// Runs the active workout: ticks its timers, plays cues, keeps the screen
// awake, and shows either the full-screen player or a mini bar above the tabs.
// Mounted once in App so timers keep going when you switch tabs.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { currentSet, elapsedMs, fmtClock, tick } from '../../lib/workout.js'
import { makeCoach, requestWakeLock } from '../../lib/coach.js'
import Icon from '../Icon.jsx'
import WorkoutPlayer from './WorkoutPlayer.jsx'

export default function WorkoutHost({ open, setOpen }) {
  const { state, dispatch } = useApp()
  const session = state.activeWorkout
  const prefs = state.settings.workout
  const [now, setNow] = useState(Date.now())

  // Clock. Runs only while a workout is active and not paused.
  const running = Boolean(session && !session.pausedAt && session.phase !== 'done')
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
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
    if (!session) { lastPhase.current = null; return }
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
      coach.speak(`Rest. Up next, ${cur.ex.name}.`)
    } else if (session.phase === 'done') {
      coach.go('Workout complete. Nice work.')
    }
  }, [session, prefs])

  // Keep the screen on while the player is showing.
  useEffect(() => {
    if (!open || !session || !prefs.keepAwake) return
    let lock = null
    let cancelled = false
    const get = () => requestWakeLock().then((l) => { if (cancelled) l?.release(); else lock = l })
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

  if (!session) return null
  if (open) return <WorkoutPlayer session={session} now={now} onMinimize={() => setOpen(false)} />
  return <MiniBar session={session} now={now} onOpen={() => setOpen(true)} />
}

function MiniBar({ session, now, onOpen }) {
  const cur = currentSet(session)
  let status = 'Tap to continue'
  if (session.pausedAt) status = 'Paused'
  else if (session.phase === 'rest' && session.phaseEndsAt) status = `Rest ${fmtClock(session.phaseEndsAt - now)} · next ${cur?.ex.name}`
  else if (session.phase === 'ready') status = 'Starting…'
  else if (session.phase === 'done') status = 'Ready to save'
  else if (cur) status = `${cur.ex.name} · set ${session.cursor.set + 1} of ${cur.ex.sets.length}`

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 px-3 animate-slide-up">
      <button
        onClick={onOpen}
        className="mx-auto flex w-full max-w-xl items-center gap-3 rounded-btn bg-accent py-2.5 pl-2.5 pr-4 text-left text-on-accent shadow-float"
      >
        <span className="dot h-9 w-9 bg-on-accent text-accent">
          <Icon name="play" size={13} filled strokeWidth={0} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{session.name}</span>
          <span className="block truncate text-[12px] opacity-75">{status}</span>
        </span>
        <span className="num text-[16px]">{fmtClock(elapsedMs(session, now))}</span>
      </button>
    </div>
  )
}
