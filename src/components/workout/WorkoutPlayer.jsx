// Full-screen guided workout: get-ready countdown → set → rest → next set,
// with logging, timers, form tips and last-time numbers, then a summary.

import { useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import {
  WEIGHT_STEP, addSet, adjustTimer, appendExercise, completeSet, currentSet, describeSets,
  elapsedMs, finish, fmtClock, keepGoing, fmtNum, jumpTo, lastPerformance, makeSessionExercise,
  nextStep, pause, removeExercise, resume, roundInfo, setCounts, skipExercise, skipRest,
  startSetTimer, suggestTarget, unskipExercise, updateSet,
} from '../../lib/workout.js'
import { shortLabel } from '../../lib/date.js'
import { unlockAudio } from '../../lib/coach.js'
import Icon from '../Icon.jsx'
import Modal from '../Modal.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import ExercisePicker from './ExercisePicker.jsx'
import WorkoutSummary from './WorkoutSummary.jsx'
import { MuscleTag, Stepper, TimerRing } from './Controls.jsx'

export default function WorkoutPlayer({ session, now, onMinimize }) {
  const { state, dispatch } = useApp()
  const [overview, setOverview] = useState(false)
  const update = (fn) => {
    unlockAudio()
    dispatch({ type: 'SET_ACTIVE_WORKOUT', session: fn(state.activeWorkout, Date.now()) })
  }

  const { done, total } = setCounts(session)
  const paused = Boolean(session.pausedAt)

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg animate-fade-in" role="dialog" aria-label={`${session.name} workout`}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-1 px-2 pt-[max(env(safe-area-inset-top),8px)]">
          <button onClick={onMinimize} className="icon-btn" aria-label="Minimize workout">
            <Icon name="chevronDown" size={24} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[13px] font-semibold text-muted">{session.name}</p>
            <p className="text-[17px] font-bold tabular-nums text-ink">{fmtClock(elapsedMs(session, now))}</p>
          </div>
          {session.phase !== 'done' && (
            <button onClick={() => update(paused ? resume : pause)} className="icon-btn" aria-label={paused ? 'Resume' : 'Pause'}>
              <Icon name={paused ? 'play' : 'pause'} size={20} />
            </button>
          )}
          <button onClick={() => setOverview(true)} className="icon-btn" aria-label="All exercises">
            <Icon name="list" size={22} />
          </button>
        </header>

        {/* Overall progress */}
        <div className="px-4 pb-1 pt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="mt-1.5 text-right text-[12px] font-semibold tabular-nums text-muted">{done} of {total} sets</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {session.phase === 'done' ? (
            <WorkoutSummary session={session} now={now} onKeepGoing={() => update(keepGoing)} />
          ) : paused ? (
            <PausedView session={session} onResume={() => update(resume)} />
          ) : session.phase === 'ready' ? (
            <ReadyView session={session} now={now} update={update} />
          ) : session.phase === 'rest' ? (
            <RestView session={session} now={now} update={update} />
          ) : (
            <WorkView session={session} now={now} update={update} unit={session.unit} onAdd={() => setOverview(true)} />
          )}
        </div>
      </div>

      <Overview open={overview} onClose={() => setOverview(false)} session={session} update={update} />
    </div>
  )
}

// ── Phases ────────────────────────────────────────────────────────────

function ReadyView({ session, now, update }) {
  const cur = currentSet(session)
  const left = session.phaseEndsAt ? session.phaseEndsAt - now : 0
  return (
    <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-brand">Get ready</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{cur?.ex.name}</h2>
      <div className="my-8">
        <TimerRing progress={session.phaseTotal ? left / session.phaseTotal : 0}>
          <span className="text-7xl font-extrabold tabular-nums text-ink">{Math.max(0, Math.ceil(left / 1000))}</span>
        </TimerRing>
      </div>
      <button onClick={() => update(skipRest)} className="btn-primary h-12 w-full max-w-xs">
        <Icon name="play" size={18} />
        Start now
      </button>
    </div>
  )
}

function PausedView({ session, onResume }) {
  const cur = currentSet(session)
  return (
    <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface2 text-ink2">
        <Icon name="pause" size={28} />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Paused</h2>
      {cur && (
        <p className="mt-1 text-[15px] text-muted">
          {session.phase === 'rest' ? 'Resting before ' : 'On '}
          {cur.ex.name}, set {session.cursor.set + 1} of {cur.ex.sets.length}
        </p>
      )}
      {session.phaseLeft != null && <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink2">{fmtClock(session.phaseLeft)} left on the timer</p>}
      <button onClick={onResume} className="btn-primary mt-8 h-12 w-full max-w-xs">
        <Icon name="play" size={18} />
        Resume
      </button>
    </div>
  )
}

function RestView({ session, now, update }) {
  const cur = currentSet(session)
  const left = session.phaseEndsAt ? session.phaseEndsAt - now : 0
  const round = roundInfo(session)
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Rest</p>
      <div className="my-6">
        <TimerRing progress={session.phaseTotal ? left / session.phaseTotal : 0} color="rgb(var(--brand))">
          <span className="text-6xl font-extrabold tabular-nums text-ink">{fmtClock(left)}</span>
          <span className="mt-1 text-[13px] font-medium text-muted">Breathe, sip water</span>
        </TimerRing>
      </div>
      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        <button onClick={() => update((s, n) => adjustTimer(s, -15, n))} className="btn-secondary">−15s</button>
        <button onClick={() => update(skipRest)} className="btn-primary">
          Skip
          <Icon name="skip" size={16} />
        </button>
        <button onClick={() => update((s, n) => adjustTimer(s, 15, n))} className="btn-secondary">+15s</button>
      </div>

      {cur && (
        <div className="card mt-6 w-full p-4 text-left">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Up next{round ? ` · round ${round.round} of ${round.rounds}` : ''}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink">{cur.ex.name}</p>
              <p className="text-[15px] text-ink2">
                Set {session.cursor.set + 1} of {cur.ex.sets.length} · {targetText(cur.ex, cur.set, session.unit)}
              </p>
            </div>
            <MuscleTag muscle={cur.ex.muscle} />
          </div>
          {cur.ex.cues[0] && (
            <p className="mt-3 flex gap-2 border-t border-line pt-3 text-[13px] text-ink2">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-brand" />
              {cur.ex.cues[0]}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function WorkView({ session, now, update, unit, onAdd }) {
  const [tipsOpen, setTipsOpen] = useState(true)
  const cur = currentSet(session)
  if (!cur) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon name="dumbbell" size={28} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">Empty workout</h2>
        <p className="mt-1 max-w-xs text-[15px] text-muted">Add exercises as you go. Each one gets its own sets, rest timer and tips.</p>
        <button onClick={onAdd} className="btn-primary mt-6 h-12 w-full max-w-xs">
          <Icon name="plus" size={18} strokeWidth={2.5} />
          Add exercise
        </button>
      </div>
    )
  }

  const { ex, set } = cur
  const timed = ex.type === 'time'
  const running = timed && session.phaseEndsAt
  const left = running ? session.phaseEndsAt - now : 0
  const round = roundInfo(session)
  const exNo = session.cursor.ex + 1
  const step = WEIGHT_STEP[unit] || 5
  const isLastSet = !nextStep({ ...session, exercises: session.exercises.map((e, i) => i !== session.cursor.ex ? e : { ...e, sets: e.sets.map((s, j) => j === session.cursor.set ? { ...s, status: 'done' } : s) }) }, session.cursor)

  const complete = () => {
    if (timed && running) {
      const heldSec = Math.max(1, Math.round((session.phaseTotal - left) / 1000))
      update((s, n) => completeSet(s, n, { sec: heldSec }))
    } else update((s, n) => completeSet(s, n))
  }

  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <MuscleTag muscle={ex.muscle} />
        {round ? `Round ${round.round} of ${round.rounds}` : `Exercise ${exNo} of ${session.exercises.length}`}
      </div>
      <h2 className="mt-1.5 text-[28px] font-extrabold leading-tight tracking-tight text-ink">{ex.name}</h2>

      {/* Set dots */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          {ex.sets.map((s, i) => (
            <span
              key={i}
              className={`h-2.5 rounded-full transition-all ${
                i === session.cursor.set ? 'w-7 bg-brand'
                  : s.status === 'done' ? 'w-2.5 bg-brand/50'
                  : s.status === 'skipped' ? 'w-2.5 bg-line'
                  : 'w-2.5 bg-surface2 ring-1 ring-inset ring-line'
              }`}
            />
          ))}
        </div>
        <span className="text-[15px] font-semibold text-ink2">Set {session.cursor.set + 1} of {ex.sets.length}</span>
      </div>

      {ex.note && session.cursor.set === 0 && (
        <div className={`mt-4 flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[14px] font-medium ${ex.up ? 'bg-brand-soft text-brand' : 'bg-surface2 text-ink2'}`}>
          <Icon name={ex.up ? 'trendUp' : 'target'} size={18} className="mt-0.5 shrink-0" />
          {ex.note}
        </div>
      )}

      {/* Logging */}
      <div className="mt-5">
        {timed ? (
          running ? (
            <div className="py-2">
              <TimerRing progress={session.phaseTotal ? left / session.phaseTotal : 0} size={210}>
                <span className="text-6xl font-extrabold tabular-nums text-ink">{fmtClock(left)}</span>
                <span className="mt-1 text-[13px] font-medium text-muted">of {set.sec}s</span>
              </TimerRing>
            </div>
          ) : (
            <Stepper label="Seconds" value={set.sec} step={5} min={5} onChange={(v) => update((s) => updateSet(s, { sec: v }))} />
          )
        ) : (
          <div className="flex gap-3">
            <Stepper label="Reps" value={set.reps} onChange={(v) => update((s) => updateSet(s, { reps: v }))} />
            {ex.weighted && (
              <Stepper label={`Weight (${unit})`} value={set.weight} step={step} decimals onChange={(v) => update((s) => updateSet(s, { weight: v }))} />
            )}
          </div>
        )}
        {!timed && set.targetReps != null && (set.reps !== set.targetReps || (ex.weighted && set.weight !== set.targetWeight)) && (
          <p className="mt-2 text-center text-[13px] text-muted">Target was {targetText(ex, { ...set, reps: set.targetReps, weight: set.targetWeight }, unit)}</p>
        )}
      </div>

      {ex.last && (
        <p className="mt-4 flex items-center gap-2 text-[14px] text-ink2">
          <Icon name="clock" size={16} className="shrink-0 text-muted" />
          <span>
            <span className="text-muted">Last time ({shortLabel(ex.last.date)}):</span>{' '}
            <span className="font-semibold">{describeSets({ ...ex, sets: ex.last.sets }, unit)}</span>
          </span>
        </p>
      )}

      {ex.cues.length > 0 && (
        <div className="card mt-4 overflow-hidden">
          <button onClick={() => setTipsOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
            <Icon name="info" size={17} className="text-brand" />
            <span className="flex-1 text-[15px] font-semibold text-ink">Form tips</span>
            <Icon name="chevronDown" size={18} className={`text-muted transition-transform ${tipsOpen ? 'rotate-180' : ''}`} />
          </button>
          {tipsOpen && (
            <ul className="space-y-1.5 border-t border-line px-4 py-3">
              {ex.cues.map((c) => (
                <li key={c} className="flex gap-2 text-[14px] text-ink2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-4">
        {timed && !running ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button onClick={() => update(startSetTimer)} className="btn-primary h-14 text-[17px]">
              <Icon name="play" size={18} />
              Start {set.sec}s timer
            </button>
            <button onClick={complete} className="btn-secondary h-14 px-4" aria-label="Log without timer">
              <Icon name="check" size={20} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button onClick={complete} className="btn-primary h-14 w-full text-[17px]">
            <Icon name="check" size={20} strokeWidth={2.5} />
            {timed ? 'Done early' : isLastSet ? 'Finish last set' : 'Complete set'}
          </button>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => update(skipExercise)} className="btn-ghost text-[14px]">
            <Icon name="skip" size={16} />
            Skip exercise
          </button>
          <button onClick={() => update((s) => addSet(s))} className="btn-ghost text-[14px]">
            <Icon name="plus" size={16} strokeWidth={2.5} />
            Add a set
          </button>
        </div>
      </div>
    </div>
  )
}

function targetText(ex, set, unit) {
  if (ex.type === 'time') return `${set.sec}s`
  const w = ex.weighted && set.weight ? ` @ ${fmtNum(set.weight)} ${unit}` : ''
  return `${set.reps} reps${w}`
}

// ── Overview sheet: every exercise and set, jump anywhere, edit the plan ──

function Overview({ open, onClose, session, update }) {
  const { state } = useApp()
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'discard' | 'finish'
  const { dispatch, toast } = useApp()
  const { done } = setCounts(session)

  function addExercise(def) {
    const item = def.type === 'time' ? { exId: def.id, sets: 3, sec: 30, restSec: 45 } : { exId: def.id, sets: 3, reps: 10, restSec: 90 }
    const last = lastPerformance(state.workouts, def.id)
    const { target, note, up } = suggestTarget(def, item, last, session.unit)
    update((s) => appendExercise(s, makeSessionExercise(def, item, target, { last, note, up })))
  }

  return (
    <>
      <Modal
        open={open}
        onClose={picking || confirm ? () => {} : onClose}
        title="Workout plan"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirm('discard')} className="btn-danger-ghost">Discard</button>
            <button
              onClick={() => (done > 0 ? (update(finish), onClose()) : setConfirm('discard'))}
              className="btn-primary"
            >
              Finish workout
            </button>
          </div>
        }
      >
        <ul className="space-y-3">
          {session.exercises.map((e, i) => {
            const skipped = e.sets.every((s) => s.status === 'skipped')
            const hasDone = e.sets.some((s) => s.status === 'done')
            return (
              <li key={e.key} className={`rounded-2xl border p-3 ${session.cursor?.ex === i ? 'border-brand/60 bg-brand-soft/40' : 'border-line'}`}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-semibold ${skipped ? 'text-muted line-through' : 'text-ink'}`}>{e.name}</p>
                    <p className="text-[13px] text-muted">Rest {e.restSec}s</p>
                  </div>
                  {skipped ? (
                    <button onClick={() => update((s) => unskipExercise(s, i))} className="chip">Restore</button>
                  ) : (
                    <button onClick={() => update((s) => addSet(s, i))} className="icon-btn h-8 w-8" aria-label={`Add a set to ${e.name}`}>
                      <Icon name="plus" size={17} />
                    </button>
                  )}
                  {!hasDone && (
                    <button onClick={() => update((s) => removeExercise(s, i))} className="icon-btn h-8 w-8 hover:text-danger" aria-label={`Remove ${e.name}`}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {e.sets.map((s, j) => {
                    const current = session.cursor?.ex === i && session.cursor?.set === j && session.phase !== 'done'
                    return (
                      <button
                        key={j}
                        onClick={() => { update((x, n) => jumpTo(x, { ex: i, set: j }, n)); onClose() }}
                        className={`rounded-lg border px-2 py-1 text-[13px] font-semibold tabular-nums transition-colors ${
                          current ? 'border-brand bg-brand text-on-brand'
                            : s.status === 'done' ? 'border-brand/40 bg-brand-soft text-brand'
                            : s.status === 'skipped' ? 'border-line text-muted line-through'
                            : 'border-line bg-surface text-ink2 hover:border-brand/50'
                        }`}
                        aria-label={`Go to ${e.name} set ${j + 1}`}
                      >
                        {s.status === 'done' && <Icon name="check" size={12} strokeWidth={3} className="mr-1 inline -translate-y-px" />}
                        {e.type === 'time' ? `${s.sec}s` : e.weighted && s.weight ? `${s.reps} × ${fmtNum(s.weight)} ${session.unit}` : `${s.reps} reps`}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 px-1 text-[13px] text-muted">Tap any set to jump to it, or to redo one you've logged.</p>
        <button onClick={() => setPicking(true)} className="btn-secondary mt-3 w-full">
          <Icon name="plus" size={18} strokeWidth={2.5} />
          Add exercise
        </button>
      </Modal>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addExercise} />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Discard workout?"
        message={done > 0 ? `You've logged ${done} set${done === 1 ? '' : 's'}. Discarding won't save them.` : 'Nothing has been logged yet.'}
        confirmLabel="Discard"
        onConfirm={() => {
          dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })
          toast('Workout discarded', 'info')
          onClose()
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}
