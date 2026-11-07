import { findExercise } from './exercises.js'
import { sportById } from './sports.js'

export function planSummary(plan) {
  if (!plan.items.length) return 'No exercises match today’s check-in.'
  if (plan.movement?.position === 'seated') return 'Light seated movement.'
  if (/restart after time away/i.test(plan.focus)) return 'A lighter return to training.'
  if (plan.schedule?.lighter) {
    const source = plan.schedule.reasonEvent
    const name = source?.title || source?.name
    if (plan.schedule.reasonPhase === 'after' && source?.status === 'planned')
      return 'Lighter work around your planned activity.'
    return name
      ? `Lighter work ${plan.schedule.reasonPhase || 'around'} ${name.toLowerCase()}.`
      : 'Lighter work around your recent activity.'
  }
  if (plan.schedule?.preparation)
    return `Balanced training with a little ${sportById(plan.schedule.preparation.sport).name.toLowerCase()} preparation.`
  if (plan.focus) return plan.focus
  if (plan.firstSession) return ''
  const muscles = plan.items.map((i) => findExercise(i.exId)?.muscle)
  const lower = muscles.some((m) => ['Legs', 'Glutes'].includes(m))
  const upper = muscles.some((m) => ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'].includes(m))
  const easy =
    plan.readiness?.energy === 'low' || plan.readiness?.intensity === 'easy' || plan.readiness?.sportSoon
  const area = upper && lower ? 'Full-body' : upper ? 'Upper-body' : lower ? 'Lower-body' : 'Core'
  return `${area} ${easy ? 'work at an easier pace' : 'training'}.`
}

// A calm greeting for the Home header. No streaks, no pressure.
export function greeting(now = Date.now(), name = '') {
  const hour = new Date(now).getHours()
  const part =
    hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

// "1 set", "3 sets". Every count shown to people goes through here.
export const count = (n, word, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`
