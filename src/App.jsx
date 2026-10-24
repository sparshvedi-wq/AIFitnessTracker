// App shell: four tabs (Home, Train, History, You), plus the active workout,
// which keeps running above whichever tab is open.

import { useState } from 'react'
import Home from './pages/Home.jsx'
import Train from './pages/Train.jsx'
import History from './pages/History.jsx'
import You from './pages/You.jsx'
import WorkoutHost from './components/workout/WorkoutHost.jsx'
import { useApp } from './store/AppContext.jsx'
import ToastHost from './components/Toast.jsx'
import Icon from './components/Icon.jsx'

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'train', label: 'Train', icon: 'train' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'you', label: 'You', icon: 'you' },
]

export default function App() {
  const { state } = useApp()
  const [tab, setTab] = useState('home')
  // Reopen the player after a reload if a workout was in progress.
  const [playerOpen, setPlayerOpen] = useState(() => Boolean(state.activeWorkout))

  const go = (id) => {
    setTab(id)
    window.scrollTo(0, 0)
  }
  const nav = { go, openPlayer: () => setPlayerOpen(true) }

  return (
    <div className="min-h-full bg-bg text-ink">
      <div className="mx-auto flex min-h-full max-w-xl flex-col">
        <main className={`flex-1 px-[22px] pt-[max(env(safe-area-inset-top),20px)] ${state.activeWorkout ? 'pb-44' : 'pb-28'}`}>
          {tab === 'home' && <Home nav={nav} />}
          {tab === 'train' && <Train nav={nav} />}
          {tab === 'history' && <History nav={nav} />}
          {tab === 'you' && <You nav={nav} />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#222327] bg-bg pb-safe">
          <div className="mx-auto grid max-w-xl grid-cols-4 px-3 pb-3 pt-2.5">
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex flex-col items-center gap-[5px] text-[12px] transition-colors ${on ? 'font-bold text-accent' : 'font-medium text-[#8A877F]'}`}
                >
                  <Icon name={t.icon} size={26} strokeWidth={1.8} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>

        <WorkoutHost open={playerOpen} setOpen={setPlayerOpen} />
        <ToastHost />
      </div>
    </div>
  )
}
