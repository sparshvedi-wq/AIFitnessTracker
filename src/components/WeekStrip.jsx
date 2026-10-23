// Mon–Sun strip under the Today header: tap a day to jump to it. A green dot
// marks days with a workout, a grey dot days with anything else logged.

import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { addDays, fromKey } from '../lib/date.js'
import { weekStart } from '../lib/workout.js'

export default function WeekStrip({ date, onChange }) {
  const { state, today } = useApp()
  const start = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const marks = useMemo(() => {
    const trained = new Set(state.workouts.map((w) => w.date))
    const logged = new Set(state.entries.map((e) => e.date))
    for (const [k, m] of Object.entries(state.metrics)) {
      if (m && ((m.water || 0) > 0 || m.weight != null || m.note)) logged.add(k)
    }
    return { trained, logged }
  }, [state.workouts, state.entries, state.metrics])

  return (
    <div className="card mb-4 grid grid-cols-7 gap-1 p-1.5">
      {days.map((k) => {
        const d = fromKey(k)
        const selected = k === date
        const isToday = k === today
        const dot = marks.trained.has(k) ? 'bg-brand' : marks.logged.has(k) ? 'bg-muted/60' : 'bg-transparent'
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            aria-pressed={selected}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors ${
              selected ? 'bg-brand text-on-brand shadow-brand' : 'hover:bg-surface2'
            }`}
          >
            <span className={`text-[11px] font-semibold uppercase ${selected ? 'opacity-80' : isToday ? 'text-brand' : 'text-muted'}`}>
              {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
            <span className={`text-[16px] font-bold tabular-nums ${selected ? '' : isToday ? 'text-brand' : 'text-ink'}`}>{d.getDate()}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${selected && dot !== 'bg-transparent' ? 'bg-on-brand' : dot}`} />
          </button>
        )
      })}
    </div>
  )
}
