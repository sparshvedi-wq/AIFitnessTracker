import { todayKey } from './date.js'

export const STORAGE_KEY = 'calorie-tracker:v1'
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 }

export function defaultState() {
  return {
    version: 1,
    entries: [],
    // foods: { id, name, calories, protein, carbs, fat, servingSize, favorite, usageCount }
    foods: [],
    // metrics: { [dateKey]: { water, weight, note } }
    metrics: {},
    settings: {
      goals: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
      useMacroPercent: false,
      macroPercent: { protein: 30, carbs: 40, fat: 30 },
      waterGoal: 8,
      weightUnit: 'lb',
      // 'system' | 'light' | 'dark'
      theme: 'system',
    },
    createdAt: todayKey(),
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    const base = defaultState()
    return {
      ...base,
      ...parsed,
      settings: {
        ...base.settings,
        ...(parsed.settings || {}),
        goals: { ...base.settings.goals, ...(parsed.settings?.goals || {}) },
        macroPercent: { ...base.settings.macroPercent, ...(parsed.settings?.macroPercent || {}) },
      },
    }
  } catch (err) {
    console.error('Failed to load state, starting fresh:', err)
    return defaultState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Failed to save state:', err)
  }
}

export function gramGoalsFromPercent(calories, macroPercent) {
  return {
    protein: Math.round((calories * (macroPercent.protein / 100)) / KCAL_PER_GRAM.protein),
    carbs: Math.round((calories * (macroPercent.carbs / 100)) / KCAL_PER_GRAM.carbs),
    fat: Math.round((calories * (macroPercent.fat / 100)) / KCAL_PER_GRAM.fat),
  }
}
