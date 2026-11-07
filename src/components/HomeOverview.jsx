// Home's top band: this week at a glance, the running tally, and the latest win.
// Everything here is counted from real saved sessions; samples and future dates never count.
import { useEffect, useState } from 'react'
import { weekOverview } from '../lib/week.js'
import { fromKey } from '../lib/date.js'
import { weekStart } from '../lib/workout.js'
import { tallySessions } from '../lib/milestones.js'
import { feel } from '../lib/coach.js'

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
function Strokes({ count, fresh = 0, height = 22 }) {
  const marks = Math.max(0, Math.min(count, 15))
  const ghost = marks === 0
  const shown = ghost ? 4 : marks
  const groups = Math.ceil(shown / 5)
  const width = Math.max(groups * 34 - 8, 26)
  const firstFresh = marks - Math.min(fresh, marks)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`tally-strokes ${ghost ? 'is-ghost' : ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: shown }, (_, i) => {
        const group = Math.floor(i / 5),
          slot = i % 5,
          x0 = group * 34
        const d =
          slot === 4 ? `M${x0 - 2} ${height - 6}L${x0 + 26} 5` : `M${x0 + 3 + slot * 6.5} 3V${height - 3}`
        const isFresh = !ghost && i >= firstFresh
        return (
          <path
            key={`${i}-${isFresh ? 'fresh' : 'set'}`}
            d={d}
            pathLength="1"
            className={isFresh ? 'tally-stroke is-fresh' : 'tally-stroke'}
            style={isFresh ? { animationDelay: `${(i - firstFresh) * 140 + 220}ms` } : undefined}
          />
        )
      })}
    </svg>
  )
}

export function TallyCard({ workouts, today, fresh = 0 }) {
  const sessions = tallySessions(workouts, today)
  const total = sessions.length
  const thisWeek = sessions.filter((w) => w.date >= weekStart(today)).length
  return (
    <div
      className={`stat-card tally-card ${fresh ? 'is-celebrating' : ''}`}
      aria-label={`Your tally: ${total} ${total === 1 ? 'session' : 'sessions'}, ${thisWeek} this week`}
    >
      <span className="stat-card-label">Your tally</span>
      <span key={`${total}-${fresh}`} className={`stat-card-number ${fresh ? 'is-bumped' : ''}`}>
        {total}
      </span>
      <span className="flex items-center gap-2 text-ink">
        <Strokes count={total} fresh={fresh} height={18} />
        {total > 15 && <span className="text-[12px] text-muted">+{total - 15}</span>}
      </span>
    </div>
  )
}

// Center artwork for each kind of win: drawn, not written.
function WinGlyph({ kind }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="win-glyph">
      {kind === 'next' && <path d="M13 5v16" {...common} strokeDasharray="2.5 3.5" />}
      {kind === 'first' && <path d="M13 4.5c-1.2 6-.2 11.5-.6 17" {...common} strokeWidth="3.2" />}
      {kind === 'milestone' && (
        <>
          <path d="M6 6v14M10.5 6v14M15 6v14M19.5 6v14" {...common} strokeWidth="2" />
          <path d="M3.5 18L22.5 7.5" {...common} strokeWidth="2.2" />
        </>
      )}
      {kind === 'best' && (
        <>
          <path d="M5 19l6-6 4 3.5L21 9" {...common} />
          <path d="M16.5 8.5H21v4.5" {...common} />
        </>
      )}
      {kind === 'back' && (
        <>
          <path d="M20 13a7 7 0 1 1-2.1-5" {...common} />
          <path d="M18.5 3.5v4.4h-4.4" {...common} />
        </>
      )}
      {kind === 'week' && <path d="M5 19v-3M10 19v-6M15 19v-9M20 19V6" {...common} strokeWidth="2.6" />}
      {kind === 'mark' && <path d="M6 13.5l4.2 4L20 8" {...common} strokeWidth="2.8" />}
    </svg>
  )
}

// Five ring segments: the current group of five marks, the way a tally is written.
function WinRing({ bundle, fresh, kind }) {
  const r = 27
  const segment = 72
  const gap = 10
  const arc = (i) => {
    const start = ((i * segment + gap / 2 - 90) * Math.PI) / 180
    const end = (((i + 1) * segment - gap / 2 - 90) * Math.PI) / 180
    return `M${33 + r * Math.cos(start)} ${33 + r * Math.sin(start)}A${r} ${r} 0 0 1 ${33 + r * Math.cos(end)} ${33 + r * Math.sin(end)}`
  }
  const firstFresh = bundle - Math.min(fresh, bundle)
  return (
    <span className={`win-ring win-ring--${kind}`} aria-hidden="true">
      <svg width="66" height="66" viewBox="0 0 66 66">
        {Array.from({ length: 5 }, (_, i) => {
          const lit = i < bundle
          const isFresh = lit && i >= firstFresh && fresh > 0
          return (
            <path
              key={`${i}-${isFresh ? 'fresh' : lit ? 'lit' : 'off'}`}
              d={arc(i)}
              pathLength="1"
              className={`win-segment ${lit ? 'is-lit' : ''} ${isFresh ? 'is-fresh' : ''}`}
              style={isFresh ? { animationDelay: `${(i - firstFresh) * 140 + 360}ms` } : undefined}
            />
          )
        })}
      </svg>
      <span className="win-ring-center">
        <WinGlyph kind={kind} />
      </span>
    </span>
  )
}

const WIN_SENTENCE = {
  next: 'Your first mark is the next win',
  first: 'Latest win: your first workout',
  milestone: 'Latest win: a tally milestone',
  best: 'Latest win: a new best',
  back: 'Latest win: back to training',
  week: 'Latest win: sessions this week',
  mark: 'Latest win: a session logged',
}

export function WinCard({ win, fresh = 0, onOpen }) {
  const label = `${WIN_SENTENCE[win.kind]}. ${win.title}${win.detail ? `, ${win.detail}` : ''}${win.when ? `, ${win.when}` : ''}.`
  const body = (
    <>
      <span className="stat-card-label">{win.label}</span>
      <span className="win-row">
        <WinRing bundle={win.bundle} fresh={fresh} kind={win.kind} />
        {(win.detail || win.when) && <span className="win-when">{win.detail || win.when}</span>}
      </span>
      <span key={`${win.kind}-${win.total}`} className={`win-title ${fresh ? 'is-new' : ''}`}>
        {win.title}
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
