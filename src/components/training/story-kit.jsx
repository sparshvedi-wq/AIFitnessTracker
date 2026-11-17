// Small pieces shared by every onboarding story screen and question.
import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'

export const money = (n) => `$${n.toFixed(2)}`
// Whole amounts read better without cents: $5/mo, not $5.00/mo.
export const roundMoney = (n) => (Number.isInteger(n) ? `$${n}` : money(n))
export const delay = (s) => ({ animationDelay: `${s}s` })

// Timers that stop when the screen goes away.
export function useTimers() {
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t) || clearInterval(t)), [])
  return {
    later: (fn, ms) => timers.current.push(setTimeout(fn, ms)),
    every: (fn, ms) => timers.current.push(setInterval(fn, ms)),
    clear: () => {
      timers.current.forEach((t) => clearTimeout(t) || clearInterval(t))
      timers.current = []
    },
  }
}
export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('tally-reduce-motion') ||
    // The app root carries the class before its effect copies it to <html>.
    Boolean(document.querySelector('.tally-reduce-motion')))

// A number that counts up once, easing out. Reduced motion shows the total.
export function useCountUp(to, ms = 1500, start = true) {
  const [value, setValue] = useState(() => (reducedMotion() ? to : 0))
  useEffect(() => {
    if (!start) return undefined
    if (reducedMotion()) {
      setValue(to)
      return undefined
    }
    let frame
    const t0 = performance.now()
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      setValue(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [to, ms, start])
  return value
}

/**
 * Runs a demo's first tap by itself after a pause, unless the person got
 * there first. Returns `touch`, to call from every real tap.
 */
export function useAutoplay(steps) {
  const touched = useRef(false)
  const timers = useTimers()
  useEffect(() => {
    if (reducedMotion()) {
      // Straight to where the demo ends.
      for (const [, fn] of steps) fn()
      return undefined
    }
    for (const [ms, fn] of steps) timers.later(() => !touched.current && fn(), ms)
    return timers.clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return {
    touched,
    touch: () => {
      touched.current = true
    },
  }
}

export function Title({ headingRef, children, className = '' }) {
  return (
    <h3 ref={headingRef} tabIndex={-1} className={`story-title story-in ${className}`}>
      {children}
    </h3>
  )
}
/** One plain sentence under a title: what Tally is doing here. */
export function Lede({ children, at = 0.08 }) {
  return (
    <p className="story-lede story-in" style={delay(at)}>
      {children}
    </p>
  )
}
/** Their own answer, said back to them. */
export function YouSaid({ children }) {
  return (
    <span className="you-said story-in">
      <Icon name="you" size={14} strokeWidth={2.6} />
      You said: <b>{children}</b>
    </span>
  )
}
export function Thumb({ src, className = '' }) {
  return (
    <span className={`story-thumb ${className}`} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <Icon name="dumbbell" size={20} />}
    </span>
  )
}
export const Check = ({ size = 14 }) => <Icon name="check" size={size} strokeWidth={3.2} />
export const Lock = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
export const TallyMark = () => (
  <svg viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 3v18M10 3v18M16 3v18M22 3v18M1 17L27 6" />
  </svg>
)
/** A list of moves in a card, as the workout screen lists them. */
export function MoveList({ moves, head, minutes, className = '' }) {
  return (
    <div className={`story-card ${className}`}>
      {head && (
        <div className="story-card-head">
          <span>{head}</span>
          {minutes != null && <b key={minutes} className="tick-in">{minutes} min</b>}
        </div>
      )}
      <div aria-live="polite">
        {moves.map((m) => (
          <div key={m.exId} className="story-move">
            <Thumb src={m.image} />
            <div className="min-w-0 flex-1">
              <div className="story-move-name">{m.name}</div>
              <div className="story-move-detail">{[m.muscle, m.detail].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ))}
        {!moves.length && <div className="story-move story-move--empty">A recovery day</div>}
      </div>
    </div>
  )
}
