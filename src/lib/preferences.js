import { addDays, todayKey } from './date.js'
import { resolvePlace } from './places.js'

export const DEFAULT_DISPLAY = { metricLight: false, largeText: false, reducedMotion: false }
export const DUMBBELL_MOVES = [
  'goblet-squat',
  'db-bench',
  'db-row',
  'lateral-raise',
  'biceps-curl',
  'db-overhead-press',
  'db-rdl',
]
export function displayOf(state) {
  return { ...DEFAULT_DISPLAY, ...state.settings?.display }
}
export function hasTrainingTarget(settings) {
  return settings.workout?.goalMode === 'target'
}
export function availableLoads(profile, location) {
  const values = resolvePlace(profile, location).dumbbells
  return [...new Set((values || []).filter((v) => Number.isFinite(v) && v > 0 && v <= 2000))].sort(
    (a, b) => a - b,
  )
}
export function parseLoads(text) {
  if (!text.trim()) return []
  const tokens = text.split(/[,;\n]+/).map((v) => Number(v.trim()))
  if (tokens.some((v) => !Number.isFinite(v) || v <= 0 || v > 2000))
    throw new Error('Enter positive weights separated by commas, such as 5, 10, 15.')
  return [...new Set(tokens)].sort((a, b) => a - b).slice(0, 100)
}
export function fitAvailableLoad(weight, loads) {
  if (!loads.length || weight == null || weight <= 0) return weight
  return [...loads].reverse().find((v) => v <= weight + 0.0001) ?? null
}
// Training rhythm always uses any seven days: there are no assigned weeks or
// make-up days. (`settings` is kept for callers; the window no longer varies.)
export function trainingDays(workouts, _settings, today = todayKey()) {
  const start = addDays(today, -6)
  const days = new Set(
    workouts
      .filter(
        (w) =>
          !w.sample &&
          !['sport', 'recovery', 'pump'].includes(w.kind) &&
          w.exercises?.some((e) =>
            e.sets?.some((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done')),
          ) &&
          w.date >= start &&
          w.date <= today,
      )
      .map((w) => w.date),
  )
  return { count: days.size, start, rolling: true, label: 'last 7 days' }
}
export function breakDays(workouts, today) {
  const last = workouts
    .filter(
      (w) =>
        !w.sample &&
        !['sport', 'recovery', 'pump'].includes(w.kind) &&
        w.date <= today &&
        w.exercises?.some((e) =>
          e.sets?.some((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done')),
        ),
    )
    .map((w) => w.date)
    .sort()
    .at(-1)
  if (!last) return 0
  return Math.max(
    0,
    Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(last + 'T12:00:00Z')) / 86400000),
  )
}
