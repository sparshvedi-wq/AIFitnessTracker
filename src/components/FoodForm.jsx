// Add / edit a food entry. Full dark-mode support, live scaled preview,
// quick-serving buttons, and optional library save.

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEALS, MEAL_LABELS, scaled } from '../lib/calc.js'
import { uid } from '../lib/id.js'

const EMPTY = {
  name: '', meal: 'breakfast', calories: '', protein: '', carbs: '',
  fat: '', servingSize: '', servings: '1',
}

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20'

function NumField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  )
}

const SERVING_PRESETS = [0.5, 1, 1.5, 2, 3]

export default function FoodForm({ open, onClose, date, initial, defaultMeal }) {
  const { dispatch, toast } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [saveToLibrary, setSaveToLibrary] = useState(true)
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
      setSaveToLibrary(false)
    } else {
      setForm({ ...EMPTY, meal: defaultMeal ?? 'breakfast' })
      setSaveToLibrary(true)
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
      toast('Entry added')
    }

    if (saveToLibrary || editing) {
      dispatch({ type: 'SAVE_FOOD', food: { name: base.name, calories: base.calories, protein: base.protein, carbs: base.carbs, fat: base.fat, servingSize: base.servingSize } })
      if (!editing) dispatch({ type: 'INCREMENT_FOOD_USAGE', name: base.name })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit entry' : 'Add food'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Food name</span>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="e.g. Greek yogurt"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Meal</span>
            <select value={form.meal} onChange={(e) => set('meal')(e.target.value)} className={inputCls}>
              {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Serving size</span>
            <input value={form.servingSize} onChange={(e) => set('servingSize')(e.target.value)} placeholder="e.g. 1 cup, 100g" className={inputCls} />
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Per serving</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField label="Calories" value={form.calories} onChange={set('calories')} />
            <NumField label="Protein (g)" value={form.protein} onChange={set('protein')} />
            <NumField label="Carbs (g)" value={form.carbs} onChange={set('carbs')} />
            <NumField label="Fat (g)" value={form.fat} onChange={set('fat')} />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Servings</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={form.servings}
              onChange={(e) => set('servings')(e.target.value)}
              className={`${inputCls} w-20`}
            />
            <div className="flex gap-1">
              {SERVING_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('servings')(String(n))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    Number(form.servings) === n
                      ? 'bg-cal text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  ×{n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live total preview */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Total ({form.servings || 1}×)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            <span className="text-cal">{Math.round(preview.calories)} cal</span>
            <span className="text-protein">P {Math.round(preview.protein)}g</span>
            <span className="text-carbs">C {Math.round(preview.carbs)}g</span>
            <span className="text-fat">F {Math.round(preview.fat)}g</span>
          </div>
        </div>

        {!editing && (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-cal focus:ring-cal"
            />
            Save to food library for quick re-adding
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-cal px-5 py-2 text-sm font-semibold text-white hover:bg-sky-600">
            {editing ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
