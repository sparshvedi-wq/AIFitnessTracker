import { finish, setCounts, toWorkoutRecord } from './workout.js'

// Save only completed work; an untouched preview must not become a workout.
export function endForSwitch(session, workouts, now = Date.now()) {
  if (!session || !setCounts(session).done) return null
  const draft = session.summaryDraft || {}
  return toWorkoutRecord(
    {
      ...finish(session, now),
      finishReason: draft.finishReason || session.finishReason || 'changed-plan',
      ...(session.kind === 'manual' && draft.logDate ? { logDate: draft.logDate } : {}),
    },
    workouts,
    { now, effort: draft.effort ?? null, note: draft.note || '' },
  )
}
