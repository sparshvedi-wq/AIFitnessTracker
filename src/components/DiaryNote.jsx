// A short daily note/journal entry. Auto-saves on blur.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'

export default function DiaryNote({ date }) {
  const { state, dispatch } = useApp()
  const stored = state.metrics[date]?.note || ''
  const [value, setValue] = useState(stored)
  const textareaRef = useRef(null)

  useEffect(() => {
    setValue(state.metrics[date]?.note || '')
  }, [date, state.metrics])

  function save() {
    const trimmed = value.trim()
    if (trimmed !== stored.trim()) {
      dispatch({ type: 'SET_METRIC', date, patch: { note: trimmed } })
    }
  }

  // Auto-grow textarea
  function handleChange(e) {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm animate-fade-in">
      <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        📝 Daily note
      </h3>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={save}
        placeholder="How did today go? Any notes on meals, energy, mood…"
        rows={2}
        className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20"
      />
    </div>
  )
}
