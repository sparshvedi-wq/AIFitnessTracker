// App shell: four tabs (Home, Train, History, You), plus the active workout,
// which keeps running above whichever tab is open.

import { useEffect, useRef, useState } from 'react'
import Home from './pages/Home.jsx'
import Train from './pages/Train.jsx'
import History from './pages/History.jsx'
import You from './pages/You.jsx'
import WorkoutHost from './components/workout/WorkoutHost.jsx'
import { useApp } from './store/AppContext.jsx'
import ToastHost from './components/Toast.jsx'
import Icon from './components/Icon.jsx'
import SessionSetup from './components/training/SessionSetup.jsx'
import TrainingProfile from './components/training/TrainingProfile.jsx'
import PhotoCheckins from './components/training/PhotoCheckins.jsx'
import PersonalSettings from './components/training/PersonalSettings.jsx'
import { displayOf } from './lib/preferences.js'
import TrainingEvents from './components/training/TrainingEvents.jsx'
import { ONBOARDING_VERSION } from './lib/onboarding.js'
import { shortSessionRequest } from './lib/flexible-training.js'
import { photoDraft } from './lib/photo-draft.js'
import WorkoutSwitchDialog from './components/workout/WorkoutSwitchDialog.jsx'
import { endForSwitch } from './lib/workout-switch.js'
import { feel } from './lib/coach.js'
import { firstSessionAchievement } from './lib/milestones.js'

// Quiet, consistent touch feedback: a selection tick on choices and toggles,
// a light tap on primary actions. Follows the Haptics setting.
function useTapHaptics(prefs) {
  const latest = useRef(prefs)
  useEffect(() => {
    latest.current = prefs
  }, [prefs])
  useEffect(() => {
    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target : null
      const control = target?.closest('button, [role="button"], [role="radio"], [role="switch"], input')
      if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return
      if (control.matches('.btn-primary')) feel(latest.current, 'light')
      else if (
        control.matches('[aria-pressed], [role="radio"], [role="switch"], [aria-checked], input[type="checkbox"]')
      )
        feel(latest.current, 'selection')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
}

// Follows the Appearance setting; "system" tracks the device and updates live.
function useTheme(preference = 'system') {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = preference === 'dark' || (preference !== 'light' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().split(/\s+/)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg.join(',')})`)
      try {
        localStorage.setItem('tally:theme', preference)
      } catch {
        // Only a first-paint hint; the saved setting is the source of truth.
      }
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'train', label: 'Train', icon: 'train' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'you', label: 'You', icon: 'you' },
]

export default function App() {
  const { state, dispatch, toast, today } = useApp()
  const [tab, setTab] = useState('home')
  const [setup, setSetup] = useState(null)
  const [pendingWorkout, setPendingWorkout] = useState(null)
  const [profileOpen, setProfileOpen] = useState(
    !state.settings.training.completed ||
      (state.settings.training.onboardingVersion || 0) < ONBOARDING_VERSION,
  )
  const [eventsOpen, setEventsOpen] = useState(null)
  const [photosOpen, setPhotosOpen] = useState(false)
  const [photoId, setPhotoId] = useState(null)
  const [personalOpen, setPersonalOpen] = useState(false)
  const display = displayOf(state)
  // Sheets rendered through a portal must inherit the same access preferences.
  useEffect(() => {
    document.documentElement.classList.toggle('tally-large-text', display.largeText)
    document.documentElement.classList.toggle('tally-reduce-motion', display.reducedMotion)
    return () => document.documentElement.classList.remove('tally-large-text', 'tally-reduce-motion')
  }, [display.largeText, display.reducedMotion])
  // Reopen the player after a reload if a workout was in progress.
  const [playerOpen, setPlayerOpen] = useState(() => Boolean(state.activeWorkout))

  useTheme(state.settings.theme)
  useTapHaptics(state.settings.workout)
  // Erasing all data returns to first-run setup.
  const needsSetup = !state.settings.training.completed
  useEffect(() => {
    if (needsSetup) setProfileOpen(true)
  }, [needsSetup])

  // Each tab keeps its scroll position; tapping the current tab returns to its top.
  const scrollByTab = useRef({})
  const go = (id) => {
    if (id === tab) {
      window.scrollTo({ top: 0, behavior: display.reducedMotion ? 'auto' : 'smooth' })
      return
    }
    scrollByTab.current[tab] = window.scrollY
    setTab(id)
    requestAnimationFrame(() => window.scrollTo(0, scrollByTab.current[id] || 0))
  }
  const resetTesting = (stage) => {
    if (!['onboarding', 'after-onboarding'].includes(stage)) return
    void photoDraft('clear').catch(() => {})
    dispatch({ type: 'RESET_TESTING', stage })
    setSetup(null)
    setPendingWorkout(null)
    setPlayerOpen(false)
    setPhotosOpen(false)
    setProfileOpen(stage === 'onboarding')
    scrollByTab.current = {}
    setTab('home')
    window.scrollTo(0, 0)
    toast(
      stage === 'onboarding' ? 'Fresh start at onboarding' : 'Fresh dashboard · training preferences kept',
      'info',
    )
  }
  const nav = {
    go,
    openPlayer: () => setPlayerOpen(true),
    confirmWorkoutChange: (continueWith) => {
      if (state.activeWorkout) setPendingWorkout({ continueWith, sessionId: state.activeWorkout.id })
      else continueWith()
    },
    prepareWorkout: (routine) => {
      if (state.activeWorkout)
        setPendingWorkout({ continueWith: () => setSetup(routine), sessionId: state.activeWorkout.id })
      else setSetup(routine)
    },
    openProfile: () => setProfileOpen(true),
    openCheckins: (id) => {
      setPhotoId(typeof id === 'string' ? id : null)
      setPhotosOpen(true)
    },
    openPersonal: () => setPersonalOpen(true),
    openEvents: (initial = 'list') => setEventsOpen(initial),
    openSportSchedule: () => setEventsOpen('list'),
    resetTesting,
  }

  return (
    <div
      className={`min-h-full bg-bg text-ink ${display.largeText ? 'tally-large-text' : ''} ${display.reducedMotion ? 'tally-reduce-motion' : ''}`}
    >
      <div className="mx-auto flex min-h-full max-w-xl flex-col">
        <main
          className={`flex-1 px-[22px] pt-[max(env(safe-area-inset-top),20px)] ${state.activeWorkout && tab !== 'home' ? 'pb-44' : 'pb-28'}`}
        >
          {tab === 'home' && <Home nav={nav} />}
          {tab === 'train' && <Train nav={nav} />}
          {tab === 'history' && <History nav={nav} />}
          {tab === 'you' && <You nav={nav} />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-safe backdrop-blur">
          <div className="mx-auto grid max-w-xl grid-cols-4 px-3 pb-3 pt-2.5">
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-[5px] text-[12px] transition-colors ${on ? 'font-semibold text-accent' : 'font-medium text-muted'}`}
                >
                  <Icon name={t.icon} size={24} strokeWidth={1.8} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>

        <WorkoutHost
          open={playerOpen}
          setOpen={setPlayerOpen}
          showMiniBar={tab !== 'home'}
          onPreviewShort={() => {
            go('train')
            setSetup(shortSessionRequest())
          }}
        />
        {setup && (
          <SessionSetup
            routine={setup}
            onClose={() => setSetup(null)}
            onStart={() => {
              setSetup(null)
              setPlayerOpen(true)
            }}
          />
        )}
        {profileOpen && (
          <TrainingProfile onClose={() => setProfileOpen(false)} onPhotos={() => setPhotosOpen(true)} />
        )}
        {eventsOpen && (
          <TrainingEvents
            initial={eventsOpen}
            onClose={() => setEventsOpen(null)}
            onPrepare={(event) => {
              setEventsOpen(null)
              setSetup(
                event.kind === 'occasion'
                  ? { kind: 'pump', event, items: [] }
                  : { kind: 'adaptive', event, items: [] },
              )
            }}
          />
        )}
        {photosOpen && <PhotoCheckins initialId={photoId} onClose={() => setPhotosOpen(false)} />}
        {personalOpen && (
          <PersonalSettings
            onSetup={() => {
              setPersonalOpen(false)
              setProfileOpen(true)
            }}
            onEvents={() => {
              setPersonalOpen(false)
              setEventsOpen('list')
            }}
            onClose={() => setPersonalOpen(false)}
          />
        )}
        {pendingWorkout && state.activeWorkout?.id === pendingWorkout.sessionId && (
          <WorkoutSwitchDialog
            session={state.activeWorkout}
            onKeep={() => {
              setPendingWorkout(null)
              setPlayerOpen(true)
            }}
            onEnd={() => {
              const record = endForSwitch(state.activeWorkout, state.workouts)
              dispatch(
                record
                  ? { type: 'FINISH_WORKOUT', workout: record }
                  : { type: 'SET_ACTIVE_WORKOUT', session: null },
              )
              // The first mark still counts when it was saved by switching.
              const first = record && firstSessionAchievement(state, record, today)
              if (first)
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  patch: { milestones: { ...state.settings.milestones, firstSession: first.workoutId } },
                })
              setPlayerOpen(false)
              const continueWith = pendingWorkout.continueWith
              setPendingWorkout(null)
              continueWith()
            }}
          />
        )}
        <ToastHost />
      </div>
    </div>
  )
}
