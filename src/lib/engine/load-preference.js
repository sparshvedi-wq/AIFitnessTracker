import { convertWeight } from '../units.js'

const DAY = 86_400_000
const work = (e) => (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done'))
const close = (a, b) => Math.abs(a - b) < 0.02

// Only a deliberate edit below the suggested load counts. Match the place and
// require three separate sessions, so a single lighter day never creates a cap.
export function preferredLoadQuestion(state, workout) {
  if (!['routine', 'adaptive'].includes(workout.kind) || workout.sample || workout.effort >= 4) return null
  const records = state.workouts.filter((w) => !w.sample && w.endedAt <= workout.endedAt)
  for (const e of workout.exercises) {
    if (!e.weighted) continue
    const set = work(e).find((s) => s.manual && s.weight > 0 && s.weight < s.targetWeight)
    if (!set) continue
    const place = set.location ?? e.location ?? workout.location
    const recentlyAsked = state.learning?.events?.some(
      (event) => event.exId === e.exId && event.question === 'load' && event.at >= workout.endedAt - 28 * DAY,
    )
    if (recentlyAsked) continue
    const prior = records
      .filter(
        (w) =>
          ['adaptive', 'routine'].includes(w.kind) &&
          w.exercises.some(
            (x) =>
              x.exId === e.exId && work(x).some((s) => (s.location ?? x.location ?? w.location) === place),
          ),
      )
      .slice(-3)
    if (
      prior.length === 3 &&
      prior.every((w) =>
        w.exercises.some(
          (x) =>
            x.exId === e.exId &&
            work(x).some(
              (s) =>
                s.manual &&
                s.weight > 0 &&
                s.weight < s.targetWeight &&
                (s.location ?? x.location ?? w.location) === place &&
                close(convertWeight(s.weight, w.unit, workout.unit), set.weight),
            ),
        ),
      )
    ) {
      return { exId: e.exId, name: e.name, place, unit: workout.unit, weight: set.weight }
    }
  }
  return null
}

export function nextLoadLimit({ learning, workouts, exId, place, now, unit }) {
  const events = learning?.events || []
  const choice = events.findLast(
    (e) =>
      e.kind === 'load-limit' &&
      e.exId === exId &&
      e.place === place &&
      e.at <= now &&
      e.at >= now - 28 * DAY,
  )
  if (
    !choice ||
    events.some(
      (e) =>
        e.at > choice.at &&
        e.at <= now &&
        (e.exId === exId || e.exId === '*') &&
        ['reset', 'retry', 'anchor'].includes(e.kind),
    )
  )
    return null
  if (
    workouts?.some(
      (w) =>
        !w.sample &&
        w.endedAt > choice.at &&
        w.endedAt <= now &&
        w.exercises.some(
          (e) => e.exId === exId && work(e).some((s) => (s.location ?? e.location ?? w.location) === place),
        ),
    )
  )
    return null
  return convertWeight(choice.weight, choice.unit, unit)
}
