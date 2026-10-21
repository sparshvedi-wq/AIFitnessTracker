// SVG donut ring showing macro breakdown vs calorie goal.
// Three arcs (protein/carbs/fat) fill the ring proportionally.

import { useIsDark } from '../lib/useTheme.js'

const R = 54
const CIRC = 2 * Math.PI * R
const SW = 18  // stroke-width
const GAP = 3  // gap between arc segments (in SVG units)
const CX = 70
const CY = 70
const SIZE = 140

function Arc({ frac, startFrac, color }) {
  if (frac <= 0.002) return null
  const dash = Math.max(0, frac * CIRC - GAP)
  const offset = -(startFrac * CIRC + GAP / 2)
  return (
    <circle
      cx={CX}
      cy={CY}
      r={R}
      fill="none"
      stroke={color}
      strokeWidth={SW}
      strokeDasharray={`${dash} ${CIRC}`}
      strokeDashoffset={offset}
      strokeLinecap="butt"
    />
  )
}

export default function MacroRing({ totals, goals }) {
  const isDark = useIsDark()

  const pCal = totals.protein * 4
  const cCal = totals.carbs * 4
  const fCal = totals.fat * 9
  const totalMacroCal = pCal + cCal + fCal
  const goalCal = Math.max(goals.calories || 2000, 1)

  // How much of the ring is filled (capped at 100%; overflow shown as red halo)
  const fillFrac = Math.min(totalMacroCal / goalCal, 1)
  const isOver = totalMacroCal > goalCal

  // Each macro takes its fraction of the FILLED portion
  const pFrac = fillFrac > 0 ? (pCal / totalMacroCal) * fillFrac : 0
  const cFrac = fillFrac > 0 ? (cCal / totalMacroCal) * fillFrac : 0
  const fFrac = fillFrac > 0 ? (fCal / totalMacroCal) * fillFrac : 0

  const bgColor = isDark ? '#334155' : '#e2e8f0'
  const remaining = Math.round(goals.calories - totals.calories)
  const over = remaining < 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* SVG ring — rotated so arcs start from the top */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: 'rotate(-90deg)' }}
          role="img"
          aria-label={`${Math.round(totals.calories)} of ${goals.calories} calories`}
        >
          {/* Background (unfilled budget) */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={bgColor} strokeWidth={SW} />

          {/* Overflow halo */}
          {isOver && (
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#fca5a5" strokeWidth={SW + 4} opacity={0.35} />
          )}

          {/* Macro arcs */}
          <Arc frac={pFrac} startFrac={0} color="#ef4444" />
          <Arc frac={cFrac} startFrac={pFrac} color="#f59e0b" />
          <Arc frac={fFrac} startFrac={pFrac + cFrac} color="#8b5cf6" />
        </svg>

        {/* Center text (not rotated) */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className={`text-2xl font-bold tabular-nums leading-none ${over ? 'text-red-500' : 'text-slate-800 dark:text-slate-100'}`}>
            {Math.abs(remaining)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {over ? 'over' : 'remaining'}
          </p>
        </div>
      </div>

      {/* Macro legend */}
      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-protein" />P {Math.round(totals.protein)}g</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-carbs" />C {Math.round(totals.carbs)}g</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-fat" />F {Math.round(totals.fat)}g</span>
      </div>
    </div>
  )
}
