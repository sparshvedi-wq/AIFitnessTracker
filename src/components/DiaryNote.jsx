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
      <div className="eyebrow mb-2 flex items-center gap-1.5">
        <Icon name="note" size={14} strokeWidth={2.4} />
        Note to self
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
        placeholder="How did it go? Energy, sleep, soreness…"
        rows={2}
        className="w-full resize-none bg-transparent font-serif text-[20px] italic leading-snug text-ink placeholder:text-muted/60 focus:outline-none"
      />
    </section>
  )
}
