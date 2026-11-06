// A small simulator for sequences of real sessions: recommend → train →
// record → (optionally) answer → recommend again. Everything goes through the
// same functions the app uses; only the person's behaviour is scripted.
import { defaultState } from '../../src/lib/storage.js'
import { buildDailyPlan } from '../../src/lib/planner.js'
import { buildSession, finish, toWorkoutRecord } from '../../src/lib/workout.js'
import { rebuildRecords } from '../../src/lib/workout-history.js'
import { withLearningEvent } from '../../src/lib/engine/learning.js'
import { ONBOARDING_VERSION } from '../../src/lib/onboarding.js'

export const at = (date, hour = 12) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()

export function makeUser(profile = {}, extra = {}) {
  const state = defaultState()
  state.settings.training = {
    ...state.settings.training,
    completed: true,
    onboardingVersion: ONBOARDING_VERSION,
    ...profile,
  }
  return { ...state, ...extra }
}

export function recommend(state, { date, hour = 12, ...options } = {}) {
  return buildDailyPlan(state, { today: date, now: at(date, hour), ...options })
}

/**
 * Trains a plan and saves the record, like the app does.
 * script: {
 *   sets: (exercise, index) => number of working sets to complete (default all),
 *   skip: { [exId]: reason },     deliberately skipped with a reason ('other' = none given)
 *   finishReason, effort, hour, weight: (exercise) => load to log,
 *   repsShort: { [exId]: reps missed per set }
 * }
 */
export function train(state, plan, date, script = {}) {
  const hour = script.hour ?? 12
  const start = at(date, hour)
  let session = buildSession(plan, {
    workouts: state.workouts,
    customExercises: state.customExercises,
    unit: state.settings.weightUnit,
    now: start,
  })
  session = { ...session, startedAt: start, phase: 'work' }
  session.exercises = session.exercises.map((e, index) => {
    if (script.skip?.[e.exId]) {
      return {
        ...e,
        skipReason: script.skip[e.exId],
        sets: e.sets.map((s) => ({ ...s, status: 'skipped' })),
      }
    }
    const want = script.sets ? script.sets(e, index) : Infinity
    let done = 0
    return {
      ...e,
      sets: e.sets.map((s) => {
        if (s.kind === 'warmup') return { ...s, status: want > 0 ? 'done' : 'todo' }
        if (done >= want) return s
        done++
        const weight = e.weighted ? (script.weight?.(e) ?? s.weight ?? 20) : null
        const reps = e.type === 'time' ? null : Math.max(1, (s.reps || 10) - (script.repsShort?.[e.exId] || 0))
        return { ...s, status: 'done', weight, reps, sec: e.type === 'time' ? s.sec || 30 : null }
      }),
    }
  })
  const end = start + 45 * 60000
  session = { ...finish(session, end), finishReason: script.finishReason || 'other' }
  const record = toWorkoutRecord(session, state.workouts, { now: end, effort: script.effort ?? 2 })
  return { state: { ...state, workouts: rebuildRecords([...state.workouts, record]) }, record, session }
}

export function answer(state, event) {
  return { ...state, learning: withLearningEvent(state.learning, event) }
}

export const ids = (plan) => plan.items.map((i) => i.exId)
