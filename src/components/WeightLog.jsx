import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'
import { shortLabel } from '../lib/date.js'

export default function WeightLog({ date }) {
  const { state, dispatch, toast } = useApp()
  const stored = state.metrics[date]?.weight
  const unit = state.settings.weightUnit || 'lb'
  // Most recent weight logged before this day, for the change line.
  const previous = useMemo(() => {
    const keys = Object.keys(state.metrics).filter((k) => k < date && state.metrics[k]?.weight != null).sort()
    return keys.length ? { date: keys[keys.length - 1], weight: state.metrics[keys[keys.length - 1]].weight } : null
  }, [state.metrics, date])
  const change = stored != null && previous ? Math.round((stored - previous.weight) * 10) / 10 : null
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
          style={{ width: `${Math.max(value.length, 1) + 0.3}ch` }}
          className="min-w-0 bg-transparent text-2xl font-bold tabular-nums text-ink placeholder:text-muted/60 focus:outline-none"
          aria-label={`Weight in ${unit}`}
        />
        <span className="text-sm font-semibold text-muted">{unit}</span>
      </label>
      <p className="mb-3 mt-1 truncate text-[13px] text-muted">
        {stored == null ? (
          previous ? `Last: ${previous.weight} ${unit}` : 'Not logged yet'
        ) : change == null ? (
          'Logged for this day'
        ) : change === 0 ? (
          'Same as last time'
        ) : (
          <>
            <span className="font-semibold text-ink2">{change > 0 ? '+' : '−'}{Math.abs(change)} {unit}</span> since {shortLabel(previous.date)}
          </>
        )}
      </p>

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
