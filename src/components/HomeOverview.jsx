// Home's top band: this week at a glance, the running tally, and the latest win.
// Everything here is counted from real saved sessions; samples and future dates never count.
import { useEffect, useRef, useState } from 'react'
import { weekOverview } from '../lib/week.js'
import { fromKey } from '../lib/date.js'
import { weekStart } from '../lib/workout.js'
import { tallySessions } from '../lib/milestones.js'
import { feel } from '../lib/coach.js'
import Icon from './Icon.jsx'

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function WeekStrip({ state, today }) {
  const week = weekOverview(state, today)
  // A day is marked only for work that earns a tally mark (not warm-up-only logs).
  const days = week.days.map((d) => ({ ...d, done: tallySessions(d.workouts, today).length > 0 }))
  const trained = days.filter((d) => d.done).length
  return (
    <div
      className="week-dots"
      role="img"
      aria-label={`This week: trained on ${trained} ${trained === 1 ? 'day' : 'days'} so far`}
    >
      {days.map((d) => {
        const future = d.date > today
        return (
          <span key={d.date} className="week-dot-col">
            <span className={`week-dot-day ${d.today ? 'is-today' : future ? 'is-future' : ''}`}>
              {d.today ? 'Today' : DAY[(fromKey(d.date).getDay() + 6) % 7]}
            </span>
            <span
              className={`week-dot ${d.done ? 'is-done' : ''} ${d.today ? 'is-today' : ''} ${future ? 'is-future' : ''}`}
            >
              {d.done ? (
                <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true">
                  <path d="M6 3v12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              ) : d.today ? (
                <span className="text-[15px] font-bold">{d.number}</span>
              ) : null}
            </span>
            {d.events.length > 0 && <span className="week-dot-event" aria-hidden="true" />}
          </span>
        )
      })}
    </div>
  )
}

const SEEN_KEY = 'tally:seen-marks'
const readSeen = () => {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}
const writeSeen = (n) => {
  try {
    localStorage.setItem(SEEN_KEY, String(n))
  } catch {
    // Without storage the new mark simply appears without the animation.
  }
}

/**
 * How many marks were added since Home last showed the tally. The animation
 * waits until no sheet covers Home, so it plays where it can be seen: after
 * the first-workout screen and the Saved sheet close, or on the next visit.
 */
export function useNewMarks(total, prefs) {
  const [fresh, setFresh] = useState(0)
  useEffect(() => {
    const seen = readSeen()
    if (seen === null || !Number.isFinite(seen) || total <= seen) {
      // First run of this feature, or a deletion: just remember the count.
      writeSeen(total)
      return
    }
    let timer
    let cancelled = false
    const play = () => {
      if (cancelled) return
      if (document.hidden || document.querySelector('[aria-modal="true"]')) {
        timer = setTimeout(play, 250)
        return
      }
      writeSeen(total)
      setFresh(Math.min(total - seen, 5))
      timer = setTimeout(() => feel(prefs, total % 5 === 0 ? 'celebrate' : 'medium'), 560)
    }
    timer = setTimeout(play, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // prefs only affect the haptic; a settings change must not replay the mark.
  }, [total]) // eslint-disable-line react-hooks/exhaustive-deps
  return fresh
}

// Tally strokes in groups of five; `fresh` trailing strokes draw themselves in.
function Strokes({ count, fresh = 0 }) {
  const groups = Math.ceil(count / 5)
  const firstFresh = count - Math.min(fresh, count)
  return (
    <span className="tally-mark-groups" aria-hidden="true">
      {Array.from({ length: groups }, (_, group) => (
        <svg key={group} width="30" height="36" viewBox="-3 0 32 36" className="tally-strokes">
          {Array.from({ length: Math.min(5, count - group * 5) }, (_, slot) => {
            const i = group * 5 + slot
            const isFresh = i >= firstFresh
            return (
              <path
                key={`${slot}-${isFresh ? 'fresh' : 'set'}`}
                d={slot === 4 ? 'M-1 30L26 5' : `M${3 + slot * 6.5} 3V33`}
                pathLength="1"
                className={isFresh ? 'tally-stroke is-fresh' : 'tally-stroke'}
                style={isFresh ? { animationDelay: `${(i - firstFresh) * 140 + 220}ms` } : undefined}
              />
            )
          })}
        </svg>
      ))}
    </span>
  )
}

export function TallyCard({ workouts, today, fresh = 0 }) {
  const sessions = tallySessions(workouts, today)
  const total = sessions.length
  const thisWeek = sessions.filter((w) => w.date >= weekStart(today)).length
  const marks = useRef(null)
  useEffect(() => {
    // Show the newest marks after a session; earlier groups remain scrollable.
    if (marks.current) marks.current.scrollTop = marks.current.scrollHeight
  }, [total, fresh])
  return (
    <div
      className={`stat-card tally-card ${fresh ? 'is-celebrating' : ''}`}
      aria-label={`Your tally: ${total} ${total === 1 ? 'session' : 'sessions'}, ${thisWeek} this week`}
    >
      <span className="stat-card-label">Your tally</span>
      <div
        ref={marks}
        className="tally-mark-window"
        tabIndex={total > 10 ? 0 : undefined}
        role={total > 10 ? 'region' : 'img'}
        aria-label={
          total > 10
            ? `Your tally: ${total} sessions. Scroll for earlier marks.`
            : `${total} ${total === 1 ? 'tally mark' : 'tally marks'}`
        }
      >
        {total ? (
          <Strokes count={total} fresh={fresh} />
        ) : (
          <span className="text-[15px] text-muted">No marks yet</span>
        )}
      </div>
    </div>
  )
}

// One plain icon per kind of win; the words beside it say what happened.
const WIN_ICON = {
  next: 'target',
  first: 'star',
  milestone: 'trophy',
  best: 'trend',
  back: 'repeat',
  week: 'barChart',
  mark: 'check',
}

const WIN_SENTENCE = {
  next: 'Your first session is the next win',
  first: 'Latest win: your first session',
  milestone: 'Latest win: a tally milestone',
  best: 'Latest win: a new best',
  back: 'Latest win: back to training',
  week: 'Latest win: sessions this week',
  mark: 'Latest win: a session logged',
}

export function WinCard({ win, fresh = 0, onOpen }) {
  const label = `${WIN_SENTENCE[win.kind]}. ${win.title}${win.detail ? `, ${win.detail}` : ''}${win.when ? `, ${win.when}` : ''}.`
  const meta = [win.detail, win.when].filter(Boolean).join(' · ')
  const body = (
    <>
      <span className="win-head">
        <span className="stat-card-label">{win.label}</span>
        <span className={`win-badge ${win.kind === 'next' ? 'is-next' : ''} ${fresh ? 'is-new' : ''}`}>
          <Icon name={WIN_ICON[win.kind]} size={18} />
        </span>
      </span>
      <span className="block min-w-0">
        <span key={`${win.kind}-${win.total}`} className={`win-title ${fresh ? 'is-new' : ''}`}>
          {win.title}
        </span>
        {meta && <span className="win-when">{meta}</span>}
      </span>
    </>
  )
  return onOpen ? (
    <button
      className={`stat-card win-card text-left ${fresh ? 'is-celebrating' : ''}`}
      onClick={onOpen}
      aria-label={label}
    >
      {body}
    </button>
  ) : (
    <div className="stat-card win-card" role="img" aria-label={label}>
      {body}
    </div>
  )
}
