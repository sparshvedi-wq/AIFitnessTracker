// Searchable list of saved foods with favorites, sorting, inline editing,
// usage counts, and one-tap add. Used as a picker sheet while logging and as
// the full Foods tab.

import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEALS, MEAL_LABELS } from '../lib/calc.js'
import { labelForKey } from '../lib/date.js'
import { uid } from '../lib/id.js'

// Inline edit form for a single library food
function EditFoodRow({ food, onSave, onCancel }) {
  const [f, setF] = useState({
    name: food.name, calories: food.calories ?? '', protein: food.protein ?? '',
    carbs: food.carbs ?? '', fat: food.fat ?? '', servingSize: food.servingSize ?? '',
  })
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <div className="space-y-3 rounded-2xl bg-surface2 p-3">
      <input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Name" className="input" autoFocus />
      <div className="grid grid-cols-4 gap-2">
        {['calories', 'protein', 'carbs', 'fat'].map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{k === 'calories' ? 'Cal' : `${k[0].toUpperCase() + k.slice(1)} g`}</span>
            <input type="number" min="0" step="any" value={f[k]} onChange={(e) => set(k)(e.target.value)} className="input px-2 text-center tabular-nums" />
          </label>
        ))}
      </div>
      <input value={f.servingSize} onChange={(e) => set('servingSize')(e.target.value)} placeholder="Serving size (e.g. 1 cup)" className="input" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost py-2">Cancel</button>
        <button
          onClick={() => onSave({ ...food, ...f, calories: Number(f.calories) || 0, protein: Number(f.protein) || 0, carbs: Number(f.carbs) || 0, fat: Number(f.fat) || 0 })}
          className="btn-primary py-2"
        >
          Save
        </button>
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'favorites', label: 'Favorites' },
  { value: 'usage', label: 'Most used' },
  { value: 'name', label: 'A–Z' },
]

export function FoodLibraryList({ date, defaultMeal = 'breakfast', onNewFood, compact = false }) {
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
    toast(`Added ${food.name} to ${MEAL_LABELS[meal].toLowerCase()}`)
  }

  function saveEdit(updated) {
    dispatch({ type: 'EDIT_FOOD', food: updated })
    setEditingId(null)
    toast('Food updated')
  }

  function removeFood(food) {
    dispatch({ type: 'DELETE_FOOD', id: food.id })
    toast(`Removed "${food.name}"`, 'info', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'SAVE_FOOD', food }),
    })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          autoFocus={compact}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your foods"
          className="input pl-10"
        />
      </div>

      {/* Where "+" adds to */}
      <div>
        <p className="section-title mb-2">
          Add to {MEAL_LABELS[meal].toLowerCase()} · {labelForKey(date)}
        </p>
        <div className="segmented">
          {MEALS.map((m) => (
            <button key={m} onClick={() => setMeal(m)} className={`segment ${meal === m ? 'segment-active' : ''}`}>
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1.5">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setSort(o.value)}
            className={`chip py-1 ${sort === o.value ? 'chip-active' : ''}`}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto text-[13px] tabular-nums text-muted">{state.foods.length} saved</span>
      </div>

      {state.foods.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Icon name="book" size={22} />
          </span>
          <p className="text-[15px] font-semibold text-ink">No saved foods yet</p>
          <p className="mt-1 max-w-[260px] text-sm text-muted">Foods you log are saved here automatically so you can add them again in one tap.</p>
          {onNewFood && (
            <button onClick={onNewFood} className="btn-primary mt-5">
              <Icon name="plus" size={18} strokeWidth={2.5} /> Add your first food
            </button>
          )}
        </div>
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No matches for “{query}”.</p>
      ) : (
        <ul className={`${compact ? '' : 'card'} divide-y divide-line/70 overflow-hidden`}>
          {results.map((food) => (
            <li key={food.id} className={compact ? 'py-2' : 'px-3 py-2'}>
              {editingId === food.id ? (
                <EditFoodRow food={food} onSave={saveEdit} onCancel={() => setEditingId(null)} />
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', id: food.id })}
                    className={`icon-btn h-9 w-9 shrink-0 ${food.favorite ? 'text-carbs' : 'text-line hover:text-carbs'}`}
                    aria-label={food.favorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Icon name="star" size={18} filled={food.favorite} />
                  </button>

                  <button onClick={() => setEditingId(food.id)} className="min-w-0 flex-1 py-1 text-left" aria-label={`Edit ${food.name}`}>
                    <p className="truncate text-[15px] font-semibold text-ink">{food.name}</p>
                    <p className="truncate text-[13px] tabular-nums text-muted">
                      <span className="font-semibold text-ink2">{Math.round(food.calories)} cal</span>
                      {' · '}P {Math.round(food.protein)} · C {Math.round(food.carbs)} · F {Math.round(food.fat)}
                      {food.servingSize ? ` · ${food.servingSize}` : ''}
                    </p>
                  </button>

                  <button
                    onClick={() => removeFood(food)}
                    className="icon-btn h-9 w-9 shrink-0 text-muted hover:text-danger"
                    aria-label={`Delete ${food.name}`}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                  <button
                    onClick={() => addFood(food)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-white"
                    aria-label={`Add ${food.name}`}
                  >
                    <Icon name="plus" size={18} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FoodLibrary({ open, onClose, date, defaultMeal = 'breakfast' }) {
  return (
    <Modal open={open} onClose={onClose} title="My foods">
      {open && <FoodLibraryList date={date} defaultMeal={defaultMeal} compact />}
    </Modal>
  )
}
