// A short daily note/journal entry. Auto-saves on blur.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

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
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface2 text-ink2">
          <Icon name="note" size={16} />
        </span>
        Note
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={save}
        placeholder="How did today go? Energy, mood, cravings…"
        rows={2}
        className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none"
      />
    </section>
  )
}
