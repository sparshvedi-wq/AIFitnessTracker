// Runs the active workout: ticks its timers, plays cues, keeps the screen
// awake, and shows either the full-screen player or a mini bar above the tabs.
// Mounted once in App so timers keep going when you switch tabs.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { currentSet, tick, pause, setCounts, sessionStatus } from '../../lib/workout.js'
import { makeCoach, requestWakeLock } from '../../lib/coach.js'
import Icon from '../Icon.jsx'
import WorkoutPlayer from './WorkoutPlayer.jsx'
import SessionSaved from './SessionSaved.jsx'
import { isNativeApp, nativeRequest } from '../../lib/native.js'

const IDLE_PAUSE_MS = 30 * 60_000
// Credit a few minutes after the last tap: the set or rest was likely still going.
const IDLE_GRACE_MS = 5 * 60_000

export default function WorkoutHost({ open, setOpen, showMiniBar = true, onPreviewShort }) {
  const { state, dispatch } = useApp()
  const session = state.activeWorkout
  const prefs = state.settings.workout
  const [now, setNow] = useState(Date.now)
  const [savedWorkout, setSavedWorkout] = useState(null)

  // Clock. Runs only while a workout is active and not paused.
  const running = Boolean(
    session?.startedAt && !session.pausedAt && !['done', 'prepared', 'between'].includes(session.phase),
  )
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  // Timers keep running when the phone locks or another app opens: rest is
  // still rest. Expo Go gets a notification when that timer ends. Only a long
  // unattended gap pauses, and the time after the last tap is not counted.
  useEffect(() => {
    if (!running) return
    let lastActivity = Date.now()
    let cue = null
    const touch = () => {
      lastActivity = Date.now()
    }
    const cancelCue = () => {
      if (cue) void cue.then((id) => id && nativeRequest('timer.cancel', { id })).catch(() => {})
      cue = null
    }
    const scheduleCue = () => {
      const s = sessionRef.current
      const cur = s && currentSet(s)
      if (!isNativeApp() || cue || !cur || s.pausedAt || !s.phaseEndsAt) return
      const seconds = (s.phaseEndsAt - Date.now()) / 1000
      if (seconds < 1) return
      const text =
        s.phase === 'rest'
          ? {
              title: 'Rest is over',
              body: `Next: ${cur.ex.name}, set ${s.cursor.set + 1} of ${cur.ex.sets.length}`,
            }
          : s.phase === 'ready'
            ? { title: 'Time to start', body: cur.ex.name }
            : { title: 'Time’s up', body: `${cur.ex.name} is done. Log it when you’re back.` }
      cue = nativeRequest('timer.schedule', { seconds, ...text }).catch(() => null)
    }
    const check = () => {
      if (document.visibilityState === 'hidden') scheduleCue()
      else {
        cancelCue()
        touch()
      }
      const s = sessionRef.current
      if (!s || s.pausedAt || ['done', 'prepared'].includes(s.phase)) return
      if (Date.now() - lastActivity < IDLE_PAUSE_MS) return
      dispatch({
        type: 'SET_ACTIVE_WORKOUT',
        session: {
          ...pause(s, lastActivity + IDLE_GRACE_MS),
          pauseReason: 'Paused after a long quiet spell. The time away isn’t counted.',
        },
      })
    }
    document.addEventListener('pointerdown', touch)
    document.addEventListener('keydown', touch)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('tally:background', scheduleCue)
    const interval = setInterval(check, 10_000)
    return () => {
      document.removeEventListener('pointerdown', touch)
      document.removeEventListener('keydown', touch)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('tally:background', scheduleCue)
      clearInterval(interval)
      cancelCue()
    }
  }, [running, dispatch])
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  // Advance when a timer runs out, with 3-2-1 beeps before it does.
  const lastBeep = useRef(null)
  useEffect(() => {
    if (!session || session.pausedAt) return
    const next = tick(session, now)
    if (next !== session) {
      dispatch({ type: 'SET_ACTIVE_WORKOUT', session: next })
      return
    }
    if (session.phaseEndsAt) {
      const left = Math.ceil((session.phaseEndsAt - now) / 1000)
      const key = `${session.phaseEndsAt}:${left}`
      if (left >= 1 && left <= 3 && lastBeep.current !== key) {
        lastBeep.current = key
        makeCoach(prefs).tick()
      }
    }
  }, [now, session, dispatch, prefs])

  // Announce each phase change.
  const lastPhase = useRef(null)
  useEffect(() => {
    if (!session) {
      lastPhase.current = null
      return
    }
    const cur = currentSet(session)
    const key = `${session.id}:${session.phase}:${session.cursor?.ex}:${session.cursor?.set}`
    const prev = lastPhase.current
    lastPhase.current = key
    if (prev === null || prev === key) return
    const coach = makeCoach(prefs)
    if (session.phase === 'work' && cur) {
      const setNo = `set ${session.cursor.set + 1} of ${cur.ex.sets.length}`
      const what = cur.ex.type === 'time' ? `${cur.set.sec} seconds` : `${cur.set.reps} reps`
      coach.go(`${cur.ex.name}, ${setNo}. ${what}.`)
    } else if (session.phase === 'rest' && cur) {
      coach.rest(`Rest. Up next, ${cur.ex.name}.`)
    } else if (session.phase === 'done') {
      coach.done('Workout complete. Nice work.')
    }
  }, [session, prefs])

  // Keep the screen on while the player is showing.
  useEffect(() => {
    if (!open || !session || !prefs.keepAwake) return
    let lock = null
    let cancelled = false
    const get = () =>
      requestWakeLock().then((l) => {
        if (cancelled) l?.release()
        else lock = l
      })
    get()
    const onVisible = () => document.visibilityState === 'visible' && get()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [open, Boolean(session), prefs.keepAwake]) // eslint-disable-line react-hooks/exhaustive-deps

  // A finished or discarded workout closes the player.
  useEffect(() => {
    if (!session && open) setOpen(false)
  }, [session, open, setOpen])

  if (savedWorkout)
    return (
      <SessionSaved
        workout={savedWorkout}
        onClose={() => setSavedWorkout(null)}
        onPreview={() => {
          setSavedWorkout(null)
          setOpen(false)
          onPreviewShort()
        }}
      />
    )
  if (!session) return null
  if (open)
    return (
      <WorkoutPlayer
        session={session}
        now={now}
        onMinimize={() => setOpen(false)}
        onSaved={setSavedWorkout}
      />
    )
  return showMiniBar ? <MiniBar session={session} now={now} onOpen={() => setOpen(true)} /> : null
}

function MiniBar({ session, now, onOpen }) {
  const { done, total } = setCounts(session)
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 px-3 animate-slide-up">
      <button
        onClick={onOpen}
        className="relative mx-auto flex w-full max-w-xl items-center gap-3 overflow-hidden rounded-2xl border border-outline bg-raised py-2.5 pl-2.5 pr-4 text-left text-ink shadow-float"
      >
        <span className="dot h-9 w-9 bg-accent text-on-accent">
          <Icon name={session.pausedAt ? 'pause' : 'play'} size={13} filled strokeWidth={0} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{session.name}</span>
          <span className="block truncate text-[12px] text-muted">{sessionStatus(session, now)}</span>
        </span>
        <Icon name="chevronUp" size={18} className="shrink-0 text-muted" />
        {total > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-line" aria-hidden="true">
            <span className="block h-full bg-accent" style={{ width: `${(done / total) * 100}%` }} />
          </span>
        )}
      </button>
    </div>
  )
}
