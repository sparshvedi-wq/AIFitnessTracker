// You: profile, lifetime numbers, goals, bodyweight and settings.

import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { MONTHS, MONTHS_LONG, addDays, fromKey } from '../lib/date.js'
import { EXERCISES, findExercise } from '../lib/exercises.js'
import { bestLifts, fmtNum, weekStart } from '../lib/workout.js'
import { exportData, importData } from '../lib/backup.js'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { LineChart, SectionHead, Toggle, corner } from '../components/Ink.jsx'
import { bodyweights } from '../components/workout/useStartWorkout.js'

// Longest run of weeks that met the weekly goal.
function bestStreak(workouts, goal) {
  if (!workouts.length) return 0
  const perWeek = new Map()
  for (const w of workouts) perWeek.set(weekStart(w.date), (perWeek.get(weekStart(w.date)) || 0) + 1)
  let week = weekStart(workouts[0].date)
  const last = weekStart(workouts[workouts.length - 1].date)
  let run = 0
  let best = 0
  while (week <= last) {
    run = (perWeek.get(week) || 0) >= goal ? run + 1 : 0
    best = Math.max(best, run)
    week = addDays(week, 7)
  }
  return best
}

function compact(n) {
  if (n >= 1e6) return `${fmtNum(Math.round(n / 1e5) / 10)}M`
  if (n >= 1e4) return `${fmtNum(Math.round(n / 100) / 10)}k`
  return fmtNum(n)
}

export default function You() {
  const { state, dispatch, toast, today } = useApp()
  const { settings, workouts } = state
  const unit = settings.weightUnit
  const goal = settings.workout.weeklyGoal
  const fileRef = useRef(null)
  const [sheet, setSheet] = useState(null) // 'name' | 'weight' | 'lift' | 'goal'
  const [pendingImport, setPendingImport] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const update = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch })
  const updateWorkout = (patch) => update({ workout: { ...settings.workout, ...patch } })

  const weights = useMemo(() => bodyweights(state.metrics), [state.metrics])
  const bw = weights[weights.length - 1]
  const weekAgo = weights.filter((w) => w.date <= addDays(today, -7)).pop()
  const bwChange = bw && weekAgo ? Math.round((bw.value - weekAgo.value) * 10) / 10 : null

  const lifted = workouts.reduce((s, w) => s + (w.totals?.volume || 0), 0)
  const life = [
    { v: fmtNum(workouts.length), l: 'Sessions' },
    { v: compact(lifted), l: `${unit} lifted` },
    { v: bestStreak(workouts, goal), l: 'Best streak' },
  ]

  const since = workouts[0]?.date || state.createdAt || today
  const lift = settings.liftGoal || { exId: 'bench-press', target: 225 }
  const liftDef = findExercise(lift.exId, state.customExercises)
  const liftBest = bestLifts(workouts, lift.exId).weight
  const thisWeek = workouts.filter((w) => w.date >= weekStart(today)).length

  const goals = [
    {
      name: `${liftDef?.name || 'Lift'} ${fmtNum(lift.target)}`,
      v: liftBest ? `${fmtNum(liftBest)}` : '–',
      pct: Math.min(100, (liftBest / lift.target) * 100),
      note: liftBest >= lift.target ? 'Done. Time for a new target.' : liftBest ? `${fmtNum(lift.target - liftBest)} ${unit} to go.` : 'Log this lift to start tracking.',
      onEdit: () => setSheet('lift'),
    },
    {
      name: `Train ${goal} day${goal === 1 ? '' : 's'} a week`,
      v: `${thisWeek} of ${goal}`,
      pct: Math.min(100, (thisWeek / goal) * 100),
      note: thisWeek >= goal ? 'Goal hit this week.' : `${goal - thisWeek} more this week.`,
      onEdit: () => setSheet('goal'),
    },
  ]

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    importData(file).then(setPendingImport).catch((err) => toast(err.message || 'Import failed', 'error'))
    e.target.value = ''
  }

  const rows = [
    { icon: 'units', label: 'Units', value: unit, onClick: () => update({ weightUnit: unit === 'lb' ? 'kg' : 'lb' }) },
    { icon: 'timer', label: 'Get-ready countdown', value: settings.workout.countdown ? `${settings.workout.countdown}s` : 'Off', onClick: () => updateWorkout({ countdown: [0, 3, 5, 10][([0, 3, 5, 10].indexOf(settings.workout.countdown) + 1) % 4] }) },
    { icon: 'volume', label: 'Sounds', toggle: 'sound' },
    { icon: 'mic', label: 'Voice coach', toggle: 'voice' },
    { icon: 'phone', label: 'Vibration', toggle: 'vibrate' },
    { icon: 'sun', label: 'Keep screen on', toggle: 'keepAwake' },
  ]
  const dataRows = [
    { icon: 'data', label: 'Sample data', sample: true },
    { icon: 'download', label: 'Export backup', onClick: () => exportData(state) },
    { icon: 'upload', label: 'Restore from backup', onClick: () => fileRef.current?.click() },
    { icon: 'trash', label: 'Reset all data', onClick: () => setConfirmReset(true), danger: true },
  ]

  return (
    <div className="animate-fade-in">
      <header className="mt-2 flex items-center gap-4">
        <span className="dot h-[72px] w-[72px] bg-paper font-display text-[32px] text-on-paper">{(settings.name || 'Y')[0].toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[30px] leading-tight">{settings.name || 'You'}</span>
          <span className="block text-[13px] text-muted">Training since {MONTHS_LONG[fromKey(since).getMonth()]}{fromKey(since).getFullYear() !== fromKey(today).getFullYear() ? ` ${fromKey(since).getFullYear()}` : ''}</span>
        </span>
        <button onClick={() => setSheet('name')} className="icon-btn" aria-label="Edit your name"><Icon name="edit" size={16} /></button>
      </header>

      <div className="mt-5 grid grid-cols-3 rounded-tuck bg-surface py-4">
        {life.map((l, i) => (
          <div key={l.l} className={`text-center ${i ? 'border-l border-line' : ''}`}>
            <p className="num text-[24px]">{l.v}</p>
            <p className="mt-1.5 text-[12px] text-muted">{l.l}</p>
          </div>
        ))}
      </div>

      <section className="mt-7">
        <SectionHead title="Goals" />
        <div className="mt-2.5 space-y-2.5">
          {goals.map((g, i) => (
            <button key={g.name} onClick={g.onEdit} className={`block w-full bg-surface p-4 text-left ${corner(i)}`}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{g.name}</span>
                <span className="num text-[18px]">{g.v}</span>
              </span>
              <span className="mt-3 block h-2 rounded-full bg-line">
                <span className="block h-2 rounded-full bg-accent transition-all" style={{ width: `${Math.max(2, g.pct)}%` }} />
              </span>
              <span className="mt-2 block text-[12px] text-muted">{g.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7 rounded-hero bg-surface px-5 py-[18px]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">Bodyweight</span>
          <button onClick={() => setSheet('weight')} className="inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-[13px] font-bold text-on-paper">Log weight</button>
        </div>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="num text-[36px]">{bw ? fmtNum(bw.value) : '–'}</span>
          <span className="text-[14px] text-muted">
            {unit}
            {bwChange != null && (bwChange === 0 ? ', same as last week' : `, ${bwChange < 0 ? 'down' : 'up'} ${fmtNum(Math.abs(bwChange))} this week`)}
          </span>
        </p>
        {weights.length > 1 ? (
          <div className="mt-3">
            <LineChart values={weights.slice(-20).map((w) => w.value)} height={64} fill={false} />
            <div className="mt-1 flex justify-between text-[11px] text-faint">
              <span>{MONTHS[fromKey(weights.slice(-20)[0].date).getMonth()]} {fromKey(weights.slice(-20)[0].date).getDate()}</span>
              <span>{MONTHS[fromKey(bw.date).getMonth()]} {fromKey(bw.date).getDate()}</span>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted">Log your weight a few times to see the trend.</p>
        )}
      </section>

      <section className="mt-7">
        <SectionHead title="Settings" />
        <SettingsGroup rows={rows} settings={settings} updateWorkout={updateWorkout} />
      </section>

      <section className="mt-7">
        <SectionHead title="Data" />
        <SettingsGroup rows={dataRows} settings={settings} sample={Boolean(state.sample)} onSample={(on) => { dispatch({ type: 'SET_SAMPLE', on }); toast(on ? 'Sample history added' : 'Sample history removed', 'info') }} />
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-faint">
          Everything stays on this device. Sample data adds ten weeks of practice history so you can see the app filled in; turn it off to remove it.
        </p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
      </section>

      {sheet === 'name' && <NameSheet open={sheet === 'name'} onClose={() => setSheet(null)} name={settings.name} onSave={(name) => update({ name })} />}
      {sheet === 'weight' && <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} unit={unit} last={bw?.value} onSave={(v) => { dispatch({ type: 'SET_METRIC', date: today, patch: { weight: v, sampleWeight: false } }); toast('Weight logged') }} />}
      {sheet === 'lift' && <LiftSheet open={sheet === 'lift'} onClose={() => setSheet(null)} goal={lift} unit={unit} onSave={(g) => update({ liftGoal: g })} />}
      {sheet === 'goal' && <WeeklySheet open={sheet === 'goal'} onClose={() => setSheet(null)} goal={goal} onSave={(n) => updateWorkout({ weeklyGoal: n })} />}

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Restore backup?"
        message="This replaces all of your current data. Export a backup first if you want to keep it."
        confirmLabel="Replace"
        onConfirm={() => { dispatch({ type: 'IMPORT_STATE', state: pendingImport }); setPendingImport(null); toast('Backup restored') }}
        onClose={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="This permanently deletes your workouts, routines, weights and settings."
        confirmLabel="Reset"
        onConfirm={() => { dispatch({ type: 'RESET' }); toast('All data reset', 'info') }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  )
}

function SettingsGroup({ rows, settings, updateWorkout, sample, onSample }) {
  return (
    <div className="mt-2.5 rounded-tuck bg-surface px-4">
      {rows.map((r, i) => {
        const control = r.toggle ? (
          <Toggle checked={settings.workout[r.toggle]} onChange={(v) => updateWorkout({ [r.toggle]: v })} label={r.label} />
        ) : r.sample ? (
          <Toggle checked={sample} onChange={onSample} label={r.label} />
        ) : (
          <>
            {r.value && <span className="text-[14px] text-muted">{r.value}</span>}
            <Icon name="chevronRight" size={15} className="text-faint" />
          </>
        )
        const Tag = r.onClick ? 'button' : 'div'
        return (
          <Tag key={r.label} onClick={r.onClick} className={`flex w-full items-center gap-3.5 py-3 text-left ${i ? 'border-t border-line' : ''}`}>
            <span className={`dot h-8 w-8 rounded-[10px] bg-surface2 ${r.danger ? 'text-danger' : 'text-ink'}`}><Icon name={r.icon} size={16} strokeWidth={1.7} /></span>
            <span className={`flex-1 text-[15px] ${r.danger ? 'text-danger' : ''}`}>{r.label}</span>
            {control}
          </Tag>
        )
      })}
    </div>
  )
}

function SheetForm({ open, onClose, title, subtitle, children, onSave, canSave = true }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={<button onClick={() => { onSave(); onClose() }} disabled={!canSave} className="btn-primary h-[50px] w-full">Save</button>}
    >
      {children}
    </Modal>
  )
}

function NameSheet({ open, onClose, name, onSave }) {
  const [v, setV] = useState(name || '')
  return (
    <SheetForm open={open} onClose={onClose} title="Your name" subtitle="Shown in your greeting on Home." onSave={() => onSave(v.trim())}>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Name" className="input mt-2" maxLength={30} />
    </SheetForm>
  )
}

function WeightSheet({ open, onClose, unit, last, onSave }) {
  const [v, setV] = useState('')
  const n = Number(v)
  return (
    <SheetForm open={open} onClose={onClose} title="Log weight" subtitle="Saved for today." canSave={n > 0} onSave={() => { onSave(Math.round(n * 10) / 10); setV('') }}>
      <div className="mt-2 flex items-baseline justify-center gap-2 rounded-tuck bg-surface2 py-6">
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={last ? String(last) : '0'}
          className="num w-40 bg-transparent text-center text-[56px] text-ink placeholder:text-faint focus:outline-none"
          aria-label={`Weight in ${unit}`}
        />
        <span className="text-[16px] text-muted">{unit}</span>
      </div>
    </SheetForm>
  )
}

function LiftSheet({ open, onClose, goal, unit, onSave }) {
  const [exId, setExId] = useState(goal.exId)
  const [target, setTarget] = useState(String(goal.target))
  const lifts = EXERCISES.filter((e) => e.weighted)
  return (
    <SheetForm open={open} onClose={onClose} title="Strength goal" canSave={Number(target) > 0} onSave={() => onSave({ exId, target: Number(target) })}>
      <label className="field-label mt-2">Lift</label>
      <select value={exId} onChange={(e) => setExId(e.target.value)} className="input">
        {lifts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <label className="field-label mt-4">Target ({unit})</label>
      <input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="input num text-[20px]" />
    </SheetForm>
  )
}

function WeeklySheet({ open, onClose, goal, onSave }) {
  const [n, setN] = useState(goal)
  return (
    <SheetForm open={open} onClose={onClose} title="Weekly goal" subtitle="How many workouts a week counts as a win." onSave={() => onSave(n)}>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((k) => (
          <button key={k} onClick={() => setN(k)} className={`dot num h-11 w-full rounded-2xl text-[18px] ${n === k ? 'bg-ink text-on-paper' : 'bg-surface2 text-ink'}`}>{k}</button>
        ))}
      </div>
    </SheetForm>
  )
}
