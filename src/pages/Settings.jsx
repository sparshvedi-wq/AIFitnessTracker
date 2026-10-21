// Settings, grouped by what people come here to do:
// Goals (with the calculator) → Tracking → Appearance → Data.

import { useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { gramGoalsFromPercent } from '../lib/storage.js'
import { exportData, importData } from '../lib/backup.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import BMRCalc from '../components/BMRCalc.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'

const MACROS = [
  { key: 'protein', label: 'Protein', color: '#E5484D' },
  { key: 'carbs', label: 'Carbs', color: '#F0A020' },
  { key: 'fat', label: 'Fat', color: '#7C66DC' },
]

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

function Group({ title, children, footer }) {
  return (
    <section className="mb-7">
      <h2 className="section-title mb-2">{title}</h2>
      <div className="card overflow-hidden">{children}</div>
      {footer && <p className="mt-2 px-1 text-[13px] text-muted">{footer}</p>}
    </section>
  )
}

// A label on the left, a compact control on the right.
function Row({ label, sub, children, first = false }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-line'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">{label}</p>
        {sub && <p className="text-[13px] text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, suffix, width = 'w-24', ...rest }) {
  return (
    <div className={`relative ${width} shrink-0`}>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`input py-2 text-right tabular-nums ${suffix ? 'pr-9' : ''}`}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted">{suffix}</span>}
    </div>
  )
}

function ActionRow({ icon, label, onClick, danger = false, first = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface2 ${first ? '' : 'border-t border-line'} ${danger ? 'text-danger' : 'text-ink'}`}
    >
      <Icon name={icon} size={19} className={danger ? '' : 'text-ink2'} />
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {!danger && <Icon name="chevronRight" size={18} className="text-muted" />}
    </button>
  )
}

export default function Settings() {
  const { state, dispatch, toast } = useApp()
  const { settings } = state
  const fileRef = useRef(null)
  const [pendingImport, setPendingImport] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const { goals, useMacroPercent, macroPercent } = settings
  const derived = gramGoalsFromPercent(goals.calories, macroPercent)
  const percentTotal = macroPercent.protein + macroPercent.carbs + macroPercent.fat

  const update = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch })
  const updateGoals = (patch) => update({ goals: { ...goals, ...patch } })
  const updatePercent = (patch) => update({ macroPercent: { ...macroPercent, ...patch } })

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
    <div className="pb-4">
      <PageHeader title="Settings" subtitle="Preferences" />

      <Group title="Daily goals">
        <Row label="Calories" sub="Your daily target" first>
          <NumberInput value={goals.calories} onChange={(v) => updateGoals({ calories: v })} suffix="cal" width="w-32" />
        </Row>

        <div className="border-t border-line px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium text-ink">Macros</p>
            <div className="segmented w-44">
              <button onClick={() => update({ useMacroPercent: false })} className={`segment py-1 ${!useMacroPercent ? 'segment-active' : ''}`}>Grams</button>
              <button onClick={() => update({ useMacroPercent: true })} className={`segment py-1 ${useMacroPercent ? 'segment-active' : ''}`}>Percent</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MACROS.map((m) => (
              <label key={m.key} className="block">
                <span className="field-label flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={useMacroPercent ? 100 : undefined}
                    value={useMacroPercent ? macroPercent[m.key] : goals[m.key]}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0
                      useMacroPercent ? updatePercent({ [m.key]: v }) : updateGoals({ [m.key]: v })
                    }}
                    className="input pr-8 tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted">
                    {useMacroPercent ? '%' : 'g'}
                  </span>
                </div>
                {useMacroPercent && (
                  <span className="mt-1 block text-[13px] tabular-nums text-muted">{derived[m.key]} g</span>
                )}
              </label>
            ))}
          </div>
          {useMacroPercent && percentTotal !== 100 && (
            <p className="mt-2 text-[13px] font-medium text-danger">Adds up to {percentTotal}%. Make it 100%.</p>
          )}
        </div>

        <BMRCalc />
      </Group>

      <Group title="Tracking">
        <Row label="Water goal" sub="Glasses per day" first>
          <NumberInput value={settings.waterGoal} onChange={(v) => update({ waterGoal: v })} />
        </Row>
        <Row label="Weight unit">
          <div className="segmented w-32">
            {['lb', 'kg'].map((u) => (
              <button key={u} onClick={() => update({ weightUnit: u })} className={`segment py-1 ${settings.weightUnit === u ? 'segment-active' : ''}`}>
                {u}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Appearance">
        <div className="p-3">
          <div className="segmented">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => update({ theme: t.value })}
                className={`segment flex items-center justify-center gap-1.5 py-2 ${settings.theme === t.value ? 'segment-active' : ''}`}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group
        title="Data & backup"
        footer={`Everything is stored on this device only. ${state.entries.length} entries · ${state.foods.length} saved foods · ${Object.keys(state.metrics).length} days with habits.`}
      >
        <ActionRow icon="download" label="Export backup" onClick={() => exportData(state)} first />
        <ActionRow icon="upload" label="Restore from backup" onClick={() => fileRef.current?.click()} />
        <ActionRow icon="trash" label="Reset all data" onClick={() => setConfirmReset(true)} danger />
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
      </Group>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Restore backup?"
        message="This replaces all of your current data. Export a backup first if you want to keep it."
        confirmLabel="Replace"
        onConfirm={applyImport}
        onClose={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="This permanently deletes all entries, foods, habits and settings. This can't be undone."
        confirmLabel="Reset"
        onConfirm={() => {
          dispatch({ type: 'RESET' })
          toast('All data reset', 'info')
        }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  )
}
