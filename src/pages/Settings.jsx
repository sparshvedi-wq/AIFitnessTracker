// Settings: calorie & macro goals, water/weight config, dark-mode toggle,
// BMR calculator, and data backup (export / import / reset).

import { useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { gramGoalsFromPercent } from '../lib/storage.js'
import { exportData, importData } from '../lib/backup.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import BMRCalc from '../components/BMRCalc.jsx'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20'

const THEME_OPTIONS = [
  { value: 'system', label: '⚙️ System' },
  { value: 'light', label: '☀️ Light' },
  { value: 'dark', label: '🌙 Dark' },
]

export default function Settings() {
  const { state, dispatch, toast } = useApp()
  const { settings } = state
  const fileRef = useRef(null)
  const [pendingImport, setPendingImport] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const { goals, useMacroPercent, macroPercent } = settings
  const derived = gramGoalsFromPercent(goals.calories, macroPercent)
  const percentTotal = macroPercent.protein + macroPercent.carbs + macroPercent.fat

  const updateGoals = (patch) =>
    dispatch({ type: 'UPDATE_SETTINGS', patch: { goals: { ...goals, ...patch } } })

  const updatePercent = (patch) =>
    dispatch({ type: 'UPDATE_SETTINGS', patch: { macroPercent: { ...macroPercent, ...patch } } })

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    importData(file)
      .then((data) => setPendingImport(data))
      .catch((err) => toast(err.message || 'Import failed', 'error'))
    e.target.value = ''
  }

  function applyImport() {
    dispatch({ type: 'IMPORT_STATE', state: pendingImport })
    setPendingImport(null)
    toast('Data imported successfully')
  }

  return (
    <div className="space-y-4 pb-6">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Settings</h2>

      {/* Appearance */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Appearance</h3>
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: t.value } })}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                settings.theme === t.value
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* BMR / TDEE Calculator */}
      <BMRCalc />

      {/* Calorie & macro goals */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Daily goals</h3>

        <Field label="Calorie goal" hint="Used for remaining-calories display and progress bars.">
          <input
            type="number"
            min="0"
            value={goals.calories}
            onChange={(e) => updateGoals({ calories: Number(e.target.value) || 0 })}
            className={inputCls}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={useMacroPercent}
            onChange={(e) =>
              dispatch({ type: 'UPDATE_SETTINGS', patch: { useMacroPercent: e.target.checked } })
            }
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-cal focus:ring-cal"
          />
          Set macros by % of calories (auto-calculates grams)
        </label>

        {useMacroPercent ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {['protein', 'carbs', 'fat'].map((m) => (
                <Field key={m} label={`${m[0].toUpperCase() + m.slice(1)} %`}>
                  <input
                    type="number" min="0" max="100"
                    value={macroPercent[m]}
                    onChange={(e) => updatePercent({ [m]: Number(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
            <p className={`text-xs font-medium ${percentTotal === 100 ? 'text-slate-400 dark:text-slate-500' : 'text-red-500'}`}>
              Total: {percentTotal}%{percentTotal !== 100 && ' — should equal 100%'}
            </p>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm">
              Targets:{' '}
              <span className="font-semibold text-protein">{derived.protein}g</span> protein ·{' '}
              <span className="font-semibold text-carbs">{derived.carbs}g</span> carbs ·{' '}
              <span className="font-semibold text-fat">{derived.fat}g</span> fat
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {['protein', 'carbs', 'fat'].map((m) => (
              <Field key={m} label={`${m[0].toUpperCase() + m.slice(1)} (g)`}>
                <input
                  type="number" min="0"
                  value={goals[m]}
                  onChange={(e) => updateGoals({ [m]: Number(e.target.value) || 0 })}
                  className={inputCls}
                />
              </Field>
            ))}
          </div>
        )}
      </section>

      {/* Other */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Other</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Water goal (glasses)">
            <input
              type="number" min="0"
              value={settings.waterGoal}
              onChange={(e) =>
                dispatch({ type: 'UPDATE_SETTINGS', patch: { waterGoal: Number(e.target.value) || 0 } })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Weight unit">
            <select
              value={settings.weightUnit}
              onChange={(e) =>
                dispatch({ type: 'UPDATE_SETTINGS', patch: { weightUnit: e.target.value } })
              }
              className={inputCls}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Backup */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Backup & data</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          All data lives in this browser. Export a JSON backup regularly so you don't lose it.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportData(state)}
            className="rounded-lg bg-slate-800 dark:bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-500"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Import JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
          <button
            onClick={() => setConfirmReset(true)}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Reset all data
          </button>
        </div>

        {/* Storage usage estimate */}
        <p className="text-xs text-slate-300 dark:text-slate-600">
          {state.entries.length} entries · {state.foods.length} saved foods · {Object.keys(state.metrics).length} days with metrics
        </p>
      </section>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Import backup?"
        message="This will replace ALL current data. Export first if you want to keep it."
        confirmLabel="Import & replace"
        onConfirm={applyImport}
        onClose={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="This permanently deletes all entries, foods, metrics, and settings. There is no undo."
        confirmLabel="Yes, reset all"
        onConfirm={() => {
          dispatch({ type: 'RESET' })
          toast('All data reset', 'info')
        }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  )
}
