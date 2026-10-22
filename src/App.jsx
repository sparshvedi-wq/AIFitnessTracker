// App shell: three tabs (Today, Progress, Settings). The selected date and
// the logging sheets live here so the date is kept when switching tabs.

import { useState } from 'react'
import { todayKey } from './lib/date.js'
import DailyView from './pages/DailyView.jsx'
import Trends from './pages/Trends.jsx'
import Settings from './pages/Settings.jsx'
import ToastHost from './components/Toast.jsx'
import Icon from './components/Icon.jsx'
import AddSheet from './components/AddSheet.jsx'
import FoodForm from './components/FoodForm.jsx'
import CopyDayModal from './components/CopyDayModal.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function TabButton({ tab, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
        active ? 'text-brand' : 'text-muted hover:text-ink2'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={tab.icon} size={22} strokeWidth={active ? 2.2 : 1.8} />
      {tab.label}
    </button>
  )
}

export default function App() {
  const [tab, setTab] = useState('today')
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
        <main className="flex-1 px-4 pb-28 pt-[max(env(safe-area-inset-top),16px)]">
          {tab === 'today' && (
            <DailyView date={date} setDate={setDate} onAdd={openAdd} onEdit={openEdit} />
          )}
          {tab === 'progress' && <Trends />}
          {tab === 'settings' && <Settings />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-surface/90 backdrop-blur-xl pb-safe">
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
