import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'

export default function WeightLog({ date }) {
  const { state, dispatch, toast } = useApp()
  const stored = state.metrics[date]?.weight
  const unit = state.settings.weightUnit || 'lb'
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(stored != null ? String(stored) : '')
  }, [stored, date])

  function save() {
    const trimmed = value.trim()
    const weight = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && !Number.isFinite(weight)) {
      toast('Enter a valid number', 'error')
      return
    }
    dispatch({ type: 'SET_METRIC', date, patch: { weight } })
    toast(weight == null ? 'Weight cleared' : `Weight logged: ${weight} ${unit}`)
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">⚖️ Weight</h3>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="—"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 pr-10 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">
            {unit}
          </span>
        </div>
        <button
          onClick={save}
          className="rounded-lg bg-slate-800 dark:bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-500"
        >
          Save
        </button>
      </div>
    </div>
  )
}
