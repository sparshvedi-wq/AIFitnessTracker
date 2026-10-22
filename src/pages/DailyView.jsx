// Today tab, top to bottom: date, calorie + macro summary, the log button,
// the four meals, then training, daily habits (water, weight) and a note.

import { useMemo } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { groupByMeal, sumEntries } from '../lib/calc.js'
import DateNav from '../components/DateNav.jsx'
import DailySummary from '../components/DailySummary.jsx'
import MealGroup from '../components/MealGroup.jsx'
import WaterTracker from '../components/WaterTracker.jsx'
import WeightLog from '../components/WeightLog.jsx'
import DiaryNote from '../components/DiaryNote.jsx'
import Icon from '../components/Icon.jsx'
import TrainingCard from '../components/TrainingCard.jsx'

export default function DailyView({ date, setDate, onAdd, onEdit, onWorkout }) {
  const { state } = useApp()

  const dayEntries = useMemo(
    () => state.entries.filter((e) => e.date === date),
    [state.entries, date],
  )
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries])
  const groups = useMemo(() => groupByMeal(dayEntries), [dayEntries])

  return (
    <div>
      <DateNav date={date} onChange={setDate} />

      <DailySummary totals={totals} goals={state.settings.goals} />

      <button onClick={() => onAdd()} className="btn-primary mt-3 h-12 w-full">
        <Icon name="plus" size={20} strokeWidth={2.5} />
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
