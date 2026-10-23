// Today tab: workouts done on this day, or the routine suggested next, plus
// how this week is going against the weekly goal.

import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { TEMPLATES } from '../lib/exercises.js'
import { estimateMinutes, fmtDuration, pickNextRoutine, weekSummary } from '../lib/workout.js'
import Icon from './Icon.jsx'

export default function TrainingCard({ date, onOpen }) {
  const { state, today } = useApp()
  const { workouts, routines } = state
  const done = workouts.filter((w) => w.date === date)
  const active = state.activeWorkout
  const goal = state.settings.workout.weeklyGoal
  const week = useMemo(() => weekSummary(workouts, date > today ? today : date), [workouts, date, today])
  const next = useMemo(() => pickNextRoutine(routines.length ? routines : TEMPLATES, workouts), [routines, workouts])
  const pct = goal ? Math.min(100, (week.count / goal) * 100) : 0

  let icon = 'dumbbell'
  let title
  let sub
  if (done.length > 0) {
    icon = 'check'
    title = done.map((w) => w.name).join(', ')
    sub = `${fmtDuration(done.reduce((s, w) => s + w.durationSec, 0))} · ${done.reduce((s, w) => s + w.totals.sets, 0)} sets`
  } else if (active) {
    icon = 'play'
    title = active.name
    sub = 'In progress, tap to continue'
  } else if (date === today && next) {
    title = `Up next: ${next.name}`
    sub = `${next.items.length} exercises · about ${estimateMinutes(next)} min`
  } else {
    title = date === today ? 'No workout yet today' : date > today ? 'Nothing planned yet' : 'Rest day'
    sub = 'Pick a routine and get guided set by set'
  }

  return (
    <button onClick={onOpen} className="card block w-full overflow-hidden text-left transition-colors hover:border-brand/40">
      <span className="flex items-center gap-3 p-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            done.length || active ? 'bg-brand text-on-brand shadow-brand' : 'bg-brand-soft text-brand'
          }`}
        >
          <Icon name={icon} size={20} strokeWidth={done.length ? 2.6 : 2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
          <span className="block truncate text-[13px] text-muted">{sub}</span>
        </span>
        <Icon name="chevronRight" size={18} className="shrink-0 text-muted" />
      </span>
      {goal > 0 && (
        <span className="flex items-center gap-3 border-t border-line/70 bg-surface2/50 px-4 py-2.5">
          <span className="text-[13px] font-medium text-ink2">
            <span className="font-semibold tabular-nums text-ink">{week.count}</span> of {goal} this week
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70">
            <span className="block h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}
    </button>
  )
}
