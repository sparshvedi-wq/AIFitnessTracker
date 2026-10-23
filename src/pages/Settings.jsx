// Settings, grouped by what people come here to do:
// Goals (with the calculator) → Tracking → Workouts → Appearance → Data.

import { useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { gramGoalsFromPercent } from '../lib/storage.js'
import { fromKey, todayKey } from '../lib/date.js'
import { exportData, importData } from '../lib/backup.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import BMRCalc from '../components/BMRCalc.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import { Toggle } from '../components/workout/Controls.jsx'

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

// Colored icon tile at the start of a settings row.
function RowIcon({ name, tint }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
      <Icon name={name} size={17} />
    </span>
  )
}

// A label on the left, a compact control on the right.
function Row({ label, sub, children, icon = null, first = false }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-line'}`}>
      {icon}
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

  const daysTracked = new Set([
    ...state.entries.map((e) => e.date),
    ...state.workouts.map((w) => w.date),
    ...Object.keys(state.metrics),
  ]).size

  const update = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch })
  const updateGoals = (patch) => update({ goals: { ...goals, ...patch } })
  const updatePercent = (patch) => update({ macroPercent: { ...macroPercent, ...patch } })
  const updateWorkout = (patch) => update({ workout: { ...settings.workout, ...patch } })

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

      {/* At-a-glance summary of everything tracked so far */}
      <section className="card mb-7 flex items-center gap-4 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand/70 text-on-brand shadow-brand">
          <Icon name="user" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">Your journey</p>
          <p className="truncate text-[13px] text-muted">
            Since {fromKey(state.createdAt || todayKey()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex shrink-0 gap-4 text-center">
          <div>
            <p className="text-[17px] font-bold tabular-nums text-ink">{state.workouts.length}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Workouts</p>
          </div>
          <div>
            <p className="text-[17px] font-bold tabular-nums text-ink">{daysTracked}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Days</p>
          </div>
        </div>
      </section>

      <Group title="Daily goals">
        <Row label="Calories" sub="Your daily target" icon={<RowIcon name="flame" tint="bg-brand-soft text-brand" />} first>
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
        <Row label="Water goal" sub="Glasses per day" icon={<RowIcon name="droplet" tint="bg-water/15 text-[#1F7AD6] dark:text-water" />} first>
          <NumberInput value={settings.waterGoal} onChange={(v) => update({ waterGoal: v })} />
        </Row>
        <Row label="Weight unit" icon={<RowIcon name="scale" tint="bg-fat/15 text-fat" />}>
          <div className="segmented w-32">
            {['lb', 'kg'].map((u) => (
              <button key={u} onClick={() => update({ weightUnit: u })} className={`segment py-1 ${settings.weightUnit === u ? 'segment-active' : ''}`}>
                {u}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Workouts" footer="Voice cues use your device's built-in speech. Keeping the screen on works in most phone browsers.">
        <Row label="Weekly goal" sub="Workouts per week" icon={<RowIcon name="target" tint="bg-brand-soft text-brand" />} first>
          <NumberInput value={settings.workout.weeklyGoal} onChange={(v) => updateWorkout({ weeklyGoal: Math.min(14, v) })} />
        </Row>
        <Row label="Get-ready countdown" sub="Before the first set" icon={<RowIcon name="clock" tint="bg-carbs/15 text-[#B87400] dark:text-carbs" />}>
          <NumberInput value={settings.workout.countdown} onChange={(v) => updateWorkout({ countdown: Math.min(30, v) })} suffix="s" />
        </Row>
        <Row label="Sounds" sub="Beeps for the last 3 seconds of a timer" icon={<RowIcon name="volume" tint="bg-surface2 text-ink2" />}>
          <Toggle checked={settings.workout.sound} onChange={(v) => updateWorkout({ sound: v })} label="Sounds" />
        </Row>
        <Row label="Voice coach" sub="Announces each exercise and rest" icon={<RowIcon name="mic" tint="bg-surface2 text-ink2" />}>
          <Toggle checked={settings.workout.voice} onChange={(v) => updateWorkout({ voice: v })} label="Voice coach" />
        </Row>
        <Row label="Vibration" sub="On phones that support it" icon={<RowIcon name="phone" tint="bg-surface2 text-ink2" />}>
          <Toggle checked={settings.workout.vibrate} onChange={(v) => updateWorkout({ vibrate: v })} label="Vibration" />
        </Row>
        <Row label="Keep screen on" sub="While the workout player is open" icon={<RowIcon name="sun" tint="bg-surface2 text-ink2" />}>
          <Toggle checked={settings.workout.keepAwake} onChange={(v) => updateWorkout({ keepAwake: v })} label="Keep screen on" />
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
        footer={`Everything is stored on this device only. ${state.entries.length} entries · ${state.workouts.length} workouts · ${Object.keys(state.metrics).length} days with habits.`}
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
        message="This permanently deletes all entries, habits and settings. This can't be undone."
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
