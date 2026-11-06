// Review the actual work and optional feedback, then save.

import { count } from '../../lib/presentation.js'
import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import {
  describeSets,
  elapsedMs,
  findRecords,
  fmtClock,
  fmtNum,
  setCounts,
  toWorkoutRecord,
  totals,
} from '../../lib/workout.js'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { isNativeApp, nativeRequest } from '../../lib/native.js'

// Keep historical effort values; labels do not change saved intensity.
export const EFFORT = [
  { value: 1, label: 'Easy', d: 'M2 7 H18' },
  { value: 2, label: 'Moderate', d: 'M2 9 C 7 4, 13 4, 18 9' },
  { value: 3, label: 'Hard', d: 'M2 11 L7 5 L11 9 L18 3' },
  { value: 4, label: 'Very hard', d: 'M2 12 L5 3 L8 11 L11 2 L14 11 L18 3' },
  { value: 5, label: 'Very hard', hidden: true },
]

export default function WorkoutSummary({ session, now, onKeepGoing, onClose, onSaved, onAddExercise }) {
  const { state, dispatch, toast, today } = useApp()
  const [effort, setEffort] = useState(session.summaryDraft?.effort ?? null)
  const [note, setNote] = useState(session.summaryDraft?.note || '')
  const [finishReason, setFinishReason] = useState(session.summaryDraft?.finishReason || 'other')
  const [saveRoutine, setSaveRoutine] = useState(Boolean(session.summaryDraft?.saveRoutine))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [logDate, setLogDate] = useState(session.summaryDraft?.logDate || session.logDate || today)
  const [includeTime, setIncludeTime] = useState(false)
  const keepDraft = (patch) =>
    dispatch({
      type: 'SET_ACTIVE_WORKOUT',
      session: { ...session, summaryDraft: { ...session.summaryDraft, ...patch } },
    })

  const { done } = setCounts(session)
  const t = useMemo(() => totals(session.exercises), [session.exercises])
  const records = useMemo(
    () =>
      findRecords(
        session,
        state.workouts.filter((w) => w.date <= logDate),
      ),
    [session, state.workouts, logDate],
  )
  const remaining = session.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.status === 'todo').length,
    0,
  )
  const isSaved = state.routines.some((r) => r.id === session.routineId)
  const worked = session.exercises.filter((e) => e.sets.some((s) => s.status === 'done'))

  function save() {
    if (!logDate || logDate > today) return
    const record = toWorkoutRecord(
      { ...session, finishReason, ...(session.kind === 'manual' ? { logDate } : {}) },
      state.workouts,
      { now, effort, note },
    )
    if (saveRoutine && !isSaved) {
      const id = `r-${session.id}`
      dispatch({
        type: 'SAVE_ROUTINE',
        routine: {
          id,
          name: session.name,
          circuit: session.circuit,
          items: (session.kind === 'manual' ? worked : session.exercises).map((e) => ({
            exId: e.exId,
            sets:
              e.sets.filter((s) => (session.kind === 'manual' ? s.status === 'done' : s.status !== 'skipped'))
                .length || e.sets.length,
            ...(e.type === 'time' ? { sec: e.sets[0].sec } : { reps: e.sets[0].reps }),
            weight: e.weighted ? Math.max(0, ...e.sets.map((s) => s.weight || 0)) || null : null,
            restSec: e.restSec,
          })),
        },
      })
      record.routineId = id
    }
    dispatch({ type: 'FINISH_WORKOUT', workout: record })
    // The saved sheet confirms it, including any new bests; no extra toast.
    onSaved?.({ ...record, newBests: records.length })
  }

  async function share() {
    const text = `${session.name} on Tally: ${count(worked.length, 'exercise')}, ${count(done, 'set')}${t.volume ? `, ${fmtNum(t.volume)} ${session.unit} moved` : ''}${includeTime ? ` in ${fmtClock(elapsedMs(session, now))}` : ''}.`
    try {
      if (isNativeApp()) await nativeRequest('share.text', { text }, 300_000)
      else if (navigator.share) await navigator.share({ text })
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
        {remaining > 0 && (
          <button onClick={onKeepGoing} className="btn-primary mt-6 h-[52px] w-full max-w-xs">
            Back to workout
          </button>
        )}
        <button onClick={() => setConfirmDiscard(true)} className="btn-danger-ghost mt-2">
          Discard workout
        </button>
        <DiscardConfirm open={confirmDiscard} onClose={() => setConfirmDiscard(false)} />
      </div>
    )
  }

  const cells = [
    t.volume > 0 ? { l: 'Volume', v: fmtNum(t.volume), u: session.unit } : { l: 'Reps', v: fmtNum(t.reps) },
    { l: 'Sets logged', v: done },
  ]

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={onClose} className="icon-btn" aria-label="Close summary">
          <Icon name="x" size={16} strokeWidth={2.4} />
        </button>
      </div>
      <div className="mt-1 flex flex-col items-center text-center">
        <span className="icon-tile !h-14 !w-14 !rounded-2xl text-accent">
          <Icon name="check" size={27} />
        </span>
        <h1 className="mt-4 font-display text-[32px] leading-tight">
          {session.kind === 'manual' ? 'Your workout' : remaining > 0 ? 'Save session' : 'Session complete'}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {session.kind === 'manual'
            ? 'Review your sets, then save whenever you’re ready.'
            : remaining > 0
              ? 'Save what you did. Every set counts.'
              : session.kind === 'sport'
                ? 'Your sport warmup is complete.'
                : session.kind === 'recovery'
                  ? 'Your light movement session is complete.'
                  : session.kind === 'pump'
                    ? 'Your short focused session is complete.'
                    : 'Your logged sets are ready to save.'}
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2.5">
        {cells.map((c) => (
          <div key={c.l} className="rounded-tuck bg-surface p-4">
            <p className="text-[12px] text-muted">{c.l}</p>
            <p className="mt-1.5 flex items-baseline gap-1">
              <span className="num text-[28px]">{c.v}</span>
              {c.u && <span className="text-[13px] text-muted">{c.u}</span>}
            </p>
          </div>
        ))}
      </div>

      <h2 className="section-title mt-7">What you did</h2>
      <div className="mt-2.5 rounded-tuck bg-surface px-4">
        {worked.map((e, i) => {
          const best = records.some((r) => r.exId === e.exId)
          return (
            <div key={e.key} className={`flex items-center gap-3 py-3 ${i ? 'border-t border-line' : ''}`}>
              <span className="dot h-6 w-6 bg-ink text-on-paper">
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{e.name}</span>
              {best && <span className="badge">Best</span>}
              <span className="max-w-[55%] text-right text-[13px] tabular-nums text-muted">
                {describeSets({ ...e, sets: e.sets.filter((s) => s.status === 'done') }, session.unit)}
              </span>
            </div>
          )
        })}
      </div>

      <h2 className="section-title mt-7">How did it feel?</h2>
      <div className="mt-2.5 grid grid-cols-4 gap-2">
        {EFFORT.filter((o) => !o.hidden).map((o) => {
          const on = effort === o.value
          return (
            <button
              key={o.value}
              onClick={() => {
                setEffort(on ? null : o.value)
                keepDraft({ effort: on ? null : o.value })
              }}
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-[18px] ${on ? 'bg-ink text-on-paper' : 'bg-surface text-ink2'}`}
            >
              <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={`w-1 rounded-sm ${n <= o.value ? 'bg-current' : 'bg-current opacity-20'}`}
                    style={{ height: `${4 + n * 3}px` }}
                  />
                ))}
              </span>
              <span className="text-[12px] font-semibold">{o.label}</span>
            </button>
          )
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          keepDraft({ note: e.target.value })
        }}
        rows={2}
        placeholder="Notes for next time (optional)"
        className="input mt-3 resize-none"
      />
      <details className="mt-3 border-t border-line">
        <summary className="min-h-12 cursor-pointer py-3 text-[14px] text-muted">Session time</summary>
        <p className="text-[14px] text-ink2">
          {fmtClock(elapsedMs(session, now))} active time. Paused time is excluded.
        </p>
        <label className="flex min-h-12 items-center gap-3 text-[14px]">
          <input type="checkbox" checked={includeTime} onChange={(e) => setIncludeTime(e.target.checked)} />
          Include time when sharing
        </label>
      </details>
      {session.kind === 'manual' && (
        <label className="mt-4 block text-[14px]">
          Workout date
          <input
            aria-label="Workout date"
            type="date"
            max={today}
            value={logDate}
            onInput={(e) => {
              setLogDate(e.target.value)
              keepDraft({ logDate: e.target.value })
            }}
            className="input mt-2"
          />
        </label>
      )}
      {session.kind !== 'manual' &&
        session.exercises.some((e) => e.sets.some((s) => s.status !== 'done')) && (
          <div className="mt-4 text-[14px]">
            Anything to consider next time?
            <span
              className="mt-2 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Reason for finishing early"
            >
              {[
                ['other', 'No reason needed'],
                ['time', 'Time was short'],
                ['unwell', 'Not feeling well'],
                ['soreness', 'Soreness / too much today'],
                ['pain', 'Pain or discomfort'],
                ['dislike', 'Prefer different exercises'],
              ].map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={finishReason === value}
                  className={`chip ${finishReason === value ? 'chip-active' : 'bg-surface2'}`}
                  onClick={() => {
                    setFinishReason(value)
                    keepDraft({ finishReason: value })
                  }}
                >
                  {text}
                </button>
              ))}
            </span>
            <span className="mt-2 block text-[12px] text-muted">Optional. Shapes your next plan.</span>
          </div>
        )}

      {!isSaved && !String(session.routineId || '').startsWith('tpl-') && (
        <label className="mt-3 flex items-center gap-3 rounded-tuck bg-surface px-4 py-3.5">
          <input
            type="checkbox"
            checked={saveRoutine}
            onChange={(e) => {
              setSaveRoutine(e.target.checked)
              keepDraft({ saveRoutine: e.target.checked })
            }}
            className="h-5 w-5 accent-[rgb(var(--accent))]"
          />
          <span className="text-[15px]">Save as one of my routines</span>
        </label>
      )}

      <div className="sticky bottom-0 z-10 mt-7 flex gap-2.5 border-t border-line bg-bg py-3">
        <button
          onClick={share}
          className="btn-secondary min-h-[54px] px-5"
          aria-label="Share workout summary"
        >
          <Icon name="share" size={16} />
        </button>
        <button
          onClick={save}
          disabled={!logDate || logDate > today}
          className="btn-primary min-h-[54px] flex-1 text-[16px]"
        >
          Save workout
        </button>
      </div>
      <div className="mt-2 flex justify-center gap-2">
        {remaining > 0 && (
          <button onClick={onKeepGoing} className="btn-ghost">
            Keep going
          </button>
        )}
        <button onClick={onAddExercise} className="btn-ghost">
          Add exercise
        </button>
        <button onClick={() => setConfirmDiscard(true)} className="btn-danger-ghost">
          Discard
        </button>
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
