// Day summary: calorie ring with eaten / goal, then compact macro bars.

import MacroRing from './MacroRing.jsx'
import ProgressBar from './ProgressBar.jsx'

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums text-ink">{Math.round(value).toLocaleString()}</p>
    </div>
  )
}

export default function DailySummary({ totals, goals }) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <MacroRing totals={totals} goals={goals} />
        <div className="flex flex-1 flex-col gap-4 pr-1">
          <Stat label="Eaten" value={totals.calories} />
          <div className="h-px bg-line" />
          <Stat label="Goal" value={goals.calories || 0} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
        <ProgressBar compact label="Protein" value={totals.protein} goal={goals.protein} color="#E5484D" />
        <ProgressBar compact label="Carbs" value={totals.carbs} goal={goals.carbs} color="#F0A020" />
        <ProgressBar compact label="Fat" value={totals.fat} goal={goals.fat} color="#7C66DC" />
      </div>
    </section>
  )
}
