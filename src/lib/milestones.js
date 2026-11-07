import { addDays, fromKey, shortLabel } from './date.js'
import { weekStart } from './workout.js'

// A working set is completed, not a warm-up, and has actual reps or time.
export const isWorkingSet = (s) =>
  s.kind !== 'warmup' && (!s.status || s.status === 'done') && (Number(s.reps) > 0 || Number(s.sec) > 0)

export const workingSetCount = (workout) =>
  (workout?.exercises || []).reduce((n, e) => n + (e.sets || []).filter(isWorkingSet).length, 0)

export const warmupSetCount = (workout) =>
  (workout?.exercises || []).reduce(
    (n, e) =>
      n + (e.sets || []).filter((s) => s.kind === 'warmup' && (!s.status || s.status === 'done')).length,
    0,
  )

// A mark represents saved work, never a prepared session, sample or future log.
export function tallySessions(workouts, today) {
  return (workouts || []).filter(
    (w) =>
      !w.sample && !w.synthetic && w.date <= today && w.exercises?.some((e) => e.sets?.some(isWorkingSet)),
  )
}

export function firstSessionAchievement(state, workout, today) {
  if (state.settings.milestones?.firstSession || !tallySessions([workout], today).length) return null
  if (tallySessions(state.workouts, today).some((w) => w.id !== workout.id)) return null
  const exercises = workout.exercises.filter((e) => e.sets?.some(isWorkingSet))
  return { workoutId: workout.id, sets: workingSetCount(workout), exercises: exercises.length }
}

// Counts worth marking. Between them, the ring still fills one stroke at a time.
const MARK_MILESTONES = [5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500]
const DAY = 86400000
const byTime = (a, b) =>
  a.date.localeCompare(b.date) || (a.endedAt || a.startedAt || 0) - (b.endedAt || b.startedAt || 0)

function whenLabel(date, today) {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return shortLabel(date)
}

/**
 * The most recent thing worth celebrating, from saved work only.
 * `bundle` is how many strokes of the current group of five are drawn (0–5),
 * which the Home ring shows the way a tally is written.
 */
export function latestWin(workouts, today) {
  const sessions = tallySessions(workouts, today).sort(byTime)
  const total = sessions.length
  const bundle = total ? ((total - 1) % 5) + 1 : 0
  if (!total) return { kind: 'next', title: 'First mark', label: 'Next win', total, bundle, when: '' }
  const last = sessions.at(-1)
  const when = whenLabel(last.date, today)
  const base = { total, bundle, when, workoutId: last.id, label: 'Latest win' }
  if (total === 1) return { ...base, kind: 'first', title: 'First mark' }
  if (MARK_MILESTONES.includes(total)) return { ...base, kind: 'milestone', title: `${total} marks` }
  const best = (last.records || [])[0]
  if (best) return { ...base, kind: 'best', title: 'New best', detail: best.name || '' }
  const previous = sessions.at(-2)
  // Rounded so a daylight-saving change can't shave an hour off a week.
  if (previous && Math.round((fromKey(last.date) - fromKey(previous.date)) / DAY) >= 7)
    return { ...base, kind: 'back', title: 'Back at it' }
  const start = weekStart(today)
  const recent = sessions.filter((w) => w.date >= start).length
  if (recent >= 2) return { ...base, kind: 'week', title: `${recent} this week` }
  return { ...base, kind: 'mark', title: 'Mark added' }
}
