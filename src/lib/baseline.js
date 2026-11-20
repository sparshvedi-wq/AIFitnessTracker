// The starting-point session: a short, guided first workout that finds out
// what someone can lift, one movement at a time.
//
// For each movement: pick a weight, do one set stopping with about two reps
// left (never past 15), say how many reps and how many more were possible.
// A second set is added only when the first says little (far too light, or
// too heavy to read). The answers are saved as an ordinary workout, so the
// strength model (src/lib/strength) learns from them like any other session
// and fills in every related exercise. Someone who already knows their
// numbers can type them instead; nothing here is required.
//
// Pure functions: the session lives in state.activeWorkout like any workout.
import { findExercise } from './exercises.js'
import { metaOf } from './catalog/index.js'
import { uid } from './id.js'
import { profileOf, readinessOf } from './planner.js'
import { quietAt, resolvePlace } from './places.js'
import { movementPreferences } from './movement-preferences.js'
import { EXPERIENCE_LEVEL, ineligibility, placeCapabilities, placeSupports } from './engine/eligibility.js'
import { anchorEvent, exerciseSignals } from './engine/learning.js'
import { isWorkingSet } from './milestones.js'
import { BASELINE, RESERVE_FEEL } from './strength/config.js'
import { exerciseProfile } from './strength/library.js'
import { startingWeights } from './strength/index.js'
import { finish, fmtNum, loadReady } from './workout.js'

export const BASELINE_NAME = 'Starting point'
export const BASELINE_MINUTES = 30

// One movement per slot, the first that fits the place, equipment and level.
// `gentle` is for someone starting out (machines and dumbbells before
// barbells); `trained` for everyone else. Heavy barbell deadlifts are left
// out on purpose: a first-day test is not the place for them.
const SLOTS = [
  {
    id: 'legs',
    label: 'Legs',
    gentle: ['leg-press', 'goblet-squat', 'db-sumo-squat', 'bodyweight-squat'],
    trained: ['back-squat', 'leg-press', 'hack-squat', 'goblet-squat', 'bodyweight-squat'],
  },
  {
    id: 'push',
    label: 'Pushing',
    gentle: [
      'machine-chest-press',
      'db-bench',
      'db-floor-press',
      'kb-floor-press',
      'push-up',
      'kneeling-push-up',
      'incline-push-up',
    ],
    trained: [
      'bench-press',
      'db-bench',
      'machine-chest-press',
      'db-floor-press',
      'kb-floor-press',
      'push-up',
      'kneeling-push-up',
    ],
  },
  {
    id: 'row',
    label: 'Pulling',
    gentle: ['machine-row', 'cable-row', 'db-row', 'db-chest-supported-row', 'kb-row', 'suspension-row'],
    trained: [
      'cable-row',
      'machine-row',
      'db-row',
      'barbell-row',
      'db-bent-over-row',
      'kb-row',
      'suspension-row',
    ],
  },
  {
    id: 'hinge',
    label: 'Hips and back of legs',
    gentle: ['kb-deadlift', 'db-hip-thrust', 'db-glute-bridge', 'hip-thrust', 'glute-bridge'],
    trained: ['rdl', 'db-rdl', 'kb-deadlift', 'kb-rdl', 'db-hip-thrust', 'hip-thrust', 'glute-bridge'],
  },
  {
    id: 'overhead',
    label: 'Shoulders',
    gentle: ['machine-shoulder-press', 'db-seated-press'],
    trained: [
      'ohp',
      'db-overhead-press',
      'db-seated-press',
      'machine-shoulder-press',
      'kb-strict-press',
      'pike-push-up',
    ],
  },
  {
    id: 'pulldown',
    label: 'Pulling down',
    gentle: ['lat-pulldown', 'assisted-pull-up', 'machine-high-row', 'single-arm-pulldown'],
    trained: ['lat-pulldown', 'assisted-pull-up', 'pull-up', 'machine-high-row', 'single-arm-pulldown'],
  },
  {
    id: 'curl',
    label: 'Arms',
    gentle: ['biceps-curl', 'cable-curl', 'machine-curl', 'barbell-curl', 'db-hammer-curl'],
    trained: ['biceps-curl', 'barbell-curl', 'cable-curl', 'machine-curl', 'db-hammer-curl'],
  },
  // Only when fewer than `FULL` movements fit (little or no equipment).
  {
    id: 'triceps',
    label: 'Back of arms',
    filler: true,
    gentle: ['triceps-pushdown', 'machine-triceps-extension', 'db-overhead-triceps-extension'],
    trained: ['triceps-pushdown', 'machine-triceps-extension', 'db-overhead-triceps-extension', 'bench-dip'],
  },
  {
    id: 'lunge',
    label: 'Single leg',
    filler: true,
    gentle: ['reverse-lunge', 'split-squat'],
    trained: ['reverse-lunge', 'split-squat'],
  },
  {
    id: 'calf',
    label: 'Calves',
    filler: true,
    gentle: ['bodyweight-calf-raise'],
    trained: ['bodyweight-calf-raise'],
  },
  // A hold to finish: a personal mark, though the strength model does not use it.
  {
    id: 'core',
    label: 'Core',
    last: true,
    gentle: ['plank', 'kneeling-side-plank'],
    trained: ['plank', 'side-plank'],
  },
]
const FULL = 7

const isWork = (s) => s && s.kind !== 'warmup'

/** A saved choice takes precedence over the usual session length. */
export function preferShortFirstSession(profile) {
  if (profile.firstSessionMode) return profile.firstSessionMode === 'training'
  if (profile.baseline?.status === 'skipped') return true
  return !profile.flexibleTime && profile.minutes > 0 && profile.minutes < BASELINE_MINUTES
}

export function baselineDue(state, today) {
  const readiness = readinessOf(state, today)
  if (readiness.unwell || readiness.rest) return false
  const training = state?.settings?.training || {}
  if (!training.completed || training.baseline?.status) return false
  if (state.activeWorkout) return false
  return !(state.workouts || []).some(
    (w) =>
      !w.sample &&
      !['sport', 'recovery', 'pump'].includes(w.kind) &&
      (w.exercises || []).some((e) => (e.sets || []).some(isWorkingSet)),
  )
}

/** The movements a starting point would use at a place, with swaps for each. */
export function baselineMoves(state, { today, now = Date.now(), location } = {}) {
  const p = profileOf(state)
  const r = readinessOf(state, today)
  const place = resolvePlace(p, location || p.location)
  const movement = movementPreferences(p, place.id)
  if (r.unwell || r.rest) return { moves: [], place, movement }
  const ctx = {
    kind: movement?.position === 'seated' ? 'seated' : 'strength',
    caps: placeCapabilities(place),
    supports: placeSupports(place, movement),
    movement,
    quiet: quietAt(p, place.id),
    level: EXPERIENCE_LEVEL[p.experience] ?? 0,
    excluded: new Set(p.excludedExercises || []),
    blockedAreas: new Set([...(r.pain || []), ...(r.sore || [])]),
    signals: exerciseSignals(state, { now, today, place: place.id }),
  }
  const list = (slot) =>
    (ctx.level === 0 ? slot.gentle : slot.trained).filter((id) => {
      const meta = metaOf(id)
      return meta && findExercise(id) && !ineligibility(meta, ctx)
    })
  const picked = []
  const add = (slot) => {
    const fits = list(slot)
    if (fits.length)
      picked.push({ slot: slot.id, label: slot.label, exId: fits[0], alternatives: fits.slice(1) })
  }
  for (const slot of SLOTS.filter((s) => !s.filler && !s.last)) add(slot)
  for (const slot of SLOTS.filter((s) => s.filler)) if (picked.length < FULL) add(slot)
  for (const slot of SLOTS.filter((s) => s.last)) add(slot)
  return { moves: picked, place, movement }
}

function sessionExercise(move, customExercises = []) {
  const def = findExercise(move.exId, customExercises)
  const meta = metaOf(move.exId)
  return {
    key: uid(),
    exId: def.id,
    name: def.name,
    muscle: def.muscle,
    type: def.type,
    weighted: def.weighted,
    cues: def.cues || [],
    restSec: 0,
    unilateral: Boolean(meta?.perSide && def.type === 'reps'),
    slot: move.slot,
    slotLabel: move.label,
    alternatives: move.alternatives || [],
    sets: [blankSet()],
    last: null,
    note: null,
    up: false,
  }
}
const blankSet = (weight = null) => ({
  targetReps: null,
  targetSec: null,
  targetWeight: weight,
  reps: null,
  sec: null,
  weight,
  status: 'todo',
  kind: 'work',
})

/** A new starting-point session, or null when nothing fits the place. */
export function buildBaselineSession(state, { today, now = Date.now(), location } = {}) {
  const { moves, place, movement } = baselineMoves(state, { today, now, location })
  if (!moves.length) return null
  const exercises = moves.map((m) => sessionExercise(m, state.customExercises))
  return {
    id: uid(),
    routineId: 'baseline',
    name: BASELINE_NAME,
    kind: 'baseline',
    focus: '',
    reasons: [],
    planning: { purpose: 'baseline', date: today },
    requestedMinutes: BASELINE_MINUTES,
    location: place.id,
    placeName: place.name,
    readiness: null,
    equipmentProfile: null,
    movement,
    schedule: null,
    circuit: false,
    unit: state.settings.weightUnit,
    startedAt: null,
    pausedMs: 0,
    pausedAt: null,
    exercises,
    cursor: { ex: 0, set: 0 },
    phase: 'work',
    phaseEndsAt: null,
    phaseLeft: null,
    phaseTotal: 0,
    introSeen: false,
    baseline: { step: 'intro' },
  }
}

// ── Moving through the session ──────────────────────────────────────────

const cur = (session) => {
  const c = session.cursor
  const ex = c ? session.exercises[c.ex] : null
  return ex ? { c, ex, set: ex.sets[c.set] } : null
}
const patchSet = (session, c, patch) => ({
  ...session,
  exercises: session.exercises.map((e, i) =>
    i !== c.ex ? e : { ...e, sets: e.sets.map((s, j) => (j === c.set ? { ...s, ...patch } : s)) },
  ),
})
const patchEx = (session, index, patch) => ({
  ...session,
  exercises: session.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)),
})
const withStep = (session, step, more = {}) => ({ ...session, baseline: { ...more, step } })

/** How an exercise is measured: 'load' (weight and reps), 'reps' or 'time'. */
export function baselineMode(ex) {
  if (!ex) return null
  if (ex.type === 'time') return 'time'
  return ex.weighted ? 'load' : 'reps'
}

function stepAt(session) {
  const here = cur(session)
  if (!here || !here.set || here.set.status !== 'todo') return 'results'
  return baselineMode(here.ex) === 'load' && !loadReady(here.ex, here.set) ? 'pick' : 'do'
}

/** Leaving the intro starts the clock. */
export function beginBaseline(session, now = Date.now()) {
  if (session.baseline?.step !== 'intro') return session
  const next = {
    ...session,
    introSeen: true,
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
    lastActivityAt: now,
  }
  return withStep(next, stepAt(next))
}

/** Moves to the next movement with a set to do, or to the results. */
function advance(session, now) {
  const order = session.exercises
    .map((e, i) => ({ i, set: e.sets.findIndex((s) => s.status === 'todo') }))
    .filter((x) => x.set >= 0)
  const from = session.cursor?.ex ?? -1
  const next = order.find((x) => x.i > from) || order[0]
  if (!next) return withStep({ ...finish(session, now), cursor: session.cursor }, 'results')
  const moved = { ...session, cursor: { ex: next.i, set: next.set } }
  return withStep(moved, stepAt(moved))
}

/** Chooses (or changes) the weight for the set about to be done. */
export function pickBaselineWeight(session, weight) {
  const here = cur(session)
  const w = Number(weight)
  if (!here || here.set.status !== 'todo' || !Number.isFinite(w) || w < 0) return session
  const next = patchSet(session, here.c, { weight: w, targetWeight: w })
  return withStep(next, loadReady(here.ex, next.exercises[here.c.ex].sets[here.c.set]) ? 'do' : 'pick')
}

/** Back to the weight choice for the set about to be done. */
export function repickBaselineWeight(session) {
  const here = cur(session)
  if (!here || baselineMode(here.ex) !== 'load' || here.set.status !== 'todo') return session
  return withStep(session, 'pick')
}

/** "Too heavy": fewer than a handful of good reps. Remembered, then a lighter pick. */
export function baselineTooHeavy(session, now = Date.now()) {
  const here = cur(session)
  if (!here || baselineMode(here.ex) !== 'load' || !loadReady(here.ex, here.set)) return session
  const workIndex = here.ex.sets.slice(0, here.c.set).filter(isWork).length
  const attempt = {
    weight: here.set.weight,
    unit: session.unit,
    setIndex: workIndex,
    at: now,
    reps: BASELINE.tooFewReps,
  }
  const next = patchEx(patchSet(session, here.c, { weight: null, targetWeight: null }), here.c.ex, {
    attempts: [...(Array.isArray(here.ex.attempts) ? here.ex.attempts : []), attempt],
  })
  return withStep(next, 'pick', { tooHeavy: attempt.weight })
}

/** The set is done: on to how many reps. */
export function finishBaselineSet(session) {
  const here = cur(session)
  if (!here || here.set.status !== 'todo') return session
  return withStep(session, 'reps')
}

/** Logs the reps done; the next question is how many were left. */
export function logBaselineReps(session, reps, now = Date.now()) {
  const here = cur(session)
  const n = Math.round(Number(reps))
  if (!here || here.set.status !== 'todo' || !Number.isFinite(n) || n < 1 || n > 100) return session
  const next = patchSet(session, here.c, { reps: n, targetReps: n, status: 'done', doneAt: now })
  return withStep({ ...next, lastLogged: { ...here.c }, lastActivityAt: now }, 'left')
}

/** Logs a timed hold (no follow-up question) and moves on. */
export function logBaselineHold(session, seconds, now = Date.now()) {
  const here = cur(session)
  const sec = Math.round(Number(seconds))
  if (!here || here.set.status !== 'todo' || !Number.isFinite(sec) || sec < 1) return session
  const next = patchSet(session, here.c, { sec, targetSec: sec, status: 'done', doneAt: now })
  return advance({ ...next, lastLogged: { ...here.c }, lastActivityAt: now }, now)
}

export const LEFT_ANSWERS = [
  [0, 'None'],
  [1, '1 or 2'],
  [3, '3 or 4'],
  [6, '5 or more'],
]

/**
 * Whether one more set would say much more than the first did, and at what
 * weight. Only for weighted movements, and only once.
 */
export function secondSetFor(session, args) {
  const here = cur(session)
  if (!here || baselineMode(here.ex) !== 'load' || here.set.status !== 'done') return null
  if (here.ex.sets.filter((s) => isWork(s) && s.status === 'done').length !== 1) return null
  const { reps, reserve, weight } = here.set
  const light = reserve >= BASELINE.secondSetAtReserve
  const heavy = reps <= BASELINE.tooFewReps && reserve <= 1
  if (!light && !heavy) return null
  const guess = startingWeights(
    { ...args, exId: here.ex.exId, reps: BASELINE.secondSetReps, rir: 2, second: true },
    session,
  )
  if (!guess) return null
  const assisted = metaOf(here.ex.exId)?.load === 'assist'
  // Heavier for a light first set, lighter for a heavy one (assistance runs the other way).
  const harder = (w) => (assisted ? w < weight - 1e-6 : w > weight + 1e-6)
  const easier = (w) => (assisted ? w > weight + 1e-6 : w < weight - 1e-6)
  const fits = light ? harder : easier
  const options = [guess.suggested, ...guess.choices].filter((w) => Number.isFinite(w) && fits(w))
  if (!options.length) return null
  return { weight: options[0], reason: light ? 'light' : 'heavy' }
}

/**
 * How many more reps were possible (0, 1, 3 or 6 for "5 or more"). Offers a second set when
 * it would help, otherwise moves on.
 * @param args strength-model arguments (workouts, learning, unit, now, …)
 */
export function answerBaselineLeft(session, answer, args, now = Date.now()) {
  const here = cur(session)
  if (!here || here.set.status !== 'done' || !(answer in RESERVE_FEEL)) return session
  const answered = patchSet(session, here.c, { feel: RESERVE_FEEL[answer], reserve: answer })
  const second = secondSetFor(answered, args)
  if (second) return withStep(answered, 'again', { second })
  return advance(answered, now)
}

/** "One more set": adds it at the suggested weight. */
export function acceptSecondSet(session) {
  const here = cur(session)
  const second = session.baseline?.second
  if (!here || session.baseline?.step !== 'again' || !second) return session
  const sets = [...here.ex.sets, blankSet(second.weight)]
  const next = { ...patchEx(session, here.c.ex, { sets }), cursor: { ex: here.c.ex, set: sets.length - 1 } }
  return withStep(next, 'do')
}

/** "That's enough": on to the next movement. */
export function declineSecondSet(session, now = Date.now()) {
  if (session.baseline?.step !== 'again') return session
  return advance(session, now)
}

/** Leaves this movement out (nothing is owed) and moves on. */
export function skipBaselineMove(session, now = Date.now()) {
  const here = cur(session)
  if (!here) return session
  const sets = here.ex.sets.map((s) => (s.status === 'todo' ? { ...s, status: 'skipped' } : s))
  return advance(patchEx(session, here.c.ex, { sets, skipReason: 'other' }), now)
}

/** Swaps the current movement for the next one that fits its slot. */
export function swapBaselineMove(session, customExercises = []) {
  const here = cur(session)
  if (!here || here.ex.sets.some((s) => s.status === 'done') || !here.ex.alternatives?.length) return session
  const [nextId, ...rest] = here.ex.alternatives
  if (!findExercise(nextId, customExercises)) return session
  const swapped = sessionExercise(
    { exId: nextId, slot: here.ex.slot, label: here.ex.slotLabel, alternatives: [...rest, here.ex.exId] },
    customExercises,
  )
  const exercises = [...session.exercises]
  exercises[here.c.ex] = swapped
  const priorAttempts = [...(session.priorAttempts || [])]
  if (here.ex.attempts?.length) priorAttempts.push({ exId: here.ex.exId, location: session.location, sets: [], attempts: here.ex.attempts })
  const next = { ...session, exercises, priorAttempts, cursor: { ex: here.c.ex, set: 0 } }
  return withStep(next, stepAt(next))
}

/** One step back within the current movement. */
export function backBaseline(session) {
  const here = cur(session)
  const step = session.baseline?.step
  if (!here) return session
  if (step === 'reps') return withStep(session, 'do')
  if (step === 'do' && baselineMode(here.ex) === 'load') return withStep(session, 'pick')
  if (step === 'left' || step === 'again') {
    const reopened = patchSet(session, here.c, {
      status: 'todo',
      reps: null,
      targetReps: null,
      feel: undefined,
      reserve: undefined,
      doneAt: undefined,
    })
    return withStep({ ...reopened, lastLogged: null }, 'reps')
  }
  return session
}

/** "Finish here": whatever is left is skipped and the results are shown. */
export function endBaseline(session, now = Date.now()) {
  const exercises = session.exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => (s.status === 'todo' ? { ...s, status: 'skipped' } : s)),
  }))
  return withStep(finish({ ...session, exercises }, now), 'results')
}

/** Movements with something logged, and the count of those still to do. */
export function baselineProgress(session) {
  const done = session.exercises.filter((e) => e.sets.some((s) => s.status === 'done')).length
  const left = session.exercises.filter((e) => e.sets.some((s) => s.status === 'todo')).length
  return {
    done,
    left,
    total: session.exercises.length,
    index: Math.min(session.exercises.length, (session.cursor?.ex ?? 0) + 1),
  }
}

/** A first-guess factor from the profile, used only before anything is known. */
export function firstGuessScale(profile, exId) {
  if (profile?.gender !== 'Woman') return 1
  const areas = exerciseProfile(exId)?.areas || {}
  const lower = (areas.Legs || 0) + (areas.Glutes || 0)
  return lower >= 0.5 ? 0.72 : 0.6
}

// ── Results ─────────────────────────────────────────────────────────────

/** What was measured, one line per movement, best set first. */
export function baselineRows(record, unit) {
  return (record?.exercises || [])
    .map((e) => {
      const sets = (e.sets || []).filter((s) => isWork(s) && (!s.status || s.status === 'done'))
      if (!sets.length) return null
      const meta = metaOf(e.exId)
      if (e.type === 'time')
        return { exId: e.exId, name: e.name, text: `${Math.max(...sets.map((s) => s.sec || 0))} s` }
      if (!e.weighted)
        return { exId: e.exId, name: e.name, text: `${Math.max(...sets.map((s) => s.reps || 0))} reps` }
      // The most informative set: the one closest to a normal working set.
      const best = [...sets].sort((a, b) => Math.abs((a.reps || 0) - 8) - Math.abs((b.reps || 0) - 8))[0]
      const suffix = meta?.load === 'assist' ? ' assistance' : meta?.load === 'hand' ? ' each' : ''
      return { exId: e.exId, name: e.name, text: `${fmtNum(best.weight)} ${unit}${suffix} × ${best.reps}` }
    })
    .filter(Boolean)
}

const AREA_WORDS = {
  Chest: 'chest',
  Back: 'back',
  Shoulders: 'shoulder',
  Biceps: 'biceps',
  Triceps: 'triceps',
  Legs: 'leg',
  Glutes: 'glute',
  Core: 'core',
}

/**
 * Plain lines about the areas that are behind, each with what the plan does
 * about it. Cautious on purpose: this is an early read that keeps updating.
 */
export function balanceNotes(balance) {
  if (!balance) return []
  return balance.areas
    .filter((a) => a.status === 'behind')
    .map((a) => ({
      area: a.id,
      text: `${a.id} is behind your other lifts${a.percent ? ` (about ${Math.abs(a.percent)}%)` : ''}.`,
      fix: `Your plans give ${AREA_WORDS[a.id] || a.id.toLowerCase()} work a little more room each week until it catches up.`,
    }))
}

// ── "I know my numbers" ─────────────────────────────────────────────────

/**
 * Typed numbers as learning events. Each is "a weight I can lift for these
 * reps with about two left"; blank rows are simply left out and estimated
 * from the rest.
 * @param entries [{ exId, weight, reps }]
 */
export function baselineAnchors(entries, { unit, at = Date.now() } = {}) {
  const events = []
  for (const [i, entry] of (entries || []).entries()) {
    const def = findExercise(entry?.exId)
    const profile = def ? exerciseProfile(def.id, def) : null
    if (!profile?.tie) continue
    const reps = Math.round(Number(entry.reps))
    if (!Number.isInteger(reps) || reps < 1 || reps > 100) continue
    const weight = Number(String(entry.weight ?? '').replace(',', '.'))
    if (profile.mode === 'bodyweight')
      events.push(anchorEvent({ exId: def.id, at: at + i, reps, scope: 'baseline' }))
    else if (Number.isFinite(weight) && weight > 0 && weight <= 10000)
      events.push(
        anchorEvent({
          exId: def.id,
          at: at + i,
          reps,
          weight: Math.round(weight * 1000) / 1000,
          unit,
          scope: 'baseline',
        }),
      )
  }
  return events
}
