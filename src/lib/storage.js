import { todayKey } from './date.js'
import { isNativeApp, persistNativeState, readNativeState } from './native.js'
import { DEFAULT_PROFILE } from './planner.js'
import { DEFAULT_DISPLAY } from './preferences.js'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, validateSnapshot } from '../../expo/src/protocol.js'
import { EXERCISES, ORIGINAL_IDS } from './exercises.js'
import { migrateExerciseIds, ID_MIGRATION_VERSION } from './catalog/migrations.js'
import { normalizeLearning } from './engine/learning.js'

export { STORAGE_KEY }

// Fields left over from the app's calorie-tracker origins. Old saves and
// backups may still carry them; they are dropped when a save is opened.
const RETIRED_KEYS = ['entries', 'foods']
const RETIRED_SETTINGS = ['goals', 'useMacroPercent', 'macroPercent', 'waterGoal']

export function defaultState() {
  return {
    version: 2,
    // metrics: { [dateKey]: { weight, sampleWeight } }
    metrics: {},
    // routines: your saved workout plans (see lib/workout.js)
    routines: [],
    // customExercises: exercises you added yourself, same shape as lib/exercises.js
    customExercises: [],
    // workouts: finished guided sessions, oldest first
    workouts: [],
    checkins: [],
    // learning: explicit exercise feedback, question history and resets (engine/learning.js)
    learning: normalizeLearning(null),
    readiness: null,
    // activeWorkout: the session in progress, so a reload picks up where you left off
    activeWorkout: null,
    settings: {
      training: { ...DEFAULT_PROFILE },
      display: { ...DEFAULT_DISPLAY },
      weightUnit: 'lb',
      // Shown in the Home greeting and on the You tab
      name: '',
      // Strength goal on the You tab
      liftGoal: null,
      workout: {
        weeklyGoal: 3,
        goalMode: 'flexible',
        countdown: 5, // get-ready seconds before the first set
        sound: true,
        voice: true,
        vibrate: true,
        keepAwake: true, // hold a screen wake lock while the player is open
      },
    },
    createdAt: todayKey(),
    catalogVersion: ID_MIGRATION_VERSION,
  }
}

const CATALOG = {
  builtIn: new Map(EXERCISES.map((e) => [e.id, e.name])),
  original: new Set(ORIGINAL_IDS),
}

function readBrowserSave() {
  // Older versions saved under the legacy key. It is read, never deleted.
  return localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
}

export function loadState() {
  try {
    const raw = isNativeApp() ? readNativeState() : readBrowserSave()
    if (!raw) return defaultState()
    return normalizeState(validateSnapshot(raw))
  } catch (err) {
    console.error('Failed to load saved training:', err)
    throw new Error('Your saved training could not be opened. The saved copy has not been replaced.')
  }
}

export const byDate = (a, b) =>
  String(a.date).localeCompare(String(b.date)) || (a.startedAt ?? 0) - (b.startedAt ?? 0)

// Fill in anything an older save or backup is missing.
export function normalizeState(parsed) {
  const base = defaultState()
  const state = { ...base, ...parsed }
  for (const key of RETIRED_KEYS) delete state[key]
  const settings = { ...base.settings, ...(parsed.settings || {}) }
  for (const key of RETIRED_SETTINGS) delete settings[key]
  const normalized = {
    ...state,
    version: base.version,
    settings: {
      ...settings,
      workout: { ...base.settings.workout, ...(parsed.settings?.workout || {}) },
      training: { ...DEFAULT_PROFILE, ...(parsed.settings?.training || {}) },
      display: { ...DEFAULT_DISPLAY, ...(parsed.settings?.display || {}) },
    },
    metrics: parsed.metrics || {},
    routines: parsed.routines || [],
    customExercises: parsed.customExercises || [],
    // Restored backups are not guaranteed to be in order; every screen assumes oldest first.
    workouts: [...(parsed.workouts || [])].sort(byDate),
    checkins: parsed.checkins || [],
    activeWorkout: parsed.activeWorkout || null,
    learning: normalizeLearning(parsed.learning),
  }
  // Idempotent: a save that was already migrated comes back unchanged.
  return migrateExerciseIds(normalized, CATALOG).state
}

export function saveState(state) {
  try {
    const raw = JSON.stringify(state)
    if (isNativeApp()) return persistNativeState(raw)
    localStorage.setItem(STORAGE_KEY, raw)
    return Promise.resolve()
  } catch (err) {
    console.error('Failed to save state:', err)
    return Promise.reject(err)
  }
}
