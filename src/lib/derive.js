// Numbers the screens show, worked out from saved workouts.

import { addDays, fromKey, todayKey } from './date.js'
import { muscleSets, weekStart } from './workout.js'

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

// The seven days of this week with what happened on each.
export function weekDays(workouts, today = todayKey()) {
  const start = weekStart(today)
  const trained = new Set(workouts.map((w) => w.date))
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => {
    const date = addDays(start, i)
    return { l, date, done: trained.has(date), today: date === today, future: date > today }
  })
}

export function volumeBetween(workouts, from, to) {
  return workouts.reduce((s, w) => (w.date >= from && w.date <= to ? s + (w.totals?.volume || 0) : s), 0)
}

// This week's volume against the same days last week.
export function weekVolume(workouts, today = todayKey()) {
  const start = weekStart(today)
  const now = volumeBetween(workouts, start, today)
  const lastStart = addDays(start, -7)
  const before = volumeBetween(workouts, lastStart, addDays(today, -7))
  return { now, change: before ? Math.round((now / before - 1) * 100) : null }
}

export function avgSessionMin(workouts, n = 10) {
  const last = workouts.slice(-n)
  if (!last.length) return null
  return Math.round(last.reduce((s, w) => s + (w.durationSec || 0), 0) / last.length / 60)
}

// Muscle groups trained in the last 4 weeks, folded into five buckets.
export function muscleBalance(workouts, today = todayKey()) {
  const fold = { Glutes: 'Legs', Biceps: 'Arms', Triceps: 'Arms', Core: 'Core', Cardio: 'Other', Mobility: 'Other' }
  const raw = muscleSets(workouts, addDays(today, -27))
  const map = new Map()
  for (const { muscle, sets } of raw) {
    const k = fold[muscle] || muscle
    map.set(k, (map.get(k) || 0) + sets)
  }
  return [...map.entries()].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets)
}

// Total volume per Monday-start week, oldest first.
export function weeklyVolume(workouts, weeks = 8, today = todayKey()) {
  const thisWeek = weekStart(today)
  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i)
    out.push({ start, volume: volumeBetween(workouts, start, addDays(start, 6)) })
  }
  return out
}

export function monthlyVolume(workouts, months = 6, today = todayKey()) {
  const d = fromKey(today)
  const out = []
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const prefix = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
    out.push({ year: m.getFullYear(), month: m.getMonth(), volume: workouts.reduce((s, w) => (w.date.startsWith(prefix) ? s + (w.totals?.volume || 0) : s), 0) })
  }
  return out
}

// Days a routine has gone untrained, for the "Recommended today" line.
export function daysSince(workouts, routineId, today = todayKey()) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    if (workouts[i].routineId === routineId) {
      return Math.round((fromKey(today) - fromKey(workouts[i].date)) / 86400000)
    }
  }
  return null
}

export function relativeDay(key, today = todayKey()) {
  if (!key) return 'Not yet'
  const n = Math.round((fromKey(today) - fromKey(key)) / 86400000)
  if (n === 0) return 'Today'
  if (n === 1) return 'Yesterday'
  if (n < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][fromKey(key).getDay()]
  return `${n} days ago`
}
