// Today header: big day label, prev/next, tap the label for a calendar.

import { addDays, labelForKey, fromKey, toKey, todayKey } from '../lib/date.js'
import Icon from './Icon.jsx'

export default function DateNav({ date, onChange }) {
  const isToday = date === todayKey()
  const label = labelForKey(date)
  const relative = ['Today', 'Yesterday', 'Tomorrow'].includes(label)
  const full = fromKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <header className="mb-5 flex items-end justify-between gap-2 pt-2">
      <label className="relative min-w-0 cursor-pointer">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          {relative ? full : fromKey(date).getFullYear()}
        </p>
        <h1 className="flex items-center gap-1 text-[28px] font-extrabold leading-tight tracking-tight text-ink">
          {label}
          <Icon name="chevronDown" size={20} strokeWidth={2.5} className="text-muted" />
        </h1>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(toKey(fromKey(e.target.value)))}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick a date"
        />
      </label>

      <div className="flex shrink-0 items-center gap-1">
        {!isToday && (
          <button onClick={() => onChange(todayKey())} className="chip mr-1 py-1 text-[13px]">
            Today
          </button>
        )}
        <button onClick={() => onChange(addDays(date, -1))} className="icon-btn border border-line bg-surface" aria-label="Previous day">
          <Icon name="chevronLeft" size={20} />
        </button>
        <button onClick={() => onChange(addDays(date, 1))} className="icon-btn border border-line bg-surface" aria-label="Next day">
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
    </header>
  )
}
