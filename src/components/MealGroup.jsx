// One meal (Breakfast/Lunch/Dinner/Snack). Tap an entry to edit or delete it;
// works on touch screens (no hover-only controls).

import { MEAL_LABELS, scaled } from '../lib/calc.js'
import Icon from './Icon.jsx'

export default function MealGroup({ meal, items, totals, onAdd, onEdit }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between py-2 pl-4 pr-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[16px] font-bold text-ink">{MEAL_LABELS[meal]}</h3>
          {items.length > 0 && (
            <span className="text-[13px] font-medium tabular-nums text-muted">
              {Math.round(totals.calories).toLocaleString()} cal
            </span>
          )}
        </div>
        <button
          onClick={() => onAdd(meal)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand transition-colors hover:bg-brand-soft"
          aria-label={`Add to ${MEAL_LABELS[meal]}`}
        >
          <Icon name="plus" size={20} strokeWidth={2.5} />
        </button>
      </div>

      {items.length === 0 ? (
        <button
          onClick={() => onAdd(meal)}
          className="block w-full border-t border-line/70 px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-surface2"
        >
          Nothing logged yet
        </button>
      ) : (
        <ul className="border-t border-line/70">
          {items.map((entry) => {
            const v = scaled(entry)
            return (
              <li key={entry.id} className="border-b border-line/50 last:border-b-0">
                <button
                  onClick={() => onEdit(entry)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface2 active:bg-surface2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">
                      {entry.name}
                      {Number(entry.servings) !== 1 && (
                        <span className="ml-1.5 text-[13px] font-medium text-muted">×{entry.servings}</span>
                      )}
                    </p>
                    <p className="truncate text-[13px] tabular-nums text-muted">
                      P {Math.round(v.protein)} · C {Math.round(v.carbs)} · F {Math.round(v.fat)}
                      {entry.servingSize ? ` · ${entry.servingSize}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                    {Math.round(v.calories)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
