import { addDays } from './date.js'

export const SHORT_DURATIONS = [5, 10, 15]
export const shortSessionRequest = () => ({ kind: 'adaptive', shortSession: true, minutes: 10, items: [] })

// Session setup's time step: quick choices per kind, plus a custom time for full sessions.
const CUSTOM_DURATIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90]
export function durationChoices(kind, short = false) {
  if (short) return SHORT_DURATIONS
  if (kind === 'pump') return [5, 10, 15]
  if (kind === 'sport') return [5, 10, 15, 20]
  return [15, 20, 30, 45]
}
export const customDurationAllowed = (kind, short = false) => !short && !['sport', 'pump'].includes(kind)

/**
 * The time a setup opens with. A requested length (for example 25 minutes from
 * Ask) is kept where a custom time is offered; otherwise the nearest quick
 * choice is selected, so the step never opens with nothing chosen.
 */
export function fitDuration(minutes, kind, short = false) {
  const choices = durationChoices(kind, short)
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return choices[1] ?? choices[0]
  if (choices.includes(value) || customDurationAllowed(kind, short)) return value
  return choices.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best))
}

/** Custom times not already offered as quick choices, always including the current one. */
export function customDurationOptions(minutes, kind, short = false) {
  const choices = durationChoices(kind, short)
  return [...new Set([...CUSTOM_DURATIONS, minutes])]
    .filter((v) => Number.isFinite(v) && v > 0 && !choices.includes(v))
    .sort((a, b) => a - b)
}

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
