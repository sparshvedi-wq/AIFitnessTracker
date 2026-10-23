// Small shared pieces for the workout screens.

import Icon from '../Icon.jsx'

// Big −/+ control for reps, weight and seconds. Tap to step, or type a
// number directly.
export function Stepper({ label, value, onChange, step = 1, min = 0, decimals = false, placeholder = '0' }) {
  const set = (v) => onChange(Math.max(min, decimals ? Math.round(v * 10) / 10 : Math.round(v)))
  return (
    <div className="min-w-0 flex-1">
      <p className="eyebrow mb-1.5 text-center">{label}</p>
      <div className="flex items-center gap-1.5 rounded-full bg-surface2 p-1.5">
        <button
          onClick={() => set((value || 0) - step)}
          disabled={(value || 0) <= min}
          className="btn-secondary h-11 w-11 shrink-0 border-0 bg-raised p-0"
          aria-label={`Less ${label.split(' ')[0].toLowerCase()}`}
        >
          <Icon name="minus" size={18} strokeWidth={2.5} />
        </button>
        <input
          type="number"
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(min, Number(e.target.value) || 0))}
          className="num min-w-0 flex-1 bg-transparent text-center text-[34px] text-ink placeholder:text-muted/60 focus:outline-none"
          aria-label={label}
        />
        <button
          onClick={() => set((value || 0) + step)}
          className="btn-secondary h-11 w-11 shrink-0 border-0 bg-raised p-0"
          aria-label={`More ${label.split(' ')[0].toLowerCase()}`}
        >
          <Icon name="plus" size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// Circular countdown. `progress` runs from 1 (full) to 0 (empty).
export function TimerRing({ progress, size = 220, stroke = 12, color = 'rgb(var(--accent))', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--ink) / 0.09)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-ink/15'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// Muscle tags stay monochrome: color is saved for data and the volt accent.
export function MuscleTag({ muscle }) {
  return <span className="tag">{muscle}</span>
}
