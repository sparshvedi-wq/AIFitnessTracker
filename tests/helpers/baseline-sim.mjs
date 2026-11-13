// A scripted person doing the starting-point session, for tests. Their real
// strength is hidden from the app: it only sees the weights they pick, the
// reps they do and how many they say were left.
import { at } from './engine-sim.mjs'
import * as B from '../../src/lib/baseline.js'
import { toWorkoutRecord } from '../../src/lib/workout.js'
import { rebuildRecords } from '../../src/lib/workout-history.js'
import { effectiveLoad, exerciseProfile } from '../../src/lib/strength/library.js'
import { startingWeights } from '../../src/lib/strength/index.js'
import { repsAtFraction } from '../../src/lib/strength/math.js'
import { findExercise } from '../../src/lib/exercises.js'
import { profileOf } from '../../src/lib/planner.js'

const LB = 1 / 0.45359237

/**
 * @param general  overall level versus the library's reference lifter (log scale)
 * @param areas    { Area: offset } applied by how much of a lift is in that area
 * @param lifts    { exId: offset } for one lift on its own
 * @param bw       bodyweight (lb)
 */
export function lifter({ general = 0, areas = {}, lifts = {}, bw = 170 } = {}) {
  const profileOfLift = (exId) => exerciseProfile(exId, findExercise(exId))
  const max = (exId) => {
    const p = profileOfLift(exId)
    let level = general + (lifts[exId] || 0)
    for (const [a, share] of Object.entries(p.areas)) level += share * (areas[a] || 0)
    return p.normKg * LB * Math.exp(level)
  }
  return {
    bw,
    /** Reps to failure at a logged weight. */
    capacity(exId, weight) {
      const p = profileOfLift(exId)
      return repsAtFraction(effectiveLoad(p, weight || 0, bw) / max(exId), p.endurance)
    },
    /** One-rep max as it would be logged. */
    oneRepMax(exId) {
      const p = profileOfLift(exId)
      return p.mode === 'assist' ? p.bw * bw - max(exId) : (max(exId) - p.bw * bw) / p.ext
    },
  }
}

/** Runs a whole starting point, taking the suggested weight every time. */
export function runBaseline(state, who, date, { location } = {}) {
  const start = at(date, 10)
  let s = B.buildBaselineSession(state, { today: date, now: start, location })
  const p = profileOf(state)
  const args = (now) => ({
    workouts: state.workouts,
    learning: state.learning,
    metrics: state.metrics,
    unit: state.settings.weightUnit,
    today: date,
    now,
    goal: p.goal,
    experience: p.experience,
    customExercises: [],
    place: s.location,
    sizes: [],
  })
  let now = start
  s = B.beginBaseline(s, now)
  const tried = new Map()
  for (let guard = 0; guard < 200 && s.baseline.step !== 'results'; guard++) {
    now += 60000
    const ex = s.exercises[s.cursor.ex]
    const set = ex.sets[s.cursor.set]
    const mode = B.baselineMode(ex)
    const step = s.baseline.step
    if (step === 'pick') {
      const guess = startingWeights({ ...args(now), exId: ex.exId, scale: B.firstGuessScale(p, ex.exId) }, s)
      if (!guess || tried.get(ex.key) === guess.suggested) s = B.skipBaselineMove(s, now)
      else s = B.pickBaselineWeight(s, guess.suggested)
    } else if (step === 'do') {
      if (mode === 'time') {
        s = B.logBaselineHold(s, 40, now)
        continue
      }
      const capacity = who.capacity(ex.exId, mode === 'load' ? set.weight : 0)
      if (mode === 'load' && capacity < 5) {
        tried.set(ex.key, set.weight)
        s = B.baselineTooHeavy(s, now)
      } else if (capacity < 3) {
        const swapped = B.swapBaselineMove(s)
        s = swapped === s || tried.has(`swap:${ex.slot}`) ? B.skipBaselineMove(s, now) : swapped
        tried.set(`swap:${ex.slot}`, true)
      } else s = B.finishBaselineSet(s)
    } else if (step === 'reps') {
      const capacity = who.capacity(ex.exId, mode === 'load' ? set.weight : 0)
      s = B.logBaselineReps(
        s,
        Math.max(1, Math.min(mode === 'load' ? 15 : 30, Math.floor(capacity - 2))),
        now,
      )
    } else if (step === 'left') {
      const left = who.capacity(ex.exId, mode === 'load' ? set.weight : 0) - set.reps
      s = B.answerBaselineLeft(s, left < 0.8 ? 0 : left < 2.8 ? 1 : left < 4.8 ? 3 : 6, args(now), now)
    } else if (step === 'again') s = B.acceptSecondSet(s)
  }
  const record = toWorkoutRecord(s, state.workouts, { now: now + 60000, effort: null })
  return {
    state: {
      ...state,
      workouts: rebuildRecords([...state.workouts, record]),
      settings: {
        ...state.settings,
        training: { ...state.settings.training, baseline: { status: 'done', at: now } },
      },
    },
    record,
    session: s,
  }
}
