// Mon–Sun strip under the Today header: tap a day to jump to it. A tally
// stroke marks days with a workout, a grey dot days with anything else logged.

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
    <div className="mb-3 grid grid-cols-7 gap-1">
      {days.map((k) => {
        const d = fromKey(k)
        const selected = k === date
        const isToday = k === today
        const trained = marks.trained.has(k)
        const logged = marks.logged.has(k)
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            aria-pressed={selected}
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors ${
              selected ? 'bg-ink text-bg' : 'hover:bg-surface2'
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${selected ? 'opacity-70' : isToday ? 'text-brand' : 'text-muted'}`}>
              {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
            </span>
            <span className={`num text-[22px] ${selected ? '' : isToday ? 'text-brand' : 'text-ink'}`}>{d.getDate()}</span>
            {trained ? (
              <span className="h-[3px] w-4 -skew-x-12 rounded-full bg-accent" />
            ) : (
              <span className={`h-[3px] w-[3px] rounded-full ${logged ? (selected ? 'bg-bg/50' : 'bg-muted/70') : 'bg-transparent'}`} />
            )}
          </button>
        )
      })}
    </div>
  )
}
