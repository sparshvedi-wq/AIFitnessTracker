// Day summary: macro ring chart + calorie hero number + progress bars.

import MacroRing from './MacroRing.jsx'
import ProgressBar from './ProgressBar.jsx'

export default function DailySummary({ totals, goals }) {
  const remaining = Math.round((goals.calories || 0) - totals.calories)
  const over = remaining < 0

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm">
      {/* Top: ring + headline */}
      <div className="mb-5 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <MacroRing totals={totals} goals={goals} />

        <div className="text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {over ? 'Over budget' : 'Remaining'}
          </p>
          <p className={`mt-0.5 text-5xl font-extrabold tabular-nums leading-none ${over ? 'text-red-500' : 'text-slate-800 dark:text-slate-100'}`}>
            {Math.abs(remaining)}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-400 dark:text-slate-500">cal</p>
          <p className="mt-2 text-sm tabular-nums text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.round(totals.calories)}</span>
            {' '}eaten · {goals.calories} goal
          </p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        <ProgressBar label="Calories" value={totals.calories} goal={goals.calories} unit="cal" color="#0ea5e9" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProgressBar label="Protein" value={totals.protein} goal={goals.protein} color="#ef4444" />
          <ProgressBar label="Carbs" value={totals.carbs} goal={goals.carbs} color="#f59e0b" />
          <ProgressBar label="Fat" value={totals.fat} goal={goals.fat} color="#8b5cf6" />
        </div>
      </div>
    </div>
  )
}
