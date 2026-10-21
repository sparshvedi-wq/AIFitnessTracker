// Searchable food library with favorites, sort options, inline editing,
// usage counts, and quick-add with adjustable servings.

import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEALS, MEAL_LABELS } from '../lib/calc.js'
import { uid } from '../lib/id.js'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20'

// Inline edit form for a single library food
function EditFoodRow({ food, onSave, onCancel }) {
  const [f, setF] = useState({
    name: food.name, calories: food.calories ?? '', protein: food.protein ?? '',
    carbs: food.carbs ?? '', fat: food.fat ?? '', servingSize: food.servingSize ?? '',
  })
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-700 p-3 space-y-2">
      <input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Name" className={inputCls} autoFocus />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['calories', 'protein', 'carbs', 'fat'].map((k) => (
          <label key={k} className="block">
            <span className="mb-0.5 block text-[11px] text-slate-400 dark:text-slate-500 capitalize">{k === 'calories' ? 'cal' : `${k} g`}</span>
            <input type="number" min="0" step="any" value={f[k]} onChange={(e) => set(k)(e.target.value)} className={inputCls} />
          </label>
        ))}
      </div>
      <input value={f.servingSize} onChange={(e) => set('servingSize')(e.target.value)} placeholder="Serving size (e.g. 1 cup)" className={inputCls} />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Cancel</button>
        <button
          onClick={() => onSave({ ...food, ...f, calories: Number(f.calories) || 0, protein: Number(f.protein) || 0, carbs: Number(f.carbs) || 0, fat: Number(f.fat) || 0 })}
          className="rounded-lg bg-cal px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
        >
          Save
        </button>
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'favorites', label: 'Favorites first' },
  { value: 'name', label: 'A–Z' },
  { value: 'usage', label: 'Most used' },
]

export default function FoodLibrary({ open, onClose, date, defaultMeal = 'breakfast' }) {
  const { state, dispatch, toast } = useApp()
  const [query, setQuery] = useState('')
  const [meal, setMeal] = useState(defaultMeal)
  const [sort, setSort] = useState('favorites')
  const [editingId, setEditingId] = useState(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = [...state.foods]
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q))
    switch (sort) {
      case 'favorites':
        list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name))
        break
      case 'usage':
        list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        break
      default: // name
        list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [state.foods, query, sort])

  function addFood(food, servings = 1) {
    dispatch({
      type: 'ADD_ENTRY',
      entry: {
        id: uid(), date, name: food.name, meal,
        calories: food.calories || 0, protein: food.protein || 0,
        carbs: food.carbs || 0, fat: food.fat || 0,
        servingSize: food.servingSize || '', servings,
      },
    })
    dispatch({ type: 'INCREMENT_FOOD_USAGE', name: food.name })
    toast(`Added ${food.name}`)
  }

  function saveEdit(updated) {
    dispatch({ type: 'EDIT_FOOD', food: updated })
    setEditingId(null)
    toast('Food updated')
  }

  function removeFood(food) {
    dispatch({ type: 'DELETE_FOOD', id: food.id })
    toast(`Removed "${food.name}"`, 'info')
  }

  return (
    <Modal open={open} onClose={onClose} title="Food library">
      <div className="space-y-3">
        {/* Search + controls */}
        <div className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20"
          />
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20"
          >
            {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}
          </select>
        </div>

        {/* Sort */}
        <div className="flex gap-1">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setSort(o.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                sort === o.value
                  ? 'bg-cal/10 text-cal'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {o.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 self-center">
            {state.foods.length} saved
          </span>
        </div>

        {state.foods.length === 0 ? (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-10 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">No saved foods yet.</p>
            <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Foods you add are saved here automatically.</p>
          </div>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No matches for "{query}".</p>
        ) : (
          <ul className="max-h-[55vh] divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto -mx-1 px-1">
            {results.map((food) => (
              <li key={food.id} className="py-2.5">
                {editingId === food.id ? (
                  <EditFoodRow food={food} onSave={saveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Favorite star */}
                    <button
                      onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', id: food.id })}
                      className={`shrink-0 text-lg leading-none transition ${food.favorite ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700 hover:text-amber-300'}`}
                      aria-label={food.favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      ★
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{food.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {Math.round(food.calories)} cal · P{Math.round(food.protein)} · C{Math.round(food.carbs)} · F{Math.round(food.fat)}
                        {food.servingSize ? ` · ${food.servingSize}` : ''}
                        {food.usageCount ? ` · used ${food.usageCount}×` : ''}
                      </p>
                    </div>

                    <button
                      onClick={() => addFood(food)}
                      className="shrink-0 rounded-lg bg-cal/10 dark:bg-cal/20 px-3 py-1.5 text-sm font-semibold text-cal hover:bg-cal/20 dark:hover:bg-cal/30"
                    >
                      + Add
                    </button>

                    <button
                      onClick={() => setEditingId(food.id)}
                      className="shrink-0 rounded p-1.5 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label="Edit"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => removeFood(food)}
                      className="shrink-0 rounded p-1.5 text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"
                      aria-label="Delete"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
