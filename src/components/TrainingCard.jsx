// Today tab: workouts done on this day, or the routine suggested next, plus
// how this week is going against the weekly goal.

import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { TEMPLATES } from '../lib/exercises.js'
import { estimateMinutes, fmtDuration, pickNextRoutine, weekSummary } from '../lib/workout.js'
import Icon from './Icon.jsx'
import { TallyMarks } from './Brand.jsx'

export default function TrainingCard({ date, onOpen }) {
  const { state, today } = useApp()
  const { workouts, routines } = state
  const done = workouts.filter((w) => w.date === date)
  const active = state.activeWorkout
  const goal = state.settings.workout.weeklyGoal
  const week = useMemo(() => weekSummary(workouts, date > today ? today : date), [workouts, date, today])
  const next = useMemo(() => pickNextRoutine(routines.length ? routines : TEMPLATES, workouts), [routines, workouts])

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
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            done.length || active ? 'bg-accent text-on-accent' : 'bg-surface2 text-ink'
          }`}
        >
          <Icon name={icon} size={20} strokeWidth={done.length ? 2.6 : 2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[20px] font-extrabold uppercase leading-tight tracking-[0.02em] text-ink">{title}</span>
          <span className="block truncate text-[13px] text-muted">{sub}</span>
        </span>
        <Icon name="chevronRight" size={18} className="shrink-0 text-muted" />
      </span>
      {goal > 0 && (
        <span className="flex items-center justify-between gap-3 border-t border-line/70 px-4 py-3">
          <TallyMarks count={week.count} goal={goal} height={22} />
          <span className="eyebrow">
            <span className="text-ink">{week.count}</span> of {goal} this week
          </span>
        </span>
      )}
    </button>
  )
}
