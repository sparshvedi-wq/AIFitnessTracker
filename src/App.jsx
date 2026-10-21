// App shell: four tabs (Today, Foods, Progress, Settings) plus a center
// "+" button that opens the logging sheet from anywhere in the app.
// The selected date and all logging modals live here so they work the same
// whichever tab you are on.

import { useState } from 'react'
import { todayKey } from './lib/date.js'
import DailyView from './pages/DailyView.jsx'
import Foods from './pages/Foods.jsx'
import Trends from './pages/Trends.jsx'
import Settings from './pages/Settings.jsx'
import ToastHost from './components/Toast.jsx'
import Icon from './components/Icon.jsx'
import AddSheet from './components/AddSheet.jsx'
import FoodForm from './components/FoodForm.jsx'
import FoodLibrary from './components/FoodLibrary.jsx'
import CopyDayModal from './components/CopyDayModal.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'foods', label: 'Foods', icon: 'foods' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function TabButton({ tab, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2 text-[11px] font-semibold transition-colors ${
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

  // Which logging surface is open: null | 'add' | 'form' | 'library' | 'copy'
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
        <main className="flex-1 px-4 pb-32 pt-[max(env(safe-area-inset-top),16px)]">
          {tab === 'today' && (
            <DailyView date={date} setDate={setDate} onAdd={openAdd} onEdit={openEdit} />
          )}
          {tab === 'foods' && <Foods date={date} meal={meal} onNewFood={() => openNewFood()} />}
          {tab === 'progress' && <Trends />}
          {tab === 'settings' && <Settings />}
        </main>

        {/* Bottom navigation with a raised center log button */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-surface/90 backdrop-blur-xl pb-safe">
          <div className="mx-auto flex max-w-xl items-end px-2">
            <TabButton tab={TABS[0]} active={tab === 'today'} onClick={() => setTab('today')} />
            <TabButton tab={TABS[1]} active={tab === 'foods'} onClick={() => setTab('foods')} />
            <div className="flex flex-1 justify-center">
              <button
                onClick={() => openAdd()}
                className="-mt-5 mb-1.5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-float ring-4 ring-bg transition-transform active:scale-95"
                aria-label="Log food"
              >
                <Icon name="plus" size={26} strokeWidth={2.5} />
              </button>
            </div>
            <TabButton tab={TABS[2]} active={tab === 'progress'} onClick={() => setTab('progress')} />
            <TabButton tab={TABS[3]} active={tab === 'settings'} onClick={() => setTab('settings')} />
          </div>
        </nav>

        <AddSheet
          open={sheet === 'add'}
          onClose={close}
          date={date}
          meal={meal}
          setMeal={setMeal}
          onNewFood={() => openNewFood(meal)}
          onLibrary={() => setSheet('library')}
          onCopy={() => setSheet('copy')}
        />
        <FoodForm
          open={sheet === 'form'}
          onClose={close}
          date={date}
          initial={editing}
          defaultMeal={meal}
        />
        <FoodLibrary open={sheet === 'library'} onClose={close} date={date} defaultMeal={meal} />
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
