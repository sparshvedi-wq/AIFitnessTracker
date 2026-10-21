// Horizontal scrolling strip of foods eaten recently (last 14 days).
// One tap adds the food to the currently selected meal.

import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { recentFoods, scaled } from '../lib/calc.js'
import { uid } from '../lib/id.js'

export default function RecentFoods({ date, activeMeal }) {
  const { state, dispatch, toast } = useApp()

  const recents = useMemo(
    () => recentFoods(state, 14, date).slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.entries, date],
  )

  if (recents.length === 0) return null

  function addRecent(entry) {
    const newEntry = {
      id: uid(),
      date,
      name: entry.name,
      meal: activeMeal || entry.meal,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      servingSize: entry.servingSize,
      servings: entry.servings,
    }
    dispatch({ type: 'ADD_ENTRY', entry: newEntry })
    dispatch({ type: 'INCREMENT_FOOD_USAGE', name: entry.name })
    toast(`Added ${entry.name}`)
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 px-0.5">
        Recently eaten
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {recents.map((entry) => {
          const v = scaled(entry)
          return (
            <button
              key={entry.id}
              onClick={() => addRecent(entry)}
              className="flex shrink-0 flex-col items-start rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-left hover:border-cal hover:bg-cal/5 transition-colors"
            >
              <span className="max-w-[100px] truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {entry.name}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                {Math.round(v.calories)} cal
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
