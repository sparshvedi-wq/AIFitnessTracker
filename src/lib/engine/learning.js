// How exercises suit this person, learned from explicit answers and from what
// actually happened in saved sessions.
//
// Signals are kept separate and never collapsed into one rating:
//   enjoyment   would they choose it again (explicit) / prefer something else (inferred)
//   comfort     reported discomfort; explicit reports restrict until a retry
//   difficulty  how hard the movement felt (explicit)
//   confidence  how secure the movement felt (explicit)
//   setup       equipment/setup friction, per place
//   acceptance  done as planned vs skipped or swapped away (the exploration reward)
//   performance comparable logged results (engine/progression.js)
//   reasons     why it was skipped or substituted
//
// Explicit evidence (answers the person gave) is labelled separately from
// inferred evidence (patterns in skips and swaps). Inferred evidence fades;
// one skip is weak. Dismissed questions add no evidence at all. Every signal
// is reversible: a reset ignores earlier evidence and a retry lifts
// restrictions while the exercise is tried again.
import { LEARNING } from './config.js'
import { realHistory, recordOutcome, recordTime } from './ledger.js'

const DAY = 86400000
export const LEARNING_VERSION = 1

export const QUESTIONS = {
  feel: {
    prompt: 'How did that movement feel?',
    answers: [
      ['good', 'Good'],
      ['hard-fine', 'Hard, but fine'],
      ['uncomfortable', 'Uncomfortable'],
      ['unsure', 'Not sure'],
    ],
  },
  again: {
    prompt: 'Would you choose this one again?',
    answers: [
      ['yes', 'Yes'],
      ['maybe', 'Sometimes'],
      ['no', 'Rather not'],
      ['unsure', 'Not sure'],
    ],
  },
  setup: {
    prompt: 'Was the setup awkward, or was the movement uncomfortable?',
    answers: [
      ['setup', 'Setup was awkward'],
      ['movement', 'Movement was uncomfortable'],
      ['neither', 'Neither'],
      ['unsure', 'Not sure'],
    ],
  },
  effort: {
    prompt: 'How hard was it with that weight?',
    answers: [
      ['easy', 'Easier than expected'],
      ['right', 'About right'],
      ['hard', 'Harder than expected'],
      ['unsure', 'Not sure'],
    ],
  },
}
const VALID_VALUES = Object.fromEntries(Object.entries(QUESTIONS).map(([k, q]) => [k, q.answers.map((a) => a[0])]))
// 'anchor' is "this is my working weight" (or, without numbers, "recalibrate"):
// the strength model starts again from it (src/lib/strength/model.js).
const EVENT_KINDS = ['answer', 'retry', 'reset', 'dismiss', 'anchor', 'load-limit']

// An anchor keeps its numbers only when they are sane; broken numbers drop the event.
function anchorFields(e) {
  const hasNumbers = e.reps !== undefined || e.weight !== undefined
  if (!hasNumbers) return {}
  const reps = Number(e.reps)
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return null
  if (e.weight !== undefined && !(Number.isFinite(e.weight) && e.weight > 0 && e.weight <= 10000)) return null
  if (e.weight !== undefined && !['lb', 'kg'].includes(e.unit)) return null
  return {
    reps,
    ...(e.weight !== undefined ? { weight: e.weight, unit: e.unit } : {}),
    // Numbers given as a starting point inform related exercises too.
    ...(e.scope === 'baseline' ? { scope: 'baseline' } : {}),
  }
}

/** Whitelists and bounds saved learning data; corrupt entries are dropped. */
export function normalizeLearning(raw) {
  const events = Array.isArray(raw?.events) ? raw.events : []
  const clean = events
    .filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        EVENT_KINDS.includes(e.kind) &&
        typeof e.exId === 'string' &&
        e.exId.length <= 120 &&
        Number.isFinite(e.at) &&
        (e.kind !== 'answer' || VALID_VALUES[e.question]?.includes(e.value)) &&
        (e.kind !== 'anchor' || anchorFields(e) !== null) &&
        (e.kind !== 'load-limit' || (Number.isFinite(e.weight) && e.weight > 0 && e.weight <= 10000 && ['lb','kg'].includes(e.unit))),
    )
    .map((e) => ({
      id: typeof e.id === 'string' ? e.id.slice(0, 80) : `${e.kind}-${e.at}-${e.exId}`,
      kind: e.kind,
      exId: e.exId,
      at: e.at,
      ...(e.kind === 'anchor' ? anchorFields(e) : {}),
      ...(e.kind === 'load-limit' ? { weight: e.weight, unit: e.unit } : {}),
      ...(e.question ? { question: e.question } : {}),
      ...(e.value ? { value: e.value } : {}),
      ...(typeof e.place === 'string' ? { place: e.place.slice(0, 80) } : {}),
      ...(typeof e.workoutId === 'string' ? { workoutId: e.workoutId.slice(0, 80) } : {}),
      // Optional words the person added; kept on this device only.
      ...(typeof e.detail === 'string' && e.detail.trim() ? { detail: e.detail.trim().slice(0, 140) } : {}),
    }))
    .sort((a, b) => a.at - b.at)
  const recent = clean.slice(-LEARNING.maxEvents)
  // Preserve the latest durable decisions even after questions leave the recent log.
  const retained = new Map()
  for (const event of clean.slice(0, clean.length - recent.length)) {
    let key = event.kind
    if (['dismiss', 'load-limit'].includes(event.kind)) continue
    if (event.kind === 'answer') {
      if (event.question === 'feel' && event.value === 'uncomfortable' ||
          event.question === 'setup' && event.value === 'movement') key = 'comfort-report'
      else if (event.question === 'feel' && ['good', 'hard-fine'].includes(event.value)) key = 'comfort-clear'
      else if (event.question === 'again' && event.value !== 'unsure') key = 'preference'
      else continue
    }
    retained.set(JSON.stringify([event.exId, key]), event)
  }
  return { version: LEARNING_VERSION, events: [...retained.values()].sort((a,b) => a.at-b.at).concat(recent) }
}

let counter = 0
const eventId = (kind, at) => `${kind}-${at.toString(36)}-${(counter++).toString(36)}`
export const answerEvent = ({ exId, question, value, place, workoutId, detail, at }) => ({
  id: eventId('answer', at),
  kind: 'answer',
  exId,
  question,
  value,
  ...(place ? { place } : {}),
  ...(workoutId ? { workoutId } : {}),
  ...(detail ? { detail } : {}),
  at,
})
export const dismissEvent = ({ exId, question, workoutId, at }) => ({
  id: eventId('dismiss', at),
  kind: 'dismiss',
  exId,
  question,
  ...(workoutId ? { workoutId } : {}),
  at,
})
export const retryEvent = ({ exId, at }) => ({ id: eventId('retry', at), kind: 'retry', exId, at })
/** "My working weight is W for R reps" (or, without numbers, start learning again). */
export const anchorEvent = ({ exId, at, weight, reps, unit, scope }) => ({
  id: eventId('anchor', at),
  kind: 'anchor',
  exId,
  at,
  ...(reps !== undefined ? { reps } : {}),
  ...(weight !== undefined ? { weight, unit } : {}),
  ...(scope === 'baseline' && reps !== undefined ? { scope } : {}),
})
export const resetEvent = ({ exId = '*', at }) => ({ id: eventId('reset', at), kind: 'reset', exId, at })

/** Adds one event, replacing an earlier answer to the same question for the same workout. */
export function withLearningEvent(learning, event) {
  const current = normalizeLearning(learning)
  const events = current.events.filter(
    (e) =>
      !(
        event.kind === 'answer' &&
        e.kind === 'answer' &&
        e.exId === event.exId &&
        e.question === event.question &&
        e.workoutId &&
        e.workoutId === event.workoutId
      ),
  )
  return normalizeLearning({ ...current, events: [...events, event] })
}

function blank(exId) {
  return {
    exId,
    enjoyment: { score: 0, explicit: null, inferredNegative: 0, inferredPositive: 0, dislikeSkips: 0, evidence: 0 },
    comfort: { status: 'unknown', reports: 0, restricted: false, since: null },
    difficulty: null,
    confidence: null,
    setup: { awkwardHere: false, awkwardElsewhere: false, reportsHere: 0 },
    acceptance: { accepted: 0, rejected: 0 },
    completions: 0,
    completionsHere: 0,
    skips: {},
    substitutedAwayHere: 0,
    chosenAsSubstituteHere: 0,
    retryActive: false,
    explicitDislike: false,
    lastDoneAt: 0,
    // When fully completed sessions happened (to let later, comfortable work
    // outweigh an older "hard" or "uncomfortable" report).
    completedAts: [],
    difficultyAt: 0,
    sources: { explicit: 0, inferred: 0 },
  }
}

// An answer about how hard a weight felt is about that session's weight. The
// next completed session's own logged sets are newer evidence, so the answer
// stops holding the load after that, and after four weeks in any case.
const DIFFICULTY_DAYS = 28
// Two completed sessions after a soft comfort report (no new report) clear it.
const COMFORT_CLEARING_SESSIONS = 2

/**
 * Per-exercise signals for planning at `place`.
 * @returns {Map<string, ReturnType<typeof blank>>}
 */
export function exerciseSignals(state, { now, today, place = null } = {}) {
  const signals = new Map()
  const get = (id) => signals.get(id) || signals.set(id, blank(id)).get(id)
  let learning
  try {
    learning = normalizeLearning(state.learning)
  } catch {
    learning = normalizeLearning(null)
  }
  // Resets and retries define where evidence starts counting.
  const resetAt = {}
  const retryAt = {}
  for (const e of learning.events) {
    if (e.at > now) continue
    if (e.kind === 'reset') resetAt[e.exId] = Math.max(resetAt[e.exId] || 0, e.at)
    if (e.kind === 'retry') retryAt[e.exId] = Math.max(retryAt[e.exId] || 0, e.at)
  }
  const counts = (exId, at) => at > Math.max(resetAt[exId] || 0, resetAt['*'] || 0)
  const fade = (at) => Math.pow(0.5, Math.max(0, now - at) / (LEARNING.inferredHalfLifeDays * DAY))

  // Inferred evidence from saved sessions.
  let history = []
  try {
    history = realHistory(state.workouts || [], today)
  } catch {
    history = []
  }
  for (const record of history) {
    const feedbackOnly = ['sport', 'recovery'].includes(record.kind)
    const at = recordTime(record)
    if (!Number.isFinite(at) || at > now) continue
    const here = place && record.location === place
    let outcome
    try {
      outcome = recordOutcome(record)
    } catch {
      continue
    }
    for (const o of outcome.exercises || []) {
      if (!o?.exId || !counts(o.exId, at)) continue
      if (feedbackOnly) {
        if (o.reason === 'discomfort' && (o.status === 'skipped' || (o.status === 'partial' && o.deliberate))) {
          const signal = get(o.exId)
          signal.comfort.reports++
          signal.comfort.since = Math.max(signal.comfort.since || 0, at)
          signal.skips.discomfort = (signal.skips.discomfort || 0) + 1
          signal.sources.explicit++
        }
        continue
      }
      const s = get(o.exId)
      const w = fade(at)
      if (o.doneWork > 0) {
        s.completions++
        if (here) s.completionsHere++
        s.lastDoneAt = Math.max(s.lastDoneAt, at)
      }
      if (o.status === 'complete') {
        s.acceptance.accepted += here || !place ? 1 : 0.6
        s.completedAts.push(at)
      }
      if (o.swappedFrom && o.doneWork > 0 && counts(o.swappedFrom, at)) {
        const from = get(o.swappedFrom)
        if (here) {
          from.substitutedAwayHere += w
          s.chosenAsSubstituteHere += w
        }
        from.acceptance.rejected += (here || !place ? 1 : 0.6) * w
        s.enjoyment.inferredPositive += 0.5 * w
        s.sources.inferred++
        from.sources.inferred++
      }
      if (o.status === 'skipped' || (o.status === 'partial' && o.deliberate)) {
        const reason = o.reason || 'unknown'
        s.skips[reason] = (s.skips[reason] || 0) + 1
        if (reason === 'dislike' && at >= now - LEARNING.inferredWindowDays * DAY) {
          s.enjoyment.inferredNegative += w
          s.enjoyment.dislikeSkips++
          s.acceptance.rejected += (here || !place ? 1 : 0.6) * w
          s.sources.inferred++
        } else if (reason === 'discomfort') {
          // The person said it hurt: that is an explicit report, not an inference.
          s.comfort.reports++
          s.comfort.since = Math.max(s.comfort.since || 0, at)
          s.sources.explicit++
        } else if (reason === 'equipment') {
          if (here) {
            s.setup.reportsHere++
            s.setup.awkwardHere = true
          } else s.setup.awkwardElsewhere = true
          s.sources.inferred++
        }
      }
    }
  }

  // Explicit answers.
  for (const e of learning.events) {
    if (e.kind !== 'answer' || !counts(e.exId, e.at) || e.at > now) continue
    const s = get(e.exId)
    const here = !place || !e.place || e.place === place
    s.sources.explicit++
    if (e.question === 'again') {
      s.enjoyment.explicit = e.value === 'unsure' ? s.enjoyment.explicit : e.value
      if (e.value === 'yes') s.acceptance.accepted += 2
      if (e.value === 'no') s.acceptance.rejected += 2
    }
    if (e.question === 'feel') {
      if (e.value === 'uncomfortable') {
        s.comfort.reports++
        s.comfort.since = Math.max(s.comfort.since || 0, e.at)
      } else if (e.value === 'good' || e.value === 'hard-fine') {
        // A comfortable report after a retry clears the earlier concern.
        if (s.comfort.since && e.at > s.comfort.since) s.comfort.cleared = e.at
        if (s.comfort.status === 'unknown') s.comfort.status = 'ok'
      }
      if (e.value === 'hard-fine') {
        s.difficulty = 'hard'
        s.difficultyAt = e.at
      }
    }
    if (e.question === 'setup') {
      if (e.value === 'setup') {
        if (here) {
          s.setup.reportsHere++
          s.setup.awkwardHere = true
        } else s.setup.awkwardElsewhere = true
      }
      if (e.value === 'movement') {
        s.comfort.reports++
        s.comfort.since = Math.max(s.comfort.since || 0, e.at)
      }
      if (e.value === 'neither') {
        s.setup.awkwardHere = here ? false : s.setup.awkwardHere
      }
    }
    if (e.question === 'effort' && e.value !== 'unsure') {
      s.difficulty = e.value
      s.difficultyAt = e.at
    }
  }

  // Favourites are an explicit positive preference.
  for (const id of state.settings?.favoriteExercises || []) {
    const s = get(id)
    s.enjoyment.explicit = s.enjoyment.explicit || 'yes'
  }

  for (const s of signals.values()) {
    const retry = retryAt[s.exId] && counts(s.exId, retryAt[s.exId]) ? retryAt[s.exId] : 0
    s.retryActive = Boolean(retry && (!s.comfort.since || retry > s.comfort.since))
    const reportedAfterRetry = s.comfort.since && s.comfort.since > retry
    const cleared = s.comfort.cleared && s.comfort.cleared > (s.comfort.since || 0)
    s.comfort.restricted = Boolean(s.comfort.reports && reportedAfterRetry && !cleared)
    // A "Good" answer, or a couple of complete sessions since the report with
    // nothing new reported, settles a soft concern; the history stays.
    const comfortableSince = s.completedAts.filter((t) => t > (s.comfort.since || 0)).length
    const settled = cleared || comfortableSince >= COMFORT_CLEARING_SESSIONS
    s.comfort.status = s.comfort.restricted
      ? 'restricted'
      : s.comfort.reports && !settled
        ? 'some'
        : s.comfort.reports
          ? 'ok'
          : s.comfort.status
    // "Harder than expected" holds the load for the next session only.
    if (
      s.difficulty === 'hard' &&
      (s.completedAts.some((t) => t > s.difficultyAt) || now - s.difficultyAt > DIFFICULTY_DAYS * DAY)
    )
      s.difficulty = null
    s.explicitDislike = s.enjoyment.explicit === 'no' && !s.retryActive
    // Counted by occurrence within the window; one skip stays weak.
    const inferred =
      s.enjoyment.dislikeSkips >= LEARNING.inferredDislikeThreshold
        ? -0.5
        : -0.15 * s.enjoyment.inferredNegative
    const positive = Math.min(0.3, 0.15 * s.enjoyment.inferredPositive)
    const explicit = { yes: 1, maybe: 0.2, no: -1 }[s.enjoyment.explicit] ?? null
    s.enjoyment.score = explicit !== null ? explicit : Math.max(-1, Math.min(1, inferred + positive))
    s.enjoyment.evidence = s.sources.explicit + s.sources.inferred
  }
  return signals
}

/** Plain-language list of what has been learned about one exercise (for the guide sheet). */
export function learnedSummary(signal) {
  if (!signal) return []
  const out = []
  if (signal.enjoyment.explicit === 'yes') out.push({ code: 'liked', text: 'You said you’d choose it again.' })
  if (signal.enjoyment.explicit === 'no')
    out.push({ code: 'disliked', text: 'You said you’d rather not do it. It isn’t suggested.' })
  if (!signal.enjoyment.explicit && signal.enjoyment.dislikeSkips >= LEARNING.inferredDislikeThreshold)
    out.push({ code: 'skipped', text: 'You’ve skipped it for something else a few times, so it comes up less.' })
  if (signal.comfort.restricted)
    out.push({ code: 'discomfort', text: 'You reported discomfort, so it isn’t suggested.' })
  if (signal.retryActive) out.push({ code: 'retry', text: 'You chose to try it again.' })
  if (signal.setup.awkwardHere) out.push({ code: 'setup', text: 'Setup was awkward at this place.' })
  if (signal.chosenAsSubstituteHere >= 2)
    out.push({ code: 'substitute', text: 'You’ve chosen it as a swap here more than once.' })
  return out
}
