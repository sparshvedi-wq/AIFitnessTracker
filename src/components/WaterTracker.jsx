import { useApp } from '../store/AppContext.jsx'

export default function WaterTracker({ date }) {
  const { state, dispatch } = useApp()
  const glasses = state.metrics[date]?.water || 0
  const goal = state.settings.waterGoal || 8
  const setWater = (n) => dispatch({ type: 'SET_METRIC', date, patch: { water: Math.max(0, n) } })
  const pct = goal > 0 ? Math.min(100, (glasses / goal) * 100) : 0

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">💧 Water</h3>
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
          {glasses} / {goal} glasses
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-water transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Glass pips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {Array.from({ length: Math.max(goal, glasses) }).map((_, i) => (
          <button
            key={i}
            onClick={() => setWater(i + 1 === glasses ? i : i + 1)}
            title={`${i + 1} glass${i + 1 !== 1 ? 'es' : ''}`}
            className={`h-6 w-4 rounded-b-full rounded-t-sm border-2 transition-all ${
              i < glasses
                ? 'border-water/70 bg-water/80'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setWater(glasses + 1)}
          className="flex-1 rounded-lg bg-water/10 dark:bg-water/20 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-400 hover:bg-water/20 dark:hover:bg-water/30"
        >
          +1 glass
        </button>
        <button
          onClick={() => setWater(glasses - 1)}
          disabled={glasses === 0}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
        >
          −1
        </button>
      </div>
    </div>
  )
}
