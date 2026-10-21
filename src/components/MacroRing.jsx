// Calorie ring: brand-colored arc for calories eaten vs goal, with the
// remaining number in the middle. Turns red when over.

import { useIsDark } from '../lib/useTheme.js'

const SIZE = 168
const SW = 14
const R = (SIZE - SW) / 2
const CIRC = 2 * Math.PI * R

export default function MacroRing({ totals, goals }) {
  const isDark = useIsDark()
  const goal = Math.max(goals.calories || 0, 1)
  const eaten = totals.calories
  const remaining = Math.round((goals.calories || 0) - eaten)
  const over = remaining < 0
  const frac = Math.min(eaten / goal, 1)

  const track = isDark ? '#1F232A' : '#EEF0F3'
  const color = over ? (isDark ? '#F86262' : '#DC3535') : (isDark ? '#2DC48C' : '#0C8C62')

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
        role="img"
        aria-label={`${Math.round(eaten)} of ${goals.calories} calories eaten`}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={track} strokeWidth={SW} />
        {frac > 0.002 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${frac * CIRC} ${CIRC}`}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
          />
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className={`text-[38px] font-extrabold leading-none tracking-tight tabular-nums ${over ? 'text-danger' : 'text-ink'}`}>
          {Math.abs(remaining).toLocaleString()}
        </p>
        <p className="mt-1 text-[13px] font-medium text-muted">{over ? 'cal over' : 'cal left'}</p>
      </div>
    </div>
  )
}
