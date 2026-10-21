// Meal section (Breakfast/Lunch/Dinner/Snack) with entries, subtotals,
// and undo-friendly delete (no confirm dialog — undo via toast instead).

import { MEAL_LABELS, scaled } from '../lib/calc.js'

export default function MealGroup({ meal, items, totals, onAdd, onEdit, onDelete }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {MEAL_LABELS[meal]}
          </h3>
          {items.length > 0 && (
            <span className="tabular-nums text-xs text-slate-400 dark:text-slate-500">
              {Math.round(totals.calories)} cal
            </span>
          )}
        </div>
        <button
          onClick={() => onAdd(meal)}
          className="rounded-lg px-2 py-1 text-sm font-medium text-cal hover:bg-cal/10"
        >
          + Add
        </button>
      </div>

      {items.length === 0 ? (
        <button
          onClick={() => onAdd(meal)}
          className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-4 text-sm text-slate-300 dark:text-slate-600 hover:border-cal hover:text-cal transition-colors"
        >
          + Add {MEAL_LABELS[meal].toLowerCase()}
        </button>
      ) : (
        <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {items.map((entry) => {
            const v = scaled(entry)
            return (
              <li key={entry.id} className="group flex items-center gap-2.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {entry.name}
                    {Number(entry.servings) !== 1 && (
                      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">×{entry.servings}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    P{Math.round(v.protein)} · C{Math.round(v.carbs)} · F{Math.round(v.fat)}
                    {entry.servingSize ? ` · ${entry.servingSize}` : ''}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {Math.round(v.calories)}
                </span>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(entry)}
                    className="rounded p-1.5 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label="Edit"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(entry)}
                    className="rounded p-1.5 text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
                    aria-label="Delete"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    </svg>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
