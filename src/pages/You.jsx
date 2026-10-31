// You: profile, totals, goals, bodyweight, and the one home for settings.

import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { MONTHS_LONG, addDays, fromKey, shortLabel } from '../lib/date.js'
import { EXERCISES, findExercise } from '../lib/exercises.js'
import { bestLifts, fmtNum } from '../lib/workout.js'
import { exportData, importData, pickNativeBackup } from '../lib/backup.js'
import { isNativeApp } from '../lib/native.js'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { LineChart, PageTitle, SectionHead, Segmented, Toggle } from '../components/Ink.jsx'
import { bodyweights } from '../components/workout/useStartWorkout.js'
import { displayOf, trainingDays, hasTrainingTarget } from '../lib/preferences.js'
import { photoDraft } from '../lib/photo-draft.js'

function compact(n) {
  if (n >= 1e6) return `${fmtNum(Math.round(n / 1e5) / 10)}M`
  if (n >= 1e4) return `${fmtNum(Math.round(n / 100) / 10)}k`
  return fmtNum(n)
}

const initialOf = (name) => (name ? [...name.trim()][0]?.toUpperCase() : null)

export default function You({ nav }) {
  const { state, dispatch, toast, today } = useApp()
  const { settings } = state
  const workouts = state.workouts.filter((w) => !w.sample && w.date <= today)
  const unit = settings.weightUnit
  const goal = settings.workout.weeklyGoal
  const hasTarget = hasTrainingTarget(settings)
  const display = displayOf(state)
  const progress = trainingDays(workouts, settings, today)
  const fileRef = useRef(null)
  const [sheet, setSheet] = useState(null) // 'name' | 'weight' | 'lift' | 'goal'
  const [pendingImport, setPendingImport] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [testingReset, setTestingReset] = useState(null)

  const update = (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch })
  const updateWorkout = (patch) => update({ workout: { ...settings.workout, ...patch } })

  const weights = useMemo(() => bodyweights(state.metrics), [state.metrics])
  const bw = weights.at(-1)
  // Compare with the most recent entry from roughly a week earlier, and name its date.
  const earlier =
    bw && weights.filter((w) => w.date <= addDays(bw.date, -5) && w.date >= addDays(bw.date, -14)).at(-1)
  const bwChange = earlier ? Math.round((bw.value - earlier.value) * 10) / 10 : null

  const lifted = workouts.reduce((s, w) => s + (w.totals?.volume || 0), 0)
  const totals = [
    { v: fmtNum(workouts.length), l: workouts.length === 1 ? 'Session' : 'Sessions' },
    {
      v: compact(lifted || workouts.reduce((n, w) => n + (w.totals?.sets || 0), 0)),
      l: lifted ? `${unit} lifted` : 'Working sets',
    },
    { v: progress.count, l: 'Days in last 7' },
  ]

  const since = workouts[0]?.date || state.createdAt || today
  const sinceDate = fromKey(since)
  const lift = settings.liftGoal || { exId: 'bench-press', target: 0 }
  const liftDef = findExercise(lift.exId, state.customExercises)
  const liftBest = bestLifts(workouts, lift.exId).weight

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    importData(file)
      .then(setPendingImport)
      .catch((err) => toast(err.message || 'That backup couldn’t be opened', 'error'))
    e.target.value = ''
  }

  async function restoreBackup() {
    if (!isNativeApp()) {
      fileRef.current?.click()
      return
    }
    try {
      const data = await pickNativeBackup()
      if (data) setPendingImport(data)
    } catch (error) {
      toast(error.message || 'That backup couldn’t be opened', 'error')
    }
  }

  return (
    <div className="animate-fade-in">
      <PageTitle title="You" />

      <section className="mt-4 flex items-center gap-4">
        <span className="dot h-14 w-14 bg-paper font-display text-[25px] text-on-paper">
          {initialOf(settings.name) || <Icon name="user" size={25} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[18px] font-semibold">{settings.name || 'Add your name'}</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            Training since {MONTHS_LONG[sinceDate.getMonth()]}
            {sinceDate.getFullYear() !== fromKey(today).getFullYear() ? ` ${sinceDate.getFullYear()}` : ''}
          </span>
        </span>
        <button onClick={() => setSheet('name')} className="icon-btn" aria-label="Edit your name">
          <Icon name="edit" size={16} />
        </button>
      </section>

      {workouts.length > 0 ? (
        <div className="mt-5 grid grid-cols-3 rounded-tuck bg-surface py-4">
          {totals.map((t, i) => (
            <div key={t.l} className={`text-center ${i ? 'border-l border-line' : ''}`}>
              <p className="num text-[24px]">{t.v}</p>
              <p className="mt-1.5 text-[12px] text-muted">{t.l}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-[14px] text-muted">Totals start with your first session.</p>
      )}

      <button className="list-row mt-4 rounded-tuck bg-surface px-4" onClick={() => nav.openCheckins()}>
        <span className="icon-tile">
          <Icon name="camera" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Photo check-ins</span>
          <span className="mt-1 block text-[13px] text-muted">
            {state.checkins.length ? 'Your photos and reviews' : 'Your starting photos'}
          </span>
        </span>
        <Icon name="chevronRight" size={16} className="text-faint" />
      </button>

      <section className="page-section">
        <SectionHead title="Goals" />
        <div className="mt-2.5 space-y-2.5">
          {lift.target ? (
            <GoalCard
              title={`${liftDef?.name || 'Lift'} · ${fmtNum(lift.target)} ${unit}`}
              value={liftBest ? `${fmtNum(liftBest)}` : null}
              pct={Math.min(100, (liftBest / lift.target) * 100)}
              note={
                liftBest >= lift.target
                  ? 'Reached. Set a new target when you’re ready.'
                  : liftBest
                    ? `${fmtNum(lift.target - liftBest)} ${unit} to go`
                    : 'Log this lift to start tracking'
              }
              onClick={() => setSheet('lift')}
            />
          ) : (
            <AddRow
              label="Set a strength goal"
              detail="Optional · your lift, your target"
              onClick={() => setSheet('lift')}
            />
          )}
          <GoalCard
            title={hasTarget ? `Around ${goal} days in any 7` : 'Train when it suits you'}
            value={hasTarget ? `${progress.count} of ${goal}` : null}
            pct={hasTarget ? Math.min(100, (progress.count / goal) * 100) : null}
            note={
              !hasTarget
                ? 'No weekly target.'
                : progress.count >= goal
                  ? 'Target met. Rest when you need to.'
                  : 'Any seven days. Nothing to make up.'
            }
            onClick={() => setSheet('goal')}
          />
        </div>
      </section>

      {!display.metricLight && (
        <section className="page-section rounded-tuck bg-surface px-5 py-[18px]">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold">Bodyweight</span>
            <button
              onClick={() => setSheet('weight')}
              className="btn-secondary min-h-11 !py-0 !px-4 text-[14px]"
            >
              Log weight
            </button>
          </div>
          {bw ? (
            <>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="num text-[36px]">{fmtNum(bw.value)}</span>
                <span className="text-[14px] text-muted">
                  {unit}
                  {bwChange != null &&
                    (bwChange === 0
                      ? ` · same as ${shortLabel(earlier.date)}`
                      : ` · ${bwChange < 0 ? 'down' : 'up'} ${fmtNum(Math.abs(bwChange))} since ${shortLabel(earlier.date)}`)}
                </span>
              </p>
              {weights.length > 1 && (
                <div className="mt-3">
                  <LineChart values={weights.slice(-20).map((w) => w.value)} height={64} fill={false} />
                  <div className="mt-1 flex justify-between text-[12px] text-muted">
                    <span>{shortLabel(weights.slice(-20)[0].date)}</span>
                    <span>{shortLabel(bw.date)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-[14px] text-muted">Log your weight now and then to see a trend.</p>
          )}
        </section>
      )}

      <section className="page-section">
        <SectionHead title="Settings" />
        <div className="mt-2.5 rounded-tuck bg-surface px-4">
          <button className="list-row" onClick={nav.openPersonal}>
            <RowIcon name="settings" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">Training preferences</span>
              <span className="mt-0.5 block text-[12px] text-muted">Setup, equipment, comfort, display</span>
            </span>
            <Icon name="chevronRight" size={15} className="text-faint" />
          </button>
          <div className="border-t border-line py-4">
            <p className="mb-2 flex items-center gap-3 text-[15px]">
              <RowIcon name="moon" />
              Appearance
            </p>
            <Segmented
              label="Appearance"
              value={settings.theme || 'system'}
              onChange={(theme) => update({ theme })}
              options={[
                ['system', 'Automatic'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ]}
            />
          </div>
          <div className="border-t border-line py-4">
            <p className="mb-2 flex items-center gap-3 text-[15px]">
              <RowIcon name="units" />
              Units
            </p>
            <Segmented
              label="Units"
              value={unit}
              onChange={(weightUnit) => update({ weightUnit })}
              options={[
                ['lb', 'lb · ft'],
                ['kg', 'kg · cm'],
              ]}
            />
          </div>
          {[
            ['volume', 'Sounds', 'sound'],
            ['mic', 'Voice cues', 'voice'],
            ['phone', 'Vibration', 'vibrate'],
            ['sun', 'Keep screen on', 'keepAwake'],
          ].map(([icon, label, key]) => (
            <div key={key} className="list-row min-h-[60px] border-t border-line">
              <RowIcon name={icon} />
              <span className="min-w-0 flex-1 text-[15px]">{label}</span>
              <Toggle
                checked={settings.workout[key]}
                onChange={(v) => updateWorkout({ [key]: v })}
                label={label}
              />
            </div>
          ))}
        </div>
        {import.meta.env.DEV && (
          <details className="mt-3 rounded-tuck bg-surface px-4">
            <summary className="cursor-pointer py-4 text-[14px] font-semibold">Testing tools</summary>
            <div className="list-row min-h-[60px] border-t border-line">
              <RowIcon name="data" />
              <span className="min-w-0 flex-1 text-[15px]">Sample history</span>
              <Toggle
                checked={Boolean(state.sample)}
                label="Sample history"
                onChange={(on) => {
                  dispatch({ type: 'SET_SAMPLE', on })
                  toast(on ? 'Sample history added' : 'Sample history removed', 'info')
                }}
              />
            </div>
            {[
              ['onboarding', 'Reset to onboarding', 'Clear preferences and progress; start at question one.'],
              ['after-onboarding', 'Reset after onboarding', 'Keep training preferences; clear progress.'],
            ].map(([stage, label, detail]) => (
              <button
                key={stage}
                onClick={() => setTestingReset(stage)}
                className="list-row border-t border-line"
              >
                <RowIcon name="repeat" />
                <span className="flex-1">
                  <span className="block text-[15px]">{label}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">{detail}</span>
                </span>
              </button>
            ))}
          </details>
        )}
      </section>

      <section className="page-section">
        <SectionHead title="Your data" />
        <div className="mt-2.5 rounded-tuck bg-surface px-4">
          <button
            className="list-row"
            onClick={() =>
              exportData(state).catch((error) => toast(error.message || 'Export failed', 'error'))
            }
          >
            <RowIcon name="download" />
            <span className="flex-1 text-[15px]">Export backup</span>
          </button>
          <button className="list-row border-t border-line" onClick={() => void restoreBackup()}>
            <RowIcon name="upload" />
            <span className="flex-1 text-[15px]">Restore from backup</span>
          </button>
          <button className="list-row border-t border-line" onClick={() => setConfirmReset(true)}>
            <RowIcon name="trash" danger />
            <span className="flex-1 text-[15px] text-danger">Erase all data</span>
          </button>
        </div>
        <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
          Stored on this device. Backups skip photos.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />
      </section>

      {sheet === 'name' && (
        <NameSheet onClose={() => setSheet(null)} name={settings.name} onSave={(name) => update({ name })} />
      )}
      {sheet === 'weight' && (
        <WeightSheet
          onClose={() => setSheet(null)}
          unit={unit}
          today={today}
          last={bw?.value}
          onSave={(date, v) => {
            dispatch({ type: 'SET_METRIC', date, patch: { weight: v, sampleWeight: false } })
            toast(date === today ? 'Weight logged' : `Weight logged for ${shortLabel(date)}`)
          }}
        />
      )}
      {sheet === 'lift' && (
        <LiftSheet
          onClose={() => setSheet(null)}
          goal={lift}
          unit={unit}
          onSave={(g) => update({ liftGoal: g })}
        />
      )}
      {sheet === 'goal' && (
        <WeeklySheet
          onClose={() => setSheet(null)}
          goal={goal}
          mode={hasTarget ? 'target' : 'flexible'}
          onSave={(patch) => updateWorkout(patch)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Restore this backup?"
        message={`${pendingImport?.workouts?.length || 0} workouts, ${pendingImport?.routines?.length || 0} routines and ${pendingImport?.checkins?.length || 0} photo reviews. Replaces what’s on this device now.`}
        confirmLabel="Replace"
        onConfirm={() => {
          dispatch({ type: 'IMPORT_STATE', state: pendingImport })
          setPendingImport(null)
          toast('Backup restored')
        }}
        onClose={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Erase all data?"
        message="Deletes everything on this device. This can’t be undone."
        confirmLabel="Erase"
        onConfirm={() => {
          void photoDraft('clear').catch(() => {})
          dispatch({ type: 'RESET' })
          toast('All data erased', 'info')
        }}
        onClose={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        open={Boolean(testingReset)}
        title={testingReset === 'onboarding' ? 'Reset to onboarding?' : 'Reset after onboarding?'}
        message={`This clears workouts, active sessions, routines, custom exercises, check-ins and measurements on this device. ${testingReset === 'onboarding' ? 'Preferences also reset.' : 'Training preferences stay saved.'}`}
        confirmLabel="Reset test run"
        onConfirm={() => nav.resetTesting(testingReset)}
        onClose={() => setTestingReset(null)}
      />
    </div>
  )
}

function RowIcon({ name, danger = false }) {
  return (
    <span className={`dot h-8 w-8 rounded-[10px] bg-surface2 ${danger ? 'text-danger' : 'text-ink'}`}>
      <Icon name={name} size={16} strokeWidth={1.7} />
    </span>
  )
}

function GoalCard({ title, value, pct, note, onClick }) {
  return (
    <button onClick={onClick} className="block w-full rounded-tuck bg-surface p-4 text-left">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">{title}</span>
        {value && <span className="num shrink-0 text-[18px]">{value}</span>}
      </span>
      {pct != null && (
        <span className="mt-3 block h-1.5 rounded-full bg-line">
          <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
      )}
      <span className="mt-2 block text-[13px] text-muted">{note}</span>
    </button>
  )
}

function AddRow({ label, detail, onClick }) {
  return (
    <button
      onClick={onClick}
      className="list-row min-h-16 rounded-tuck border border-dashed border-outline px-4"
    >
      <span className="dot h-8 w-8 bg-surface2 text-accent">
        <Icon name="plus" size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{detail}</span>
      </span>
    </button>
  )
}

function SheetForm({ onClose, title, subtitle, children, onSave, canSave = true }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <button
          onClick={() => {
            onSave()
            onClose()
          }}
          disabled={!canSave}
          className="btn-primary h-[50px] w-full"
        >
          Save
        </button>
      }
    >
      {children}
    </Modal>
  )
}

function NameSheet({ onClose, name, onSave }) {
  const [v, setV] = useState(name || '')
  return (
    <SheetForm
      onClose={onClose}
      title="Your name"
      subtitle="Used to greet you. Stays on this device."
      onSave={() => onSave(v.trim())}
    >
      <input
        autoFocus
        aria-label="Your name"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Name"
        className="input mt-2"
        maxLength={60}
      />
    </SheetForm>
  )
}

function WeightSheet({ onClose, unit, today, last, onSave }) {
  const [v, setV] = useState('')
  const [date, setDate] = useState(today)
  const n = Number(v)
  const valid = n > 0 && n < 2000 && date && date <= today
  return (
    <SheetForm
      onClose={onClose}
      title="Log weight"
      canSave={valid}
      onSave={() => onSave(date, Math.round(n * 10) / 10)}
    >
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
      <label className="field-label mt-4" htmlFor="weight-date">
        Date
      </label>
      <input
        id="weight-date"
        type="date"
        className="input"
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
      />
    </SheetForm>
  )
}

function LiftSheet({ onClose, goal, unit, onSave }) {
  const [exId, setExId] = useState(goal.exId)
  const [target, setTarget] = useState(goal.target ? String(Math.round(goal.target * 10) / 10) : '')
  const lifts = EXERCISES.filter((e) => e.weighted && e.type !== 'time')
  return (
    <SheetForm
      onClose={onClose}
      title="Strength goal"
      subtitle="A lift and a weight to reach."
      canSave={Number(target) > 0}
      onSave={() => onSave({ exId, target: Number(target) })}
    >
      <label className="field-label mt-2" htmlFor="lift-target">
        Target ({unit})
      </label>
      <input
        id="lift-target"
        type="number"
        inputMode="decimal"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="input num text-[20px]"
      />
      <p className="field-label mt-5">Lift</p>
      <div
        className="max-h-[38vh] overflow-y-auto rounded-2xl bg-surface2 px-3"
        role="radiogroup"
        aria-label="Lift"
      >
        {lifts.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={exId === l.id}
            onClick={() => setExId(l.id)}
            className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-line text-left text-[15px] last:border-0"
          >
            {l.name}
            {exId === l.id && <Icon name="check" size={17} className="text-accent" />}
          </button>
        ))}
      </div>
      {goal.target > 0 && (
        <button
          className="btn-ghost mt-3 w-full"
          onClick={() => {
            onSave(null)
            onClose()
          }}
        >
          Remove strength goal
        </button>
      )}
    </SheetForm>
  )
}

function WeeklySheet({ onClose, goal, mode, onSave }) {
  const [goalMode, setGoalMode] = useState(mode)
  const [n, setN] = useState(goal)
  return (
    <SheetForm
      onClose={onClose}
      title="Training rhythm"
      subtitle="No assigned days. A target is optional."
      onSave={() => onSave({ weeklyGoal: n, goalMode })}
    >
      <Segmented
        className="mt-3"
        label="Training rhythm"
        value={goalMode}
        onChange={setGoalMode}
        options={[
          ['flexible', 'No target'],
          ['target', 'Rough target'],
        ]}
      />
      {goalMode === 'target' && (
        <div className="mt-5">
          <p className="mb-3 text-[14px] text-muted">Days in any seven</p>
          <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Days in any seven">
            {[1, 2, 3, 4, 5, 6, 7].map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={n === k}
                onClick={() => setN(k)}
                className={`dot num h-12 w-full rounded-2xl text-[18px] ${n === k ? 'bg-ink text-on-paper' : 'bg-surface2 text-ink'}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </SheetForm>
  )
}
