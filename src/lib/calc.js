import { lastNDays, todayKey, addDays, fromKey } from './date.js'

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
export const round = (n) => Math.round(n)

export function scaled(entry) {
  const s = num(entry.servings) || 1
  return {
    calories: num(entry.calories) * s,
    protein: num(entry.protein) * s,
    carbs: num(entry.carbs) * s,
    fat: num(entry.fat) * s,
  }
}

export function sumEntries(entries) {
  return entries.reduce(
    (acc, e) => {
      const v = scaled(e)
      acc.calories += v.calories
      acc.protein += v.protein
      acc.carbs += v.carbs
      acc.fat += v.fat
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function groupByMeal(entries) {
  return MEALS.map((meal) => {
    const items = entries.filter((e) => e.meal === meal)
    return { meal, items, totals: sumEntries(items) }
  })
}

function loggedOn(state, key) {
  const hasFood = state.entries.some((e) => e.date === key)
  const m = state.metrics[key]
  const hasMetric = m && (num(m.water) > 0 || m.weight != null)
  return hasFood || hasMetric
}

export function computeStreak(state, todayKeyStr) {
  let streak = 0
  let cursor = todayKeyStr
  if (!loggedOn(state, cursor)) {
    cursor = addDays(cursor, -1)
  }
  for (let i = 0; i < 3650; i++) {
    if (loggedOn(state, cursor)) {
      streak++
      cursor = addDays(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

export function dailySeries(state, n) {
  return lastNDays(n).map((key) => {
    const dayEntries = state.entries.filter((e) => e.date === key)
    const t = sumEntries(dayEntries)
    return {
      date: key,
      calories: round(t.calories),
      protein: round(t.protein),
      carbs: round(t.carbs),
      fat: round(t.fat),
    }
  })
}

// Per-day deficit (positive = under goal = deficit, negative = surplus)
export function deficitSeries(state, n) {
  const goal = state.settings.goals.calories
  return dailySeries(state, n).map((d) => ({
    ...d,
    deficit: d.calories > 0 ? goal - d.calories : null,
  }))
}

// Stacked macro data where each macro is in its calorie-equivalent form
export function macroStackSeries(state, n) {
  return dailySeries(state, n).map((d) => ({
    date: d.date,
    proteinCal: round(d.protein * 4),
    carbsCal: round(d.carbs * 4),
    fatCal: round(d.fat * 9),
  }))
}

export function averageMacros(series) {
  const active = series.filter((d) => d.calories > 0)
  if (active.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const sum = active.reduce(
    (a, d) => ({
      calories: a.calories + d.calories,
      protein: a.protein + d.protein,
      carbs: a.carbs + d.carbs,
      fat: a.fat + d.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const k = active.length
  return {
    calories: round(sum.calories / k),
    protein: round(sum.protein / k),
    carbs: round(sum.carbs / k),
    fat: round(sum.fat / k),
  }
}

export function weightSeries(state) {
  return Object.entries(state.metrics)
    .filter(([, m]) => m && m.weight != null && Number.isFinite(Number(m.weight)))
    .map(([date, m]) => ({ date, weight: Number(m.weight) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// Weekly comparison: this 7 days vs the previous 7 days (only logged days)
export function weeklyStats(state, todayStr) {
  const thisWeek = lastNDays(7).map((key) => {
    const entries = state.entries.filter((e) => e.date === key)
    return { key, total: sumEntries(entries) }
  })
  const lastWeekKeys = Array.from({ length: 7 }, (_, i) => addDays(todayStr, -(7 + i))).reverse()
  const lastWeek = lastWeekKeys.map((key) => {
    const entries = state.entries.filter((e) => e.date === key)
    return { key, total: sumEntries(entries) }
  })

  const goal = state.settings.goals.calories
  const thisActive = thisWeek.filter((d) => d.total.calories > 0)
  const lastActive = lastWeek.filter((d) => d.total.calories > 0)

  const avgThis = thisActive.length
    ? round(thisActive.reduce((s, d) => s + d.total.calories, 0) / thisActive.length)
    : 0
  const avgLast = lastActive.length
    ? round(lastActive.reduce((s, d) => s + d.total.calories, 0) / lastActive.length)
    : 0

  const onTarget = thisActive.filter(
    (d) => Math.abs(d.total.calories - goal) / (goal || 1) < 0.15,
  ).length

  const totalDeficit = thisActive.reduce((s, d) => s + (goal - d.total.calories), 0)

  return {
    daysLogged: thisActive.length,
    avgCalories: avgThis,
    avgLast,
    onTarget,
    totalDeficit: round(totalDeficit),
  }
}

// Unique foods eaten in the last N days (for the recently-eaten strip)
export function recentFoods(state, n = 14, excludeDate = null) {
  const cutoff = addDays(todayKey(), -n)
  const seen = new Map()
  // Sort entries newest-first so the first occurrence of a name is the most recent
  const sorted = [...state.entries]
    .filter((e) => e.date >= cutoff && e.date !== excludeDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const entry of sorted) {
    const key = entry.name.trim().toLowerCase()
    if (!seen.has(key)) seen.set(key, entry)
  }
  return [...seen.values()]
}

// Achievement badges — purely derived from state
export function computeAchievements(state, todayStr) {
  const streak = computeStreak(state, todayStr)
  const total = state.entries.length
  const foods = state.foods.length

  // Days where water goal was met
  const wg = state.settings.waterGoal || 8
  const waterDays = Object.values(state.metrics).filter((m) => (m?.water || 0) >= wg).length

  // Days where calories were within ±10% of goal
  const goal = state.settings.goals.calories
  const onTargetDays = Object.keys(
    Object.fromEntries(state.entries.map((e) => [e.date, true])),
  ).filter((date) => {
    const cal = round(sumEntries(state.entries.filter((e) => e.date === date)).calories)
    return Math.abs(cal - goal) / (goal || 1) < 0.1
  }).length

  const badges = [
    { id: 'first', icon: '🌱', label: 'First Log', desc: 'Logged your very first day', earned: total >= 1 },
    { id: 'week', icon: '🔥', label: 'On Fire', desc: '7-day logging streak', earned: streak >= 7 },
    { id: 'month', icon: '🏆', label: 'Iron Will', desc: '30-day streak', earned: streak >= 30 },
    { id: 'library', icon: '📚', label: 'Library Builder', desc: '10+ foods saved', earned: foods >= 10 },
    { id: 'dedicated', icon: '📊', label: 'Dedicated', desc: '50+ entries logged', earned: total >= 50 },
    { id: 'hydrated', icon: '💧', label: 'Hydrated', desc: 'Hit water goal 7 days', earned: waterDays >= 7 },
    { id: 'precision', icon: '🎯', label: 'Precision', desc: 'Hit calorie goal 5 days', earned: onTargetDays >= 5 },
  ]
  return badges
}
