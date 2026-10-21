// App shell: sticky header with theme-aware logo + bottom tab navigation.
// The selected date lives here so it persists across tab switches.

import { useState } from 'react'
import { useApp } from './store/AppContext.jsx'
import { todayKey } from './lib/date.js'
import DailyView from './pages/DailyView.jsx'
import Trends from './pages/Trends.jsx'
import Settings from './pages/Settings.jsx'
import ToastHost from './components/Toast.jsx'

const TABS = [
  {
    id: 'daily',
    label: 'Daily',
    path: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    id: 'trends',
    label: 'Trends',
    path: 'M3 3v18h18M7 14l3-3 3 3 5-6',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.82 1.17V21a2 2 0 11-4 0v-.09A1.65 1.65 0 007.5 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003.2 14.3 1.65 1.65 0 002 12.6a2 2 0 110-4 1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.61.78 1.05 1.51 1.05H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
  },
]

export default function App() {
  const { today } = useApp()
  const [tab, setTab] = useState('daily')
  const [date, setDate] = useState(todayKey())

  return (
    // Outer div fills the full screen so the dark bg covers gutters on wide viewports
    <div className="min-h-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">🍎 Calorie Tracker</h1>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-4 pb-28">
        {tab === 'daily' && <DailyView date={date} setDate={setDate} />}
        {tab === 'trends' && <Trends />}
        {tab === 'settings' && <Settings />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                  active ? 'text-cal' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <svg
                  width="22" height="22" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d={t.path} />
                </svg>
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>

      <ToastHost />
    </div>
    </div>
  )
}
