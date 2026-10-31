import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadState, saveState, defaultState, normalizeState } from '../lib/storage.js'
import { uid } from '../lib/id.js'
import { todayKey } from '../lib/date.js'
import { makeSampleWeights, makeSampleWorkouts } from '../lib/sample.js'
import { AppContext } from './context.js'
import { resetForTesting } from '../lib/testing.js'
import { convertStateUnits } from '../lib/units.js'
import { saveTrainingEvent } from '../lib/training-events.js'
import { rebuildRecords } from '../lib/workout-history.js'
import { deletePreviews, keptPreviewIds, savePreviews } from '../lib/photo-store.js'

function reducer(state, action) {
  switch (action.type) {
    case 'SET_METRIC': {
      const prev = state.metrics[action.date] || { weight: null }
      return {
        ...state,
        metrics: { ...state.metrics, [action.date]: { ...prev, ...action.patch } },
      }
    }

    case 'UPDATE_SETTINGS': {
      state = convertStateUnits(state, action.patch.weightUnit)
      return { ...state, settings: { ...state.settings, ...action.patch } }
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

    case 'SET_READINESS':
      return { ...state, readiness: action.readiness }
    case 'SAVE_TRAINING_EVENT':
      return {
        ...state,
        settings: { ...state.settings, training: saveTrainingEvent(state.settings.training, action.event) },
      }

    case 'SAVE_CHECKIN': {
      // Images are stored separately (lib/photo-store.js); only the most recent keep them.
      const checkins = [...state.checkins.filter((c) => c.id !== action.checkin.id), action.checkin]
      const kept = new Set(keptPreviewIds(checkins))
      return {
        ...state,
        checkins: checkins.map((c) => (kept.has(c.id) ? c : { ...c, hasPreviews: false })),
      }
    }

    case 'DELETE_CHECKIN': {
      const checkins = state.checkins.filter((c) => c.id !== action.id)
      const training = { ...state.settings.training }
      if (training.focusCheckinId === action.id)
        Object.assign(training, {
          confirmedFocus: [],
          focusCheckinId: null,
          weakerSide: '',
          sideTestConfirmed: false,
        })
      if (training.baselinePhotoId === action.id)
        training.baselinePhotoId =
          checkins.filter((c) => !c.synthetic && !c.sample).sort((a, b) => a.createdAt - b.createdAt)[0]
            ?.id || null
      return { ...state, checkins, settings: { ...state.settings, training } }
    }

    case 'FINISH_WORKOUT':
      return {
        ...state,
        activeWorkout: null,
        workouts: rebuildRecords([...state.workouts, action.workout]),
        settings:
          action.workout.kind === 'sport'
            ? {
                ...state.settings,
                training: {
                  ...state.settings.training,
                  lastSport: action.workout.sport,
                  lastSportMinutes: action.workout.requestedMinutes || 10,
                },
              }
            : state.settings,
      }

    case 'DELETE_WORKOUT':
      return { ...state, workouts: rebuildRecords(state.workouts.filter((w) => w.id !== action.id)) }

    case 'UPDATE_WORKOUT':
      return {
        ...state,
        workouts: rebuildRecords(
          state.workouts.map((w) => (w.id === action.workout.id ? action.workout : w)),
        ),
      }

    case 'RESTORE_WORKOUT':
      return {
        ...state,
        workouts: rebuildRecords([...state.workouts, action.workout]),
      }

    // Load or remove the preview history from lib/sample.js
    case 'SET_SAMPLE': {
      if (action.on) {
        const weights = makeSampleWeights()
        const metrics = { ...state.metrics }
        for (const [date, weight] of Object.entries(weights)) {
          if (metrics[date]?.weight == null)
            metrics[date] = { ...(metrics[date] || {}), weight, sampleWeight: true }
        }
        return {
          ...state,
          sample: true,
          metrics,
          workouts: [...state.workouts.filter((w) => !w.sample), ...makeSampleWorkouts()].sort(
            (a, b) => a.startedAt - b.startedAt,
          ),
        }
      }
      const metrics = {}
      for (const [date, m] of Object.entries(state.metrics)) {
        metrics[date] = m.sampleWeight ? { ...m, weight: null, sampleWeight: false } : m
      }
      return { ...state, sample: false, metrics, workouts: state.workouts.filter((w) => !w.sample) }
    }

    case 'IMPORT_STATE':
      return normalizeState(action.state)

    case 'RESET':
      return defaultState()

    case 'RESET_TESTING':
      return resetForTesting(state, action.stage)

    default:
      return state
  }
}

export function AppProvider({ children, initialState, initialPreviews = {} }) {
  const [state, dispatch] = useReducer(reducer, initialState, (saved) => saved || loadState())
  const [photoPreviews, setPhotoPreviews] = useState(initialPreviews)

  // Store the images first, then record the check-in, so a saved check-in never
  // points at images that failed to save.
  const saveCheckin = useCallback(async (checkin) => {
    const { previews, ...record } = checkin
    if (previews) await savePreviews(record.id, previews)
    dispatch({ type: 'SAVE_CHECKIN', checkin: { ...record, hasPreviews: Boolean(previews) } })
    if (previews) setPhotoPreviews((all) => ({ ...all, [record.id]: previews }))
  }, [])

  // Deleted, reset, replaced or older check-ins release their stored images.
  useEffect(() => {
    const kept = new Set(keptPreviewIds(state.checkins.filter((c) => c.hasPreviews !== false)))
    const stale = Object.keys(photoPreviews).filter((id) => !kept.has(id))
    if (!stale.length) return
    setPhotoPreviews((all) => Object.fromEntries(Object.entries(all).filter(([id]) => kept.has(id))))
    deletePreviews(stale).catch((error) => console.error('Could not remove check-in photos:', error))
  }, [state.checkins, photoPreviews])
  const [toasts, setToasts] = useState([])
  const [today, setToday] = useState(todayKey)
  const [storageError, setStorageError] = useState(false)
  const [saveAttempt, setSaveAttempt] = useState(0)
  const retrySave = useCallback(() => setSaveAttempt((n) => n + 1), [])

  useEffect(() => {
    const updateDay = () => setToday(todayKey())
    const interval = setInterval(updateDay, 60_000)
    document.addEventListener('visibilitychange', updateDay)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', updateDay)
    }
  }, [])

  useEffect(() => {
    let current = true
    Promise.resolve(saveState(state))
      .then(() => {
        if (current) setStorageError(false)
      })
      .catch(() => {
        if (current) setStorageError(true)
      })
    return () => {
      current = false
    }
  }, [state, saveAttempt])

  const toastTimers = useRef(new Map())
  useEffect(() => {
    const timers = toastTimers.current
    return () => timers.forEach(clearTimeout)
  }, [])

  const dismissToast = useCallback((id) => {
    clearTimeout(toastTimers.current.get(id))
    toastTimers.current.delete(id)
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  // At most two messages at once; a newer one replaces the oldest.
  const toast = useCallback(
    (message, kind = 'success', action = null) => {
      const id = uid()
      setToasts((t) => [...t.slice(-1), { id, message, kind, action }])
      toastTimers.current.set(
        id,
        setTimeout(() => dismissToast(id), action ? 8000 : 4000),
      )
    },
    [dismissToast],
  )

  // Date-dependent recommendations refresh across midnight, even without a new log.
  const value = useMemo(
    () => ({
      state,
      dispatch,
      toast,
      toasts,
      dismissToast,
      today,
      storageError,
      retrySave,
      photoPreviews,
      saveCheckin,
    }),
    [state, toast, toasts, dismissToast, today, storageError, retrySave, photoPreviews, saveCheckin],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
