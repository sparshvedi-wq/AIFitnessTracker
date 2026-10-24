// Tally score: one number for growth and consistency, 0 to 100.
//
// PLACEHOLDER FORMULA. Sid is writing the real one; swap it in here and
// everything on Home and the workout summary follows.
//
//   consistency = sessions in the last 4 weeks ÷ (weekly goal × 4), capped at 1
//   growth      = volume in the last 4 weeks vs the 4 weeks before,
//                 mapped so "same as before" is 0.5 and +50% or more is 1
//   score       = 60% consistency + 40% growth

import { addDays, todayKey } from './date.js'
import { weekStart } from './workout.js'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

function windowStats(workouts, from, to) {
  let sessions = 0
  let volume = 0
  for (const w of workouts) {
    if (w.date < from || w.date > to) continue
    sessions++
    volume += w.totals?.volume || 0
  }
  return { sessions, volume }
}

export function growthRatio(workouts, end) {
  const now = windowStats(workouts, addDays(end, -27), end)
  const before = windowStats(workouts, addDays(end, -55), addDays(end, -28))
  if (!before.volume) return 0
  return now.volume / before.volume - 1
}

// The two halves of the score, so Home can show what it's made of.
export function scoreParts(workouts, goal, end) {
  const { sessions } = windowStats(workouts, addDays(end, -27), end)
  const consistency = clamp(sessions / Math.max(1, goal * 4), 0, 1)
  const ratio = growthRatio(workouts, end)
  return { consistency, ratio, growth: clamp(0.5 + ratio, 0, 1) }
}

export function scoreAt(workouts, goal, end) {
  const { consistency, growth } = scoreParts(workouts, goal, end)
  return Math.round(100 * (0.6 * consistency + 0.4 * growth))
}

// Weekly score points ending today, oldest first.
export function scoreSeries(workouts, goal, weeks = 8, today = todayKey()) {
  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = i === 0 ? today : addDays(weekStart(today), -7 * i + 6)
    out.push({ date: end, score: scoreAt(workouts, goal, end) })
  }
  return out
}

// Share of weeks in the last 8 that hit the weekly goal (this week counts
// only if it already has).
export function consistencyPct(workouts, goal, today = todayKey()) {
  const thisWeek = weekStart(today)
  let hit = 0
  let weeks = 0
  for (let i = 0; i < 8; i++) {
    const start = addDays(thisWeek, -7 * i)
    const { sessions } = windowStats(workouts, start, addDays(start, 6))
    if (i === 0 && sessions < goal) continue
    weeks++
    if (sessions >= goal) hit++
  }
  return weeks ? Math.round((hit / weeks) * 100) : 0
}
