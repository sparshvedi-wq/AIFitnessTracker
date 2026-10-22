// BMR/TDEE calculator using the Mifflin-St Jeor equation.
// Shown as a collapsible row inside the Goals section of Settings.

import { useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

const ACTIVITY = [
  { label: 'Sedentary (little or no exercise)', factor: 1.2 },
  { label: 'Lightly active (1–3 days/week)', factor: 1.375 },
  { label: 'Moderately active (3–5 days/week)', factor: 1.55 },
  { label: 'Very active (6–7 days/week)', factor: 1.725 },
  { label: 'Extra active (physical job + training)', factor: 1.9 },
]

const inputCls = 'input'

export default function BMRCalc() {
  const { state, dispatch, toast } = useApp()
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
    // keep existing macro goals, just update calories
    dispatch({ type: 'UPDATE_SETTINGS', patch: { goals: { ...state.settings.goals, calories: cal } } })
    toast(`Calorie goal set to ${cal}`)
  }

  const Label = ({ children }) => <span className="field-label">{children}</span>

  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface2"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon name="calculator" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Calculate my calorie goal</span>
          <span className="block text-[13px] text-muted">Based on your body and activity</span>
        </span>
        <Icon name="chevronDown" size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4 animate-fade-in">
          <div className="segmented">
            {['imperial', 'metric'].map((u) => (
              <button key={u} onClick={() => set('unit')(u)} className={`segment ${form.unit === u ? 'segment-active' : ''}`}>
                {u === 'imperial' ? 'lb · ft' : 'kg · cm'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sex</Label>
              <div className="segmented">
                {['male', 'female'].map((g) => (
                  <button key={g} onClick={() => set('gender')(g)} className={`segment ${form.gender === g ? 'segment-active' : ''}`}>
                    {g === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <Label>Age</Label>
              <input type="number" inputMode="numeric" min="5" max="120" value={form.age} onChange={(e) => set('age')(e.target.value)} placeholder="30" className={inputCls} />
            </label>
          </div>

          {form.unit === 'imperial' ? (
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <Label>Weight (lb)</Label>
                <input type="number" inputMode="decimal" value={form.weightLb} onChange={(e) => set('weightLb')(e.target.value)} placeholder="165" className={inputCls} />
              </label>
              <label className="block">
                <Label>Height (ft)</Label>
                <input type="number" inputMode="numeric" value={form.heightFt} onChange={(e) => set('heightFt')(e.target.value)} placeholder="5" className={inputCls} />
              </label>
              <label className="block">
                <Label>(in)</Label>
                <input type="number" inputMode="numeric" value={form.heightIn} onChange={(e) => set('heightIn')(e.target.value)} placeholder="10" className={inputCls} />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Label>Weight (kg)</Label>
                <input type="number" inputMode="decimal" value={form.weightKg} onChange={(e) => set('weightKg')(e.target.value)} placeholder="75" className={inputCls} />
              </label>
              <label className="block">
                <Label>Height (cm)</Label>
                <input type="number" inputMode="numeric" value={form.heightCm} onChange={(e) => set('heightCm')(e.target.value)} placeholder="178" className={inputCls} />
              </label>
            </div>
          )}

          <label className="block">
            <Label>Activity level</Label>
            <select value={form.activity} onChange={(e) => set('activity')(Number(e.target.value))} className={inputCls}>
              {ACTIVITY.map((a) => (
                <option key={a.factor} value={a.factor}>{a.label}</option>
              ))}
            </select>
          </label>

          <button onClick={calculate} className="btn-primary w-full">Calculate</button>

          {result && (
            <div className="space-y-3 rounded-2xl bg-surface2 p-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[13px] font-medium text-muted">At rest (BMR)</p>
                  <p className="text-2xl font-bold tabular-nums text-ink">{result.bmr.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-muted">Maintenance</p>
                  <p className="text-2xl font-bold tabular-nums text-brand">{result.tdee.toLocaleString()}</p>
                </div>
              </div>

              <p className="section-title px-0 pt-1">Set as my goal</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Lose weight', sub: '−500 cal/day', cal: result.tdee - 500 },
                  { label: 'Mild cut', sub: '−250 cal/day', cal: result.tdee - 250 },
                  { label: 'Maintain', sub: 'Stay the same', cal: result.tdee },
                  { label: 'Lean bulk', sub: '+250 cal/day', cal: result.tdee + 250 },
                ].map(({ label, sub, cal }) => (
                  <button
                    key={label}
                    onClick={() => applyGoal(Math.max(1000, cal))}
                    className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-brand/60"
                  >
                    <span>
                      <span className="block text-[15px] font-semibold text-ink">{label}</span>
                      <span className="block text-[13px] text-muted">{sub}</span>
                    </span>
                    <span className="text-[15px] font-bold tabular-nums text-ink">{Math.max(1000, cal).toLocaleString()} cal</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
