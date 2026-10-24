// Full-screen guided workout. One screen does it all: progress up top, the
// current set with big reps and weight, then today's plan underneath.
// Timers (get ready, rest, timed sets) take over the top panel when running.

import { useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import {
  WEIGHT_STEP, addSet, adjustTimer, appendExercise, bestLifts, completeSet, currentSet, describeSets,
  elapsedMs, finish, fmtClock, fmtNum, jumpTo, keepGoing, lastPerformance, makeSessionExercise, nextStep,
  pause, removeExercise, resume, roundInfo, setCounts, skipExercise, skipRest, startSetTimer, suggestTarget,
  totals, unskipExercise, updateSet,
} from '../../lib/workout.js'
import { MONTHS, fromKey } from '../../lib/date.js'
import { unlockAudio } from '../../lib/coach.js'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { BigStepper } from '../Ink.jsx'
import ExercisePicker from './ExercisePicker.jsx'
import FormSheet from './FormSheet.jsx'
import WorkoutSummary from './WorkoutSummary.jsx'

export default function WorkoutPlayer({ session, now, onMinimize }) {
  const { state, dispatch } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const update = (fn) => {
    unlockAudio()
    dispatch({ type: 'SET_ACTIVE_WORKOUT', session: fn(state.activeWorkout, Date.now()) })
  }

  function addExercise(def) {
    const item = def.type === 'time' ? { exId: def.id, sets: 3, sec: 30, restSec: 45 } : { exId: def.id, sets: 3, reps: 10, restSec: 90 }
    const last = lastPerformance(state.workouts, def.id)
    const { target, note, up } = suggestTarget(def, item, last, session.unit)
    update((s) => appendExercise(s, makeSessionExercise(def, item, target, { last, note, up })))
  }

  if (session.phase === 'done') {
    return (
      <Screen>
        <WorkoutSummary session={session} now={now} onKeepGoing={() => update(keepGoing)} onClose={onMinimize} />
      </Screen>
    )
  }

  const cur = currentSet(session)
  const { done, total } = setCounts(session)
  const paused = Boolean(session.pausedAt)
  const t = totals(session.exercises)
  const left = estimateLeftMin(session)
  const ticks = session.exercises.flatMap((e, i) => e.sets.filter((s) => s.status !== 'skipped').map((s, j) => ({ s, cur: session.cursor?.ex === i && e.sets.indexOf(s) === session.cursor?.set, k: `${i}-${j}` })))

  return (
    <Screen>
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <button onClick={onMinimize} className="icon-btn" aria-label="Minimize workout"><Icon name="chevronDown" size={20} strokeWidth={2.2} /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15px] font-semibold">{session.name}</p>
          <p className="text-[12px] text-muted">
            {cur ? (roundInfo(session) ? `Round ${roundInfo(session).round} of ${roundInfo(session).rounds}` : `Exercise ${session.cursor.ex + 1} of ${session.exercises.length}`) : 'Add your first exercise'}
          </p>
        </div>
        <button onClick={() => update(paused ? resume : pause)} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5" aria-label={paused ? 'Resume workout' : 'Pause workout'}>
          {paused ? <Icon name="play" size={12} filled strokeWidth={0} className="text-accent" /> : <span className="h-2 w-2 rounded-full bg-accent" />}
          <span className="num text-[15px]">{fmtClock(elapsedMs(session, now))}</span>
        </button>
      </header>

      {/* Progress */}
      {ticks.length > 0 && (
        <div className="mt-4 flex gap-1">
          {ticks.map((k) => (
            <span key={k.k} className={`h-[5px] flex-1 rounded-full ${k.cur ? 'bg-accent' : k.s.status === 'done' ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Chip icon="tally" v={`${done}/${total}`} l="sets done" />
        <Chip icon="bars" v={fmtNum(t.volume)} l={`${session.unit} moved`} />
        <Chip icon="timer" v={`~${left}m`} l="to go" />
      </div>

      {/* Current step */}
      {!cur ? (
        <EmptyStart onAdd={() => setPicking(true)} />
      ) : paused ? (
        <Paused session={session} onResume={() => update(resume)} />
      ) : session.phase === 'ready' ? (
        <Countdown title="Get ready" sub={cur.ex.name} ms={session.phaseEndsAt - now} total={session.phaseTotal} onSkip={() => update(skipRest)} skipLabel="Start now" />
      ) : session.phase === 'rest' ? (
        <Rest session={session} now={now} update={update} />
      ) : (
        <Work session={session} now={now} update={update} onForm={() => setFormOpen(true)} />
      )}

      {/* Today's plan */}
      {session.exercises.length > 0 && <Plan session={session} update={update} />}

      <More session={session} update={update} onAdd={() => setPicking(true)} onFinish={() => (done > 0 ? update(finish) : setConfirm(true))} onDiscard={() => setConfirm(true)} />

      <FormSheet open={formOpen} onClose={() => setFormOpen(false)} exercise={cur?.ex} />
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addExercise} />
      <ConfirmDialog
        open={confirm}
        title="Discard workout?"
        message={done > 0 ? `You've logged ${done} set${done === 1 ? '' : 's'}. Discarding won't save them.` : 'Nothing has been logged yet.'}
        confirmLabel="Discard"
        onConfirm={() => dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })}
        onClose={() => setConfirm(false)}
      />
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg animate-fade-in" role="dialog" aria-label="Workout">
      <div className="mx-auto max-w-xl px-[22px] pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),18px)]">{children}</div>
    </div>
  )
}

// Rough minutes left: ~40s of work per set plus its rest.
function estimateLeftMin(session) {
  let sec = 0
  for (const e of session.exercises) {
    for (const s of e.sets) {
      if (s.status !== 'todo') continue
      sec += (e.type === 'time' ? s.sec || 30 : 40) + (e.restSec || 0)
    }
  }
  return Math.max(0, Math.round(sec / 60))
}

function Chip({ icon, v, l }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[18px] bg-surface px-3 py-2.5">
      <Icon name={icon} size={18} strokeWidth={1.8} className="shrink-0 text-accent" />
      <span className="min-w-0 leading-none">
        <span className="num block truncate text-[19px]">{v}</span>
        <span className="mt-1 block truncate text-[11px] text-muted">{l}</span>
      </span>
    </div>
  )
}

function EmptyStart({ onAdd }) {
  return (
    <section className="mt-7 rounded-hero bg-surface p-6 text-center">
      <h2 className="font-display text-[26px]">Empty workout</h2>
      <p className="mx-auto mt-1 max-w-xs text-[14px] text-muted">Add exercises as you go. Each one gets its own sets, rest timer and form guide.</p>
      <button onClick={onAdd} className="btn-primary mt-5 h-[52px] w-full"><Icon name="plus" size={18} strokeWidth={2.4} />Add exercise</button>
    </section>
  )
}

function Paused({ session, onResume }) {
  const cur = currentSet(session)
  return (
    <section className="mt-7 rounded-hero bg-surface p-6 text-center">
      <h2 className="font-display text-[30px]">Paused</h2>
      {cur && <p className="mt-1 text-[14px] text-muted">{session.phase === 'rest' ? 'Resting before' : 'On'} {cur.ex.name}, set {session.cursor.set + 1} of {cur.ex.sets.length}</p>}
      {session.phaseLeft != null && <p className="num mt-3 text-[40px]">{fmtClock(session.phaseLeft)}</p>}
      <button onClick={onResume} className="btn-primary mt-5 h-[52px] w-full"><Icon name="play" size={14} filled strokeWidth={0} />Resume</button>
    </section>
  )
}

// Big countdown with a thin progress bar under it.
function Countdown({ title, sub, ms, total, onSkip, skipLabel, children }) {
  const p = total ? Math.max(0, Math.min(1, ms / total)) : 0
  return (
    <section className="mt-7 rounded-hero bg-surface p-6 text-center">
      <p className="text-[13px] text-muted">{title}</p>
      {sub && <h2 className="mt-1 font-display text-[26px] leading-tight">{sub}</h2>}
      <p className="num mt-3 text-[88px] leading-none">{fmtClock(ms)}</p>
      <div className="mx-auto mt-5 h-[5px] max-w-[240px] rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${p * 100}%` }} />
      </div>
      {children}
      <button onClick={onSkip} className="btn-primary mt-5 h-[52px] w-full">{skipLabel}</button>
    </section>
  )
}

function Rest({ session, now, update }) {
  const cur = currentSet(session)
  return (
    <Countdown title="Rest" ms={session.phaseEndsAt - now} total={session.phaseTotal} onSkip={() => update(skipRest)} skipLabel="Skip rest">
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={() => update((s, n) => adjustTimer(s, -15, n))} className="chip bg-surface2">−15s</button>
        <button onClick={() => update((s, n) => adjustTimer(s, 15, n))} className="chip bg-surface2">+15s</button>
      </div>
      {cur && (
        <p className="mt-4 text-[14px] text-ink2">
          Up next: <span className="font-semibold text-ink">{cur.ex.name}</span>, set {session.cursor.set + 1} of {cur.ex.sets.length}
        </p>
      )}
    </Countdown>
  )
}

function Work({ session, now, update, onForm }) {
  const { ex, set } = currentSet(session)
  const unit = session.unit
  const timed = ex.type === 'time'
  const running = timed && session.phaseEndsAt
  const left = running ? session.phaseEndsAt - now : 0
  const step = WEIGHT_STEP[unit] || 5
  const asDone = { ...session, exercises: session.exercises.map((e, i) => (i !== session.cursor.ex ? e : { ...e, sets: e.sets.map((s, j) => (j === session.cursor.set ? { ...s, status: 'done' } : s)) })) }
  const isLast = !nextStep(asDone, session.cursor)

  const complete = () => {
    if (timed && running) update((s, n) => completeSet(s, n, { sec: Math.max(1, Math.round((session.phaseTotal - left) / 1000)) }))
    else update((s, n) => completeSet(s, n))
  }

  return (
    <section className="mt-7">
      <span className="badge h-6 px-2.5 text-[12px]">Set {session.cursor.set + 1} of {ex.sets.length}</span>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <h2 className="min-w-0 font-display text-[34px] leading-[1.05]">{ex.name}</h2>
        <button onClick={onForm} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-outline pl-1.5 pr-3.5 text-[14px] font-semibold">
          <span className="dot h-7 w-7 bg-accent text-on-accent"><Icon name="play" size={10} filled strokeWidth={0} /></span>
          Form
        </button>
      </div>
      {ex.note && session.cursor.set === 0 && <p className={`mt-2 text-[13px] ${ex.up ? 'text-accent' : 'text-muted'}`}>{ex.note}</p>}

      <div className="mt-4 flex overflow-hidden rounded-hero bg-surface">
        {timed ? (
          running ? (
            <div className="flex flex-1 flex-col items-center py-6">
              <span className="num text-[76px] leading-[1.05]">{fmtClock(left)}</span>
              <span className="mt-1 text-[13px] text-muted">of {set.sec}s</span>
            </div>
          ) : (
            <BigStepper label="seconds" value={set.sec} step={5} min={5} onChange={(v) => update((s) => updateSet(s, { sec: v }))} />
          )
        ) : (
          <>
            <BigStepper label="reps" value={set.reps} onChange={(v) => update((s) => updateSet(s, { reps: v }))} />
            {ex.weighted && (
              <>
                <span className="w-px bg-line" />
                <BigStepper label={unit} value={set.weight} step={step} decimals onChange={(v) => update((s) => updateSet(s, { weight: v }))} />
              </>
            )}
          </>
        )}
      </div>

      {timed && !running ? (
        <div className="mt-3 flex gap-2.5">
          <button onClick={() => update(startSetTimer)} className="btn-primary h-14 flex-1 text-[16px]"><Icon name="play" size={13} filled strokeWidth={0} />Start {set.sec}s</button>
          <button onClick={complete} className="btn-secondary h-14 px-5" aria-label="Log without the timer"><Icon name="check" size={18} strokeWidth={2.4} /></button>
        </div>
      ) : (
        <button onClick={complete} className="btn-primary mt-3 h-14 w-full text-[16px]">
          {timed ? 'Done early' : isLast ? 'Log last set' : 'Log set'}
        </button>
      )}
      {!isLast && ex.restSec > 0 && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-muted">
          <Icon name="timer" size={14} />
          {fmtClock(ex.restSec * 1000)} rest after this set
        </p>
      )}
    </section>
  )
}

function Plan({ session, update }) {
  const cur = session.cursor
  const doneEx = session.exercises.filter((e) => e.sets.every((s) => s.status !== 'todo')).length
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="section-title">Today’s plan</h2>
        <span className="text-[13px] text-muted">{doneEx} of {session.exercises.length}</span>
      </div>
      <div className="mt-2.5 rounded-tuck bg-surface px-4">
        {session.exercises.map((e, i) => {
          const isCur = cur?.ex === i
          const allDone = e.sets.every((s) => s.status === 'done')
          const skipped = e.sets.every((s) => s.status === 'skipped')
          const firstTodo = e.sets.findIndex((s) => s.status === 'todo')
          const planText = e.type === 'time' ? `${e.sets.length} × ${e.sets[0].sec}s` : `${e.sets.length} × ${e.sets[0].reps}`
          return (
            <div key={e.key} className={i ? 'border-t border-line' : ''}>
              <button
                onClick={() => (skipped ? update((s) => unskipExercise(s, i)) : firstTodo >= 0 && !isCur && update((s, n) => jumpTo(s, { ex: i, set: firstTodo }, n)))}
                className="flex w-full items-center gap-3.5 py-3.5 text-left"
              >
                <span className={`dot h-6 w-6 ${allDone ? 'bg-ink text-on-paper' : isCur ? 'border-2 border-accent' : 'border-[1.5px] border-outline'}`}>
                  {allDone && <Icon name="check" size={12} strokeWidth={3} />}
                  {isCur && !allDone && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[15px] ${isCur ? 'font-bold' : 'font-medium'} ${allDone || skipped ? 'text-faint' : ''} ${skipped ? 'line-through' : ''}`}>{e.name}</span>
                <span className="text-[13px] tabular-nums text-muted">{skipped ? 'Restore' : planText}</span>
              </button>
              {isCur && (
                <div className="-mt-1 flex gap-2 pb-3.5 pl-[38px]">
                  {e.sets.map((s, j) => {
                    const here = j === cur.set
                    return (
                      <button
                        key={j}
                        onClick={() => !here && update((x, n) => jumpTo(x, { ex: i, set: j }, n))}
                        className={`flex-1 rounded-xl px-1 py-2 text-center leading-none ${
                          here ? 'border-[1.5px] border-accent' : s.status === 'done' ? 'bg-surface2' : s.status === 'skipped' ? 'opacity-40' : 'border border-dashed border-outline'
                        }`}
                        aria-label={`Set ${j + 1}`}
                      >
                        <span className={`block text-[10px] ${here ? 'text-accent' : 'text-muted'}`}>Set {j + 1}</span>
                        <span className={`mt-1 block text-[13px] font-semibold tabular-nums ${s.status === 'todo' && !here ? 'text-faint' : 'text-ink'}`}>
                          {e.type === 'time' ? `${s.sec}s` : e.weighted && s.weight ? `${s.reps} × ${fmtNum(s.weight)}` : `${s.reps} reps`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Everything that isn't needed every set: last time, bests, plan edits, finish.
function More({ session, update, onAdd, onFinish, onDiscard }) {
  const { state } = useApp()
  const [open, setOpen] = useState(false)
  const cur = currentSet(session)
  const ex = cur?.ex
  const best = ex ? bestLifts(state.workouts, ex.exId) : null
  const hasDone = ex?.sets.some((s) => s.status === 'done')
  return (
    <section className="mt-3">
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary h-12 w-full text-[14px]">
        {open ? 'Show less' : 'See more: history, bests and options'}
        <Icon name="chevronDown" size={15} strokeWidth={2.2} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2.5 animate-fade-in">
          {ex && (
            <div className="rounded-tuck bg-surface px-4">
              <InfoRow label="Last time" value={ex.last ? `${describeSets({ ...ex, sets: ex.last.sets }, session.unit)} · ${MONTHS[fromKey(ex.last.date).getMonth()]} ${fromKey(ex.last.date).getDate()}` : 'First time doing this'} />
              <InfoRow label="Best" value={!best || !(best.weight || best.reps || best.sec) ? 'No best yet' : ex.type === 'time' ? `${best.sec}s` : ex.weighted ? `${fmtNum(best.weight)} ${session.unit}` : `${best.reps} reps`} />
              <InfoRow label="Rest between sets" value={`${ex.restSec}s`} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {ex && <button onClick={() => update((s) => addSet(s))} className="chip h-11 justify-center bg-surface"><Icon name="plus" size={14} strokeWidth={2.4} />Add a set</button>}
            {ex && <button onClick={() => update(skipExercise)} className="chip h-11 justify-center bg-surface"><Icon name="skip" size={13} />Skip exercise</button>}
            <button onClick={onAdd} className="chip h-11 justify-center bg-surface"><Icon name="plus" size={14} strokeWidth={2.4} />Add exercise</button>
            {ex && !hasDone && session.exercises.length > 1 && (
              <button onClick={() => update((s) => removeExercise(s, session.cursor.ex))} className="chip h-11 justify-center bg-surface"><Icon name="trash" size={14} />Remove this one</button>
            )}
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-2 pt-1">
            <button onClick={onDiscard} className="btn-danger-ghost h-12">Discard</button>
            <button onClick={onFinish} className="btn-primary h-12">Finish workout</button>
          </div>
        </div>
      )}
    </section>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="row-line flex items-center justify-between gap-3 py-3">
      <span className="text-[14px] text-muted">{label}</span>
      <span className="text-right text-[14px] font-medium text-ink">{value}</span>
    </div>
  )
}
