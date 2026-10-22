// The one place to log food: pick a meal, tap a recent food to re-add it,
// enter a new food, or copy a previous day.

import { useMemo } from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEALS, MEAL_LABELS, recentFoods, scaled } from '../lib/calc.js'
import { labelForKey } from '../lib/date.js'
import { uid } from '../lib/id.js'

function ActionRow({ icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface2 active:bg-line/60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="block text-[13px] text-muted">{sub}</span>
      </span>
      <Icon name="chevronRight" size={18} className="text-muted" />
    </button>
  )
}

export default function AddSheet({ open, onClose, date, meal, setMeal, onNewFood, onCopy }) {
  const { state, dispatch, toast } = useApp()

  const recents = useMemo(
    () => recentFoods(state, 14, date).slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.entries, date],
  )

  function addRecent(entry) {
    dispatch({
      type: 'ADD_ENTRY',
      entry: {
        id: uid(), date, name: entry.name, meal,
        calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat,
        servingSize: entry.servingSize, servings: entry.servings,
      },
    })
    dispatch({ type: 'INCREMENT_FOOD_USAGE', name: entry.name })
    toast(`Added ${entry.name} to ${MEAL_LABELS[meal].toLowerCase()}`)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Log food · ${labelForKey(date)}`}>
      <div className="space-y-5">
        {/* Meal picker */}
        <div className="segmented">
          {MEALS.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`segment ${meal === m ? 'segment-active' : ''}`}
            >
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>

        {/* One-tap re-add */}
        {recents.length > 0 && (
          <div>
            <p className="section-title mb-2">Recent</p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {recents.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => addRecent(entry)}
                  className="flex shrink-0 flex-col items-start rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-brand/50 active:bg-surface2"
                >
                  <span className="max-w-[120px] truncate text-sm font-semibold text-ink">{entry.name}</span>
                  <span className="flex items-center gap-1 text-xs tabular-nums text-muted">
                    <Icon name="plus" size={12} strokeWidth={3} className="text-brand" />
                    {Math.round(scaled(entry).calories)} cal
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="-mx-2 space-y-0.5">
          <ActionRow icon="pencil" title="Enter food" sub="Type in calories and macros" onClick={onNewFood} />
          <ActionRow icon="copy" title="Copy a previous day" sub="Repeat meals you already logged" onClick={onCopy} />
        </div>
      </div>
    </Modal>
  )
}
