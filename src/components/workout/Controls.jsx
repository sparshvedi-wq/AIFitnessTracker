// Small shared pieces for the workout screens.

import Icon from '../Icon.jsx'

// Big −/+ control for reps, weight and seconds. Tap to step, or type a
// number directly.
export function Stepper({ label, value, onChange, step = 1, min = 0, decimals = false, placeholder = '0' }) {
  const set = (v) => onChange(Math.max(min, decimals ? Math.round(v * 10) / 10 : Math.round(v)))
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-center text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
        <button
          onClick={() => set((value || 0) - step)}
          disabled={(value || 0) <= min}
          className="btn-secondary h-11 w-11 shrink-0 border-0 bg-surface2 p-0"
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
          className="min-w-0 flex-1 bg-transparent text-center text-2xl font-bold tabular-nums text-ink placeholder:text-muted/60 focus:outline-none"
          aria-label={label}
        />
        <button
          onClick={() => set((value || 0) + step)}
          className="btn-secondary h-11 w-11 shrink-0 border-0 bg-surface2 p-0"
          aria-label={`More ${label.split(' ')[0].toLowerCase()}`}
        >
          <Icon name="plus" size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// Circular countdown. `progress` runs from 1 (full) to 0 (empty).
export function TimerRing({ progress, size = 220, stroke = 12, color = 'rgb(var(--brand))', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

const MUSCLE_TINT = {
  Legs: 'bg-[#3B9EFF]/15 text-[#1F7AD6] dark:text-[#6CB6FF]',
  Glutes: 'bg-[#3B9EFF]/15 text-[#1F7AD6] dark:text-[#6CB6FF]',
  Chest: 'bg-protein/15 text-protein',
  Shoulders: 'bg-protein/15 text-protein',
  Triceps: 'bg-protein/15 text-protein',
  Back: 'bg-fat/15 text-fat',
  Biceps: 'bg-fat/15 text-fat',
  Core: 'bg-carbs/15 text-[#B87400] dark:text-carbs',
  Cardio: 'bg-danger/15 text-danger',
  Mobility: 'bg-brand-soft text-brand',
}

export function MuscleTag({ muscle }) {
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${MUSCLE_TINT[muscle] || 'bg-surface2 text-ink2'}`}>
      {muscle}
    </span>
  )
}
