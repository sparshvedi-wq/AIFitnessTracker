// App shell: four tabs (Today, Workout, Progress, Settings), plus the active
// workout, which keeps running above whichever tab is open. The selected date and
// the logging sheets live here so the date is kept when switching tabs.

import { useState } from 'react'
import { todayKey } from './lib/date.js'
import DailyView from './pages/DailyView.jsx'
import Trends from './pages/Trends.jsx'
import Settings from './pages/Settings.jsx'
import Workouts from './pages/Workouts.jsx'
import WorkoutHost from './components/workout/WorkoutHost.jsx'
import { useApp } from './store/AppContext.jsx'
import ToastHost from './components/Toast.jsx'
import Icon from './components/Icon.jsx'
import AddSheet from './components/AddSheet.jsx'
import FoodForm from './components/FoodForm.jsx'
import CopyDayModal from './components/CopyDayModal.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'workout', label: 'Train', icon: 'dumbbell' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function TabButton({ tab, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
        active ? 'text-ink' : 'text-muted hover:text-ink2'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {/* A volt tally stroke marks the open tab */}
      <span
        className={`absolute top-0 h-[3px] w-8 -skew-x-12 rounded-full bg-accent transition-all duration-300 ${
          active ? 'opacity-100' : 'scale-x-0 opacity-0'
        }`}
      />
      <Icon name={tab.icon} size={22} strokeWidth={active ? 2.3 : 1.8} />
      {tab.label}
    </button>
  )
}

export default function App() {
  const { state } = useApp()
  const [tab, setTab] = useState(() => (state.activeWorkout ? 'workout' : 'today'))
  // Reopen the player after a reload if a workout was in progress.
  const [playerOpen, setPlayerOpen] = useState(() => Boolean(state.activeWorkout))
  const [date, setDate] = useState(todayKey())

  // Which logging sheet is open: null | 'add' | 'form' | 'copy'
  const [sheet, setSheet] = useState(null)
  const [meal, setMeal] = useState(defaultMealForNow())
  const [editing, setEditing] = useState(null)

  const close = () => setSheet(null)

  function openAdd(forMeal) {
    if (forMeal) setMeal(forMeal)
    setSheet('add')
  }
  function openNewFood(forMeal = meal) {
    setEditing(null)
    setMeal(forMeal)
    setSheet('form')
  }
  function openEdit(entry) {
    setEditing(entry)
    setSheet('form')
  }

  return (
    <div className="min-h-full bg-bg text-ink">
      <div className="mx-auto flex min-h-full max-w-xl flex-col">
        <main className={`flex-1 px-4 pt-[max(env(safe-area-inset-top),16px)] ${state.activeWorkout ? 'pb-48' : 'pb-28'}`}>
          {tab === 'today' && (
            <DailyView date={date} setDate={setDate} onAdd={openAdd} onEdit={openEdit} onWorkout={() => setTab('workout')} />
          )}
          {tab === 'workout' && <Workouts onOpenPlayer={() => setPlayerOpen(true)} />}
          {tab === 'progress' && <Trends />}
          {tab === 'settings' && <Settings />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-bg/85 backdrop-blur-xl pb-safe">
          <div className="mx-auto flex max-w-xl px-2">
            {TABS.map((t) => (
              <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>
        </nav>

        <AddSheet
          open={sheet === 'add'}
          onClose={close}
          date={date}
          meal={meal}
          setMeal={setMeal}
          onNewFood={() => openNewFood(meal)}
          onCopy={() => setSheet('copy')}
        />
        <FoodForm
          open={sheet === 'form'}
          onClose={close}
          date={date}
          initial={editing}
          defaultMeal={meal}
        />
        <CopyDayModal open={sheet === 'copy'} onClose={close} targetDate={date} />

        <WorkoutHost open={playerOpen} setOpen={setPlayerOpen} />
        <ToastHost />
      </div>
    </div>
  )
}

// Pre-select the meal that matches the time of day.
function defaultMealForNow() {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
