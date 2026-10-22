// Today tab: workouts done on this day, or a shortcut to start one.

import { useApp } from '../store/AppContext.jsx'
import { fmtClock } from '../lib/workout.js'
import Icon from './Icon.jsx'

export default function TrainingCard({ date, onOpen }) {
  const { state, today } = useApp()
  const done = state.workouts.filter((w) => w.date === date)
  const active = state.activeWorkout

  return (
    <button onClick={onOpen} className="card flex w-full items-center gap-3 p-4 text-left">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon name={done.length ? 'check' : 'dumbbell'} size={20} strokeWidth={done.length ? 2.6 : 2} />
      </span>
      <span className="min-w-0 flex-1">
        {done.length > 0 ? (
          <>
            <span className="block truncate text-[15px] font-semibold text-ink">{done.map((w) => w.name).join(', ')}</span>
            <span className="block text-[13px] text-muted">
              {fmtClock(done.reduce((s, w) => s + w.durationSec, 0) * 1000)} · {done.reduce((s, w) => s + w.totals.sets, 0)} sets
            </span>
          </>
        ) : active ? (
          <>
            <span className="block truncate text-[15px] font-semibold text-ink">{active.name}</span>
            <span className="block text-[13px] text-muted">In progress</span>
          </>
        ) : (
          <>
            <span className="block text-[15px] font-semibold text-ink">{date === today ? 'No workout yet today' : 'No workout this day'}</span>
            <span className="block text-[13px] text-muted">Pick a routine and get guided set by set</span>
          </>
        )}
      </span>
      <Icon name="chevronRight" size={18} className="text-muted" />
    </button>
  )
}
