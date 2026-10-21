// Copy food entries from any previous day to the currently viewed date.
// Shows a list of recent logged days → select one → check entries → copy.

import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useApp } from '../store/AppContext.jsx'
import { MEAL_LABELS, scaled, sumEntries } from '../lib/calc.js'
import { uid } from '../lib/id.js'
import { addDays, todayKey, labelForKey } from '../lib/date.js'

export default function CopyDayModal({ open, onClose, targetDate }) {
  const { state, dispatch, toast } = useApp()
  const [selectedDay, setSelectedDay] = useState(null)
  const [selected, setSelected] = useState(new Set())

  // Collect the last 60 days that actually have food entries (excluding today & targetDate)
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

  function pickDay(day) {
    setSelectedDay(day)
    setSelected(new Set(dayEntries.map((e) => e.id))) // select all by default
  }

  // Re-sync selection when day changes
  const dayEntriesForPick = useMemo(
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

  function copySelected() {
    const toCopy = dayEntriesForPick
      .filter((e) => selected.has(e.id))
      .map((e) => ({ ...e, id: uid(), date: targetDate }))
    if (toCopy.length === 0) return
    dispatch({ type: 'ADD_ENTRIES', entries: toCopy })
    toast(`Copied ${toCopy.length} entr${toCopy.length === 1 ? 'y' : 'ies'} to ${labelForKey(targetDate)}`)
    onClose()
  }

  function handleClose() {
    setSelectedDay(null)
    setSelected(new Set())
    onClose()
  }

  const dayTotal = sumEntries(dayEntriesForPick.filter((e) => selected.has(e.id)))

  return (
    <Modal open={open} onClose={handleClose} title="Copy from another day" maxWidth="max-w-md">
      {!selectedDay ? (
        <div className="space-y-1">
          {loggedDays.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No previous days with food logged.
            </p>
          ) : (
            loggedDays.map((day) => {
              const entries = state.entries.filter((e) => e.date === day)
              const total = sumEntries(entries)
              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDay(day); setSelected(new Set(entries.map((e) => e.id))) }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {labelForKey(day)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {entries.length} item{entries.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {Math.round(total.calories)} cal
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setSelectedDay(null)}
            className="flex items-center gap-1 text-sm text-cal hover:underline"
          >
            ← Back
          </button>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {labelForKey(selectedDay)} — select entries to copy
          </p>

          <div className="max-h-64 divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            {dayEntriesForPick.map((entry) => {
              const v = scaled(entry)
              const checked = selected.has(entry.id)
              return (
                <label key={entry.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEntry(entry.id)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-cal focus:ring-cal"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {entry.name}
                      {Number(entry.servings) !== 1 && (
                        <span className="ml-1 text-xs text-slate-400">×{entry.servings}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {MEAL_LABELS[entry.meal]} · P{Math.round(v.protein)} C{Math.round(v.carbs)} F{Math.round(v.fat)}
                    </p>
                  </div>
                  <span className="tabular-nums text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {Math.round(v.calories)}
                  </span>
                </label>
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {selected.size} selected · {Math.round(dayTotal.calories)} cal
            </p>
            <button
              onClick={copySelected}
              disabled={selected.size === 0}
              className="rounded-lg bg-cal px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-40"
            >
              Copy {selected.size > 0 ? selected.size : ''} entries
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
