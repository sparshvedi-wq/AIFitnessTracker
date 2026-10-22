import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { loadState, saveState, defaultState, normalizeState, gramGoalsFromPercent } from '../lib/storage.js'
import { uid } from '../lib/id.js'
import { todayKey } from '../lib/date.js'

const AppContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTRY':
      return { ...state, entries: [...state.entries, action.entry] }

    case 'ADD_ENTRIES': // batch add (used by copy-from-day)
      return { ...state, entries: [...state.entries, ...action.entries] }

    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.entry.id ? { ...e, ...action.entry } : e,
        ),
      }

    case 'DELETE_ENTRY':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) }

    case 'SAVE_FOOD': {
      const name = action.food.name.trim()
      if (!name) return state
      const idx = state.foods.findIndex(
        (f) => f.name.trim().toLowerCase() === name.toLowerCase(),
      )
      const food = { ...action.food, name }
      if (idx >= 0) {
        const foods = state.foods.slice()
        foods[idx] = { ...foods[idx], ...food, id: foods[idx].id, favorite: foods[idx].favorite, usageCount: foods[idx].usageCount ?? 0 }
        return { ...state, foods }
      }
      return {
        ...state,
        foods: [
          ...state.foods,
          { ...food, id: food.id || uid(), favorite: false, usageCount: 0 },
        ],
      }
    }

    case 'EDIT_FOOD': {
      return {
        ...state,
        foods: state.foods.map((f) =>
          f.id === action.food.id ? { ...f, ...action.food } : f,
        ),
      }
    }

    case 'DELETE_FOOD':
      return { ...state, foods: state.foods.filter((f) => f.id !== action.id) }

    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        foods: state.foods.map((f) =>
          f.id === action.id ? { ...f, favorite: !f.favorite } : f,
        ),
      }

    case 'INCREMENT_FOOD_USAGE': {
      const name = action.name.trim().toLowerCase()
      return {
        ...state,
        foods: state.foods.map((f) =>
          f.name.trim().toLowerCase() === name
            ? { ...f, usageCount: (f.usageCount || 0) + 1 }
            : f,
        ),
      }
    }

    case 'SET_METRIC': {
      const prev = state.metrics[action.date] || { water: 0, weight: null, note: '' }
      return {
        ...state,
        metrics: { ...state.metrics, [action.date]: { ...prev, ...action.patch } },
      }
    }

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.settings, ...action.patch }
      if (settings.useMacroPercent) {
        settings.goals = {
          ...settings.goals,
          ...gramGoalsFromPercent(settings.goals.calories, settings.macroPercent),
        }
      }
      return { ...state, settings }
    }

    case 'SAVE_ROUTINE': {
      const exists = state.routines.some((r) => r.id === action.routine.id)
      return {
        ...state,
        routines: exists
          ? state.routines.map((r) => (r.id === action.routine.id ? action.routine : r))
          : [...state.routines, action.routine],
      }
    }

    case 'DELETE_ROUTINE':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) }

    case 'SAVE_EXERCISE':
      return { ...state, customExercises: [...state.customExercises, action.exercise] }

    case 'SET_ACTIVE_WORKOUT': // start, advance or discard (session: null)
      return { ...state, activeWorkout: action.session }

    case 'FINISH_WORKOUT':
      return { ...state, activeWorkout: null, workouts: [...state.workouts, action.workout] }

    case 'DELETE_WORKOUT':
      return { ...state, workouts: state.workouts.filter((w) => w.id !== action.id) }

    case 'RESTORE_WORKOUT':
      return {
        ...state,
        workouts: [...state.workouts, action.workout].sort((a, b) => a.startedAt - b.startedAt),
      }

    case 'IMPORT_STATE':
      return normalizeState(action.state)

    case 'RESET':
      return defaultState()

    default:
      return state
  }
}

// Apply 'dark' class to <html> based on the theme setting + OS preference.
function applyTheme(pref) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = pref === 'dark' || (pref === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [toasts, setToasts] = useState([])

  useEffect(() => { saveState(state) }, [state])

  // Re-apply theme whenever the setting changes or OS preference changes
  useEffect(() => {
    const pref = state.settings.theme || 'system'
    applyTheme(pref)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(pref)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [state.settings.theme])

  const toast = useCallback((message, kind = 'success', action = null) => {
    const id = uid()
    setToasts((t) => [...t, { id, message, kind, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const value = useMemo(
    () => ({ state, dispatch, toast, toasts, dismissToast, today: todayKey() }),
    [state, toast, toasts, dismissToast],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
