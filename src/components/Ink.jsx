// Shared pieces of the Ink look: the logo, section headings, charts and the
// big number stepper.

import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

// The hand-drawn tally mark: four strokes and an accent slash.
export function TallyLogo({ width = 30, className = '' }) {
  return (
    <svg width={width} height={(width * 22) / 28} viewBox="0 0 28 22" className={className} aria-label="Tally" role="img">
      <path d="M5 3c.4 5 .2 11-.3 16M11 2c.3 6 .1 12-.2 17M17 3c.2 5 .3 11 0 16M23 2c.3 6 0 12-.3 17" fill="none" stroke="rgb(var(--ink))" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M1 15c8-3 17-7 26-11" fill="none" stroke="rgb(var(--accent))" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function SectionHead({ title, right = null, onRight, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <h2 className="section-title">{title}</h2>
      {right != null && (onRight ? (
        <button onClick={onRight} className="text-[13px] font-medium text-accent">{right}</button>
      ) : (
        <span className="text-[13px] text-muted">{right}</span>
      ))}
    </div>
  )
}

export function PageTitle({ title, right = null }) {
  return (
    <header className="flex items-center justify-between gap-3 pb-1 pt-1">
      <h1 className="h-page">{title}</h1>
      {right}
    </header>
  )
}

// Measure an element's width so SVG charts can fill it exactly.
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Smooth line with horizontal tangents at each point.
function smoothPath(xs, ys) {
  let d = `M${xs[0]} ${ys[0]}`
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`
  }
  return d
}

let gradId = 0

// Line chart that fills its container. `values` oldest first.
export function LineChart({ values, height = 110, min, max, fill = true, dotFill = 'rgb(var(--surface))', pad = 8 }) {
  const [ref, w] = useWidth()
  const [id] = useState(() => `fade${gradId++}`)
  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const span = hi - lo || 1
  let svg = null
  if (w > 0 && values.length > 1) {
    const xs = values.map((_, i) => pad + (i * (w - pad * 2)) / (values.length - 1))
    const ys = values.map((v) => pad + (1 - (v - lo) / span) * (height - pad * 2))
    const line = smoothPath(xs, ys)
    const area = `${line} L ${xs[xs.length - 1]} ${height} L ${xs[0]} ${height} Z`
    svg = (
      <svg width={w} height={height} aria-hidden="true" className="block">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.28" />
            <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {fill && <path d={area} fill={`url(#${id})`} />}
        <path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="5.5" fill={dotFill} stroke="rgb(var(--ink))" strokeWidth="2.2" />
      </svg>
    )
  }
  return <div ref={ref} style={{ height }}>{svg}</div>
}

// Big number with −/+ under it. Tap the number to type one.
export function BigStepper({ label, value, onChange, step = 1, min = 0, decimals = false, size = 'text-[76px]' }) {
  const set = (v) => onChange(Math.max(min, decimals ? Math.round(v * 10) / 10 : Math.round(v)))
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center py-5">
      <input
        type="number"
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={value ?? ''}
        placeholder="0"
        onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(min, Number(e.target.value) || 0))}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className={`num w-full min-w-0 bg-transparent text-center ${size} leading-[1.05] tracking-[-0.005em] text-ink placeholder:text-faint focus:outline-none`}
      />
      <span className="mt-1 text-[13px] text-muted">{label}</span>
      <div className="mt-3.5 flex gap-2.5">
        <button onClick={() => set((value || 0) - step)} disabled={(value || 0) <= min} className="dot h-10 w-10 border-[1.5px] border-outline text-ink disabled:opacity-40" aria-label={`Less ${label}`}>
          <Icon name="minus" size={16} strokeWidth={2.2} />
        </button>
        <button onClick={() => set((value || 0) + step)} className="dot h-10 w-10 border-[1.5px] border-outline text-ink" aria-label={`More ${label}`}>
          <Icon name="plus" size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

// Weekday tile: short day over the date number.
export function DateTile({ date }) {
  const d = new Date(`${date}T12:00:00`)
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[14px] bg-surface2 leading-none">
      <span className="text-[10px] font-semibold text-muted">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}</span>
      <span className="num mt-[3px] text-[18px] text-ink">{d.getDate()}</span>
    </span>
  )
}

const CORNERS = ['rounded-tuck', 'rounded-tuck-r', 'rounded-tuck-tr', 'rounded-tuck-tl']
export const corner = (i) => CORNERS[i % 4]

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-outline'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-ink transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
