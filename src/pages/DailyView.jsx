// Daily view: date nav, quick-add bar, recently eaten strip, the day's
// summary ring, water/weight, diary note, and per-meal entry groups.
// Delete is undo-able via a toast action (no blocking confirm dialog).

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { groupByMeal, sumEntries } from '../lib/calc.js'
import { uid } from '../lib/id.js'
import DateNav from '../components/DateNav.jsx'
import QuickAddBar from '../components/QuickAddBar.jsx'
import RecentFoods from '../components/RecentFoods.jsx'
import DailySummary from '../components/DailySummary.jsx'
import MealGroup from '../components/MealGroup.jsx'
import WaterTracker from '../components/WaterTracker.jsx'
import WeightLog from '../components/WeightLog.jsx'
import DiaryNote from '../components/DiaryNote.jsx'
import FoodForm from '../components/FoodForm.jsx'
import FoodLibrary from '../components/FoodLibrary.jsx'
import CopyDayModal from '../components/CopyDayModal.jsx'

export default function DailyView({ date, setDate }) {
  const { state, dispatch, toast } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [defaultMeal, setDefaultMeal] = useState('breakfast')
  // activeMeal is used to target quick-re-adds to the right meal
  const [activeMeal, setActiveMeal] = useState('breakfast')

  const dayEntries = useMemo(
    () => state.entries.filter((e) => e.date === date),
    [state.entries, date],
  )
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries])
  const groups = useMemo(() => groupByMeal(dayEntries), [dayEntries])

  function openNew(meal = activeMeal) {
    setEditing(null)
    setDefaultMeal(meal)
    setActiveMeal(meal)
    setFormOpen(true)
  }

  function openEdit(entry) {
    setEditing(entry)
    setFormOpen(true)
  }

  // Optimistic delete with undo toast
  function deleteEntry(entry) {
    dispatch({ type: 'DELETE_ENTRY', id: entry.id })
    toast(`Deleted "${entry.name}"`, 'info', {
      label: 'Undo',
      onClick: () => dispatch({ type: 'ADD_ENTRY', entry: { ...entry } }),
    })
  }

  return (
    <div className="space-y-4">
      <DateNav date={date} onChange={setDate} onCopy={() => setCopyOpen(true)} />

      <QuickAddBar onNewFood={openNew} onOpenLibrary={() => setLibraryOpen(true)} />

      {/* Recently eaten strip — only shows if there's history */}
      <RecentFoods date={date} activeMeal={activeMeal} />

      <DailySummary totals={totals} goals={state.settings.goals} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WaterTracker date={date} />
        <WeightLog date={date} />
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <MealGroup
            key={g.meal}
            meal={g.meal}
            items={g.items}
            totals={g.totals}
            onAdd={(meal) => { setActiveMeal(meal); openNew(meal) }}
            onEdit={openEdit}
            onDelete={deleteEntry}
          />
        ))}
      </div>

      <DiaryNote date={date} />

      <FoodForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        date={date}
        initial={editing}
        defaultMeal={defaultMeal}
      />
      <FoodLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        date={date}
        defaultMeal={activeMeal}
      />
      <CopyDayModal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        targetDate={date}
      />
    </div>
  )
}
