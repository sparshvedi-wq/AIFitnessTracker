// End of a workout: the numbers, the score change, what you did, how it felt,
// then save.

import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { describeSets, elapsedMs, findRecords, fmtClock, fmtNum, setCounts, toWorkoutRecord, totals, weekStart } from '../../lib/workout.js'
import { scoreAt } from '../../lib/score.js'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { TallyLogo, corner } from '../Ink.jsx'

// Effort, saved as a number. Older saves used 1–5; 5 reads as Brutal too.
export const EFFORT = [
  { value: 1, label: 'Easy', d: 'M2 7 H18' },
  { value: 2, label: 'Solid', d: 'M2 9 C 7 4, 13 4, 18 9' },
  { value: 3, label: 'Hard', d: 'M2 11 L7 5 L11 9 L18 3' },
  { value: 4, label: 'Brutal', d: 'M2 12 L5 3 L8 11 L11 2 L14 11 L18 3' },
  { value: 5, label: 'Brutal', hidden: true },
]

export default function WorkoutSummary({ session, now, onKeepGoing, onClose }) {
  const { state, dispatch, toast, today } = useApp()
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
  const goal = state.settings.workout.weeklyGoal

  const preview = useMemo(() => toWorkoutRecord(session, state.workouts, { now }), [session, state.workouts, now])
  const before = scoreAt(state.workouts, goal, today)
  const after = scoreAt([...state.workouts, preview], goal, today)
  const weekCount = state.workouts.filter((w) => w.date >= weekStart(today)).length + 1

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
    toast(records.length ? `Saved, with ${records.length} new best${records.length === 1 ? '' : 's'}` : 'Workout saved')
  }

  async function share() {
    const text = `${session.name} on Tally: ${worked.length} exercises, ${done} sets${t.volume ? `, ${fmtNum(t.volume)} ${session.unit} moved` : ''} in ${fmtClock(elapsedMs(session, now))}.`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Copied to clipboard')
      }
    } catch {
      // Share sheet closed
    }
  }

  if (done === 0) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <h2 className="font-display text-[30px]">Nothing logged yet</h2>
        <p className="mt-1 text-[15px] text-muted">Log at least one set to save this workout.</p>
        {remaining > 0 && <button onClick={onKeepGoing} className="btn-primary mt-6 h-[52px] w-full max-w-xs">Back to workout</button>}
        <button onClick={() => setConfirmDiscard(true)} className="btn-danger-ghost mt-2">Discard workout</button>
        <DiscardConfirm open={confirmDiscard} onClose={() => setConfirmDiscard(false)} />
      </div>
    )
  }

  const cells = [
    { l: 'Time', v: fmtClock(elapsedMs(session, now)) },
    t.volume > 0 ? { l: 'Volume', v: fmtNum(t.volume), u: session.unit } : { l: 'Reps', v: fmtNum(t.reps) },
    { l: 'Sets', v: `${done} of ${total}` },
    { l: 'New bests', v: records.length },
  ]

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={onClose} className="icon-btn" aria-label="Close summary"><Icon name="x" size={16} strokeWidth={2.4} /></button>
      </div>
      <div className="mt-1 flex flex-col items-center text-center">
        <TallyLogo width={96} />
        <h1 className="mt-4 font-display text-[38px] leading-[1.1]">{remaining > 0 ? 'Wrapping up' : `${session.name}, done.`}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {remaining > 0
            ? `${remaining} set${remaining === 1 ? '' : 's'} left in the plan. Your call.`
            : weekCount >= goal
              ? `That’s ${weekCount} of ${goal}. The week is yours.`
              : `That’s ${weekCount} of ${goal} this week.`}
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2.5">
        {cells.map((c, i) => (
          <div key={c.l} className={`bg-surface p-4 ${corner(i)}`}>
            <p className="text-[12px] text-muted">{c.l}</p>
            <p className="mt-1.5 flex items-baseline gap-1">
              <span className="num text-[28px]">{c.v}</span>
              {c.u && <span className="text-[13px] text-muted">{c.u}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3.5 rounded-tuck bg-paper px-[18px] py-4 text-on-paper">
        <span className="flex-1">
          <span className="block text-[13px] text-paper-muted">Tally score</span>
          <span className="mt-1 flex items-center gap-2.5">
            <span className="num text-[28px] text-[#8A867E]">{before}</span>
            <Icon name="arrowRight" size={18} strokeWidth={2} />
            <span className="num text-[28px]">{after}</span>
          </span>
        </span>
        {after !== before && <span className="inline-flex h-7 items-center rounded-full bg-on-paper px-3 text-[13px] font-bold text-paper">{after > before ? '+' : ''}{after - before}</span>}
      </div>

      <h2 className="section-title mt-7">What you did</h2>
      <div className="mt-2.5 rounded-tuck bg-surface px-4">
        {worked.map((e, i) => {
          const best = records.some((r) => r.exId === e.exId)
          return (
            <div key={e.key} className={`flex items-center gap-3 py-3 ${i ? 'border-t border-line' : ''}`}>
              <span className="dot h-6 w-6 bg-ink text-on-paper"><Icon name="check" size={12} strokeWidth={3} /></span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{e.name}</span>
              {best && <span className="badge">Best</span>}
              <span className="shrink-0 text-[13px] tabular-nums text-muted">{describeSets({ ...e, sets: e.sets.filter((s) => s.status === 'done') }, session.unit)}</span>
            </div>
          )
        })}
      </div>

      <h2 className="section-title mt-7">How did it feel?</h2>
      <div className="mt-2.5 grid grid-cols-4 gap-2">
        {EFFORT.filter((o) => !o.hidden).map((o) => {
          const on = effort === o.value
          return (
            <button key={o.value} onClick={() => setEffort(on ? null : o.value)} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-[18px] ${on ? 'bg-ink text-on-paper' : 'bg-surface text-ink2'}`}>
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d={o.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-[12px] font-semibold">{o.label}</span>
            </button>
          )
        })}
      </div>

      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes for next time (optional)" className="input mt-3 resize-none" />

      {!isSaved && !String(session.routineId || '').startsWith('tpl-') && (
        <label className="mt-3 flex items-center gap-3 rounded-tuck bg-surface px-4 py-3.5">
          <input type="checkbox" checked={saveRoutine} onChange={(e) => setSaveRoutine(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
          <span className="text-[15px]">Save as one of my routines</span>
        </label>
      )}

      <div className="mt-7 flex gap-2.5">
        <button onClick={share} className="btn-secondary h-[54px] px-5"><Icon name="share" size={16} />Share</button>
        <button onClick={save} className="btn-primary h-[54px] flex-1 text-[16px]">Done</button>
      </div>
      <div className="mt-2 flex justify-center gap-2">
        {remaining > 0 && <button onClick={onKeepGoing} className="btn-ghost">Keep going</button>}
        <button onClick={() => setConfirmDiscard(true)} className="btn-danger-ghost">Discard</button>
      </div>
      <DiscardConfirm open={confirmDiscard} onClose={() => setConfirmDiscard(false)} />
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
