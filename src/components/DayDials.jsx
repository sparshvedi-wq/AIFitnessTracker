// Three dials across the top of Today: Fuel (calories vs goal), Train
// (workouts this week vs goal) and Water (glasses vs goal). One glance tells
// you how the day is going.

const SIZE = 96
const SW = 8
const R = (SIZE - SW) / 2
const CIRC = 2 * Math.PI * R
// The dial is a 300° arc with a gap at the bottom, like a gauge
const ARC = 300 / 360

function Dial({ label, pct, color, value, sub }) {
  const frac = Math.max(0, Math.min(pct, 1))
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(120deg)' }} aria-hidden="true">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
            stroke="rgb(var(--ink) / 0.09)" strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={`${ARC * CIRC} ${CIRC}`}
          />
          {frac > 0.004 && (
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
              stroke={color} strokeWidth={SW} strokeLinecap="round"
              strokeDasharray={`${frac * ARC * CIRC} ${CIRC}`}
              style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)', filter: `drop-shadow(0 0 6px ${color.replace(')', ' / 0.45)')})` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-[30px] text-ink">{value}</span>
          <span className="mt-0.5 text-[10px] font-semibold text-muted">{sub}</span>
        </div>
      </div>
      <span className="eyebrow -mt-1.5 text-ink2">{label}</span>
    </div>
  )
}

export default function DayDials({ eaten, calGoal, weekCount, weeklyGoal, water, waterGoal }) {
  const pct = (v, g) => (g > 0 ? v / g : 0)
  return (
    <section className="card flex items-start justify-between px-2 pb-4 pt-3">
      <Dial
        label="Fuel"
        pct={pct(eaten, calGoal)}
        color="rgb(var(--accent))"
        value={`${Math.round(pct(eaten, calGoal) * 100)}%`}
        sub={`of ${(calGoal || 0).toLocaleString()}`}
      />
      <Dial
        label="Train"
        pct={pct(weekCount, weeklyGoal)}
        color="rgb(var(--protein))"
        value={`${weekCount}/${weeklyGoal || 0}`}
        sub="this week"
      />
      <Dial
        label="Water"
        pct={pct(water, waterGoal)}
        color="rgb(var(--water))"
        value={`${water}/${waterGoal}`}
        sub="glasses"
      />
    </section>
  )
}
