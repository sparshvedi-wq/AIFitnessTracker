// End of a guided workout: stats, new records, how it felt, then save.

import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { describeSets, elapsedMs, findRecords, fmtClock, fmtNum, setCounts, toWorkoutRecord, totals } from '../../lib/workout.js'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'

export const EFFORT = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Moderate' },
  { value: 3, label: 'Hard' },
  { value: 4, label: 'Very hard' },
  { value: 5, label: 'All out' },
]

export default function WorkoutSummary({ session, now, onKeepGoing }) {
  const { state, dispatch, toast } = useApp()
  const [effort, setEffort] = useState(null)
  const [note, setNote] = useState('')
  const [saveRoutine, setSaveRoutine] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const { done, total } = setCounts(session)
  const t = useMemo(() => totals(session.exercises), [session.exercises])
  const records = useMemo(() => findRecords(session, state.workouts), [session, state.workouts])
  const remaining = total - done
  const isSaved = state.routines.some((r) => r.id === session.routineId)
  const worked = session.exercises.filter((e) => e.sets.some((s) => s.status === 'done'))

  function save() {
    const record = toWorkoutRecord(session, state.workouts, { now, effort, note })
    if (saveRoutine && !isSaved) {
      const id = `r-${session.id}`
      dispatch({
        type: 'SAVE_ROUTINE',
        routine: {
          id,
          name: session.name,
          circuit: session.circuit,
          items: session.exercises.map((e) => ({
            exId: e.exId,
            sets: e.sets.filter((s) => s.status !== 'skipped').length || e.sets.length,
            ...(e.type === 'time' ? { sec: e.sets[0].sec } : { reps: e.sets[0].reps }),
            weight: e.weighted ? Math.max(0, ...e.sets.map((s) => s.weight || 0)) || null : null,
            restSec: e.restSec,
          })),
        },
      })
      record.routineId = id
    }
    dispatch({ type: 'FINISH_WORKOUT', workout: record })
    toast(records.length ? `Workout saved · ${records.length} new record${records.length === 1 ? '' : 's'}!` : 'Workout saved')
  }

  if (done === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">Nothing logged yet</h2>
        <p className="mt-1 text-[15px] text-muted">Log at least one set to save this workout.</p>
        {remaining > 0 && <button onClick={onKeepGoing} className="btn-primary mt-6 h-12 w-full max-w-xs">Back to workout</button>}
        <button onClick={() => setConfirmDiscard(true)} className="btn-danger-ghost mt-2">Discard workout</button>
        <DiscardConfirm open={confirmDiscard} onClose={() => setConfirmDiscard(false)} />
      </div>
    )
  }

  return (
    <div className="pt-3">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon name={remaining > 0 ? 'flame' : 'trophy'} size={30} />
        </span>
        <h2 className="mt-3 text-[26px] font-extrabold tracking-tight text-ink">
          {remaining > 0 ? 'Wrapping up' : 'Workout complete'}
        </h2>
        <p className="text-[15px] text-muted">
          {remaining > 0 ? `${remaining} set${remaining === 1 ? '' : 's'} left in the plan` : session.name}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Stat label="Time" value={fmtClock(elapsedMs(session, now))} />
        <Stat label="Sets" value={`${done}`} />
        {t.volume > 0 ? <Stat label="Volume" value={`${fmtNum(t.volume)} ${session.unit}`} /> : <Stat label="Reps" value={fmtNum(t.reps)} />}
        {t.seconds > 0 ? <Stat label="Time under work" value={fmtClock(t.seconds * 1000)} /> : <Stat label="Exercises" value={`${worked.length}`} />}
      </div>

      {records.length > 0 && (
        <section className="card mt-3 p-4">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <Icon name="trophy" size={18} className="text-carbs" />
            New personal records
          </h3>
          <ul className="mt-2 space-y-1.5">
            {records.map((r) => (
              <li key={r.exId} className="flex justify-between gap-3 text-[14px]">
                <span className="truncate text-ink2">{r.name}</span>
                <span className="shrink-0 font-semibold text-ink">{r.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-3 divide-y divide-line">
        {worked.map((e) => (
          <div key={e.key} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <span className="truncate text-[15px] font-medium text-ink">{e.name}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-ink2">
              {describeSets({ ...e, sets: e.sets.filter((s) => s.status === 'done') }, session.unit)}
            </span>
          </div>
        ))}
      </section>

      <h3 className="section-title mb-2 mt-6">How did it feel?</h3>
      <div className="grid grid-cols-5 gap-1.5">
        {EFFORT.map((o) => (
          <button
            key={o.value}
            onClick={() => setEffort(effort === o.value ? null : o.value)}
            className={`rounded-xl border px-1 py-2.5 text-center transition-colors ${effort === o.value ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink2'}`}
          >
            <span className="block text-lg font-bold tabular-nums">{o.value}</span>
            <span className="block text-[11px] font-semibold leading-tight">{o.label}</span>
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Notes (optional): energy, pain, what to change next time"
        className="input mt-3 resize-none"
      />

      {!isSaved && (
        <label className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <input type="checkbox" checked={saveRoutine} onChange={(e) => setSaveRoutine(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" />
          <span className="text-[15px] font-medium text-ink">Save as one of my routines</span>
        </label>
      )}

      <div className="sticky bottom-0 -mx-4 mt-5 space-y-2 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-4">
        <button onClick={save} className="btn-primary h-14 w-full text-[17px]">
          <Icon name="check" size={20} strokeWidth={2.5} />
          Save workout
        </button>
        <div className="grid grid-cols-2 gap-2">
          {remaining > 0 ? (
            <button onClick={onKeepGoing} className="btn-secondary">Keep going</button>
          ) : <span />}
          <button onClick={() => setConfirmDiscard(true)} className="btn-danger-ghost">Discard</button>
        </div>
      </div>
      <DiscardConfirm open={confirmDiscard} onClose={() => setConfirmDiscard(false)} />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function DiscardConfirm({ open, onClose }) {
  const { dispatch, toast } = useApp()
  return (
    <ConfirmDialog
      open={open}
      title="Discard workout?"
      message="Nothing from this session will be saved."
      confirmLabel="Discard"
      onConfirm={() => {
        dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })
        toast('Workout discarded', 'info')
      }}
      onClose={onClose}
    />
  )
}
