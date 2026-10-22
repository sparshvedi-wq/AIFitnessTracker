import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

export default function WeightLog({ date }) {
  const { state, dispatch, toast } = useApp()
  const stored = state.metrics[date]?.weight
  const unit = state.settings.weightUnit || 'lb'
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

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
    inputRef.current?.blur()
  }

  return (
    <section className="card flex flex-col p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fat/15 text-fat">
          <Icon name="scale" size={16} />
        </span>
        Weight
      </div>

      {/* Number and unit read as one value; the input sizes to its content */}
      <label className="mt-3 flex cursor-text items-baseline gap-1">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="—"
          style={{ width: `${Math.max(value.length, 1) + 0.6}ch` }}
          className="min-w-0 bg-transparent text-2xl font-bold tabular-nums text-ink placeholder:text-muted/60 focus:outline-none"
          aria-label={`Weight in ${unit}`}
        />
        <span className="text-sm font-semibold text-muted">{unit}</span>
      </label>
      <p className="mb-3 mt-1 text-[13px] text-muted">{stored != null ? 'Logged for this day' : 'Not logged yet'}</p>

      <button
        onClick={dirty ? save : () => inputRef.current?.focus()}
        className={`mt-auto h-10 w-full p-0 ${dirty ? 'btn-primary' : 'btn-secondary'}`}
      >
        {dirty ? (
          <><Icon name="check" size={18} strokeWidth={2.5} /> Save</>
        ) : (
          <><Icon name="pencil" size={16} /> {stored != null ? 'Edit' : 'Add'}</>
        )}
      </button>
    </section>
  )
}
