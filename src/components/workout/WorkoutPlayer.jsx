// Focused workout player: one exercise, its dose and the next action.
// The full plan, editing tools and session stats live in the workout menu.

import { useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import {
  WEIGHT_STEP,
  addSet,
  adjustTimer,
  appendExercise,
  bestLifts,
  completeSet,
  currentSet,
  describeSets,
  elapsedMs,
  finish,
  fmtClock,
  fmtNum,
  jumpTo,
  keepGoing,
  lastPerformance,
  makeSessionExercise,
  nextStep,
  pause,
  removeExercise,
  resume,
  roundInfo,
  setCounts,
  skipExercise,
  skipRest,
  startSetTimer,
  suggestTarget,
  totals,
  unskipExercise,
  updateSet,
  undoLastSet,
  beginPrepared,
} from '../../lib/workout.js'
import { MONTHS, fromKey } from '../../lib/date.js'
import { unlockAudio } from '../../lib/coach.js'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import Modal from '../Modal.jsx'
import { BigStepper } from '../Ink.jsx'
import ExercisePicker from './ExercisePicker.jsx'
import FormSheet from './FormSheet.jsx'
import WorkoutSummary from './WorkoutSummary.jsx'
import WorkoutAdjustments from './WorkoutAdjustments.jsx'
import { DUMBBELL_MOVES, availableLoads, fitAvailableLoad } from '../../lib/preferences.js'
import useDialogAccessibility from '../useDialogAccessibility.js'
import { movementAllowed } from '../../lib/movement-preferences.js'
import { loadKind, plateBreakdown, startingLoadChoices, stepLoad } from '../../lib/starting-loads.js'
import { exerciseNote } from '../../lib/exercise-notes.js'
import { recordPlaceLabel } from '../../lib/places.js'

export default function WorkoutPlayer({ session, now, onMinimize, onSaved }) {
  const { state, dispatch } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingAt, setEditingAt] = useState(null)
  const [adjustment, setAdjustment] = useState(null)
  const update = (fn) => {
    unlockAudio()
    dispatch({
      type: 'SET_ACTIVE_WORKOUT',
      session: fn(state.activeWorkout, Date.now()),
    })
  }

  function addExercise(def) {
    if (!movementAllowed(def.id, session.movement)) return
    const item =
      def.type === 'time'
        ? { exId: def.id, sets: 3, sec: 30, restSec: 45 }
        : { exId: def.id, sets: 3, reps: 10, restSec: 90 }
    if (session.schedule?.lighter) {
      item.sets = session.schedule.muscles?.includes(def.muscle) ? 1 : 2
      if (def.type === 'time') item.sec = 20
      else item.reps = 8
    }
    item.unilateral = ['split-squat', 'seated-knee-extension'].includes(def.id)
    const last = lastPerformance(state.workouts, def.id, session.unit)
    const { target, note, up } = session.schedule?.lighter
      ? {
          target: {
            reps: item.reps,
            sec: item.sec,
            weight:
              def.weighted && last ? Math.max(...last.sets.map((s) => s.weight || 0)) * 0.85 || null : null,
          },
          note: 'Lighter around your activity.',
          up: false,
        }
      : suggestTarget(def, item, last, session.unit)
    if (DUMBBELL_MOVES.includes(def.id))
      target.weight = fitAvailableLoad(
        target.weight,
        availableLoads(
          session.equipmentProfile || state.settings.training,
          session.location || state.settings.training.location,
        ),
      )
    update((s) => appendExercise(s, makeSessionExercise(def, item, target, { last, note, up })))
  }

  if (session.phase === 'done') {
    return (
      <Screen onClose={onMinimize}>
        <WorkoutSummary
          session={session}
          now={now}
          onKeepGoing={() => update(keepGoing)}
          onClose={onMinimize}
          onSaved={onSaved}
          onAddExercise={() => setPicking(true)}
        />
        <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addExercise} />
      </Screen>
    )
  }

  const cur = currentSet(session)
  const { done, total } = setCounts(session)
  const paused = Boolean(session.pausedAt)

  return (
    <Screen onClose={onMinimize}>
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <button onClick={onMinimize} className="icon-btn" aria-label="Minimize workout">
          <Icon name="chevronDown" size={20} strokeWidth={2.2} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[17px] font-semibold">{session.name}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {cur
              ? roundInfo(session)
                ? `Round ${roundInfo(session).round} of ${roundInfo(session).rounds}`
                : `Exercise ${session.cursor.ex + 1} of ${session.exercises.length}`
              : 'Add your first exercise'}
          </p>
        </div>
        {session.startedAt && session.phase !== 'prepared' && !paused && (
          <button
            onClick={() => update(paused ? resume : pause)}
            className="icon-btn h-11 w-11"
            aria-label={paused ? 'Resume workout' : 'Pause workout'}
          >
            <Icon name={paused ? 'play' : 'pause'} size={17} />
          </button>
        )}
        <button onClick={() => setMenuOpen(true)} className="icon-btn h-11 w-11" aria-label="Workout menu">
          <Icon name="more" size={21} />
        </button>
      </header>

      {/* Progress */}
      {total > 0 && (
        <div
          className="mt-5 h-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Completed sets"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* Current step */}
      {session.phase === 'between' ? (
        <section className="workout-intermission my-auto py-8">
          <span className="icon-tile mb-5 text-accent">
            <Icon name="check" size={24} />
          </span>
          <p className="text-[14px] text-muted">{cur?.ex.name}</p>
          <h2 className="mt-2 font-display text-[32px]">Exercise logged</h2>
          <p className="mt-3 text-[15px] text-muted">Add another or finish up.</p>
          <button className="btn-primary mt-7 min-h-14 w-full" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} />
            Add next exercise
          </button>
          <button
            className="btn-secondary mt-3 min-h-12 w-full"
            onClick={() => update((s, n) => keepGoing(addSet(s), n))}
          >
            Another set of this exercise
          </button>
          <button className="btn-ghost mt-3 min-h-12 w-full" onClick={() => update(finish)}>
            Finish & review
          </button>
          {session.lastLogged && (
            <button className="btn-ghost min-h-11 w-full text-[14px]" onClick={() => update(undoLastSet)}>
              Undo last set
            </button>
          )}
        </section>
      ) : session.phase === 'prepared' ? (
        <section className="workout-intermission mt-7 rounded-hero bg-surface p-5">
          <span className="icon-tile mb-5 !h-14 !w-14 !rounded-2xl text-accent">
            <Icon name="train" size={28} />
          </span>
          <h2 className="font-display text-[30px]">Ready to start</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'} ·{' '}
            {session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.status !== 'skipped').length, 0)}{' '}
            sets
          </p>
          <p className="mt-3 text-[13px] text-muted">Start easy. Timers start when you tap.</p>
          <button className="btn-primary mt-5 h-14 w-full" onClick={() => update(beginPrepared)}>
            Start session
          </button>
        </section>
      ) : !cur ? (
        <EmptyStart onAdd={() => setPicking(true)} />
      ) : paused ? (
        <Paused session={session} onResume={() => update(resume)} />
      ) : session.phase === 'ready' ? (
        <Countdown
          title="Get ready"
          sub={cur.ex.name}
          ms={Math.min(session.phaseTotal, session.phaseEndsAt - now)}
          total={session.phaseTotal}
          onSkip={() => update(skipRest)}
          skipLabel="Start now"
        />
      ) : session.phase === 'rest' ? (
        <Rest session={session} now={now} update={update} />
      ) : (
        <Work
          session={session}
          now={now}
          update={update}
          onForm={() => setFormOpen(true)}
          onEdit={() => setEditing(true)}
        />
      )}

      <More
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        session={session}
        update={update}
        onPlan={() => {
          setMenuOpen(false)
          setPlanOpen(true)
        }}
        onForm={() => {
          setMenuOpen(false)
          setFormOpen(true)
        }}
        onAdd={() => {
          setMenuOpen(false)
          setPicking(true)
        }}
        onReplace={() => {
          setMenuOpen(false)
          setAdjustment('swap')
        }}
        onShorten={() => {
          setMenuOpen(false)
          setAdjustment('shorten')
        }}
        onLog={() => {
          setMenuOpen(false)
          update(completeSet)
        }}
        canFinish={done > 0}
        onFinish={() => {
          setMenuOpen(false)
          update(finish)
        }}
        onDiscard={() => {
          setMenuOpen(false)
          setConfirm(true)
        }}
      />
      <Modal open={planOpen} onClose={() => setPlanOpen(false)} title="Your plan">
        <Plan
          session={session}
          onEditLogged={(coord) => {
            setPlanOpen(false)
            setEditingAt(coord)
            setEditing(true)
          }}
          update={(fn) => {
            update(fn)
            setPlanOpen(false)
          }}
        />
      </Modal>
      {editing && (editingAt ? session.exercises[editingAt.ex] : cur?.ex) && (
        <EditSet
          key={editingAt ? `${editingAt.ex}:${editingAt.set}` : `${cur.ex.key}:${session.cursor.set}`}
          exercise={editingAt ? session.exercises[editingAt.ex] : cur.ex}
          set={editingAt ? session.exercises[editingAt.ex].sets[editingAt.set] : cur.set}
          unit={session.unit}
          loads={availableLoads(
            session.equipmentProfile || state.settings.training,
            session.location || state.settings.training.location,
          )}
          onClose={() => {
            setEditing(false)
            setEditingAt(null)
          }}
          onSave={(patch) => {
            update((s) =>
              editingAt
                ? {
                    ...s,
                    exercises: s.exercises.map((e, i) =>
                      i === editingAt.ex
                        ? { ...e, sets: e.sets.map((v, j) => (j === editingAt.set ? { ...v, ...patch } : v)) }
                        : e,
                    ),
                  }
                : updateSet(s, patch),
            )
            setEditing(false)
            setEditingAt(null)
          }}
        />
      )}
      {adjustment && (
        <WorkoutAdjustments
          key={adjustment}
          mode={adjustment}
          session={session}
          onClose={() => setAdjustment(null)}
          onApply={(fn) => {
            update(fn)
            setAdjustment(null)
          }}
        />
      )}

      <FormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        exercise={cur?.ex}
        location={session.location}
        placeName={session.placeName || recordPlaceLabel(session)}
      />
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={addExercise}
        filterExercise={session.movement ? (e) => movementAllowed(e.id, session.movement) : undefined}
      />
      <ConfirmDialog
        open={confirm}
        title={done > 0 ? 'Discard workout?' : 'End this workout?'}
        message={
          done > 0
            ? `You’ve logged ${done} set${done === 1 ? '' : 's'}. Discarding won’t save them.`
            : 'Nothing has been logged yet, so there’s nothing to save.'
        }
        confirmLabel={done > 0 ? 'Discard' : 'End workout'}
        onConfirm={() => dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })}
        onClose={() => setConfirm(false)}
      />
    </Screen>
  )
}

function Screen({ children, onClose }) {
  const screen = useRef(null)
  useDialogAccessibility(screen, true, onClose)
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-bg animate-fade-in"
      role="dialog"
      ref={screen}
      tabIndex={-1}
      aria-modal="true"
      aria-label="Workout"
    >
      <div className="workout-screen mx-auto flex min-h-[100dvh] max-w-xl flex-col px-[22px] pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),18px)]">
        {children}
      </div>
    </div>
  )
}

function EmptyStart({ onAdd }) {
  return (
    <section className="workout-intermission mt-7 rounded-hero bg-surface p-6 text-center">
      <h2 className="font-display text-[26px]">Log a workout</h2>
      <p className="mx-auto mt-1 max-w-xs text-[14px] text-muted">Add an exercise to start logging sets.</p>
      <button onClick={onAdd} className="btn-primary mt-5 h-[52px] w-full">
        <Icon name="plus" size={18} strokeWidth={2.4} />
        Add exercise
      </button>
    </section>
  )
}

function Paused({ session, onResume }) {
  const cur = currentSet(session)
  return (
    <section className="workout-intermission mt-7 rounded-hero bg-surface p-6 text-center">
      <h2 className="font-display text-[30px]">Paused</h2>
      {session.pauseReason && <p className="mt-2 text-[13px] text-muted">{session.pauseReason}</p>}
      {cur && (
        <p className="mt-1 text-[14px] text-muted">
          {session.phase === 'rest' ? 'Resting before' : 'On'} {cur.ex.name}, set {session.cursor.set + 1} of{' '}
          {cur.ex.sets.length}
        </p>
      )}
      {session.phaseLeft != null && <p className="num mt-3 text-[40px]">{fmtClock(session.phaseLeft)}</p>}
      <button onClick={onResume} className="btn-primary mt-5 h-[52px] w-full">
        <Icon name="play" size={14} filled strokeWidth={0} />
        Resume
      </button>
    </section>
  )
}

// Big countdown with a thin progress bar under it.
function Countdown({ title, sub, ms, total, onSkip, skipLabel, children, calm = false }) {
  const p = total ? Math.max(0, Math.min(1, ms / total)) : 0
  return (
    <section className="workout-intermission mt-7 rounded-hero bg-surface p-6 text-center">
      <p className="text-[13px] text-muted">{title}</p>
      {sub && <h2 className="mt-1 font-display text-[26px] leading-tight">{sub}</h2>}
      <p
        className={`num mt-3 leading-none ${calm ? 'text-[48px] text-ink2' : 'text-[clamp(88px,30vw,128px)]'}`}
        role="timer"
        aria-label={`${title}: ${fmtClock(ms)} left`}
      >
        {fmtClock(ms)}
      </p>
      <div className="mx-auto mt-6 h-1.5 max-w-[280px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full origin-left rounded-full bg-accent transition-transform duration-100 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${p})` }}
        />
      </div>
      {children}
      <button onClick={onSkip} className="btn-primary mt-5 h-[52px] w-full">
        {skipLabel}
      </button>
    </section>
  )
}

function Rest({ session, now, update }) {
  const { state } = useApp()
  const cur = currentSet(session)
  return (
    <Countdown
      title="Rest"
      calm={state.settings.workout.calmRest === true}
      ms={Math.min(session.phaseTotal, session.phaseEndsAt - now)}
      total={session.phaseTotal}
      onSkip={() => update(skipRest)}
      skipLabel="Ready for the next set"
    >
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={() => update((s, n) => adjustTimer(s, -15, n))} className="chip bg-surface2">
          −15s
        </button>
        <button onClick={() => update((s, n) => adjustTimer(s, 15, n))} className="chip bg-surface2">
          +15s
        </button>
      </div>
      {cur && (
        <div className="mt-6 rounded-2xl bg-surface2 px-4 py-3 text-left">
          <p className="text-[12px] text-muted">
            Up next · set {session.cursor.set + 1} of {cur.ex.sets.length}
          </p>
          <p className="mt-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[16px] font-semibold">{cur.ex.name}</span>
            <span className="num shrink-0 text-[18px]">
              {cur.ex.type === 'time'
                ? `${cur.set.sec}s`
                : `${cur.set.reps}${cur.set.weight ? ` × ${fmtNum(cur.set.weight)} ${session.unit}` : ' reps'}`}
            </span>
          </p>
        </div>
      )}
      <p className="mt-3 text-[13px] text-muted">Take as long as you need.</p>
      {session.lastLogged && (
        <button className="btn-ghost mt-2 min-h-11 w-full text-[14px]" onClick={() => update(undoLastSet)}>
          Undo last set
        </button>
      )}
    </Countdown>
  )
}

function Work({ session, now, update, onForm, onEdit }) {
  const { state } = useApp()
  const { ex, set } = currentSet(session)
  const unit = session.unit
  const timed = ex.type === 'time'
  const running = timed && session.phaseEndsAt
  const left = running ? session.phaseEndsAt - now : 0
  const asDone = {
    ...session,
    exercises: session.exercises.map((e, i) =>
      i !== session.cursor.ex
        ? e
        : {
            ...e,
            sets: e.sets.map((s, j) => (j === session.cursor.set ? { ...s, status: 'done' } : s)),
          },
    ),
  }
  const isLast = !nextStep(asDone, session.cursor)
  const doseLength = Math.max(String(set.reps || 0).length, set.weight ? fmtNum(set.weight).length : 1)
  const doseSize =
    !timed && ex.weighted
      ? `clamp(${doseLength > 5 ? 24 : 36}px, ${Math.min(20, 48 / doseLength)}vw, ${Math.min(88, 192 / doseLength)}px)`
      : 'clamp(72px, 26vw, 112px)'

  const complete = () => {
    if (timed && running)
      update((s, n) =>
        completeSet(s, n, {
          sec: Math.max(1, Math.round((session.phaseTotal - left) / 1000)),
        }),
      )
    else update((s, n) => completeSet(s, n))
  }

  return (
    <section className="workout-stage mt-7 flex flex-1 flex-col">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="badge h-7 px-3 text-[14px]">
          {set.kind === 'warmup' ? 'Warmup · ' : ''}Set{' '}
          {ex.sets.slice(0, session.cursor.set + 1).filter((s) => s.status !== 'skipped').length} of{' '}
          {ex.sets.filter((s) => s.status !== 'skipped').length}
        </span>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <h2 className="min-w-0 font-display text-[clamp(32px,11vw,48px)] leading-[1.08]">{ex.name}</h2>
      </div>
      {ex.phaseLabel && <p className="mt-2 text-[13px] text-accent">{ex.phaseLabel}</p>}
      {ex.last && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Last: {describeSets({ ...ex, sets: ex.last.sets }, unit)}
        </p>
      )}
      {exerciseNote(state.settings.exerciseNotes, ex.exId, session.location) && (
        <p className="mt-2 text-[14px] leading-relaxed text-ink2">
          {exerciseNote(state.settings.exerciseNotes, ex.exId, session.location)}
        </p>
      )}
      {ex.sideExtra && session.cursor.set === ex.sets.length - 1 && (
        <p className="mt-2 text-[13px] text-accent">
          Optional: one extra {ex.sideExtra.side}-side rep, only if comfortable.
        </p>
      )}

      {running ? (
        <div className="workout-dose mt-6 flex flex-1 flex-col items-center justify-center rounded-hero bg-surface px-5 py-8 text-center">
          <p className="num text-[clamp(76px,26vw,112px)] leading-none">{fmtClock(left)}</p>
          <p className="mt-5 text-[16px] text-muted">Move at a comfortable pace.</p>
        </div>
      ) : (
        <div
          className="workout-dose mt-6 flex w-full flex-1 flex-col justify-center rounded-hero bg-surface px-5 py-8 text-center"
          style={{ '--workout-dose-size': doseSize }}
          role="group"
          aria-label="Current set targets"
        >
          <span className="flex w-full items-center justify-center gap-5">
            <span className="min-w-0 flex-1">
              <span className="num block text-[length:var(--workout-dose-size)] leading-none">
                {timed ? fmtClock(set.sec * 1000) : set.reps}
              </span>
              <span className="mt-4 block text-[16px] text-muted">
                {timed ? 'duration' : ex.unilateral ? 'reps / side' : 'reps'}
              </span>
            </span>
            {!timed && ex.weighted && (
              <>
                <span className="h-24 w-px shrink-0 bg-line" />
                <span className="min-w-0 flex-1">
                  <span className="num block text-[length:var(--workout-dose-size)] leading-none">
                    {set.weight ? fmtNum(set.weight) : '—'}
                  </span>
                  <span className="mt-4 block text-[16px] text-muted">
                    {set.weight
                      ? `${unit}${DUMBBELL_MOVES.includes(ex.exId) ? ' / hand' : ''}`
                      : 'choose weight'}
                  </span>
                  {set.weight > 0 && loadKind(ex.exId) === 'barbell' && (
                    <PlateLine weight={set.weight} unit={unit} className="mt-1 !text-[12px]" />
                  )}
                </span>
              </>
            )}
          </span>
          <button
            className="mx-auto mt-3 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[14px] font-semibold text-accent"
            onClick={onEdit}
          >
            <Icon name="edit" size={16} />
            Edit numbers{set.kind === 'warmup' ? ' · warmup' : ''}
          </button>
        </div>
      )}

      <div className="workout-action-dock">
        {timed && !running ? (
          <button
            onClick={() => update(startSetTimer)}
            className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]"
          >
            <Icon name="play" size={13} filled strokeWidth={0} />
            Start exercise
          </button>
        ) : (
          <button
            onClick={ex.weighted && !set.weight ? onEdit : complete}
            className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]"
          >
            {ex.weighted && !set.weight
              ? 'Choose starting weight'
              : timed
                ? 'Done early'
                : isLast
                  ? 'Log last set'
                  : 'Log set'}
          </button>
        )}
        <button
          onClick={onForm}
          className="mt-2 flex min-h-[52px] w-full shrink-0 items-center gap-3 rounded-[18px] border border-accent/40 bg-accent/10 px-4 py-2 text-left text-accent"
        >
          <span className="dot h-9 w-9 bg-accent/15">
            <Icon name="list" size={19} />
          </span>
          <span className="flex-1 text-[16px] font-semibold">Exercise guide</span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </section>
  )
}

function Plan({ session, update, onEditLogged }) {
  const cur = session.cursor
  const [expanded, setExpanded] = useState(cur?.ex)
  const doneEx = session.exercises.filter((e) => e.sets.every((s) => s.status !== 'todo')).length
  return (
    <section className="mt-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] text-muted">Exercises completed</h2>
        <span className="text-[13px] text-muted">
          {doneEx} of {session.exercises.length}
        </span>
      </div>
      <div className="mt-2.5 rounded-tuck bg-surface px-4">
        {session.exercises.map((e, i) => {
          const isCur = cur?.ex === i
          const allDone = e.sets.every((s) => s.status === 'done')
          const skipped = e.sets.every((s) => s.status === 'skipped')
          const firstTodo = e.sets.findIndex((s) => s.status === 'todo')
          const planText =
            e.type === 'time'
              ? `${e.sets.filter((s) => s.status !== 'skipped').length} × ${e.sets[0].sec}s`
              : `${e.sets.filter((s) => s.status !== 'skipped').length} × ${e.sets[0].reps}`
          return (
            <div key={e.key} className={i ? 'border-t border-line' : ''}>
              <button
                onClick={() =>
                  skipped
                    ? update((s) => unskipExercise(s, i))
                    : allDone
                      ? setExpanded(expanded === i ? null : i)
                      : firstTodo >= 0 && !isCur && update((s, n) => jumpTo(s, { ex: i, set: firstTodo }, n))
                }
                className="flex w-full items-center gap-3.5 py-3.5 text-left"
              >
                <span
                  className={`dot h-6 w-6 ${allDone ? 'bg-ink text-on-paper' : isCur ? 'border-2 border-accent' : 'border-[1.5px] border-outline'}`}
                >
                  {allDone && <Icon name="check" size={12} strokeWidth={3} />}
                  {isCur && !allDone && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-[15px] ${isCur ? 'font-bold' : 'font-medium'} ${allDone || skipped ? 'text-faint' : ''} ${skipped ? 'line-through' : ''}`}
                >
                  {e.name}
                </span>
                <span className="text-[13px] tabular-nums text-muted">{skipped ? 'Restore' : planText}</span>
              </button>
              {(isCur || expanded === i) && (
                <div className="-mt-1 flex flex-wrap gap-2 pb-3.5">
                  {e.sets.map((s, j) => {
                    const here = j === cur.set
                    return (
                      <button
                        key={j}
                        onClick={() =>
                          s.status === 'done'
                            ? onEditLogged({ ex: i, set: j })
                            : !here && update((x, n) => jumpTo(x, { ex: i, set: j }, n))
                        }
                        className={`min-h-12 min-w-[64px] flex-1 rounded-xl px-2 py-2 text-center leading-none ${
                          here
                            ? 'border-[1.5px] border-accent'
                            : s.status === 'done'
                              ? 'bg-surface2'
                              : s.status === 'skipped'
                                ? 'opacity-40'
                                : 'border border-dashed border-outline'
                        }`}
                        aria-label={`${s.status === 'done' ? 'Edit logged' : 'Go to'} set ${j + 1}`}
                      >
                        <span className={`block text-[10px] ${here ? 'text-accent' : 'text-muted'}`}>
                          Set {j + 1}
                        </span>
                        <span
                          className={`mt-1 block text-[13px] font-semibold tabular-nums ${s.status === 'todo' && !here ? 'text-faint' : 'text-ink'}`}
                        >
                          {e.type === 'time'
                            ? `${s.sec}s`
                            : e.weighted && s.weight
                              ? `${s.reps} × ${fmtNum(s.weight)}`
                              : `${s.reps} reps`}
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

// The player keeps only the current exercise visible. Other actions live here.
function More({
  open,
  onClose,
  session,
  update,
  onPlan,
  onForm,
  onAdd,
  onReplace,
  onShorten,
  onLog,
  onFinish,
  onDiscard,
  canFinish,
}) {
  const { state, dispatch } = useApp()
  const [panel, setPanel] = useState('main')
  const [skipping, setSkipping] = useState(false)
  const close = () => {
    setPanel('main')
    onClose()
  }
  const cur = currentSet(session)
  const ex = cur?.ex
  const best = ex ? bestLifts(state.workouts, ex.exId) : null
  const hasDone = ex?.sets.some((s) => s.status === 'done')
  const t = totals(session.exercises)
  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={panel === 'main' ? 'Workout menu' : 'More controls'}
        bodyKey={panel}
        footer={
          <button
            className="btn-primary h-12 w-full"
            onClick={() => (panel === 'main' ? close() : setPanel('main'))}
          >
            {panel === 'main' ? 'Back to workout' : 'Back to menu'}
          </button>
        }
      >
        {panel === 'main' ? (
          <div className="mt-3 divide-y divide-line">
            <MenuRow
              label="View full plan"
              detail={`${session.exercises.length} ${session.exercises.length === 1 ? 'exercise' : 'exercises'}`}
              onClick={onPlan}
            />
            {ex && (
              <MenuRow label="Exercise guide" detail="Instructions and why it’s included" onClick={onForm} />
            )}
            {ex && session.phase !== 'prepared' && (
              <MenuRow
                label="Replace exercise"
                detail="Equipment busy or prefer another movement"
                onClick={onReplace}
              />
            )}
            <MenuRow label="Add exercise" onClick={onAdd} />
            <details className="py-1">
              <summary className="min-h-12 cursor-pointer py-3 text-[15px] font-semibold">
                Sound & rest display
              </summary>
              <div className="flex flex-wrap gap-2 pb-3">
                {[
                  ['Quiet', false, false],
                  ['Sounds', true, false],
                  ['Spoken', true, true],
                ].map(([label, sound, voice]) => (
                  <button
                    key={label}
                    className={`chip ${state.settings.workout.sound === sound && state.settings.workout.voice === voice ? 'chip-active' : 'bg-surface2'}`}
                    aria-pressed={
                      state.settings.workout.sound === sound && state.settings.workout.voice === voice
                    }
                    onClick={() =>
                      dispatch({
                        type: 'UPDATE_SETTINGS',
                        patch: { workout: { ...state.settings.workout, sound, voice } },
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex min-h-12 items-center gap-3 pb-3 text-[14px]">
                <input
                  type="checkbox"
                  checked={state.settings.workout.calmRest === true}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_SETTINGS',
                      patch: { workout: { ...state.settings.workout, calmRest: e.target.checked } },
                    })
                  }
                />
                Smaller rest countdown
              </label>
            </details>
            {session.phase !== 'prepared' &&
              (canFinish ? (
                <MenuRow
                  label="Finish & review"
                  detail="Review your logged sets before saving"
                  onClick={onFinish}
                />
              ) : (
                <MenuRow
                  label="End workout"
                  detail="Nothing logged yet, so nothing to save"
                  onClick={onDiscard}
                />
              ))}
            {!['sport', 'manual'].includes(session.kind) && (
              <MenuRow
                label="I have less time"
                detail="Shorten only the work that is left"
                onClick={onShorten}
              />
            )}
            {ex && session.phase !== 'prepared' && (
              <MenuRow
                label="Skip this exercise"
                onClick={() => {
                  onClose()
                  setSkipping(true)
                }}
              />
            )}
            <MenuRow
              label="More controls"
              detail="Edit the plan, history and session stats"
              onClick={() => setPanel('controls')}
            />
          </div>
        ) : (
          <>
            <div className="mt-3 divide-y divide-line">
              {ex && (
                <MenuRow
                  label="Add a set"
                  onClick={() => {
                    update((s, n) =>
                      ['between', 'done'].includes(s.phase) ? keepGoing(addSet(s), n) : addSet(s),
                    )
                    onClose()
                  }}
                />
              )}
              <MenuRow label="Add exercise" onClick={onAdd} />
              {ex && !hasDone && session.exercises.length > 1 && (
                <MenuRow
                  label="Remove current exercise"
                  onClick={() => {
                    update((s) => removeExercise(s, session.cursor.ex))
                    onClose()
                  }}
                />
              )}
              {ex?.type === 'time' &&
                session.phase === 'work' &&
                !session.pausedAt &&
                !session.phaseEndsAt && (
                  <MenuRow
                    label="Log without a timer"
                    detail="Record the duration you completed yourself"
                    onClick={onLog}
                  />
                )}
            </div>
            <details className="mt-3 rounded-tuck bg-surface2 px-4">
              <summary className="cursor-pointer py-4 text-[14px] font-semibold">
                History & session stats
              </summary>
              {ex && (
                <>
                  <InfoRow
                    label="Last time"
                    value={
                      ex.last
                        ? `${describeSets({ ...ex, sets: ex.last.sets }, session.unit)} · ${MONTHS[fromKey(ex.last.date).getMonth()]} ${fromKey(ex.last.date).getDate()}`
                        : 'First time doing this'
                    }
                  />
                  <InfoRow
                    label="Best"
                    value={
                      !best || !(best.weight || best.reps || best.sec)
                        ? 'No best yet'
                        : ex.type === 'time'
                          ? `${best.sec}s`
                          : ex.weighted
                            ? `${fmtNum(best.weight)} ${session.unit}`
                            : `${best.reps} reps`
                    }
                  />
                  <InfoRow label="Rest between sets" value={`${ex.restSec}s`} />
                </>
              )}
              <InfoRow label="Sets completed" value={String(t.sets)} />
              <InfoRow label="Weight moved" value={`${fmtNum(t.volume)} ${session.unit}`} />
              <InfoRow label="Session time (breaks excluded)" value={fmtClock(elapsedMs(session))} />
            </details>
            <button className="btn-danger-ghost mt-4 min-h-11 w-full" onClick={onDiscard}>
              Discard workout
            </button>
          </>
        )}
      </Modal>
      <Modal
        open={skipping}
        onClose={() => setSkipping(false)}
        title="Why skip this one?"
        subtitle="Optional. This helps adjust future sessions."
      >
        <div className="mt-3 divide-y divide-line">
          {[
            ['time', 'Short on time'],
            ['soreness', 'Sore or feels overworked'],
            ['pain', 'Pain or discomfort'],
            ['equipment', 'Equipment unavailable'],
            ['dislike', 'Prefer something else'],
            ['other', 'Skip without a reason'],
          ].map(([value, label]) => (
            <MenuRow
              key={value}
              label={label}
              onClick={() => {
                update((s, n) => skipExercise(s, n, value))
                setSkipping(false)
              }}
            />
          ))}
        </div>
      </Modal>
    </>
  )
}

function MenuRow({ label, detail, onClick }) {
  return (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 py-4 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {detail && <span className="mt-1 block text-[12px] text-muted">{detail}</span>}
      </span>
      <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
    </button>
  )
}

function EditSet({ exercise, set, unit, loads = [], onSave, onClose }) {
  const [reps, setReps] = useState(set.reps)
  const [sec, setSec] = useState(set.sec)
  const [weight, setWeight] = useState(set.weight)
  const [setKind, setSetKind] = useState(set.kind || 'work')
  const dumbbell = DUMBBELL_MOVES.includes(exercise.exId)
  const ownLoads = dumbbell ? loads : []
  const choices = exercise.weighted && !set.weight ? startingLoadChoices(exercise.exId, unit, ownLoads) : []
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit this set"
      subtitle={exercise.name}
      footer={
        <button
          className="btn-primary h-12 w-full"
          disabled={
            exercise.type === 'time' ? !(sec > 0) : !(reps > 0) || (exercise.weighted && !(weight > 0))
          }
          onClick={() =>
            onSave(
              exercise.type === 'time'
                ? { sec, kind: setKind }
                : { reps, kind: setKind, ...(exercise.weighted ? { weight } : {}) },
            )
          }
        >
          Update set
        </button>
      }
    >
      <div className="segmented mt-3" role="radiogroup" aria-label="Set type">
        {[
          ['work', 'Working set'],
          ['warmup', 'Warm-up set'],
        ].map(([value, label]) => (
          <button
            key={value}
            role="radio"
            aria-checked={setKind === value}
            className={`segment ${setKind === value ? 'segment-active' : ''}`}
            onClick={() => setSetKind(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {setKind === 'warmup' && (
        <p className="mt-2 text-[13px] text-muted">Saved, but not counted toward records.</p>
      )}
      {choices.length > 0 && (
        <div className="mt-5">
          <p className="text-[14px] font-semibold">Pick a starting weight</p>
          <p className="mt-1 text-[13px] text-muted">
            {dumbbell ? 'Per dumbbell. ' : loadKind(exercise.exId) === 'barbell' ? 'Including the bar. ' : ''}
            Choose one you can move with control; you can change it after a set.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {choices.map((v) => (
              <button
                key={v}
                aria-pressed={weight === v}
                className={`chip justify-center ${weight === v ? 'chip-active' : 'bg-surface2'}`}
                onClick={() => setWeight(v)}
              >
                {fmtNum(v)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex overflow-hidden rounded-hero bg-surface2">
        {exercise.type === 'time' ? (
          <BigStepper label="seconds" value={sec} min={5} step={5} onChange={setSec} />
        ) : (
          <>
            <BigStepper
              label={exercise.unilateral ? 'reps per side' : 'reps'}
              value={reps}
              onChange={setReps}
            />
            {exercise.weighted && (
              <>
                <span className="w-px bg-line" />
                <BigStepper
                  label={dumbbell ? `${unit} each` : unit}
                  value={weight}
                  step={WEIGHT_STEP[unit] || 5}
                  decimals
                  onChange={setWeight}
                  stepTo={(v, direction) => stepLoad(v, direction, WEIGHT_STEP[unit] || 5, ownLoads)}
                />
              </>
            )}
          </>
        )}
      </div>
      {loadKind(exercise.exId) === 'barbell' && <PlateLine weight={weight} unit={unit} className="mt-3" />}
    </Modal>
  )
}
// "45 lb bar + 25 + 10 each side": no mental maths between sets.
function PlateLine({ weight, unit, className = '' }) {
  const load = plateBreakdown(weight, unit)
  if (!load) return null
  return (
    <p className={`text-center text-[13px] text-muted ${className}`}>
      {load.plates.length
        ? `${load.bar} ${unit} bar + ${load.plates.map(fmtNum).join(' + ')} each side`
        : `Just the ${load.bar} ${unit} bar`}
      {!load.exact && ' · nearest with standard plates'}
    </p>
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
