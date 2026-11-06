import { addDays } from './date.js'

export const SHORT_DURATIONS = [5, 10, 15]
export const shortSessionRequest = () => ({ kind: 'adaptive', shortSession: true, minutes: 10, items: [] })

// An invitation is never a dated plan. Rebuild against the next visit's check-in.
export function nextVisitInvitation(workout) {
  if (workout.finishReason === 'pain')
    return {
      text: 'Rest up. Next time, tell us what to avoid first.',
      action: 'Explore short options',
    }
  if (workout.finishReason === 'unwell')
    return {
      text: 'Feel better soon. When you’re ready, gentle movement or rest are both fine.',
      action: 'Explore short options',
    }
  if (workout.effort >= 4 || workout.finishReason === 'soreness')
    return {
      text: 'Take the time you need. A short, easy session is there when you want it.',
      action: 'Preview a short session',
    }
  return {
    text: 'If you feel like moving tomorrow, there’s a 10-minute option.',
    action: 'Preview a short session',
  }
}

export function returnMessage(workouts, today) {
  const last = workouts
    .filter((w) => !w.sample && w.date <= today && w.exercises?.some((e) => e.sets?.length))
    .map((w) => w.date)
    .sort()
    .at(-1)
  return last && last <= addDays(today, -7) ? 'Welcome back. We’ll ease you in.' : null
}
