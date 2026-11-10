// The strength model inside a live workout.
//
// After a set, a one-tap answer ("easy", "good", "hard"), "I couldn't finish"
// or "too heavy to start" updates today's belief and re-plans the sets still
// to do. Sets the person typed in themselves are never overwritten. Plain
// "Done" taps change nothing (no news is not evidence), so the plan stays put
// unless there is a reason to move it.
import { metaOf } from '../catalog/index.js'
import { findExercise } from '../exercises.js'
import { completeSet, updateSet } from '../workout.js'
import { anchorEvent } from '../engine/learning.js'
import { DAY_SD, MATERIAL_REP_CHANGE } from './config.js'
import { loadGrid } from './loads.js'
import { clamp, isNum } from './math.js'
import {
  FEELS,
  advance,
  applySession,
  beliefAt,
  exerciseBelief,
  initialState,
  sessionObservations,
  strengthMode,
  trendPriorFor,
  typicalRir,
} from './model.js'
import { prescribeLoad, prescribeReps, repRange, targetRir } from './prescribe.js'
import { exerciseProfile, similarity } from './library.js'
import { liveStrengthGraph, strengthTarget } from './index.js'

const isWork = (s) => s && s.kind !== 'warmup'
const round = (v) => Math.round(v * 1000) / 1000

/**
 * What the live adaptation needs from app state.
 * @param {object} args workouts, learning, unit, now, today, goal, experience,
 *   readiness, sizes (listed dumbbells here), customExercises
 */
export function liveContext(args) {
  const r = args.readiness || {}
  return {
    ...args,
    easy: Boolean(r.unwell || r.energy === 'low' || r.intensity === 'easy'),
  }
}

function modeOf(ex, ctx) {
  const def = findExercise(ex.exId, ctx.customExercises) || ex
  const meta = metaOf(ex.exId)
  // Assisted machines log their assistance like a weight.
  const assisted = meta?.load === 'assist' && def?.type === 'reps'
  return { def, meta, mode: strengthMode(def, meta) ?? (assisted ? 'load' : null) }
}

/** History up to now plus today's sets of this exercise, as one belief. */
function todayBelief(ex, ctx, { mode, def, meta }) {
  const history = exerciseBelief({
    workouts: ctx.workouts || [],
    exId: ex.exId,
    def,
    meta,
    unit: ctx.unit,
    today: ctx.today,
    now: ctx.now,
    experience: ctx.experience,
    learning: ctx.learning,
  })
  const live = sessionObservations({ exercises: [ex], unit: ctx.unit }, ex.exId, {
    unit: ctx.unit,
    mode,
    experience: ctx.experience,
    meta,
    live: true,
  })
  let state = null
  if (history) {
    state = advance(history.state, ctx.now)
    // Today's form is part of what today's sets reveal.
    const P = state.P.map((row) => [...row])
    P[0][0] += DAY_SD ** 2
    state = { ...state, P }
    if (live.observations.length) state = applySession(state, live.observations, { dayVar: 0 }).state
  } else if (live.observations.length) {
    const init = initialState({ mode, observations: live.observations, meta, trendPrior: trendPriorFor(mode, ctx.experience), at: ctx.now })
    if (init) state = applySession(init, live.observations, { dayVar: 0 }).state
  }
  return { history, live, state }
}

/** A grid holding exactly one weight, for "keep my weight, adjust the reps". */
function fixedGrid(w) {
  return {
    min: w,
    max: w,
    listed: true,
    between: (a, b) => (w >= Math.min(a, b) - 1e-9 && w <= Math.max(a, b) + 1e-9 ? [w] : []),
    has: (v) => Math.abs(v - w) < 1e-6,
    next: () => null,
    atMost: () => w,
  }
}

function gridFor(ex, ctx, meta, used = []) {
  const logged = ex.sets.filter((s) => isWork(s) && s.status === 'done' && isNum(s.weight) && s.weight > 0).map((s) => s.weight)
  return loadGrid({
    load: meta?.load,
    unit: ctx.unit,
    sizes: ['hand', 'one'].includes(meta?.load) ? ctx.sizes || [] : [],
    used: [...used, ...logged],
  })
}

const describe = (mode, weight, reps, unit, load) =>
  mode !== 'load'
    ? `${reps} reps`
    : load === 'assist'
      ? `${fmt(weight)} ${unit} assistance × ${reps}`
      : `${fmt(weight)} ${unit}${load === 'hand' ? ' each' : ''} × ${reps}`
const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100))

/** Did today's sets of this exercise include a failure or a "too heavy"? */
function liveFailure(ex) {
  if (Array.isArray(ex.attempts) && ex.attempts.length) return true
  return ex.sets.some((s) => isWork(s) && s.status === 'done' && (s.feel === 'failed' || (isNum(s.targetReps) && s.reps < s.targetReps)))
}

/** Weight and reps for the sets still to do, from the shared strength graph. */
function graphPlan(session, ex, ctx, { def, next, range, rir, failure }) {
  const profile = exerciseProfile(ex.exId, def)
  if (!profile?.tie || !['load', 'bodyweight', 'assist'].includes(profile.mode)) return null
  const args = {
    exId: ex.exId,
    def,
    workouts: ctx.workouts || [],
    learning: ctx.learning,
    metrics: ctx.metrics,
    unit: ctx.unit,
    today: ctx.today,
    now: ctx.now,
    goal: ctx.goal,
    experience: ctx.experience,
    easy: ctx.easy,
    place: session.location || null,
    sizes: ['hand', 'one'].includes(profile.loadConvention) ? ctx.sizes || [] : [],
    customExercises: ctx.customExercises,
    range,
    rir,
    sets: 1,
    noFloor: true,
    allowBigDrop: failure,
  }
  const graph = liveStrengthGraph(args, session)
  const weighted = profile.mode !== 'bodyweight'
  const current = weighted ? (isNum(next.weight) && next.weight >= 0 ? next.weight : null) : next.reps
  // Someone who chose their own weight keeps it unless a set failed.
  const keep = weighted && ex.userLoad && !failure && isNum(next.weight) && next.weight > 0
  const roomy = ex.sets.some((x) => isWork(x) && x.status === 'done' && x.feel === 'easy' && x.reserve >= 5)
  const first = strengthTarget({ ...args, graph, current, roomy, extraSets: 0, ...(keep ? { fixedWeight: next.weight } : {}) })
  if (!first || (weighted && !isNum(first.weight))) return null
  return {
    weight: weighted ? first.weight : null,
    repsFor: (m) =>
      m === 0
        ? first.reps
        : (strengthTarget({ ...args, graph, extraSets: m, current: weighted ? first.weight : first.reps, ...(weighted ? { fixedWeight: first.weight } : {}) })?.reps ?? first.reps),
  }
}

/**
 * After an answer on one exercise, upcoming exercises that share its muscles
 * (and haven't started) are re-planned too, when the change matters.
 */
export function adaptUpcoming(session, fromIndex, ctx) {
  let next = session
  const from = session.exercises[fromIndex]
  if (!from) return session
  session.exercises.forEach((ex, i) => {
    if (i === fromIndex || ex.sets.some((s) => isWork(s) && s.status === 'done')) return
    if (!ex.sets.some((s) => isWork(s) && s.status === 'todo')) return
    if (similarity(from.exId, ex.exId).muscles < 0.3) return
    next = adaptExercise(next, i, ctx, { reason: 'related' })
  })
  return next
}

/**
 * Re-plans the sets of one exercise that are still to do.
 * @param {object} options force (always apply), reason (shown to the person)
 */
export function adaptExercise(session, exIndex, ctx, { force = false, reason = 'feel' } = {}) {
  try {
    const ex = session.exercises[exIndex]
    if (!ex) return session
    const { def, meta, mode } = modeOf(ex, ctx)
    if (!mode) return session
    const todo = ex.sets.map((s, i) => (isWork(s) && s.status === 'todo' && !s.manual ? i : -1)).filter((i) => i >= 0)
    if (!todo.length) return session
    const next = ex.sets[todo[0]]
    const { history, live, state } = todayBelief(ex, ctx, { mode, def, meta })
    const failure = live.observations.some((o) => ['failed', 'too-heavy', 'missed'].includes(o.source))
    const range = Array.isArray(ex.repRange) && ex.repRange.length === 2 ? ex.repRange : repRange({ goal: ctx.goal, experience: ctx.experience, meta, mode })
    const rir = isNum(ex.targetRir) ? ex.targetRir : targetRir({ experience: ctx.experience, easy: ctx.easy })
    const done = ex.sets.filter((s) => isWork(s) && s.status === 'done')
    const before = done.map((s) => typicalRir(s.feel, ctx.experience, isNum(s.targetReps) && s.reps < s.targetReps))
    let weight = mode === 'load' ? next.weight : null
    let repsFor
    // Exercises the library ties together use the shared graph: today's form,
    // tiredness from every earlier exercise and everything learned elsewhere.
    const fromGraph = graphPlan(session, ex, ctx, { def, next, range, rir, failure: failure || liveFailure(ex) })
    if (fromGraph) {
      weight = fromGraph.weight
      repsFor = fromGraph.repsFor
    } else if (!state) {
      // Nothing to learn from yet (for example "too heavy" on a first attempt):
      // step down about a fifth to a weight that exists, keep the reps.
      if (mode !== 'load' || reason !== 'too-heavy' || !isNum(next.weight)) return session
      const grid = gridFor(ex, ctx, meta)
      const lower = grid.atMost(next.weight * 0.8)
      weight = lower < next.weight - 1e-6 ? lower : grid.next(next.weight, -1)
      if (!isNum(weight) || weight >= next.weight - 1e-6) return session
      repsFor = () => next.reps
    } else {
      const est = beliefAt({ mode, state }, null)
      if (mode === 'load') {
        const keepWeight = ex.userLoad && !failure && isNum(next.weight) && next.weight > 0
        const grid = keepWeight ? fixedGrid(next.weight) : gridFor(ex, ctx, meta, history?.used || [])
        const first = prescribeLoad(est, {
          range,
          rir,
          sets: 1,
          grid,
          current: isNum(next.weight) && next.weight > 0 ? next.weight : null,
          before,
          allowBigDrop: failure,
        })
        weight = first.weight
        const at = fixedGrid(weight)
        repsFor = (m) =>
          m === 0
            ? first.reps
            : prescribeLoad(est, { range, rir, sets: 1, grid: at, current: weight, before: [...before, ...new Array(m).fill(rir)] }).reps
      } else {
        const first = prescribeReps(est, { range, rir, sets: 1, current: next.reps, before })
        repsFor = (m) =>
          m === 0 ? first.reps : prescribeReps(est, { range, rir, sets: 1, current: first.reps, before: [...before, ...new Array(m).fill(rir)] }).reps
      }
    }
    const firstReps = clamp(Math.round(repsFor(0)), 1, 60)
    const weighted = mode === 'load' && isNum(weight)
    const weightChanged = weighted && (!isNum(next.weight) || Math.abs(weight - next.weight) > 1e-6)
    const material = weightChanged || Math.abs(firstReps - (next.reps || 0)) >= MATERIAL_REP_CHANGE
    if (!force && !material) return session
    if (!weightChanged && firstReps === next.reps) return session
    const sets = [...ex.sets]
    todo.forEach((index, m) => {
      const reps = m === 0 ? firstReps : clamp(Math.round(repsFor(m)), 1, 60)
      sets[index] = {
        ...sets[index],
        reps,
        targetReps: reps,
        ...(weighted ? { weight, targetWeight: weight } : {}),
      }
    })
    // A warm-up still to do follows the new working weight at about half.
    if (weightChanged)
      sets.forEach((s, i) => {
        if (s.kind === 'warmup' && s.status === 'todo' && !s.manual) {
          const half = gridFor(ex, ctx, meta).atMost(weight * 0.5)
          sets[i] = { ...s, weight: half, targetWeight: half }
        }
      })
    const exercises = [...session.exercises]
    exercises[exIndex] = {
      ...ex,
      sets,
      adjusted: {
        at: ctx.now,
        reason,
        fromSet: todo[0],
        weight: weighted ? weight : null,
        reps: firstReps,
        assist: meta?.load === 'assist',
        text: describe(weighted ? 'load' : 'reps', weight, firstReps, ctx.unit, meta?.load),
      },
    }
    return { ...session, exercises }
  } catch {
    // The live plan is never broken by the model: keep the numbers as they are.
    return session
  }
}

/** Index of a working set among this exercise's working sets. */
function workIndexOf(ex, setIndex) {
  let n = 0
  for (let i = 0; i < setIndex; i++) if (isWork(ex.sets[i])) n++
  return n
}

/** The just-logged set worth a one-tap "how did that feel?", or null. */
export function feelPrompt(session, customExercises = []) {
  const c = session?.lastLogged
  if (!c) return null
  const ex = session.exercises?.[c.ex]
  const set = ex?.sets?.[c.set]
  if (!set || set.status !== 'done' || !isWork(set) || set.feel || set.feelSkipped) return null
  if (['sport', 'recovery', 'pump'].includes(session.kind)) return null
  const { mode } = modeOf(ex, { customExercises })
  if (!mode) return null
  const first = workIndexOf(ex, c.set) === 0
  const lastOfExercise = !ex.sets.some((s) => isWork(s) && s.status === 'todo')
  // The first set after an automatic change: check the new numbers landed.
  const afterChange = ex.adjusted?.fromSet === c.set
  if (set.manual || first || lastOfExercise || afterChange) return c
  return null
}

function patchAt(session, c, patch) {
  return {
    ...session,
    exercises: session.exercises.map((e, i) =>
      i !== c.ex ? e : { ...e, sets: e.sets.map((s, j) => (j === c.set ? { ...s, ...patch } : s)) },
    ),
  }
}

/** Records a one-tap answer on a logged set and re-plans what's left. */
export function recordFeel(session, c, feel, ctx, reserve = undefined) {
  if (!FEELS.includes(feel) || !session.exercises[c.ex]?.sets[c.set]) return session
  // "Easy" may say how many more were possible: 3 (a few), 5 (about five) or 8 (eight or more).
  const extra = feel === 'easy' && [3, 5, 8].includes(reserve) ? { reserve } : { reserve: undefined }
  const next = patchAt(session, c, { feel, ...extra })
  return adaptUpcoming(adaptExercise(next, c.ex, ctx, { force: feel !== 'good', reason: feel }), c.ex, ctx)
}

/** After "Easy": ask once how many more reps were possible (optional). */
export function reservePrompt(session) {
  const c = session?.lastLogged
  const set = c && session.exercises?.[c.ex]?.sets?.[c.set]
  if (!set || set.feel !== 'easy' || set.reserve !== undefined || set.reserveSkipped) return null
  return c
}

/** Moved on without saying how many more: plain "easy" stands. */
export function skipReserve(session, c) {
  if (!session.exercises[c.ex]?.sets[c.set]) return session
  return patchAt(session, c, { reserveSkipped: true })
}

/** The person moved on without answering: don't ask about this set again. */
export function skipFeel(session, c) {
  if (!session.exercises[c.ex]?.sets[c.set]) return session
  return patchAt(session, c, { feelSkipped: true })
}

/**
 * Numbers the person typed (or stepped) for a set. Typed sets are never
 * changed by the app; a typed weight on a working set is kept for the rest of
 * this exercise, with only the reps adapting around it.
 */
export function applyManualEntry(session, c, patch) {
  const ex = session.exercises[c?.ex]
  const set = ex?.sets[c.set]
  if (!set) return session
  const changed = ['reps', 'sec', 'weight'].some((k) => k in patch && patch[k] !== set[k])
  // Picking a first weight is a starting guess the app may refine; changing a
  // planned weight is a choice it keeps.
  const weightChanged =
    'weight' in patch && patch.weight !== set.weight && isNum(set.weight) && set.weight > 0 && isWork({ ...set, ...patch })
  const next = patchAt(session, c, { ...patch, ...(changed ? { manual: true } : {}) })
  if (!weightChanged) return next
  return {
    ...next,
    exercises: next.exercises.map((e, i) => (i === c.ex ? { ...e, userLoad: true } : e)),
  }
}

/** "I didn't get all the reps" about a set already logged: correct it and re-plan. */
export function correctLoggedReps(session, c, reps, ctx) {
  const set = session.exercises[c?.ex]?.sets[c.set]
  const n = Math.round(Number(reps))
  if (!set || set.status !== 'done' || !Number.isFinite(n) || n < 1) return session
  return adaptUpcoming(adaptExercise(patchAt(session, c, { reps: n, feel: 'failed' }), c.ex, ctx, { force: true, reason: 'failed' }), c.ex, ctx)
}

/** "I couldn't finish": logs the reps actually done as a failed set, then re-plans. */
export function logShortSet(session, reps, ctx, now = Date.now()) {
  const c = session.cursor
  const n = Math.round(Number(reps))
  if (!c || !Number.isFinite(n) || n < 1) return session
  const logged = completeSet(updateSet(session, { reps: n, feel: 'failed' }), now)
  return adaptUpcoming(adaptExercise(logged, c.ex, ctx, { force: true, reason: 'failed' }), c.ex, ctx)
}

/** "Too heavy to start": remember the attempt and lighten this set and the rest. */
export function markTooHeavy(session, ctx, now = Date.now()) {
  const c = session.cursor
  const ex = session.exercises[c?.ex]
  const set = ex?.sets[c.set]
  const assisted = metaOf(ex.exId)?.load === 'assist'
  if (!set || !isNum(set.weight) || (set.weight <= 0 && !assisted)) return session
  const attempt = { weight: round(set.weight), unit: ctx.unit, setIndex: workIndexOf(ex, c.set), at: now }
  const exercises = [...session.exercises]
  // The current set stays the one to do: clear a manual mark so it can change.
  exercises[c.ex] = {
    ...ex,
    userLoad: false,
    attempts: [...(Array.isArray(ex.attempts) ? ex.attempts : []), attempt],
    sets: ex.sets.map((s, j) => (j === c.set ? { ...s, manual: false } : s)),
  }
  return adaptUpcoming(adaptExercise({ ...session, exercises }, c.ex, ctx, { force: true, reason: 'too-heavy' }), c.ex, ctx)
}

/**
 * "Set my working weight": the person's own numbers replace what the model
 * learned before now. Returns the learning event to save and the re-planned
 * session; sets logged earlier today stay in the log but no longer steer.
 */
export function setWorkingWeight(session, exIndex, { weight = null, reps = null }, ctx, now = Date.now()) {
  const ex = session.exercises[exIndex]
  if (!ex) return { session, event: null }
  const { mode } = modeOf(ex, ctx)
  if (!mode) return { session, event: null }
  const w = Number(weight)
  const r = Math.round(Number(reps))
  const valid = Number.isFinite(r) && r >= 1 && r <= 100 && (mode !== 'load' || (Number.isFinite(w) && w > 0 && w <= 10000))
  const event = anchorEvent({
    exId: ex.exId,
    at: now,
    ...(valid ? { reps: r, unit: ctx.unit, ...(mode === 'load' ? { weight: round(w) } : {}) } : {}),
  })
  const doneWork = ex.sets.filter((s) => isWork(s) && s.status === 'done').length
  const exercises = [...session.exercises]
  exercises[exIndex] = {
    ...ex,
    calibratedFrom: doneWork,
    userLoad: false,
    attempts: [],
    sets: ex.sets.map((s) => (s.status === 'todo' ? { ...s, manual: false, ...(valid ? {} : mode === 'load' ? { weight: null, targetWeight: null } : {}) } : s)),
  }
  const next = { ...session, exercises }
  if (!valid) return { session: next, event }
  // The remaining sets use exactly the stated numbers; answers on them adapt
  // from there, and future plans start from the saved anchor.
  const seeded = {
    ...next,
    exercises: next.exercises.map((e, i) =>
      i !== exIndex
        ? e
        : {
            ...e,
            adjusted: null,
            sets: e.sets.map((s) =>
              isWork(s) && s.status === 'todo' ? { ...s, ...(mode === 'load' ? { weight: round(w), targetWeight: round(w) } : {}), reps: r, targetReps: r } : s,
            ),
          },
    ),
  }
  return { session: seeded, event }
}
