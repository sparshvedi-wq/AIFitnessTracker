// The starting-point session: one movement at a time, one question at a time.
// Pick a weight, do one set, say how many reps and how many were left. The
// logic lives in lib/baseline.js; this is only the screens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import Icon from '../Icon.jsx'
import Modal from '../Modal.jsx'
import FormSheet from '../workout/FormSheet.jsx'
import StrengthBalance from './StrengthBalance.jsx'
import useDialogAccessibility from '../useDialogAccessibility.js'
import useFreshTapGuard from '../useFreshTapGuard.js'
import { useStrengthContext } from '../workout/StrengthControls.jsx'
import { SetNumberField } from '../workout/SetControls.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import { exerciseThumb } from '../../lib/exercise-thumbs.js'
import { metaOf } from '../../lib/catalog/index.js'
import { profileOf } from '../../lib/planner.js'
import { unlockAudio } from '../../lib/coach.js'
import { recordPlaceLabel } from '../../lib/places.js'
import { WEIGHT_STEP, fmtClock, fmtNum, resume, toWorkoutRecord } from '../../lib/workout.js'
import { BASELINE } from '../../lib/strength/config.js'
import { startingWeights, strengthBalance } from '../../lib/strength/index.js'
import {
  BASELINE_MINUTES,
  LEFT_ANSWERS,
  acceptSecondSet,
  answerBaselineLeft,
  backBaseline,
  baselineMode,
  baselineProgress,
  baselineRows,
  baselineTooHeavy,
  beginBaseline,
  declineSecondSet,
  endBaseline,
  finishBaselineSet,
  firstGuessScale,
  logBaselineHold,
  logBaselineReps,
  pickBaselineWeight,
  repickBaselineWeight,
  skipBaselineMove,
  swapBaselineMove,
} from '../../lib/baseline.js'
import '../workout/first-workout.css'

const BODYWEIGHT_MAX_REPS = 30

export default function BaselinePlayer({ session, onMinimize, onSaved }) {
  const { state, dispatch, toast } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [ending, setEnding] = useState(false)
  const strengthCtx = useStrengthContext(session)
  const step = session.baseline?.step || 'intro'
  const update = (fn) => {
    unlockAudio()
    const now = Date.now()
    const live = state.activeWorkout
    // Back after a long quiet spell: the clock starts again with the next tap.
    dispatch({
      type: 'SET_ACTIVE_WORKOUT',
      session: fn(live.pausedAt && live.phase !== 'done' ? resume(live, now) : live, now),
    })
  }
  const here = session.cursor ? session.exercises[session.cursor.ex] : null
  const set = here?.sets[session.cursor.set]
  const mode = baselineMode(here)
  const progress = baselineProgress(session)
  const unit = session.unit
  const suffix =
    here && metaOf(here.exId)?.load === 'assist'
      ? ' assistance'
      : here && metaOf(here.exId)?.load === 'hand'
        ? ' each'
        : ''

  if (step === 'intro')
    return (
      <Screen onClose={onMinimize} stepKey="intro">
        <section className="first-intro" aria-labelledby="baseline-intro-title">
          <header className="flex items-center">
            <button onClick={onMinimize} className="icon-btn" aria-label="Minimize">
              <Icon name="chevronDown" size={20} strokeWidth={2.2} />
            </button>
          </header>
          <div className="first-intro-stage" aria-hidden="true">
            <span className="floor-glow first-intro-floor" />
            <img src={ONBOARDING_ART.strength} alt="" />
          </div>
          <p className="first-intro-eyebrow">
            About {BASELINE_MINUTES} minutes · {session.exercises.length} movements
          </p>
          <h2 id="baseline-intro-title" className="first-intro-title">
            Find your starting point.
          </h2>
          <p className="first-intro-copy">
            One set of each. Stop with about two reps left, never to failure. Your answers set the weights for
            everything else.
          </p>
          <p className="-mt-4 mb-6 text-[14px] leading-relaxed text-muted">
            Warm up first: a few easy minutes of walking or light movement.
          </p>
          <button
            className="btn-primary first-intro-start min-h-12 w-full"
            onClick={() => update(beginBaseline)}
          >
            Let’s go
            <Icon name="arrowRight" size={16} />
          </button>
        </section>
      </Screen>
    )

  if (step === 'results')
    return (
      <Screen onClose={onMinimize} stepKey="results">
        <Results session={session} onMinimize={onMinimize} onSaved={onSaved} />
      </Screen>
    )

  if (!here || !set) return null

  return (
    <Screen onClose={onMinimize} stepKey={`${session.cursor.ex}:${session.cursor.set}:${step}`}>
      <header className="flex items-center gap-3">
        <button onClick={onMinimize} className="icon-btn" aria-label="Minimize">
          <Icon name="chevronDown" size={20} strokeWidth={2.2} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[17px] font-semibold">{session.name}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            Movement {progress.index} of {progress.total}
          </p>
        </div>
        <button onClick={() => setEnding(true)} className="min-h-11 px-2 text-[14px] font-semibold text-ink2">
          End
        </button>
      </header>
      <div
        className="mt-5 h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Movements done"
        aria-valuenow={progress.done}
        aria-valuemin={0}
        aria-valuemax={progress.total}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(progress.done / progress.total) * 100}%` }}
        />
      </div>

      <section className="mt-7 flex flex-1 flex-col">
        <p className="text-[14px] font-semibold text-accent">
          {here.slotLabel}
          {session.cursor.set > 0 ? ' · one more set' : ''}
        </p>
        <h2 className="mt-1 font-display text-[clamp(30px,10vw,44px)] leading-[1.08]">{here.name}</h2>

        {step === 'pick' && (
          <Pick
            key={`${here.key}:${session.cursor.set}:${session.baseline?.tooHeavy ?? ''}`}
            session={session}
            exercise={here}
            suffix={suffix}
            strengthCtx={strengthCtx}
            profile={profileOf(state)}
            onPick={(w) => update((s) => pickBaselineWeight(s, w))}
          />
        )}
        {step === 'do' && mode !== 'time' && (
          <Do
            exercise={here}
            set={set}
            mode={mode}
            unit={unit}
            suffix={suffix}
            onDone={() => update(finishBaselineSet)}
            onTooHeavy={() => update(baselineTooHeavy)}
            onChange={() => update(repickBaselineWeight)}
          />
        )}
        {step === 'do' && mode === 'time' && (
          <Hold onLog={(sec) => update((s, n) => logBaselineHold(s, sec, n))} />
        )}
        {step === 'reps' && (
          <Reps
            max={mode === 'load' ? BASELINE.maxReps : BODYWEIGHT_MAX_REPS}
            perSide={here.unilateral}
            onPick={(n) => update((s, now) => logBaselineReps(s, n, now))}
            onBack={() => update(backBaseline)}
          />
        )}
        {step === 'left' && (
          <Left
            reps={set.reps}
            onAnswer={(value) => update((s, now) => answerBaselineLeft(s, value, strengthCtx(now), now))}
            onBack={() => update(backBaseline)}
          />
        )}
        {step === 'again' && session.baseline?.second && (
          <Again
            second={session.baseline.second}
            unit={unit}
            suffix={suffix}
            onYes={() => update(acceptSecondSet)}
            onNo={() => update(declineSecondSet)}
          />
        )}

        {['pick', 'do'].includes(step) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[14px] font-semibold text-ink2">
            <button className="min-h-11" onClick={() => setFormOpen(true)}>
              How to do it
            </button>
            {here.alternatives?.length > 0 && !here.sets.some((s) => s.status === 'done') && (
              <button
                className="min-h-11"
                onClick={() => {
                  update((s) => swapBaselineMove(s, state.customExercises))
                  toast('Swapped for a similar movement', 'info')
                }}
              >
                Swap it
              </button>
            )}
            <button className="min-h-11" onClick={() => update(skipBaselineMove)}>
              Skip
            </button>
          </div>
        )}
      </section>

      <FormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        exercise={here}
        location={session.location}
        placeName={session.placeName || recordPlaceLabel(session)}
      />
      <Modal open={ending} onClose={() => setEnding(false)} title="End here?" maxWidth="max-w-sm">
        <p className="text-[15px] leading-relaxed text-ink2">
          {progress.done > 0
            ? `You’ve done ${progress.done} of ${progress.total}. What you’ve done is enough to start from; the rest is estimated.`
            : 'Nothing is logged yet, so there’s nothing to save.'}
        </p>
        <div className="mt-6 space-y-2">
          {progress.done > 0 && (
            <button
              className="btn-primary min-h-12 w-full"
              onClick={() => {
                setEnding(false)
                update(endBaseline)
              }}
            >
              Finish with what I’ve done
            </button>
          )}
          <button className="btn-secondary min-h-12 w-full" onClick={() => setEnding(false)}>
            Keep going
          </button>
          <button
            className="btn-danger-ghost min-h-11 w-full"
            onClick={() => dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })}
          >
            Discard
          </button>
        </div>
      </Modal>
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
      aria-label="Starting point"
    >
      <div className="workout-screen mx-auto flex min-h-[100dvh] max-w-xl flex-col px-[22px] pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),18px)]">
        {children}
      </div>
    </div>
  )
}

// Choose the weight for the set: a few sensible options, or any number.
function Pick({ session, exercise, suffix, strengthCtx, profile, onPick }) {
  const unit = session.unit
  const assisted = metaOf(exercise.exId)?.load === 'assist'
  const second = session.cursor.set > 0
  const guess = useMemo(
    () =>
      startingWeights(
        {
          ...strengthCtx(),
          exId: exercise.exId,
          place: session.location,
          scale: firstGuessScale(profile, exercise.exId),
        },
        session,
      ),
    // The suggestion is worked out once per visit to this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.key, session.cursor.set, session.baseline?.tooHeavy],
  )
  const choices = guess?.choices?.length ? guess.choices : []
  const [weight, setWeight] = useState(guess ? String(guess.suggested) : '')
  const [typing, setTyping] = useState(!choices.length)
  const value = Number(String(weight).replace(',', '.'))
  const valid =
    Number.isFinite(value) && weight !== '' && (value > 0 || (value === 0 && assisted)) && value <= 2000
  const thumb = exerciseThumb(exercise.exId)
  const tooHeavy = session.baseline?.tooHeavy
  return (
    <>
      <p className="mt-3 text-[16px] leading-relaxed text-ink2">
        {assisted
          ? 'Pick an assistance you could do about 10 reps with. More assistance is easier.'
          : 'Pick a weight you could lift about 10 times.'}
        {suffix === ' each' ? ' Per dumbbell.' : ''}
      </p>
      {thumb && !second && (
        <img src={thumb} alt="" className="mx-auto mt-4 h-[132px] w-[132px] rounded-[20px] object-cover" />
      )}
      {choices.length > 0 && (
        <div className="mt-5 grid grid-cols-4 gap-2" role="group" aria-label={`Weight in ${unit}`}>
          {choices.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={value === v}
              className={`chip num min-h-14 flex-col justify-center text-[18px] ${value === v ? 'chip-active' : 'bg-surface2'}`}
              onClick={() => {
                setWeight(String(v))
                setTyping(false)
              }}
            >
              {fmtNum(v)}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {Number.isFinite(tooHeavy)
          ? `${fmtNum(tooHeavy)} ${unit} was too heavy, so these are lighter.`
          : guess?.informed && guess.source && guess.source !== 'own'
            ? `Suggested from your ${guess.source.toLowerCase()}. Lighter is fine.`
            : 'A cautious first guess. Lighter is fine; you can’t get this wrong.'}
      </p>
      {typing ? (
        <div className="mt-3">
          <SetNumberField
            label={`${assisted ? 'Assistance' : 'Weight'} · ${unit}${suffix}`}
            value={weight}
            decimal
            onChange={setWeight}
            stepTo={(v, d) => Math.max(0, Math.round((v + d * (WEIGHT_STEP[unit] || 5)) * 10) / 10)}
          />
        </div>
      ) : (
        <button
          className="mt-1 min-h-11 self-start text-[14px] font-semibold text-accent"
          onClick={() => setTyping(true)}
        >
          Another weight
        </button>
      )}
      <div className="mt-auto pt-6">
        <button
          className="btn-primary h-16 w-full text-[18px]"
          disabled={!valid}
          onClick={() => valid && onPick(value)}
        >
          {valid ? `Use ${fmtNum(value)} ${unit}${suffix}` : 'Choose a weight'}
        </button>
      </div>
    </>
  )
}

function Do({ exercise, set, mode, unit, suffix, onDone, onTooHeavy, onChange }) {
  const guard = useFreshTapGuard(`${exercise.key}:${set.weight}`)
  const top = mode === 'load' ? BASELINE.maxReps : BODYWEIGHT_MAX_REPS
  return (
    <>
      <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-hero bg-surface px-5 py-8 text-center">
        {mode === 'load' ? (
          <>
            <p className="num text-[clamp(64px,22vw,96px)] leading-none">{fmtNum(set.weight)}</p>
            <p className="mt-2 text-[15px] text-muted">
              {unit}
              {suffix}
            </p>
          </>
        ) : (
          <p className="font-display text-[32px] leading-tight">Bodyweight</p>
        )}
        <p className="mt-6 max-w-[300px] text-[16px] leading-relaxed text-ink2">
          Do good reps until you have about two left. Stop at {top}
          {exercise.unilateral ? ' per side' : ''}.
        </p>
      </div>
      <button className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]" onClick={guard(onDone)}>
        Done
      </button>
      {mode === 'load' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn-secondary min-h-12" onClick={onTooHeavy}>
            Too heavy
          </button>
          <button className="btn-secondary min-h-12" onClick={onChange}>
            Change weight
          </button>
        </div>
      )}
    </>
  )
}

// A hold is timed with a stopwatch that counts up; stopping it logs the time.
function Hold({ onLog }) {
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [startedAt])
  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0
  return (
    <>
      <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-hero bg-surface px-5 py-8 text-center">
        <p className="num text-[clamp(64px,22vw,96px)] leading-none" role="timer">
          {fmtClock(elapsed)}
        </p>
        <p className="mt-6 max-w-[300px] text-[16px] leading-relaxed text-ink2">
          Hold with good form. Stop when it starts to slip, not when you collapse.
        </p>
      </div>
      {startedAt ? (
        <button
          className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]"
          onClick={() => onLog(Math.max(1, Math.round(elapsed / 1000)))}
        >
          Stop
        </button>
      ) : (
        <button
          className="btn-primary mt-5 h-16 w-full shrink-0 text-[18px]"
          onClick={() => {
            setNow(Date.now())
            setStartedAt(Date.now())
          }}
        >
          <Icon name="play" size={13} filled strokeWidth={0} />
          Start the clock
        </button>
      )}
    </>
  )
}

function Reps({ max, perSide, onPick, onBack }) {
  return (
    <>
      <p className="mt-6 text-[20px] font-semibold">How many reps{perSide ? ' per side' : ''}?</p>
      <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Reps you did">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="chip num min-h-12 justify-center bg-surface2 text-[17px]"
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button className="btn-ghost mt-4 min-h-11 w-full text-[14px]" onClick={onBack}>
        Back
      </button>
    </>
  )
}

function Left({ reps, onAnswer, onBack }) {
  return (
    <>
      <p className="mt-6 text-[20px] font-semibold">How many more could you have done?</p>
      <p className="mt-1 text-[14px] text-muted">
        After your {reps} {reps === 1 ? 'rep' : 'reps'}, with good form. A rough guess is fine.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Reps left">
        {LEFT_ANSWERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="chip min-h-16 justify-center bg-surface2 text-[17px] font-semibold"
            onClick={() => onAnswer(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="btn-ghost mt-4 min-h-11 w-full text-[14px]" onClick={onBack}>
        Change the reps
      </button>
    </>
  )
}

function Again({ second, unit, suffix, onYes, onNo }) {
  const light = second.reason === 'light'
  return (
    <>
      <div className="mt-6 rounded-hero bg-surface p-5">
        <p className="font-display text-[26px] leading-tight">
          {light ? 'That was light for you.' : 'That was heavy.'}
        </p>
        <p className="mt-2 text-[16px] leading-relaxed text-ink2">
          One more set at{' '}
          <span className="num text-ink">
            {fmtNum(second.weight)} {unit}
            {suffix}
          </span>{' '}
          gives a much better read. Rest a minute first.
        </p>
      </div>
      <div className="mt-auto pt-6">
        <button className="btn-primary h-16 w-full text-[18px]" onClick={onYes}>
          Do one more set
        </button>
        <button className="btn-ghost mt-2 min-h-12 w-full" onClick={onNo}>
          That’s enough
        </button>
      </div>
    </>
  )
}

// What was measured, how the areas compare, and one button to save it.
function Results({ session, onMinimize, onSaved }) {
  const { state, dispatch, today } = useApp()
  const strengthCtx = useStrengthContext(session)
  const [confirm, setConfirm] = useState(false)
  const guard = useFreshTapGuard('baseline-results')
  const rows = useMemo(() => baselineRows(session, session.unit), [session])
  const balance = useMemo(
    () => (rows.length ? strengthBalance({ ...strengthCtx(), session, place: session.location }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.id, rows.length, today],
  )
  const save = () => {
    const now = Date.now()
    const record = toWorkoutRecord(session, state.workouts, { now, effort: null, note: '' })
    dispatch({ type: 'FINISH_WORKOUT', workout: record })
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: {
        training: { ...state.settings.training, baseline: { status: 'done', at: now, workoutId: record.id } },
      },
    })
    onSaved?.({ ...record, newBests: 0 })
  }
  if (!rows.length)
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <h2 className="font-display text-[30px]">Nothing logged</h2>
        <p className="mt-1 text-[15px] text-muted">There’s nothing to save from this one.</p>
        <button
          className="btn-primary mt-6 h-[52px] w-full max-w-xs"
          onClick={() => dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })}
        >
          Close
        </button>
      </div>
    )
  return (
    <>
      <header className="flex items-center">
        <button onClick={onMinimize} className="icon-btn" aria-label="Minimize">
          <Icon name="chevronDown" size={20} strokeWidth={2.2} />
        </button>
      </header>
      <p className="mt-6 text-[14px] font-semibold text-accent">Done</p>
      <h2 className="mt-1 font-display text-[clamp(32px,9vw,42px)] leading-[1.06]">Your starting point</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink2">
        Every related exercise now starts from these. They keep adjusting as you train.
      </p>
      <ul className="mt-5 rounded-tuck bg-surface px-4">
        {rows.map((r, i) => (
          <li
            key={r.exId}
            className={`flex items-baseline justify-between gap-3 py-3.5 ${i ? 'border-t border-line' : ''}`}
          >
            <span className="min-w-0 truncate text-[15px] font-medium">{r.name}</span>
            <span className="num shrink-0 text-[16px] text-ink2">{r.text}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-7 text-[16px] font-semibold">How your areas compare</h3>
      <StrengthBalance balance={balance} className="mt-3" />
      <div className="mt-auto pt-7">
        <button className="btn-primary h-14 w-full text-[17px]" onClick={guard(save)}>
          Save my starting point
        </button>
        <button className="btn-danger-ghost mt-2 min-h-11 w-full" onClick={() => setConfirm(true)}>
          Discard
        </button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Discard these results?"
        maxWidth="max-w-sm"
      >
        <p className="text-[15px] leading-relaxed text-ink2">Nothing from this session will be saved.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => setConfirm(false)}>
            Keep
          </button>
          <button
            className="btn-danger"
            onClick={() => dispatch({ type: 'SET_ACTIVE_WORKOUT', session: null })}
          >
            Discard
          </button>
        </div>
      </Modal>
    </>
  )
}
