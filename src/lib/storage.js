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
    // routines: your saved workout plans (see lib/workout.js)
    routines: [],
    // customExercises: exercises you added yourself, same shape as lib/exercises.js
    customExercises: [],
    // workouts: finished guided sessions, oldest first
    workouts: [],
    // activeWorkout: the session in progress, so a reload picks up where you left off
    activeWorkout: null,
    settings: {
      goals: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
      useMacroPercent: false,
      macroPercent: { protein: 30, carbs: 40, fat: 30 },
      waterGoal: 8,
      weightUnit: 'lb',
      // 'system' | 'light' | 'dark'. Tally is dark-first.
      theme: 'dark',
      workout: {
        weeklyGoal: 3,
        countdown: 5, // get-ready seconds before the first set
        sound: true,
        voice: true,
        vibrate: true,
        keepAwake: true, // hold a screen wake lock while the player is open
      },
    },
    createdAt: todayKey(),
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return normalizeState(JSON.parse(raw))
  } catch (err) {
    console.error('Failed to load state, starting fresh:', err)
    return defaultState()
  }
}

// Fill in anything an older save or backup is missing.
export function normalizeState(parsed) {
  const base = defaultState()
  return {
    ...base,
    ...parsed,
    settings: {
      ...base.settings,
      ...(parsed.settings || {}),
      goals: { ...base.settings.goals, ...(parsed.settings?.goals || {}) },
      macroPercent: { ...base.settings.macroPercent, ...(parsed.settings?.macroPercent || {}) },
      workout: { ...base.settings.workout, ...(parsed.settings?.workout || {}) },
    },
    routines: parsed.routines || [],
    customExercises: parsed.customExercises || [],
    workouts: parsed.workouts || [],
    activeWorkout: parsed.activeWorkout || null,
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
