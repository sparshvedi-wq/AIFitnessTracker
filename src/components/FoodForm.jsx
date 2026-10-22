// Add / edit a food entry. Live scaled preview, quick-serving buttons,
// and (when editing) delete with undo.

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEALS, MEAL_LABELS, scaled } from '../lib/calc.js'
import { uid } from '../lib/id.js'

const EMPTY = {
  name: '', meal: 'breakfast', calories: '', protein: '', carbs: '',
  fat: '', servingSize: '', servings: '1',
}

function NumField({ label, value, onChange, dot }) {
  return (
    <label className="block">
      <span className="field-label flex items-center gap-1.5">
        {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="input tabular-nums"
      />
    </label>
  )
}

const SERVING_PRESETS = [0.5, 1, 1.5, 2, 3]

export default function FoodForm({ open, onClose, date, initial, defaultMeal }) {
  const { dispatch, toast } = useApp()
  const [form, setForm] = useState(EMPTY)
  const editing = Boolean(initial?.id)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name ?? '',
        meal: initial.meal ?? defaultMeal ?? 'breakfast',
        calories: initial.calories ?? '',
        protein: initial.protein ?? '',
        carbs: initial.carbs ?? '',
        fat: initial.fat ?? '',
        servingSize: initial.servingSize ?? '',
        servings: String(initial.servings ?? '1'),
      })
    } else {
      setForm({ ...EMPTY, meal: defaultMeal ?? 'breakfast' })
    }
  }, [open, initial, defaultMeal, editing])

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }))

  const preview = scaled({
    calories: form.calories, protein: form.protein,
    carbs: form.carbs, fat: form.fat, servings: form.servings,
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast('Please enter a food name', 'error'); return }

    const base = {
      name: form.name.trim(),
      meal: form.meal,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      servingSize: form.servingSize.trim(),
      servings: Number(form.servings) || 1,
    }

    if (editing) {
      dispatch({ type: 'UPDATE_ENTRY', entry: { ...base, id: initial.id } })
      toast('Entry updated')
    } else {
      dispatch({ type: 'ADD_ENTRY', entry: { ...base, id: uid(), date } })
      toast(`Added to ${MEAL_LABELS[base.meal].toLowerCase()}`)
    }
    onClose()
  }

  // Optimistic delete with undo toast
  function handleDelete() {
    const entry = { ...initial }
    dispatch({ type: 'DELETE_ENTRY', id: entry.id })
    toast(`Deleted "${entry.name}"`, 'info', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'ADD_ENTRY', entry }),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit entry' : 'Enter food'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="field-label">Food name</span>
          <input
            autoFocus={!editing}
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="e.g. Greek yogurt"
            className="input"
          />
        </label>

        <div>
          <span className="field-label">Meal</span>
          <div className="segmented">
            {MEALS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set('meal')(m)}
                className={`segment ${form.meal === m ? 'segment-active' : ''}`}
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="section-title px-0">Nutrition per serving</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Calories" value={form.calories} onChange={set('calories')} dot="rgb(var(--brand))" />
            <NumField label="Protein (g)" value={form.protein} onChange={set('protein')} dot="#E5484D" />
            <NumField label="Carbs (g)" value={form.carbs} onChange={set('carbs')} dot="#F0A020" />
            <NumField label="Fat (g)" value={form.fat} onChange={set('fat')} dot="#7C66DC" />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className="field-label">Serving size</span>
            <input value={form.servingSize} onChange={(e) => set('servingSize')(e.target.value)} placeholder="1 cup, 100 g…" className="input" />
          </label>
          <label className="block w-24">
            <span className="field-label">Servings</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={form.servings}
              onChange={(e) => set('servings')(e.target.value)}
              className="input text-center tabular-nums"
            />
          </label>
        </div>
        <div className="no-scrollbar -mt-2 flex gap-1.5 overflow-x-auto">
          {SERVING_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set('servings')(String(n))}
              className={`chip px-3 py-1 tabular-nums ${Number(form.servings) === n ? 'chip-active' : ''}`}
            >
              ×{n}
            </button>
          ))}
        </div>

        {/* Live total */}
        <div className="flex items-center justify-between rounded-2xl bg-surface2 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-muted">Total</p>
            <p className="text-2xl font-bold tabular-nums text-ink">
              {Math.round(preview.calories)} <span className="text-sm font-semibold text-muted">cal</span>
            </p>
          </div>
          <div className="flex gap-3 text-[13px] font-semibold tabular-nums">
            <span className="text-protein">P {Math.round(preview.protein)}g</span>
            <span className="text-carbs">C {Math.round(preview.carbs)}g</span>
            <span className="text-fat">F {Math.round(preview.fat)}g</span>
          </div>
        </div>


        <div className="flex gap-2 pt-1">
          {editing && (
            <button type="button" onClick={handleDelete} className="btn-danger-ghost px-3" aria-label="Delete entry">
              <Icon name="trash" size={18} />
              Delete
            </button>
          )}
          <button type="submit" className="btn-primary flex-1">
            {editing ? 'Save changes' : 'Add to log'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
