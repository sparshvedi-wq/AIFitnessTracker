import { isAssisted, totals } from './workout.js'

// The same limits apply when logging a set and when correcting it later, so a
// value saved during a workout can always be edited afterwards.
export const SET_LIMITS = { reps: 10000, sec: 86400, weight: 10000 }

// Keep a blank or partially typed value in the form until it is valid to save.
export function setEntryPatch(exercise, values, kind = 'work') {
  const read = (v) =>
    /^\d+(?:[.,]\d+)?$/.test(String(v ?? '').trim()) ? Number(String(v).trim().replace(',', '.')) : NaN
  const reps = read(values.reps)
  const sec = read(values.sec)
  const weight = read(values.weight)
  if (!['work', 'warmup'].includes(kind)) return null
  if (exercise.type === 'time')
    return Number.isSafeInteger(sec) && sec > 0 && sec <= SET_LIMITS.sec ? { sec, kind } : null
  if (!Number.isSafeInteger(reps) || reps <= 0 || reps > SET_LIMITS.reps) return null
  // Zero assistance is the hardest assisted setting; other loads must be above 0.
  const zeroAllowed = isAssisted(exercise.exId)
  if (
    exercise.weighted &&
    (!Number.isFinite(weight) || weight < 0 || weight > SET_LIMITS.weight || (weight === 0 && !zeroAllowed))
  )
    return null
  return { reps, kind, ...(exercise.weighted ? { weight } : {}) }
}

export function loggedSetStats(session) {
  // Legacy sets without a status must not appear as completed in a live session.
  return totals(session.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.status === 'done') })))
}
