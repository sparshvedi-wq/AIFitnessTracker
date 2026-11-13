// Guided workout logic — pure functions, no React.
//
// A routine is the plan: { id, name, circuit, items: [{ exId, sets, reps | sec, weight?, restSec }] }
// A session is a routine in progress (state.activeWorkout). It's built from a
// routine plus history, so targets already include progression suggestions.
// A workout is a finished session saved to state.workouts.

import { findExercise } from './exercises.js'
import { uid } from './id.js'
import { addDays, fromKey, todayKey, toKey } from './date.js'
import { DUMBBELL_MOVES, fitAvailableLoad } from './preferences.js'
import { trainingTitle } from './training-copy.js'
import { metaOf } from './catalog/index.js'
import { outcomeFromSession } from './engine/ledger.js'
import { snapLoad, strengthNote, strengthTarget, trainsAny } from './strength/index.js'
import { exerciseProfile } from './strength/library.js'
import { TEST, reserveFor } from './strength/config.js'

// Assisted machines log assistance: less is harder, and it is not lifted load.
const assisted = (exId) => metaOf(exId)?.load === 'assist'
export const isAssisted = assisted

// Whether a set has the load it needs before it can be logged. Zero
// assistance is a real (the hardest) setting; any other load must be above 0.
export function loadReady(exercise, set) {
  if (!exercise?.weighted) return true
  const w = set?.weight
  return Number.isFinite(w) && (w > 0 || (w === 0 && assisted(exercise.exId)))
}

// The load a saved routine starts from: the heaviest working load, or for an
// assisted move the least assistance, which is its hardest setting.
export function routineLoad(exercise) {
  if (!exercise.weighted) return null
  const loads = exercise.sets
    .filter((s) => s.kind !== 'warmup')
    .map((s) => s.weight)
    .filter((w) => Number.isFinite(w) && w >= 0)
  if (assisted(exercise.exId)) return loads.length ? Math.min(...loads) : null
  return Math.max(0, ...loads) || null
}

export const WEIGHT_STEP = { lb: 5, kg: 2.5 }

// ── Building a session ──────────────────────────────────────────────

// The most recent finished workout that included this exercise.
export function lastPerformance(workouts, exId, unit) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    if (workouts[i].sample || ['sport', 'pump', 'recovery'].includes(workouts[i].kind)) continue
    if (unit && workouts[i].unit && workouts[i].unit !== unit) continue
    const sets = workouts[i].exercises
      .filter((e) => e.exId === exId)
      .flatMap((e) => e.sets)
      .filter((s) => s.kind !== 'warmup')
    if (sets.length) return { date: workouts[i].date, sets }
  }
  return null
}

// Progressive overload: look at last time and nudge the target up when
// every set hit its goal.
export function suggestTarget(def, item, last, unit) {
  const target = { reps: item.reps ?? null, sec: item.sec ?? null, weight: item.weight ?? null }
  if (!last) return { target, note: null, up: false }

  const done = last.sets
  if (def.type === 'time') {
    const goal = item.sec || 0
    const hit = done.every((s) => (s.sec || 0) >= (s.targetSec ?? goal))
    if (hit && goal > 0)
      return { target: { ...target, sec: goal + 5 }, note: '5 seconds longer than last time', up: true }
    return { target, note: null, up: false }
  }

  const hitAll = done.every((s) => (s.reps || 0) >= (s.targetReps ?? item.reps ?? 0))
  if (def.weighted && assisted(def.id)) {
    // Assistance: the least used is the hardest, and progress means less help.
    const used = done.map((s) => s.weight).filter((w) => Number.isFinite(w) && w >= 0)
    if (!used.length) return { target, note: null, up: false }
    const least = Math.min(...used)
    if (hitAll && least > 0) {
      const less = Math.max(0, least - (WEIGHT_STEP[unit] || 5))
      return {
        target: { ...target, weight: less },
        note: `${fmtNum(least - less)} ${unit} less assistance: you hit every rep last time`,
        up: true,
      }
    }
    return {
      target: { ...target, weight: least },
      note: `Same assistance: aim for all ${item.reps} reps this time`,
      up: false,
    }
  }
  if (def.weighted) {
    const lastWeight = Math.max(0, ...done.map((s) => s.weight || 0))
    if (lastWeight <= 0) return { target, note: null, up: false }
    if (hitAll) {
      const step = WEIGHT_STEP[unit] || 5
      return {
        target: { ...target, weight: lastWeight + step },
        note: `Up ${step} ${unit}: you hit every rep last time`,
        up: true,
      }
    }
    return {
      target: { ...target, weight: lastWeight },
      note: `Same weight: aim for all ${item.reps} reps this time`,
      up: false,
    }
  }

  const bestReps = Math.max(0, ...done.map((s) => s.reps || 0))
  if (hitAll && bestReps >= (item.reps || 0)) {
    return { target: { ...target, reps: bestReps + 1 }, note: 'One more rep than last time', up: true }
  }
  return { target, note: null, up: false }
}

export const LOGGED_WORKOUT = 'Logged workout'

/**
 * A starting weight typed into a routine beats a guess borrowed from another
 * exercise: it only gives way once this exercise has its own history.
 */
function routineStartWins(item, adaptive) {
  return Number.isFinite(item.weight) && item.weight > 0 && ['estimated-start', 'no-history'].includes(adaptive.code)
}

/**
 * @param strength optional { learning, goal, experience, today, metrics,
 *   place } — when given, saved routines get their weights from the adaptive
 *   strength model (the same rules as daily plans), keeping each routine's
 *   own rep count. The routine's `strengthContext` (from adaptRoutineItems)
 *   carries the day's lighter signals, muscles to go easy on, past activities
 *   and held loads, so a routine is planned with everything a daily plan uses.
 */
export function buildSession(
  routine,
  { workouts = [], customExercises = [], unit = 'lb', now = Date.now(), dumbbellWeights = [], strength = null } = {},
) {
  const strengthCache = new Map()
  const day = routine.strengthContext || {}
  const lighterMuscles = new Set(routine.lighterMuscles || day.lighterMuscles || [])
  const holds = new Set(day.holds || [])
  // At most a couple of test sets are offered in one workout.
  let offers = 0
  const exercises = routine.items
    .map((item) => {
      const def = findExercise(item.exId, customExercises)
      if (!def) return null
      const last = lastPerformance(workouts, item.exId, unit)
      // Past the limit, a planned step up simply holds for today.
      const offered = (target) => (target?.offer && offers >= TEST.maxPerSession ? { ...target, offer: null } : target)
      const adaptive =
        !routine.lockedTargets && strength
          ? strengthTarget({
              exId: def.id,
              def,
              workouts,
              customExercises,
              learning: strength.learning,
              metrics: strength.metrics,
              unit,
              today: strength.today || toKey(new Date(now)),
              now,
              goal: strength.goal,
              experience: strength.experience,
              place: strength.place ?? routine.location ?? null,
              activities: strength.activities ?? day.activities,
              easy: Boolean(day.easy) || trainsAny(def.id, lighterMuscles, def),
              returning: Boolean(day.returning),
              highEffort: Boolean(day.highEffort),
              noIncrease: holds.has(def.id),
              sizes: dumbbellWeights,
              sets: item.sets,
              fixedReps: item.reps,
              cache: strengthCache,
              // A step up in weight is offered as a test set (strength/config.js TEST).
              offerIncrease: true,
            })
          : null
      const { target, note, up } = routine.lockedTargets
        ? {
            target: { reps: item.reps ?? null, sec: item.sec ?? null, weight: item.weight ?? null },
            note: item.note,
            up: false,
          }
        : adaptive && (adaptive.weight !== null || adaptive.mode === 'reps') && !routineStartWins(item, adaptive)
          ? {
              target: {
                // A first guess keeps the routine's own rep count.
                reps: adaptive.code === 'estimated-start' && isFinite(item.reps) ? item.reps : adaptive.reps,
                sec: null,
                weight: adaptive.weight,
              },
              note: strengthNote(offered(adaptive), unit),
              up: adaptive.up,
            }
          : suggestTarget(def, item, last, unit)
      if (DUMBBELL_MOVES.includes(def.id)) target.weight = fitAvailableLoad(target.weight, dumbbellWeights)
      const applied = adaptive && (adaptive.weight !== null || adaptive.mode === 'reps') && !routineStartWins(item, adaptive)
      const offer = routine.lockedTargets ? item.offer : applied ? offered(adaptive).offer : null
      if (offer) offers++
      const planned = adaptive ? { ...item, repRange: adaptive.range, targetRir: adaptive.rir, offer } : { ...item, offer }
      return makeSessionExercise(def, planned, target, { last, note, up })
    })
    .filter(Boolean)
  const kind =
    routine.kind !== 'sport' && routine.movement?.position === 'seated'
      ? 'recovery'
      : routine.kind || 'routine'
  if (!routine.circuit && !['sport', 'pump', 'recovery'].includes(kind))
    addWarmupSet(exercises, dumbbellWeights, unit)

  const session = {
    id: uid(),
    routineId: routine.id,
    name: routine.name,
    kind,
    sport: routine.sport || null,
    focus: routine.focus || '',
    reasons: routine.reasons || [],
    planning: routine.planning || null,
    requestedMinutes: routine.requestedMinutes,
    location: routine.location || null,
    // Kept with the record so History can name the place even after it's deleted.
    placeName: routine.placeName || null,
    readiness: routine.readiness || null,
    equipmentProfile: routine.equipmentProfile || null,
    movement: routine.movement || null,
    schedule: routine.schedule || null,
    // Muscles kept lighter today (a nearby practice, a very hard session).
    ...(lighterMuscles.size ? { lighterMuscles: [...lighterMuscles] } : {}),
    circuit: Boolean(routine.circuit),
    unit,
    startedAt: now,
    pausedMs: 0,
    pausedAt: null,
    exercises,
    cursor: exercises.length ? { ex: 0, set: 0 } : null,
    phase: 'ready',
    phaseEndsAt: null,
    phaseLeft: null,
    phaseTotal: 0,
  }
  return session
}

// One lighter warm-up set before the first loaded lift, at about half the
// working weight. It is saved as a warm-up and never counts toward records.
export const WARMUP_SHARE = 0.5
function addWarmupSet(exercises, dumbbellWeights = [], unit = 'lb') {
  const first = exercises.find((e) => e.weighted && e.type !== 'time' && e.sets[0]?.weight > 0 && !assisted(e.exId))
  if (!first) return
  const work = first.sets[0]
  const half = Math.round(work.weight * WARMUP_SHARE * 2) / 2
  // A weight the equipment can hold: plates on a bar, a stack step, a listed dumbbell.
  const weight = DUMBBELL_MOVES.includes(first.exId)
    ? (fitAvailableLoad(half, dumbbellWeights) ?? dumbbellWeights[0] ?? half)
    : (snapLoad({ exId: first.exId, weight: half, unit }) ?? half)
  first.sets.unshift({
    ...work,
    targetWeight: weight,
    weight,
    kind: 'warmup',
  })
}

export function makeSessionExercise(def, item, target, { last = null, note = null, up = false } = {}) {
  const sets = Array.from({ length: Math.max(1, item.sets || 1) }, () => ({
    targetReps: target.reps,
    targetSec: target.sec,
    targetWeight: target.weight,
    reps: target.reps,
    sec: target.sec,
    weight: target.weight,
    status: 'todo',
    kind: 'work',
  }))
  return {
    key: uid(),
    exId: def.id,
    name: def.name,
    muscle: def.muscle,
    type: def.type,
    weighted: def.weighted,
    cues: def.cues || [],
    restSec: item.restSec ?? 60,
    sets,
    last: last ? { date: last.date, sets: last.sets } : null,
    note,
    phaseLabel: item.phaseLabel,
    sideExtra: item.sideExtra,
    unilateral: item.unilateral,
    // The rep range and reps-in-reserve the plan aimed for (strength model).
    ...(Array.isArray(item.repRange) ? { repRange: item.repRange } : {}),
    ...(Number.isFinite(item.targetRir) ? { targetRir: item.targetRir } : {}),
    // First-weight choices estimated from related exercises (strength model).
    ...(Array.isArray(item.startChoices) && item.startChoices.length ? { startChoices: item.startChoices } : {}),
    // A test set on offer at the next weight up (strength/session.js).
    ...(item.offer && Number.isFinite(item.offer.weight) && Number.isFinite(item.offer.reps)
      ? { offer: { weight: item.offer.weight, reps: item.offer.reps, from: item.offer.from, fromReps: item.offer.fromReps } }
      : {}),
    up,
  }
}

// ── Moving through a session ────────────────────────────────────────

// Every set in the order it should be done. Normal routines go exercise by
// exercise; circuits go round by round.
export function stepOrder(session) {
  const out = []
  const { exercises } = session
  if (session.circuit) {
    const rounds = Math.max(0, ...exercises.map((e) => e.sets.length))
    for (let s = 0; s < rounds; s++) {
      exercises.forEach((e, i) => {
        if (s < e.sets.length) out.push({ ex: i, set: s })
      })
    }
  } else {
    exercises.forEach((e, i) => e.sets.forEach((_, s) => out.push({ ex: i, set: s })))
  }
  return out
}

// Next unfinished set after `from`, wrapping around to anything skipped past.
export function nextStep(session, from = session.cursor) {
  const order = stepOrder(session)
  const isTodo = (c) => session.exercises[c.ex]?.sets[c.set]?.status === 'todo'
  const at = from ? order.findIndex((c) => c.ex === from.ex && c.set === from.set) : -1
  for (let i = at + 1; i < order.length; i++) if (isTodo(order[i])) return order[i]
  for (let i = 0; i <= at && i < order.length; i++) if (isTodo(order[i])) return order[i]
  return null
}

export function setCounts(session) {
  let done = 0
  let total = 0
  for (const e of session.exercises) {
    for (const s of e.sets) {
      if (s.status !== 'skipped') total++
      if (s.status === 'done') done++
    }
  }
  return { done, total }
}

// Which round of a circuit the cursor is in (1-based), and how many there are.
export function roundInfo(session) {
  if (!session.circuit || !session.cursor) return null
  const rounds = Math.max(0, ...session.exercises.map((e) => e.sets.length))
  return { round: session.cursor.set + 1, rounds }
}

export function elapsedMs(session, now = Date.now()) {
  if (!session.startedAt || session.phase === 'prepared') return 0
  const pausedNow = session.pausedAt ? now - session.pausedAt : 0
  return Math.max(0, now - session.startedAt - session.pausedMs - pausedNow)
}

export function prepareSession(session) {
  return {
    ...session,
    phase: 'prepared',
    startedAt: null,
    pausedAt: null,
    phaseEndsAt: null,
    phaseLeft: null,
  }
}

export function beginPrepared(session, now = Date.now()) {
  if (session.phase !== 'prepared') return session
  return { ...session, startedAt: now, phase: 'work', phaseEndsAt: null, pausedAt: null, lastActivityAt: now }
}

// Leaving the first-session intro starts the clock afresh. Time spent reading
// it, including an idle pause that began there, is not training time.
export function startAfterIntro(session, now = Date.now()) {
  if (!session.startedAt) return { ...session, introSeen: true }
  return {
    ...session,
    introSeen: true,
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
    pauseReason: null,
    lastActivityAt: now,
  }
}

// Phase changes. Each returns a new session; the store just saves it.
// Timers are stored as an absolute end time so they stay right even if the
// tab sleeps or the app is minimized.

// Done: freeze the clock (as a pause) until it's saved or you keep going.
export function finish(session, now = Date.now()) {
  return { ...session, phase: 'done', phaseEndsAt: null, phaseLeft: null, pausedAt: session.pausedAt ?? now }
}

export function keepGoing(session, now = Date.now()) {
  const to = nextStep(session, null)
  if (!to) return session
  return enterWork({ ...resume(session, now), cursor: to }, now)
}

function timed(session, phase, sec, now) {
  return { ...session, phase, phaseEndsAt: now + sec * 1000, phaseTotal: sec * 1000, phaseLeft: null }
}

export function currentSet(session) {
  const c = session.cursor
  if (!c) return null
  const ex = session.exercises[c.ex]
  return ex ? { ex, set: ex.sets[c.set] } : null
}

export function startReady(session, sec, now = Date.now()) {
  if (!sec) return enterWork(session, now)
  return timed({ ...session, phase: 'ready' }, 'ready', sec, now)
}

// Move to the current set. Timed sets always wait for an explicit Start.
export function enterWork(session, now = Date.now()) {
  if (session.phase === 'prepared') return session
  const cur = currentSet(session)
  if (!cur) return finish(session, now)
  // Each timed set needs an explicit Start, including after rest/get-ready.
  return { ...session, phase: 'work', phaseEndsAt: null, phaseLeft: null, phaseTotal: 0 }
}

export function startSetTimer(session, now = Date.now()) {
  const cur = currentSet(session)
  if (!cur) return session
  return timed(session, 'work', cur.set.sec || cur.set.targetSec || 30, now)
}

function patchSet(session, c, patch) {
  const exercises = session.exercises.map((e, i) =>
    i !== c.ex ? e : { ...e, sets: e.sets.map((s, j) => (j === c.set ? { ...s, ...patch } : s)) },
  )
  return { ...session, exercises }
}

export function updateSet(session, patch) {
  return session.cursor ? patchSet(session, session.cursor, patch) : session
}

// Log the current set and move on: rest if there's more to do, else finish.
export function completeSet(session, now = Date.now(), patch = {}) {
  const c = session.cursor
  if (!c) return session
  const ex = session.exercises[c.ex]
  // When the set was logged: places it in time for recovery and learns pace.
  let next = { ...patchSet(session, c, { doneAt: now, ...patch, status: 'done' }), lastLogged: { ...c } }
  // Carry a changed weight into the sets still to come, unless you've
  // already set those yourself.
  const weight = next.exercises[c.ex].sets[c.set].weight
  if (ex.weighted && weight != null && next.exercises[c.ex].sets[c.set].kind !== 'warmup') {
    next.exercises[c.ex] = {
      ...next.exercises[c.ex],
      sets: next.exercises[c.ex].sets.map((s, j) =>
        j > c.set && s.status === 'todo' && s.kind !== 'warmup' && s.weight === s.targetWeight
          ? { ...s, weight }
          : s,
      ),
    }
  }
  const to = nextStep(next, c)
  if (!to) return session.kind === 'manual' ? { ...finish(next, now), phase: 'between' } : finish(next, now)
  next = { ...next, cursor: to }
  const rest = ex.restSec || 0
  // When rest began (and pause time so far), for the rest screen's clock.
  if (rest > 0) return { ...openRest(next), restStartedAt: now, restPausedMs: next.pausedMs || 0 }
  return enterWork(next, now)
}

// Rest has no deadline. This also clears timers on sessions saved by older versions.
export function openRest(session) {
  if (
    session.phase === 'rest' &&
    session.phaseEndsAt == null &&
    session.phaseLeft == null &&
    !session.phaseTotal
  )
    return session
  return { ...session, phase: 'rest', phaseEndsAt: null, phaseLeft: null, phaseTotal: 0 }
}

export function skipRest(session, now = Date.now()) {
  return enterWork(session, now)
}

export function undoLastSet(session, now = Date.now()) {
  const c = session.lastLogged
  if (!c || session.exercises[c.ex]?.sets[c.set]?.status !== 'done') return session
  const next = patchSet(session, c, { status: 'todo' })
  return enterWork({ ...resume(next, now), cursor: c, lastLogged: null }, now)
}

export function adjustTimer(session, deltaSec, now = Date.now()) {
  if (session.phase === 'rest') return openRest(session)
  if (session.pausedAt) {
    const left = Math.max(1000, (session.phaseLeft || 0) + deltaSec * 1000)
    return { ...session, phaseLeft: left, phaseTotal: Math.max(session.phaseTotal, left) }
  }
  if (!session.phaseEndsAt) return session
  const ends = Math.max(now + 1000, session.phaseEndsAt + deltaSec * 1000)
  return { ...session, phaseEndsAt: ends, phaseTotal: Math.max(session.phaseTotal, ends - now) }
}

export function pause(session, now = Date.now()) {
  if (session.phase === 'rest') session = openRest(session)
  if (session.pausedAt) return session
  const phaseLeft = session.phaseEndsAt ? Math.max(0, session.phaseEndsAt - now) : null
  return { ...session, pausedAt: now, phaseLeft, phaseEndsAt: null }
}

export function resume(session, now = Date.now()) {
  if (session.phase === 'rest') session = openRest(session)
  if (!session.pausedAt) return session
  const phaseEndsAt = session.phaseLeft != null ? now + session.phaseLeft : null
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + (now - session.pausedAt),
    phaseEndsAt,
    phaseLeft: null,
  }
}

// Skip what's left of the current exercise.
export function skipExercise(session, now = Date.now(), reason = 'other') {
  const c = session.cursor
  if (!c) return session
  const exercises = session.exercises.map((e, i) =>
    i !== c.ex
      ? e
      : {
          ...e,
          skipReason: reason,
          sets: e.sets.map((s) => (s.status === 'todo' ? { ...s, status: 'skipped' } : s)),
        },
  )
  const next = { ...session, exercises }
  const to = nextStep(next, c)
  if (!to) return finish(next, now)
  return enterWork({ ...next, cursor: to }, now)
}

// Bring a skipped exercise back into the plan.
export function unskipExercise(session, exIndex) {
  const exercises = session.exercises.map((e, i) =>
    i !== exIndex
      ? e
      : { ...e, sets: e.sets.map((s) => (s.status === 'skipped' ? { ...s, status: 'todo' } : s)) },
  )
  return { ...session, exercises }
}

// Add one more set to an exercise, copying its last set's numbers.
export function addSet(session, exIndex = session.cursor?.ex) {
  if (exIndex == null) return session
  const exercises = session.exercises.map((e, i) => {
    if (i !== exIndex) return e
    const last = e.sets[e.sets.length - 1]
    return { ...e, sets: [...e.sets, { ...last, status: 'todo' }] }
  })
  return { ...session, exercises }
}

export function removeExercise(session, exIndex) {
  const exercises = session.exercises.filter((_, i) => i !== exIndex)
  let cursor = session.cursor
  if (cursor && cursor.ex === exIndex) cursor = null
  else if (cursor && cursor.ex > exIndex) cursor = { ...cursor, ex: cursor.ex - 1 }
  let next = { ...session, exercises, cursor }
  if (!cursor) {
    const to = nextStep(next, null)
    next = to ? enterWork({ ...next, cursor: to }, Date.now()) : finish(next)
  }
  return next
}

export function appendExercise(session, exercise) {
  const exercises = [...session.exercises, exercise]
  const next = { ...session, exercises }
  // A finished workout with a new exercise added picks back up there.
  if (['done', 'between'].includes(session.phase) || !session.cursor) {
    const now = Date.now()
    const resumed = next.startedAt
      ? resume(next, now)
      : { ...next, startedAt: now, pausedAt: null, pausedMs: 0 }
    return enterWork({ ...resumed, cursor: { ex: exercises.length - 1, set: 0 } }, now)
  }
  return next
}

// Jump straight to any set (from the overview list).
export function jumpTo(session, c, now = Date.now()) {
  const target = session.exercises[c.ex]?.sets[c.set]
  if (!target || target.status !== 'todo') return session
  let next = session.phase === 'done' ? resume(session, now) : session
  return enterWork({ ...next, cursor: c }, now)
}

// Advance when a timer runs out. Returns the same object when nothing changed.
export function tick(session, now = Date.now()) {
  if (session.phase === 'rest') return openRest(session)
  if (session.pausedAt || !session.phaseEndsAt || now < session.phaseEndsAt) return session
  if (session.phase === 'ready') return enterWork(session, now)
  if (session.phase === 'work') {
    const cur = currentSet(session)
    return completeSet(session, now, { sec: cur?.set.sec || cur?.set.targetSec })
  }
  return session
}

// ── Finishing ───────────────────────────────────────────────────────

export function totals(exercises) {
  let sets = 0
  let reps = 0
  let volume = 0
  let seconds = 0
  let warmupSets = 0
  for (const e of exercises) {
    for (const s of e.sets) {
      if (s.status && s.status !== 'done') continue
      if (s.kind === 'warmup') {
        warmupSets++
        continue
      }
      sets++
      if (e.type === 'time') seconds += s.sec || 0
      else {
        reps += s.reps || 0
        // Weight actually lifted: both dumbbells for two-handed per-hand moves
        // (from the exercise library); assistance is not lifted weight.
        if (e.weighted && !assisted(e.exId)) volume += (s.reps || 0) * (s.weight || 0) * handsOf(e.exId)
      }
    }
  }
  return { sets, reps, volume: Math.round(volume), seconds, warmupSets }
}

// Two dumbbells logged "per hand" are both lifted.
const HANDS = new Map()
function handsOf(exId) {
  if (!HANDS.has(exId)) {
    const ext = exerciseProfile(exId)?.ext
    HANDS.set(exId, ext === 2 && metaOf(exId)?.load === 'hand' ? 2 : 1)
  }
  return HANDS.get(exId)
}

/** Weight lifted in a saved workout, worked out from its sets (old records included). */
export function workoutVolume(w) {
  return Array.isArray(w?.exercises) ? totals(w.exercises).volume : w?.totals?.volume || 0
}

// Epley estimate of a one-rep max.
export const oneRepMax = (weight, reps) => (reps > 0 && weight > 0 ? weight * (1 + reps / 30) : 0)

export function bestLifts(workouts, exId) {
  let weight = 0
  let e1rm = 0
  let reps = 0
  let sec = 0
  // For assisted moves the best is the least assistance used for a working set.
  let assistance = null
  for (const w of workouts) {
    if (w.sample || ['sport', 'pump', 'recovery'].includes(w.kind)) continue
    for (const e of w.exercises) {
      if (e.exId !== exId) continue
      for (const s of e.sets) {
        if (s.kind === 'warmup') continue
        if (assisted(exId)) {
          if ((s.reps || 0) > 0) assistance = Math.min(assistance ?? Infinity, s.weight || 0)
        } else {
          weight = Math.max(weight, s.weight || 0)
          e1rm = Math.max(e1rm, oneRepMax(s.weight || 0, s.reps || 0))
        }
        reps = Math.max(reps, s.reps || 0)
        sec = Math.max(sec, s.sec || 0)
      }
    }
  }
  return { weight, e1rm, reps, sec, assistance }
}

// New personal records in this session compared with all earlier workouts.
// Only counts exercises you've done before, so a first try isn't a "record".
export function findRecords(session, workouts) {
  if (['sport', 'recovery', 'pump'].includes(session.kind)) return []
  workouts = workouts.filter((w) => !w.sample && !['sport', 'recovery', 'pump'].includes(w.kind))
  const out = []
  for (const e of session.exercises) {
    const done = e.sets.filter((s) => s.status === 'done' && s.kind !== 'warmup')
    if (!done.length) continue
    // Machine and cable stacks differ between gyms: their numbers are only
    // compared with the same place.
    const pool = exerciseProfile(e.exId)?.machine
      ? workouts.filter((w) => (w.location || null) === (session.location || null))
      : workouts
    const prior = pool.some((w) =>
      w.exercises.some((x) => x.exId === e.exId && x.sets.some((s) => s.kind !== 'warmup')),
    )
    if (!prior) continue
    const best = bestLifts(pool, e.exId)
    const unit = session.unit
    if (e.type === 'time') {
      const sec = Math.max(...done.map((s) => s.sec || 0))
      if (sec > best.sec) out.push({ exId: e.exId, name: e.name, label: `${sec}s hold` })
    } else if (e.weighted && assisted(e.exId)) {
      const least = Math.min(...done.filter((s) => (s.reps || 0) > 0).map((s) => s.weight || 0))
      if (best.assistance != null && least < best.assistance)
        out.push({ exId: e.exId, name: e.name, label: `Least assistance: ${fmtNum(least)} ${unit}` })
    } else if (e.weighted) {
      const weight = Math.max(...done.map((s) => s.weight || 0))
      const e1rm = Math.max(...done.map((s) => oneRepMax(s.weight || 0, s.reps || 0)))
      if (weight > best.weight)
        out.push({ exId: e.exId, name: e.name, label: `Heaviest: ${fmtNum(weight)} ${unit}` })
      else if (e1rm > best.e1rm + 0.01)
        out.push({
          exId: e.exId,
          name: e.name,
          label: `Best set: est. 1RM ${fmtNum(Math.round(e1rm))} ${unit}`,
        })
    } else {
      const reps = Math.max(...done.map((s) => s.reps || 0))
      if (reps > best.reps) out.push({ exId: e.exId, name: e.name, label: `Most reps: ${reps}` })
    }
  }
  return out
}

// Turn a session into the record kept in history. Only finished sets are kept.
export function toWorkoutRecord(session, workouts, { now = Date.now(), effort = null, note = '' } = {}) {
  const exercises = session.exercises
    .map((e) => ({
      exId: e.exId,
      name: e.name,
      muscle: e.muscle,
      type: e.type,
      weighted: e.weighted,
      // The rest it was planned with, so "Repeat" and pace keep it.
      ...(Number.isFinite(e.restSec) ? { restSec: e.restSec } : {}),
      ...(e.unilateral ? { unilateral: true } : {}),
      ...(e.swappedFrom ? { swappedFrom: e.swappedFrom } : {}),
      // Strength-model evidence (src/lib/strength): "too heavy" attempts and a
      // mid-workout "set my working weight" point.
      ...(Array.isArray(e.attempts) && e.attempts.length ? { attempts: e.attempts } : {}),
      ...(Number.isInteger(e.calibratedFrom) && e.calibratedFrom > 0 ? { calibratedFrom: e.calibratedFrom } : {}),
      sets: e.sets
        .filter((s) => s.status === 'done')
        .map((s) => ({
          kind: s.kind || 'work',
          reps: e.type === 'time' ? null : s.reps || 0,
          sec: e.type === 'time' ? s.sec || 0 : null,
          weight: e.weighted ? s.weight || 0 : null,
          targetReps: s.targetReps,
          targetSec: s.targetSec,
          // How the set felt (one tap) and whether the numbers were typed in.
          ...(s.feel ? { feel: s.feel } : {}),
          ...(reserveFor(s.feel, s.reserve) ? { reserve: s.reserve } : {}),
          ...(s.manual ? { manual: true } : {}),
          // A test set at the next weight up, and how it went.
          ...(['passed', 'missed'].includes(s.test) ? { test: s.test } : {}),
          ...(Number.isFinite(s.doneAt) ? { at: s.doneAt } : {}),
        })),
    }))
    .filter((e) => e.sets.length > 0)

  return {
    id: session.id,
    routineId: session.routineId,
    // A freely logged workout is named after what was actually logged.
    name:
      session.kind === 'manual' && session.name === LOGGED_WORKOUT
        ? trainingTitle(session.exercises)
        : session.name,
    kind: session.kind || 'routine',
    sport: session.sport,
    requestedMinutes: session.requestedMinutes,
    location: session.location,
    placeName: session.placeName || null,
    movement: session.movement,
    schedule: session.schedule,
    planning: session.planning,
    focus: session.focus,
    finishReason: session.finishReason || 'other',
    // Completed, partial, unreached and skipped work with stated reasons (engine/ledger.js).
    outcome: outcomeFromSession(session),
    unfinished:
      ['manual', 'baseline'].includes(session.kind)
        ? []
        : session.exercises
            .filter((e) => e.sets.some((s) => s.status !== 'done'))
            .map((e) => ({
              exId: e.exId,
              reason: e.skipReason || session.finishReason || 'other',
              at: now,
              carried: Boolean(
                session.planning?.carriedFrom?.some((source) => source.endsWith(`:${e.exId}`)),
              ),
            })),
    unit: session.unit,
    date: session.logDate || toKey(new Date(session.startedAt || now)),
    startedAt: session.startedAt,
    endedAt: now,
    durationSec: Math.round(elapsedMs(session, now) / 1000),
    exercises,
    totals: totals(exercises),
    records: findRecords(session, workouts),
    effort,
    note: note.trim(),
  }
}

// ── Planning & stats ────────────────────────────────────────────────

// Rough length of a routine in minutes: ~3s per rep plus timed work and rests.
export function estimateMinutes(routine) {
  let sec = 0
  for (const item of routine.items) {
    const work = item.sec ? item.sec : (item.reps || 10) * 3 + 10
    sec += item.sets * work + Math.max(0, item.sets - (routine.circuit ? 0 : 1)) * (item.restSec || 0)
  }
  return Math.max(1, Math.round(sec / 60))
}

// The distinct muscle groups a routine works, in the order they appear.
export function routineMuscles(routine, custom) {
  const seen = []
  for (const item of routine.items) {
    const m = findExercise(item.exId, custom)?.muscle
    if (m && !seen.includes(m)) seen.push(m)
  }
  return seen
}

export function lastDoneDate(workouts, routineId) {
  for (let i = workouts.length - 1; i >= 0; i--)
    if (workouts[i].routineId === routineId) return workouts[i].date
  return null
}

// Suggest the routine you've gone longest without doing. With only starter
// routines to pick from, stick to the ones you've actually done.
export function pickNextRoutine(routines, workouts) {
  if (!routines.length) return null
  if (routines.every((r) => String(r.id).startsWith('tpl-'))) {
    const done = routines.filter((r) => lastDoneDate(workouts, r.id))
    if (done.length) routines = done
  }
  let best = null
  let bestDate = null
  for (const r of routines) {
    const d = lastDoneDate(workouts, r.id)
    if (!d) return r
    if (!bestDate || d < bestDate) {
      best = r
      bestDate = d
    }
  }
  return best
}

// Monday-start week containing `key`.
export function weekStart(key) {
  const d = fromKey(key)
  const offset = (d.getDay() + 6) % 7
  return addDays(key, -offset)
}

export function weekSummary(workouts, today = todayKey()) {
  const start = weekStart(today)
  const list = workouts.filter((w) => w.date >= start && w.date <= today)
  const days = new Set(list.map((w) => w.date))
  return {
    start,
    count: list.length,
    minutes: Math.round(list.reduce((s, w) => s + w.durationSec, 0) / 60),
    volume: list.reduce((s, w) => s + workoutVolume(w), 0),
    days,
  }
}

// Consecutive weeks (ending this week or last) that met the weekly goal.
export function weekStreak(workouts, goal, today = todayKey()) {
  if (!goal) return 0
  const perWeek = new Map()
  for (const w of workouts) {
    if (w.sample || ['sport', 'recovery', 'pump'].includes(w.kind)) continue
    const k = weekStart(w.date)
    if (!perWeek.has(k)) perWeek.set(k, new Set())
    perWeek.get(k).add(w.date)
  }
  let week = weekStart(today)
  // This week still counts as "in progress" — don't break the streak yet.
  if ((perWeek.get(week)?.size || 0) < goal) week = addDays(week, -7)
  let streak = 0
  while ((perWeek.get(week)?.size || 0) >= goal) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}

// Workouts per Monday-start week for the last `weeks` weeks, oldest first.
export function weeklyCounts(workouts, weeks = 8, today = todayKey()) {
  const thisWeek = weekStart(today)
  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i)
    const end = addDays(start, 6)
    const list = workouts.filter((w) => w.date >= start && w.date <= end)
    out.push({
      start,
      count: list.length,
      minutes: Math.round(list.reduce((s, w) => s + (w.durationSec || 0), 0) / 60),
    })
  }
  return out
}

// Finished sets per muscle group since `fromKey`, most worked first.
export function muscleSets(workouts, fromKey) {
  const counts = new Map()
  for (const w of workouts) {
    if (w.date < fromKey) continue
    for (const e of w.exercises) {
      const muscle = e.muscle || findExercise(e.exId)?.muscle || 'Other'
      counts.set(muscle, (counts.get(muscle) || 0) + e.sets.filter((s) => s.kind !== 'warmup').length)
    }
  }
  return [...counts.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets)
}

// Best result for each exercise you've done, heaviest lifts first:
// weighted moves by top weight, bodyweight moves by reps, timed moves by seconds.
export function personalBests(workouts) {
  const best = new Map()
  for (const w of workouts) {
    if (w.sample || ['sport', 'recovery', 'pump'].includes(w.kind)) continue
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (s.kind === 'warmup') continue
        const cur = best.get(e.exId) || {
          exId: e.exId,
          name: e.name,
          type: e.type,
          weighted: e.weighted,
          unit: w.unit,
          weight: 0,
          reps: 0,
          sec: 0,
          date: w.date,
        }
        if (e.type === 'time') {
          if ((s.sec || 0) > cur.sec) Object.assign(cur, { sec: s.sec, date: w.date })
        } else if (e.weighted && assisted(e.exId)) {
          // Least assistance is best; it is not ranked with lifted loads.
          if ((s.reps || 0) > 0 && (cur.assistance == null || (s.weight || 0) < cur.assistance))
            Object.assign(cur, { assistance: s.weight || 0, reps: s.reps, date: w.date, unit: w.unit })
        } else if (e.weighted) {
          if ((s.weight || 0) > cur.weight || ((s.weight || 0) === cur.weight && (s.reps || 0) > cur.reps)) {
            Object.assign(cur, { weight: s.weight || 0, reps: s.reps || 0, date: w.date, unit: w.unit })
          }
        } else if ((s.reps || 0) > cur.reps) Object.assign(cur, { reps: s.reps, date: w.date })
        best.set(e.exId, cur)
      }
    }
  }
  const rank = (b) => (b.weighted ? 2 : b.type === 'time' ? 0 : 1)
  return [...best.values()].sort(
    (a, b) => rank(b) - rank(a) || b.weight - a.weight || b.reps - a.reps || b.sec - a.sec,
  )
}

// Training badges for the Progress tab.
export function workoutAchievements(workouts, weeklyGoal, today = todayKey()) {
  const minutes = workouts.reduce((s, w) => s + (w.durationSec || 0), 0) / 60
  const records = workouts.reduce((s, w) => s + (w.records?.length || 0), 0)
  const streak = weekStreak(workouts, weeklyGoal, today)
  return [
    {
      id: 'w-first',
      icon: 'dumbbell',
      label: 'First Rep',
      desc: 'Finished your first workout',
      earned: workouts.length >= 1,
    },
    {
      id: 'w-ten',
      icon: 'zap',
      label: 'Building Habits',
      desc: '10 workouts finished',
      earned: workouts.length >= 10,
    },
    {
      id: 'w-weeks',
      icon: 'flame',
      label: 'Consistent',
      desc: 'Weekly goal hit 4 weeks in a row',
      earned: streak >= 4,
    },
    {
      id: 'w-record',
      icon: 'trophy',
      label: 'Record Breaker',
      desc: 'Set a personal record',
      earned: records >= 1,
    },
    {
      id: 'w-hours',
      icon: 'clock',
      label: 'Ten Hours In',
      desc: '10 hours of training',
      earned: minutes >= 600,
    },
  ]
}

// ── Formatting ──────────────────────────────────────────────────────

export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// Workout length for lists: "48 min", "1 h 05 min", "45 s".
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

export function fmtNum(n) {
  const v = Math.round(Number(n || 0) * 10) / 10
  const [int, dec] = String(Math.abs(v)).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (v < 0 ? '-' : '') + grouped + (dec ? '.' + dec : '')
}

// "3 × 10 @ 60 lb", "3 × 40s"
export function describeSets(e, unit) {
  const sets = e.sets
  if (!sets.length) return ''
  const same = sets.every(
    (s) =>
      s.reps === sets[0].reps &&
      s.sec === sets[0].sec &&
      s.weight === sets[0].weight &&
      s.kind === sets[0].kind,
  )
  const one = (s) => {
    if (e.type === 'time') return `${s.sec}s${s.kind === 'warmup' ? ' (warmup)' : ''}`
    const w = e.weighted && s.weight ? ` @ ${fmtNum(s.weight)} ${unit}` : ''
    return `${s.reps}${w}${s.kind === 'warmup' ? ' (warmup)' : ''}`
  }
  if (same) return `${sets.length} × ${one(sets[0])}`
  return sets.map(one).join(', ')
}

export function describeItem(item, def, unit) {
  const work = def?.type === 'time' ? `${item.sec}s` : `${item.reps} reps`
  const w = item.weight ? ` @ ${fmtNum(item.weight)} ${unit}` : ''
  return `${item.sets} × ${work}${w}`
}

// One line describing where the workout stands; shared by the mini bar and Home.
export function sessionStatus(session) {
  const cur = currentSet(session)
  if (session.pausedAt) return 'Paused'
  if (session.phase === 'rest') return cur ? `Resting · next ${cur.ex.name}` : 'Resting'
  if (session.phase === 'prepared') return 'Plan ready · start when you are'
  if (session.phase === 'ready') return 'Starting…'
  if (session.phase === 'done') return 'Ready to save'
  if (session.phase === 'between') return 'Exercise logged · add the next one'
  if (cur) return `${cur.ex.name} · set ${session.cursor.set + 1} of ${cur.ex.sets.length}`
  return 'Tap to continue'
}
