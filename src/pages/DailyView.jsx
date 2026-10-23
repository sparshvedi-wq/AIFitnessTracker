// Today tab, top to bottom: brand bar with the logging streak, the date and a
// line from the coach, week strip, the three day dials, calories + macros, the
// log button, the four meals, then training, habits (water, weight) and a note.

import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { computeStreak, groupByMeal, sumEntries } from '../lib/calc.js'
import { TEMPLATES } from '../lib/exercises.js'
import { pickNextRoutine, weekSummary } from '../lib/workout.js'
import { todayLine } from '../lib/voice.js'
import DateNav from '../components/DateNav.jsx'
import WeekStrip from '../components/WeekStrip.jsx'
import DailySummary from '../components/DailySummary.jsx'
import MealGroup from '../components/MealGroup.jsx'
import WaterTracker from '../components/WaterTracker.jsx'
import WeightLog from '../components/WeightLog.jsx'
import DiaryNote from '../components/DiaryNote.jsx'
import Icon from '../components/Icon.jsx'
import TrainingCard from '../components/TrainingCard.jsx'
import DayDials from '../components/DayDials.jsx'
import { Wordmark } from '../components/Brand.jsx'

export default function DailyView({ date, setDate, onAdd, onEdit, onWorkout }) {
  const { state, today } = useApp()
  const { settings, workouts } = state

  const dayEntries = useMemo(
    () => state.entries.filter((e) => e.date === date),
    [state.entries, date],
  )
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries])
  const groups = useMemo(() => groupByMeal(dayEntries), [dayEntries])
  const streak = useMemo(() => computeStreak(state, today), [state, today])
  const week = useMemo(() => weekSummary(workouts, date > today ? today : date), [workouts, date, today])
  const next = useMemo(() => pickNextRoutine(state.routines.length ? state.routines : TEMPLATES, workouts), [state.routines, workouts])
  const water = state.metrics[date]?.water || 0
  const line = todayLine({
    date, today,
    eaten: totals.calories,
    goal: settings.goals.calories,
    trainedToday: workouts.some((w) => w.date === date),
    weekCount: week.count,
    weeklyGoal: settings.workout.weeklyGoal,
    nextName: next?.name,
  })

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Wordmark />
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface2 py-1 pl-2 pr-3" title="Days logged in a row">
            <Icon name="flame" size={16} className="text-protein" filled />
            <span className="num text-[18px] text-ink">{streak}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">day streak</span>
          </span>
        )}
      </div>

      <DateNav date={date} onChange={setDate} />
      <p className="voice mb-4 mt-1.5">{line}</p>
      <WeekStrip date={date} onChange={setDate} />

      <DayDials
        eaten={totals.calories}
        calGoal={settings.goals.calories}
        weekCount={week.count}
        weeklyGoal={settings.workout.weeklyGoal}
        water={water}
        waterGoal={settings.waterGoal || 8}
      />

      <div className="mt-3">
        <DailySummary totals={totals} goals={settings.goals} />
      </div>

      <button onClick={() => onAdd()} className="btn-primary mt-3 h-14 w-full text-[15px]">
        <Icon name="plus" size={20} strokeWidth={2.8} />
        Log food
      </button>

      <h2 className="section-title mb-2 mt-7">Meals</h2>
      <div className="space-y-3">
        {groups.map((g) => (
          <MealGroup
            key={g.meal}
            meal={g.meal}
            items={g.items}
            totals={g.totals}
            onAdd={onAdd}
            onEdit={onEdit}
          />
        ))}
      </div>

      <h2 className="section-title mb-2 mt-7">Training</h2>
      <TrainingCard date={date} onOpen={onWorkout} />

      <h2 className="section-title mb-2 mt-7">Habits</h2>
      <div className="grid grid-cols-2 gap-3">
        <WaterTracker date={date} />
        <WeightLog date={date} />
      </div>
      <div className="mt-3">
        <DiaryNote date={date} />
      </div>
    </div>
  )
}
