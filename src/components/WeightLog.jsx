import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

export default function WeightLog({ date }) {
  const { state, dispatch, toast } = useApp()
  const stored = state.metrics[date]?.weight
  const unit = state.settings.weightUnit || 'lb'
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(stored != null ? String(stored) : '')
  }, [stored, date])

  const dirty = value.trim() !== (stored != null ? String(stored) : '')

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
    <section className="card flex flex-col p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fat/15 text-fat">
          <Icon name="scale" size={16} />
        </span>
        Weight
      </div>
      <div className="relative mt-3">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="—"
          className="w-full bg-transparent pr-8 text-2xl font-bold tabular-nums text-ink placeholder:text-muted/60 focus:outline-none"
          aria-label={`Weight in ${unit}`}
        />
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{unit}</span>
      </div>
      <div className="mt-2 h-1.5" />
      <button onClick={save} disabled={!dirty} className="btn-secondary mt-3 h-10 p-0">
        <Icon name="check" size={18} strokeWidth={2.5} /> {stored != null && !dirty ? 'Saved' : 'Save'}
      </button>
    </section>
  )
}
