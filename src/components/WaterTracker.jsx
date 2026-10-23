import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

export default function WaterTracker({ date }) {
  const { state, dispatch } = useApp()
  const glasses = state.metrics[date]?.water || 0
  const goal = state.settings.waterGoal || 8
  const setWater = (n) => dispatch({ type: 'SET_METRIC', date, patch: { water: Math.max(0, n) } })
  const pct = goal > 0 ? Math.min(100, (glasses / goal) * 100) : 0
  const reached = goal > 0 && glasses >= goal

  return (
    <section className="card flex flex-col p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-water/15 text-water">
          <Icon name="droplet" size={16} />
        </span>
        Water
        {reached && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-water text-white" aria-label="Goal reached">
            <Icon name="check" size={12} strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
        {glasses}<span className="text-sm font-semibold text-muted"> / {goal} glasses</span>
      </p>
      {/* One segment per glass, so progress reads at a glance */}
      <div className="mb-1.5 mt-2.5 flex gap-1" aria-hidden="true">
        {Array.from({ length: Math.min(goal, 12) || 1 }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < Math.round((pct / 100) * Math.min(goal, 12)) ? 'bg-water' : 'bg-surface2'
            }`}
          />
        ))}
      </div>
      <p className="mb-3 text-[13px] text-muted">
        {reached ? 'Goal reached' : `${goal - glasses} to go`}
      </p>
      <div className="mt-auto flex gap-2">
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
