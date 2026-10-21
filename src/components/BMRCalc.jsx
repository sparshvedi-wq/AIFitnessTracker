// BMR/TDEE calculator using the Mifflin-St Jeor equation.
// Shown as a collapsible panel within Settings.

import { useState } from 'react'
import { useApp } from '../store/AppContext.jsx'

const ACTIVITY = [
  { label: 'Sedentary (little or no exercise)', factor: 1.2 },
  { label: 'Lightly active (1–3 days/week)', factor: 1.375 },
  { label: 'Moderately active (3–5 days/week)', factor: 1.55 },
  { label: 'Very active (6–7 days/week)', factor: 1.725 },
  { label: 'Extra active (physical job + training)', factor: 1.9 },
]

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-cal focus:outline-none focus:ring-2 focus:ring-cal/20'

export default function BMRCalc() {
  const { dispatch, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    gender: 'male',
    age: '',
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weightLb: '',
    weightKg: '',
    activity: 1.55,
    unit: 'imperial', // 'imperial' | 'metric'
  })
  const [result, setResult] = useState(null)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  function calculate() {
    const { gender, age, unit, activity } = form
    const a = Number(age)
    if (!a || a < 5 || a > 120) { toast('Enter a valid age', 'error'); return }

    let weightKg, heightCm
    if (unit === 'imperial') {
      const lb = Number(form.weightLb)
      const ft = Number(form.heightFt)
      const inches = Number(form.heightIn) || 0
      if (!lb) { toast('Enter your weight', 'error'); return }
      if (!ft) { toast('Enter your height', 'error'); return }
      weightKg = lb * 0.453592
      heightCm = (ft * 12 + inches) * 2.54
    } else {
      weightKg = Number(form.weightKg)
      heightCm = Number(form.heightCm)
      if (!weightKg) { toast('Enter your weight', 'error'); return }
      if (!heightCm) { toast('Enter your height', 'error'); return }
    }

    // Mifflin-St Jeor
    const bmr =
      gender === 'male'
        ? 10 * weightKg + 6.25 * heightCm - 5 * a + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * a - 161

    const tdee = Math.round(bmr * activity)
    setResult({ bmr: Math.round(bmr), tdee })
  }

  function applyGoal(cal) {
    dispatch({ type: 'UPDATE_SETTINGS', patch: { goals: { calories: cal } } })
    // keep existing macro goals, just update calories
    toast(`Calorie goal set to ${cal}`)
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            🧮 Calculate my calorie goal
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Uses BMR (Mifflin-St Jeor) + activity level
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-5 space-y-4 animate-slide-up">
          {/* Unit toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5">
            {['imperial', 'metric'].map((u) => (
              <button
                key={u}
                onClick={() => set('unit')(u)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                  form.unit === u
                    ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {u === 'imperial' ? 'Imperial (lb, ft)' : 'Metric (kg, cm)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Gender</span>
              <select value={form.gender} onChange={(e) => set('gender')(e.target.value)} className={inputCls}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Age</span>
              <input type="number" min="5" max="120" value={form.age} onChange={(e) => set('age')(e.target.value)} placeholder="30" className={inputCls} />
            </label>
          </div>

          {form.unit === 'imperial' ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-1 block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Weight (lb)</span>
                <input type="number" value={form.weightLb} onChange={(e) => set('weightLb')(e.target.value)} placeholder="165" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Feet</span>
                <input type="number" value={form.heightFt} onChange={(e) => set('heightFt')(e.target.value)} placeholder="5" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Inches</span>
                <input type="number" value={form.heightIn} onChange={(e) => set('heightIn')(e.target.value)} placeholder="10" className={inputCls} />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Weight (kg)</span>
                <input type="number" value={form.weightKg} onChange={(e) => set('weightKg')(e.target.value)} placeholder="75" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Height (cm)</span>
                <input type="number" value={form.heightCm} onChange={(e) => set('heightCm')(e.target.value)} placeholder="178" className={inputCls} />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Activity level</span>
            <select
              value={form.activity}
              onChange={(e) => set('activity')(Number(e.target.value))}
              className={inputCls}
            >
              {ACTIVITY.map((a) => (
                <option key={a.factor} value={a.factor}>{a.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={calculate}
            className="w-full rounded-lg bg-slate-800 dark:bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-500"
          >
            Calculate
          </button>

          {result && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-700 p-4 space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">BMR</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{result.bmr}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">cal at rest</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">TDEE</p>
                  <p className="text-xl font-bold text-cal tabular-nums">{result.tdee}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">maintenance cal</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Apply as calorie goal:</p>
                {[
                  { label: 'Lose weight (–500)', cal: result.tdee - 500 },
                  { label: 'Mild cut (–250)', cal: result.tdee - 250 },
                  { label: 'Maintain', cal: result.tdee },
                  { label: 'Lean bulk (+250)', cal: result.tdee + 250 },
                ].map(({ label, cal }) => (
                  <button
                    key={label}
                    onClick={() => applyGoal(Math.max(1000, cal))}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm hover:border-cal hover:bg-cal/5 transition-colors"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{Math.max(1000, cal)} cal</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
