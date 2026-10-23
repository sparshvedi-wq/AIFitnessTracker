// A short daily note/journal entry. Auto-saves on blur.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

export default function DiaryNote({ date }) {
  const { state, dispatch } = useApp()
  const stored = state.metrics[date]?.note || ''
  const [value, setValue] = useState(stored)
  const textareaRef = useRef(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(state.metrics[date]?.note || '')
  }, [date, state.metrics])

  // Auto-grow, including when a longer note loads for another day
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(id)
  }, [saved])

  function save() {
    const trimmed = value.trim()
    if (trimmed !== stored.trim()) {
      dispatch({ type: 'SET_METRIC', date, patch: { note: trimmed } })
      setSaved(true)
    }
  }

  function handleChange(e) {
    setValue(e.target.value)
  }

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface2 text-ink2">
          <Icon name="note" size={16} />
        </span>
        Note
        <span className={`ml-auto flex items-center gap-1 text-[12px] font-medium text-brand transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
          <Icon name="check" size={13} strokeWidth={3} />
          {saved ? 'Saved' : ''}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={save}
        placeholder="How did today go? Energy, mood, sleep, soreness…"
        rows={2}
        className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none"
      />
    </section>
  )
}
