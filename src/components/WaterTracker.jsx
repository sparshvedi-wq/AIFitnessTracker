import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

export default function WaterTracker({ date }) {
  const { state, dispatch } = useApp()
  const glasses = state.metrics[date]?.water || 0
  const goal = state.settings.waterGoal || 8
  const setWater = (n) => dispatch({ type: 'SET_METRIC', date, patch: { water: Math.max(0, n) } })
  const pct = goal > 0 ? Math.min(100, (glasses / goal) * 100) : 0

  return (
    <section className="card flex flex-col p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-water/15 text-water">
          <Icon name="droplet" size={16} />
        </span>
        Water
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
        {glasses}<span className="text-sm font-semibold text-muted"> / {goal} glasses</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-water transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setWater(glasses - 1)}
          disabled={glasses === 0}
          className="btn-secondary h-10 w-10 shrink-0 p-0"
          aria-label="Remove a glass"
        >
          <Icon name="minus" size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setWater(glasses + 1)}
          className="btn h-10 flex-1 bg-water/15 p-0 text-[#1F7AD6] hover:bg-water/25 dark:text-water"
          aria-label="Add a glass"
        >
          <Icon name="plus" size={18} strokeWidth={2.5} /> Glass
        </button>
      </div>
    </section>
  )
}
