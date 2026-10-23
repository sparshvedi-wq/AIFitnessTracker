// Day summary: calories left as one big scoreboard number, eaten vs goal
// beside it, then the three macros.

import ProgressBar from './ProgressBar.jsx'
import { MACRO_COLORS } from '../lib/palette.js'

export default function DailySummary({ totals, goals }) {
  const goal = goals.calories || 0
  const remaining = Math.round(goal - totals.calories)
  const over = remaining < 0
  const pct = goal > 0 ? Math.min(100, (totals.calories / goal) * 100) : 0

  return (
    <section className="card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{over ? 'Calories over' : 'Calories left'}</p>
          <p className={`num mt-1 text-[76px] ${over ? 'text-danger' : 'text-ink'}`}>
            {Math.abs(remaining).toLocaleString()}
          </p>
        </div>
        <div className="pb-1.5 text-right">
          <p className="num text-[26px] text-ink">{Math.round(totals.calories).toLocaleString()}</p>
          <p className="text-[12px] font-medium text-muted">eaten of {goal.toLocaleString()}</p>
        </div>
      </div>

      {/* Calorie bar, with a tick where the goal sits */}
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.08]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-danger' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <ProgressBar compact label="Protein" value={totals.protein} goal={goals.protein} color={MACRO_COLORS.protein} />
        <ProgressBar compact label="Carbs" value={totals.carbs} goal={goals.carbs} color={MACRO_COLORS.carbs} />
        <ProgressBar compact label="Fat" value={totals.fat} goal={goals.fat} color={MACRO_COLORS.fat} />
      </div>
    </section>
  )
}
