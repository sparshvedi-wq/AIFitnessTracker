// Focused workout player: one exercise, its dose and the next action.
// The full plan, editing tools and session stats live in the workout menu.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import {
  WEIGHT_STEP,
  addSet,
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
  undoLastSet,
  beginPrepared,
  isAssisted,
  loadReady,
  startAfterIntro,
} from '../../lib/workout.js'
import { MONTHS, fromKey } from '../../lib/date.js'
import { unlockAudio } from '../../lib/coach.js'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import Modal from '../Modal.jsx'
import ExercisePicker from './ExercisePicker.jsx'
import FormSheet from './FormSheet.jsx'
import WorkoutSummary from './WorkoutSummary.jsx'
import WorkoutAdjustments from './WorkoutAdjustments.jsx'
import { metaOf } from '../../lib/catalog/index.js'
import { DUMBBELL_MOVES, availableLoads, fitAvailableLoad } from '../../lib/preferences.js'
import useDialogAccessibility from '../useDialogAccessibility.js'
import { movementAllowed } from '../../lib/movement-preferences.js'
import { loadKind, plateBreakdown, startingLoadChoices, stepLoad } from '../../lib/starting-loads.js'
import { exerciseNote } from '../../lib/exercise-notes.js'
import { recordPlaceLabel } from '../../lib/places.js'
import { tallySessions } from '../../lib/milestones.js'
import FirstSessionIntro from './FirstSessionIntro.jsx'
import QuickWorkoutActions from './QuickWorkoutActions.jsx'
import { skipWithUndo, undoQuickSkip, SKIP_REASONS } from '../../lib/workout-quick-actions.js'
import { SetNumberCard, SetNumberField, WorkoutInfo } from './SetControls.jsx'
import { loggedSetStats, setEntryPatch } from '../../lib/set-entry.js'
import { exerciseThumb } from '../../lib/exercise-thumbs.js'
import useFreshTapGuard from '../useFreshTapGuard.js'
import { profileOf } from '../../lib/planner.js'
import { strengthNote, strengthTarget } from '../../lib/strength/index.js'
import {
  adaptExercise,
  applyManualEntry,
  correctLoggedReps,
  logShortSet,
  markTooHeavy,
  setWorkingWeight,
} from '../../lib/strength/session.js'
import {
  AdjustedNote,
  CouldntSheet,
  FeelPrompt,
  StrengthFacts,
  WorkingWeightSheet,
  exerciseMode,
  useStrengthContext,
} from './StrengthControls.jsx'

export default function WorkoutPlayer({ session, now, onMinimize, onSaved }) {
  const { state, dispatch, today, toast, getActiveWorkout } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingAt, setEditingAt] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [adjustment, setAdjustment] = useState(null)
  // "I couldn't do this": { coord, step } for the set it is about.
  const [couldnt, setCouldnt] = useState(null)
  const [workingWeight, setWorkingWeightOpen] = useState(false)
  const strengthCtx = useStrengthContext(session)
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
    item.unilateral = Boolean(metaOf(def.id)?.perSide && def.type === 'reps')
    const last = lastPerformance(state.workouts, def.id, session.unit)
    // The same adaptive weights as planned exercises; simple rules only for
    // timed and assisted movements the model doesn't cover.
    const p = { ...profileOf(state), ...(session.equipmentProfile || {}) }
    const live = strengthCtx()
    const adaptive = strengthTarget({
      exId: def.id,
      def,
      workouts: state.workouts,
      customExercises: state.customExercises,
      learning: state.learning,
      unit: session.unit,
      today,
      now: live.now,
      goal: p.goal,
      experience: p.experience,
      easy: Boolean(session.schedule?.lighter || live.easy),
      sizes: live.sizes,
      sets: item.sets,
    })
    if (adaptive && def.type === 'reps') {
      item.reps = adaptive.reps
      item.repRange = adaptive.range
      item.targetRir = adaptive.rir
    }
    const { target, note, up } =
      adaptive && (adaptive.weight !== null || adaptive.mode === 'reps')
        ? {
            target: { reps: adaptive.reps, sec: null, weight: adaptive.weight },
            note: session.schedule?.lighter ? 'Lighter around your activity.' : strengthNote(adaptive, session.unit),
            up: adaptive.up,
          }
        : session.schedule?.lighter
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

  // Skips the rest of the current exercise with a reason, with Undo.
  function skipWithReason(reason) {
    const live = getActiveWorkout()
    if (!live) return
    const change = skipWithUndo(live, Date.now(), reason)
    update(() => change.after)
    toast('Exercise skipped', 'info', {
      label: 'Undo',
      onClick: () => {
        const restored = undoQuickSkip(getActiveWorkout(), change)
        if (restored) dispatch({ type: 'SET_ACTIVE_WORKOUT', session: restored })
        else toast('Your workout has changed. Nothing was undone.', 'info')
      },
    })
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

  // The very first session gets one calm screen of its own before set one.
  if (
    !session.introSeen &&
    done === 0 &&
    session.exercises.length > 0 &&
    !['sport', 'manual'].includes(session.kind) &&
    !tallySessions(state.workouts, today).length
  )
    return (
      <Screen onClose={onMinimize}>
        <FirstSessionIntro
          weighted={session.exercises.some((e) => e.weighted)}
          onMinimize={onMinimize}
          // Time spent reading this screen is not training time.
          onStart={() => update(startAfterIntro)}
        />
      </Screen>
    )

  return (
    <Screen
      onClose={onMinimize}
      stepKey={`${session.id}:${session.phase}:${session.cursor?.ex}:${session.cursor?.set}:${paused}`}
    >
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
        <button
          onClick={() => setQuickOpen(true)}
          className="icon-btn h-11 w-11"
          aria-label="Quick workout actions"
        >
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
        <Rest
          session={session}
          update={update}
          strengthCtx={strengthCtx}
          onShort={(coord) => setCouldnt({ coord, step: 'reps' })}
          onQuick={() => setQuickOpen(true)}
          onForm={() => setFormOpen(true)}
          onEdit={(field) => {
            setEditingField(field)
            setEditing(true)
          }}
        />
      ) : (
        <Work
          session={session}
          now={now}
          update={update}
          strengthCtx={strengthCtx}
          onCouldnt={() => setCouldnt({ coord: session.cursor, step: 'why' })}
          onForm={() => setFormOpen(true)}
          onEdit={(field) => {
            setEditingField(field)
            setEditing(true)
          }}
          onQuick={() => setQuickOpen(true)}
        />
      )}
      {couldnt && (
        <CouldntSheet
          key={`${couldnt.coord?.ex}:${couldnt.coord?.set}:${couldnt.step}`}
          open
          session={session}
          coord={couldnt.coord}
          initialStep={couldnt.step}
          mode={exerciseMode(session.exercises[couldnt.coord?.ex], state.customExercises)}
          onClose={() => setCouldnt(null)}
          onTooHeavy={() => {
            const live = getActiveWorkout() || session
            const at = Date.now()
            const next = markTooHeavy(live, strengthCtx(at), at)
            dispatch({ type: 'SET_ACTIVE_WORKOUT', session: next })
            if (currentSet(next)?.set.weight === currentSet(live)?.set.weight)
              toast('That’s the lightest weight here. Try fewer reps, or swap it.', 'info')
          }}
          onReps={(reps) =>
            update((s, n) => {
              const c = couldnt.coord
              return s.exercises[c.ex]?.sets[c.set]?.status === 'done'
                ? correctLoggedReps(s, c, reps, strengthCtx(n))
                : logShortSet(s, reps, strengthCtx(n), n)
            })
          }
          onPain={() => skipWithReason('pain')}
          onSwap={() => setAdjustment('swap')}
          onType={() => {
            setEditingField(null)
            setEditing(true)
          }}
        />
      )}
      {workingWeight && cur && (
        <WorkingWeightSheet
          open
          exercise={cur.ex}
          mode={exerciseMode(cur.ex, state.customExercises)}
          unit={session.unit}
          onClose={() => setWorkingWeightOpen(false)}
          onSave={(numbers) => {
            const now = Date.now()
            const { session: next, event } = setWorkingWeight(getActiveWorkout() || session, session.cursor.ex, numbers, strengthCtx(now), now)
            if (event) dispatch({ type: 'LEARNING_EVENT', event })
            dispatch({ type: 'SET_ACTIVE_WORKOUT', session: next })
            setWorkingWeightOpen(false)
            toast(numbers.reps ? 'Got it. Tally starts from your numbers.' : 'Tally will find your weight again from the next set.', 'info')
          }}
        />
      )}

      {quickOpen && (
        <QuickWorkoutActions
          session={session}
          onClose={() => setQuickOpen(false)}
          onSkip={(reason) => {
            setQuickOpen(false)
            skipWithReason(reason)
          }}
          onSwap={() => {
            setQuickOpen(false)
            setAdjustment('swap')
          }}
          onShorten={() => {
            setQuickOpen(false)
            setAdjustment('shorten')
          }}
          onFinish={() => {
            setQuickOpen(false)
            update(finish)
          }}
          onEnd={() => {
            setQuickOpen(false)
            setConfirm(true)
          }}
          onMore={() => {
            setQuickOpen(false)
            setMenuOpen(true)
          }}
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
        onPlace={() => {
          setMenuOpen(false)
          setAdjustment('place')
        }}
        onLog={() => {
          setMenuOpen(false)
          update(completeSet)
        }}
        canFinish={done > 0}
        onWorkingWeight={() => setWorkingWeightOpen(true)}
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
            setEditingField(null)
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
          focusField={editingField}
          loads={availableLoads(
            session.equipmentProfile || state.settings.training,
            session.location || state.settings.training.location,
          )}
          onClose={() => {
            setEditing(false)
            setEditingAt(null)
          }}
          onSave={(patch) => {
            // Typed numbers are marked so the app never overwrites them.
            const coord = editingAt || session.cursor
            update((s) => applyManualEntry(s, coord, patch))
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

function Screen({ children, onClose, stepKey }) {
  const screen = useRef(null)
  useDialogAccessibility(screen, true, onClose)
  useLayoutEffect(() => {
    if (screen.current) screen.current.scrollTop = 0
  }, [stepKey])
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
      {session.phase !== 'rest' && session.phaseLeft != null && (
        <p className="num mt-3 text-[40px]">{fmtClock(session.phaseLeft)}</p>
      )}
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

function Rest({ session, update, strengthCtx, onShort, onQuick, onEdit, onForm }) {
  const cur = currentSet(session)
  const stats = loggedSetStats(session)
  const planned = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.kind !== 'warmup' && s.status !== 'skipped').length,
    0,
  )
  const progress = planned ? stats.sets / planned : 0
  const trained = session.exercises.filter((e) =>
    e.sets.some((s) => s.status === 'done' && s.kind !== 'warmup'),
  ).length
  // Start next set appears where Log set was tapped.
  const guard = useFreshTapGuard(`${session.cursor?.ex}:${session.cursor?.set}`)
  const thumb = cur && exerciseThumb(cur.ex.exId)
  const loadSuffix =
    cur && metaOf(cur.ex.exId)?.load === 'hand'
      ? ' / hand'
      : cur && metaOf(cur.ex.exId)?.load === 'assist'
        ? ' assistance'
        : ''
  return (
    <section className="workout-stage mt-6 flex flex-1 flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h2 className="font-display text-[36px]">Rest</h2>
          <WorkoutInfo title="Rest">
            Take the time you need. Tap Start next set when you’re ready. Stats count logged working sets
            only. Logged load is reps × the recorded weight; dumbbell weights stay per hand, and assistance is
            excluded. Warm-ups stay in your history.
          </WorkoutInfo>
        </div>
        <button
          onClick={onQuick}
          className="inline-flex min-h-11 items-center gap-1.5 px-3 text-[14px] font-semibold text-ink2"
          aria-label="Adjust workout"
        >
          <Icon name="sliders" size={16} />
          Adjust
        </button>
      </div>
      <RestClock session={session} />
      <div className="workout-rest-stats my-5 flex flex-1 flex-col items-center justify-center rounded-hero border border-line bg-surface px-5 py-6">
        <div className="workout-rest-ring relative h-[164px] w-[164px]">
          <svg viewBox="0 0 164 164" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="82" cy="82" r="72" fill="none" stroke="rgb(var(--line))" strokeWidth="7" />
            <circle
              cx="82"
              cy="82"
              r="72"
              fill="none"
              stroke="rgb(var(--accent))"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${progress * 452.39} 452.39`}
              className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="num text-[56px] leading-none">{stats.sets}</p>
            <p className="mt-2 text-[14px] text-muted">{stats.sets === 1 ? 'set logged' : 'sets logged'}</p>
          </div>
        </div>
        <div className="workout-rest-grid mt-4 grid w-full grid-cols-2 divide-x divide-line text-center">
          <div>
            <p className="num text-[28px]">
              {stats.reps || (stats.seconds ? fmtClock(stats.seconds * 1000) : 0)}
            </p>
            <p className="flex min-h-7 items-center justify-center text-[13px] text-muted">
              {stats.reps === 1 ? 'rep' : stats.reps || !stats.seconds ? 'reps' : 'movement'}
            </p>
          </div>
          <div>
            <p className="num text-[28px]">
              {stats.volume ? fmtNum(stats.volume) : stats.warmupSets || trained}
            </p>
            <div className="flex min-h-7 items-center justify-center text-[13px] text-muted">
              {stats.volume
                ? `${session.unit} logged`
                : stats.warmupSets
                  ? stats.warmupSets === 1
                    ? 'warm-up set'
                    : 'warm-up sets'
                  : trained === 1
                    ? 'exercise trained'
                    : 'exercises trained'}
            </div>
          </div>
        </div>
      </div>
      <FeelPrompt session={session} update={update} strengthCtx={strengthCtx} onShort={onShort} />
      {cur && (
        <div className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-2">
          {thumb && (
            <img
              src={thumb}
              alt=""
              className="workout-rest-next-thumb h-[64px] w-[64px] shrink-0 rounded-xl object-cover"
            />
          )}
          <button
            className="min-h-[80px] min-w-0 flex-1 py-1 text-left"
            onClick={() => onEdit(cur.ex.type === 'time' ? 'sec' : cur.ex.weighted ? 'weight' : 'reps')}
            aria-label="Edit next set"
          >
            <p className="text-[12px] text-muted">
              Up next · set {session.cursor.set + 1} of {cur.ex.sets.length}
            </p>
            <p className="mt-1 text-[16px] font-semibold leading-tight">{cur.ex.name}</p>
            <span className="mt-1 inline-flex items-center gap-2 text-[15px] text-accent">
              <span className="num">
                {cur.ex.type === 'time'
                  ? `${cur.set.sec}s`
                  : `${cur.set.reps}${cur.ex.weighted && loadReady(cur.ex, cur.set) ? ` × ${fmtNum(cur.set.weight)} ${session.unit}${loadSuffix}` : ' reps'}`}
              </span>
              <Icon name="edit" size={14} />
            </span>
          </button>
          <button
            onClick={onForm}
            className="icon-btn h-11 w-11 shrink-0 text-accent"
            aria-label="Exercise guide"
          >
            <Icon name="list" size={20} />
          </button>
        </div>
      )}
      <div className="workout-action-dock mt-4">
        <button onClick={guard(() => update(skipRest))} className="btn-primary min-h-14 w-full text-[17px]">
          Start next set <Icon name="arrowRight" size={18} />
        </button>
        {session.lastLogged && (
          <button className="btn-ghost mt-2 min-h-11 w-full text-[14px]" onClick={() => update(undoLastSet)}>
            Undo last set
          </button>
        )}
      </div>
    </section>
  )
}

// How long this rest has lasted, next to the suggested rest. Rest never ends
// on its own; this only helps judge when to go again.
function RestClock({ session }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const started = session.restStartedAt
  if (!Number.isFinite(started)) return null
  const paused = (session.pausedMs || 0) - (session.restPausedMs || 0) + (session.pausedAt ? now - session.pausedAt : 0)
  const elapsed = Math.max(0, now - started - paused)
  const lastEx = session.exercises[session.lastLogged?.ex]
  const suggested = (lastEx?.restSec || 0) * 1000
  return (
    <p className="mt-1 text-[14px] text-muted" aria-live="off">
      <span className="num text-ink2">Rested {fmtClock(elapsed)}</span>
      {suggested > 0 && (elapsed < suggested ? ` · about ${fmtClock(suggested)} suggested` : ' · ready when you are')}
    </p>
  )
}

function Work({ session, now, update, strengthCtx, onCouldnt, onForm, onEdit, onQuick }) {
  const { state } = useApp()
  // Simple (default): the app sets the numbers; tap one to change it.
  // Advanced: +/− buttons under each number too.
  const steppers = state.settings.workout?.weightControls === 'advanced'
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
  const ownLoads = DUMBBELL_MOVES.includes(ex.exId)
    ? availableLoads(
        session.equipmentProfile || state.settings.training,
        session.location || state.settings.training.location,
      )
    : []
  const weightLabel = `${unit}${metaOf(ex.exId)?.load === 'assist' ? ' assistance' : metaOf(ex.exId)?.load === 'hand' ? ' / hand' : ''}`
  // Stepped numbers are the person's own, like typed ones.
  const editValue = (patch) => update((s) => applyManualEntry(s, s.cursor, patch))
  // The main button changes meaning in place (Start → Done early, or the next set).
  const guard = useFreshTapGuard(`${session.cursor.ex}:${session.cursor.set}:${running ? 'run' : 'idle'}`)

  const complete = () => {
    if (timed && running)
      update((s, n) =>
        completeSet(s, n, {
          sec: Math.max(1, Math.round((session.phaseTotal - left) / 1000)),
        }),
      )
    // A plain Done changes nothing; typed reps above or below the plan re-plan the rest.
    else update((s, n) => adaptExercise(completeSet(s, n), s.cursor.ex, strengthCtx(n), { reason: 'logged' }))
  }

  return (
    <section className="workout-stage mt-7 flex flex-1 flex-col">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <button
          onClick={() => onEdit(null)}
          className="badge min-h-11 gap-2 px-3 text-[14px]"
          aria-label="Change set type or numbers"
        >
          {set.kind === 'warmup' ? 'Warmup · ' : ''}Set{' '}
          {ex.sets.slice(0, session.cursor.set + 1).filter((s) => s.status !== 'skipped').length} of{' '}
          {ex.sets.filter((s) => s.status !== 'skipped').length}
          <Icon name="chevronDown" size={13} />
        </button>
        <button
          onClick={onQuick}
          className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[14px] font-semibold text-ink2"
          aria-label="Adjust workout"
        >
          <Icon name="sliders" size={16} />
          Adjust
        </button>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <h2 className="min-w-0 font-display text-[clamp(32px,11vw,48px)] leading-[1.08]">{ex.name}</h2>
      </div>
      {ex.phaseLabel && <p className="mt-2 text-[13px] text-accent">{ex.phaseLabel}</p>}
      <AdjustedNote ex={ex} unit={unit} onEdit={() => onEdit(timed ? 'sec' : ex.weighted ? 'weight' : 'reps')} />
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
          <div className="flex w-full items-stretch justify-center gap-3">
            <SetNumberCard
              label={timed ? 'seconds' : ex.unilateral ? 'reps / side' : 'reps'}
              value={timed ? set.sec : set.reps}
              steppers={steppers}
              onEdit={() => onEdit(timed ? 'sec' : 'reps')}
              onChange={(value) => editValue(timed ? { sec: value } : { reps: value })}
              stepTo={(value, direction) => Math.max(1, Math.round(value + direction * (timed ? 5 : 1)))}
            />
            {!timed && ex.weighted && (
              <SetNumberCard
                label={weightLabel}
                value={set.weight}
                steppers={steppers}
                display={loadReady(ex, set) ? fmtNum(set.weight) : '—'}
                onEdit={() => onEdit('weight')}
                onChange={(weight) => editValue({ weight })}
                stepTo={(value, direction) => {
                  const next = stepLoad(value, direction, WEIGHT_STEP[unit] || 5, ownLoads)
                  return next > 0 || (next === 0 && isAssisted(ex.exId)) ? next : value
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="workout-action-dock">
        {timed && !running ? (
          <button
            onClick={guard(() => update(startSetTimer))}
            className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]"
          >
            <Icon name="play" size={13} filled strokeWidth={0} />
            Start exercise
          </button>
        ) : (
          <button
            onClick={guard(!loadReady(ex, set) ? () => onEdit('weight') : complete)}
            className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]"
          >
            {!loadReady(ex, set)
              ? 'Choose starting weight'
              : timed
                ? 'Done early'
                : isLast
                  ? 'Log last set'
                  : 'Log set'}
          </button>
        )}
        {loadReady(ex, set) && set.kind !== 'warmup' && !running && (
          <button
            onClick={onCouldnt}
            className="btn-ghost mt-1 min-h-11 w-full shrink-0 text-[15px] font-semibold text-ink2"
          >
            I couldn’t do this
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
                            : e.weighted && loadReady(e, s)
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
  onPlace,
  onLog,
  onFinish,
  onDiscard,
  onWorkingWeight,
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
            {ex && <MenuRow label="Exercise guide" onClick={onForm} />}
            {ex && session.phase !== 'prepared' && <MenuRow label="Replace exercise" onClick={onReplace} />}
            <MenuRow label="Add exercise" onClick={onAdd} />
            <details className="py-1">
              <summary className="min-h-12 cursor-pointer py-3 text-[15px] font-semibold">
                Workout sounds
              </summary>
              <div className="flex flex-wrap gap-2 pb-3">
                {[
                  ['Quiet', false],
                  ['Sounds', true],
                ].map(([label, sound]) => (
                  <button
                    key={label}
                    className={`chip ${state.settings.workout.sound === sound ? 'chip-active' : 'bg-surface2'}`}
                    aria-pressed={state.settings.workout.sound === sound}
                    onClick={() =>
                      dispatch({
                        type: 'UPDATE_SETTINGS',
                        patch: { workout: { ...state.settings.workout, sound } },
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
            <details className="py-1">
              <summary className="min-h-12 cursor-pointer py-3 text-[15px] font-semibold">
                Weight controls
              </summary>
              <div className="flex flex-wrap gap-2 pb-2">
                {[
                  ['Simple', 'simple'],
                  ['Show + and −', 'advanced'],
                ].map(([label, value]) => {
                  const on = (state.settings.workout.weightControls || 'simple') === value
                  return (
                    <button
                      key={value}
                      className={`chip ${on ? 'chip-active' : 'bg-surface2'}`}
                      aria-pressed={on}
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_SETTINGS',
                          patch: { workout: { ...state.settings.workout, weightControls: value } },
                        })
                      }
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="pb-3 text-[12px] leading-relaxed text-muted">
                Tally picks your weights and reps. Tap any number to change it yourself.
              </p>
            </details>
            {session.phase !== 'prepared' &&
              (canFinish ? (
                <MenuRow label="Finish & review" onClick={onFinish} />
              ) : (
                <MenuRow label="End workout" detail="Nothing logged yet" onClick={onDiscard} />
              ))}
            {!['sport', 'manual'].includes(session.kind) && (
              <MenuRow label="I have less time" onClick={onShorten} />
            )}
            {!['sport', 'manual'].includes(session.kind) && (
              <MenuRow label="Training somewhere else" onClick={onPlace} />
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
            <MenuRow label="More controls" onClick={() => setPanel('controls')} />
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
                    close()
                  }}
                />
              )}
              <MenuRow label="Add exercise" onClick={onAdd} />
              {ex && !hasDone && session.exercises.length > 1 && (
                <MenuRow
                  label="Remove current exercise"
                  onClick={() => {
                    update((s) => removeExercise(s, session.cursor.ex))
                    close()
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
              {ex && exerciseMode(ex, state.customExercises) && (
                <MenuRow
                  label="Set your working weight"
                  detail="Numbers feel off? Tally starts again from yours."
                  onClick={() => {
                    close()
                    onWorkingWeight()
                  }}
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
                  {open && panel !== 'main' && <StrengthFacts ex={ex} unit={session.unit} now={Date.now()} />}
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
      <Modal open={skipping} onClose={() => setSkipping(false)} title="Why skip this one?">
        <div className="mt-3 divide-y divide-line">
          {SKIP_REASONS.map(([value, label]) => (
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

function EditSet({ exercise, set, unit, loads = [], focusField, onSave, onClose }) {
  const [reps, setReps] = useState(String(set.reps ?? ''))
  const [sec, setSec] = useState(String(set.sec ?? ''))
  const [weight, setWeight] = useState(String(set.weight ?? ''))
  const [setKind, setSetKind] = useState(set.kind || 'work')
  const dumbbell = DUMBBELL_MOVES.includes(exercise.exId)
  const ownLoads = dumbbell ? loads : []
  // Choices estimated from related exercises win over the generic defaults.
  const choices = !loadReady(exercise, set)
    ? exercise.startChoices?.length
      ? exercise.startChoices
      : startingLoadChoices(exercise.exId, unit, ownLoads)
    : []
  const patch = setEntryPatch(exercise, { reps, sec, weight }, setKind)
  const weightLabel = `${metaOf(exercise.exId)?.load === 'assist' ? 'Assistance' : 'Weight'} · ${unit}${metaOf(exercise.exId)?.load === 'hand' ? ' / hand' : ''}`
  const loadInfo =
    metaOf(exercise.exId)?.load === 'assist'
      ? 'Enter the assistance shown on the machine. More assistance makes the exercise easier.'
      : metaOf(exercise.exId)?.load === 'hand'
        ? 'Enter the weight of one dumbbell, not both added together.'
        : loadKind(exercise.exId) === 'barbell'
          ? 'Enter the total weight, including the bar. The plate breakdown appears below.'
          : 'Enter the weight you use for this set. Start with a load you can move with control.'
  return (
    <Modal
      open
      onClose={onClose}
      title="Set numbers"
      subtitle={exercise.name}
      footer={
        <button className="btn-primary h-12 w-full" disabled={!patch} onClick={() => patch && onSave(patch)}>
          Save numbers
        </button>
      }
    >
      <div className="mt-3 space-y-3">
        {exercise.type === 'time' ? (
          <SetNumberField
            label="Seconds"
            value={sec}
            onChange={setSec}
            focus={focusField === 'sec'}
            stepTo={(v, d) => Math.max(1, Math.round(v + d * 5))}
          />
        ) : (
          <>
            {exercise.weighted && (
              <SetNumberField
                label={weightLabel}
                value={weight}
                decimal
                onChange={setWeight}
                focus={focusField === 'weight'}
                info={loadInfo}
                stepTo={(v, d) => stepLoad(v, d, WEIGHT_STEP[unit] || 5, ownLoads)}
              />
            )}
            <SetNumberField
              label={exercise.unilateral ? 'Reps per side' : 'Reps'}
              value={reps}
              onChange={setReps}
              focus={focusField === 'reps'}
              stepTo={(v, d) => Math.max(1, Math.round(v + d))}
            />
          </>
        )}
      </div>
      {choices.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="Starting weight choices">
          {choices.map((v) => (
            <button
              key={v}
              aria-pressed={Number(weight) === v}
              className={`chip min-h-11 justify-center ${Number(weight) === v ? 'chip-active' : 'bg-surface2'}`}
              onClick={() => setWeight(String(v))}
            >
              {fmtNum(v)}
            </button>
          ))}
        </div>
      )}
      {loadKind(exercise.exId) === 'barbell' && (
        <PlateLine weight={Number(weight)} unit={unit} className="mt-3" />
      )}
      <div className="mt-4 flex min-h-11 items-center justify-between">
        <span className="text-[14px] font-semibold">Set type</span>
        <WorkoutInfo title="Set type">
          Working sets count toward your training totals and records. Warm-up sets are saved in your history,
          but do not count toward records.
        </WorkoutInfo>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Set type">
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
