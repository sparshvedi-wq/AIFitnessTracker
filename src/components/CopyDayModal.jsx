// Copy food entries from a previous day to the currently viewed date.
// Pick a logged day, untick anything you don't want, then copy.

import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEAL_LABELS, scaled, sumEntries } from '../lib/calc.js'
import { uid } from '../lib/id.js'
import { todayKey, labelForKey } from '../lib/date.js'

export default function CopyDayModal({ open, onClose, targetDate }) {
  const { state, dispatch, toast } = useApp()
  const [selectedDay, setSelectedDay] = useState(null)
  const [selected, setSelected] = useState(new Set())

  // The 30 most recent days that have food entries (excluding today & targetDate)
  const loggedDays = useMemo(() => {
    const days = new Set(
      state.entries
        .map((e) => e.date)
        .filter((d) => d !== targetDate && d !== todayKey()),
    )
    return [...days].sort((a, b) => (a > b ? -1 : 1)).slice(0, 30)
  }, [state.entries, targetDate])

  const dayEntries = useMemo(
    () => (selectedDay ? state.entries.filter((e) => e.date === selectedDay) : []),
    [state.entries, selectedDay],
  )

  function toggleEntry(id) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleClose() {
    setSelectedDay(null)
    setSelected(new Set())
    onClose()
  }

  function copySelected() {
    const toCopy = dayEntries
      .filter((e) => selected.has(e.id))
      .map((e) => ({ ...e, id: uid(), date: targetDate }))
    if (toCopy.length === 0) return
    dispatch({ type: 'ADD_ENTRIES', entries: toCopy })
    toast(`Copied ${toCopy.length} entr${toCopy.length === 1 ? 'y' : 'ies'} to ${labelForKey(targetDate)}`)
    handleClose()
  }

  const selectedTotal = sumEntries(dayEntries.filter((e) => selected.has(e.id)))

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={selectedDay ? labelForKey(selectedDay) : 'Copy a previous day'}
      maxWidth="max-w-md"
      footer={selectedDay && (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            <span className="font-semibold text-ink">{selected.size}</span> selected · {Math.round(selectedTotal.calories).toLocaleString()} cal
          </p>
          <button onClick={copySelected} disabled={selected.size === 0} className="btn-primary">
            Copy to {labelForKey(targetDate)}
          </button>
        </div>
      )}
    >
      {!selectedDay ? (
        loggedDays.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No previous days with food logged yet.</p>
        ) : (
          <ul className="-mx-2">
            {loggedDays.map((day) => {
              const entries = state.entries.filter((e) => e.date === day)
              const total = sumEntries(entries)
              return (
                <li key={day}>
                  <button
                    onClick={() => { setSelectedDay(day); setSelected(new Set(entries.map((e) => e.id))) }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">{labelForKey(day)}</p>
                      <p className="text-[13px] text-muted">
                        {entries.length} item{entries.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-[15px] font-semibold tabular-nums text-ink2">
                      {Math.round(total.calories).toLocaleString()} cal
                    </span>
                    <Icon name="chevronRight" size={18} className="text-muted" />
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          <button onClick={() => setSelectedDay(null)} className="flex items-center gap-1 text-sm font-semibold text-brand">
            <Icon name="chevronLeft" size={16} strokeWidth={2.5} /> All days
          </button>
          <ul className="card divide-y divide-line/70 overflow-hidden">
            {dayEntries.map((entry) => {
              const v = scaled(entry)
              const checked = selected.has(entry.id)
              return (
                <li key={entry.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEntry(entry.id)}
                      className="h-5 w-5 shrink-0 rounded-md accent-[rgb(var(--brand))]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {entry.name}
                        {Number(entry.servings) !== 1 && (
                          <span className="ml-1 text-[13px] text-muted">×{entry.servings}</span>
                        )}
                      </p>
                      <p className="text-[13px] text-muted">
                        {MEAL_LABELS[entry.meal]} · P {Math.round(v.protein)} · C {Math.round(v.carbs)} · F {Math.round(v.fat)}
                      </p>
                    </div>
                    <span className="text-[15px] font-semibold tabular-nums text-ink">{Math.round(v.calories)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Modal>
  )
}
