// One-tap strength feedback inside a workout: "how did that feel?" during
// rest, "I couldn't do this" during a set, and "set my working weight" when
// the numbers feel off. Typing numbers stays available for anyone who wants it.
import { useState } from 'react'
import Icon from '../Icon.jsx'
import Modal from '../Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { profileOf } from '../../lib/planner.js'
import { availableLoads } from '../../lib/preferences.js'
import { pastActivityLoad } from '../../lib/sport-schedule.js'
import { metaOf } from '../../lib/catalog/index.js'
import { findExercise } from '../../lib/exercises.js'
import { fmtNum } from '../../lib/workout.js'
import { strengthMode, strengthSummary } from '../../lib/strength/index.js'
import { MUSCLE_LABEL } from '../../lib/catalog/vocabulary.js'
import { feelPrompt, liveContext, recordFeel, reservePrompt, skipFeel, skipReserve } from '../../lib/strength/session.js'
import { SetNumberField } from './SetControls.jsx'

/** Builds the live strength context for this workout at a given time. */
export function useStrengthContext(session) {
  const { state, today } = useApp()
  return (now = Date.now()) => {
    const p = { ...profileOf(state), ...(session?.equipmentProfile || {}) }
    const location = session?.location || p.location
    return liveContext({
      workouts: state.workouts,
      learning: state.learning,
      unit: session?.unit || state.settings.weightUnit,
      now,
      today,
      goal: p.goal,
      experience: p.experience,
      readiness: session?.readiness || {},
      sizes: availableLoads(p, location),
      customExercises: state.customExercises,
      metrics: state.metrics,
      // Sport and activities already done count as muscle fatigue.
      activities: pastActivityLoad(p, { today, now }),
    })
  }
}

/** 'load', 'reps' or null for an exercise in this session. */
export function exerciseMode(ex, customExercises = []) {
  if (!ex) return null
  const def = findExercise(ex.exId, customExercises) || ex
  const meta = metaOf(ex.exId)
  // Assisted machines log assistance like a weight.
  if (meta?.load === 'assist' && def?.type === 'reps') return 'load'
  return strengthMode(def, meta)
}

const FEELS = [
  ['easy', 'Easy'],
  ['good', 'Good'],
  ['hard', 'Hard'],
]

const RESERVES = [
  [3, 'A few'],
  [5, 'About 5'],
  [8, '8 or more'],
]

/** During rest: "How did that set feel?" for the sets where it matters. */
export function FeelPrompt({ session, update, strengthCtx, onShort }) {
  const { state } = useApp()
  const easy = reservePrompt(session)
  if (easy) {
    // Optional follow-up to "Easy": a weight far too light is fixed in one go.
    return (
      <section className="mb-4 rounded-[20px] border border-accent/30 bg-surface px-4 py-3" aria-label="How many more could you have done?">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold">How many more reps could you have done?</p>
          <button type="button" className="min-h-11 shrink-0 px-2 text-[13px] text-muted" onClick={() => update((s) => skipReserve(s, easy))}>
            Skip
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="How many more reps">
          {RESERVES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip min-h-12 justify-center bg-surface2 text-[15px]"
              onClick={() => update((s, n) => recordFeel(s, easy, 'easy', strengthCtx(n), value))}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    )
  }
  const c = feelPrompt(session, state.customExercises)
  if (!c) return null
  const ex = session.exercises[c.ex]
  const set = ex.sets[c.set]
  const answer = (feel) => update((s, n) => recordFeel(s, c, feel, strengthCtx(n)))
  return (
    <section className="mb-4 rounded-[20px] border border-accent/30 bg-surface px-4 py-3" aria-label="How did that set feel?">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold">
          {set.test
            ? `How did ${fmtNum(set.weight)} ${session.unit} feel?`
            : set.manual
              ? 'You set those numbers. How did it feel?'
              : 'How did that set feel?'}
        </p>
        <button
          type="button"
          className="min-h-11 shrink-0 px-2 text-[13px] text-muted"
          onClick={() => update((s) => skipFeel(s, c))}
        >
          Skip
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="How did that set feel?">
        {FEELS.map(([value, label]) => (
          <button key={value} type="button" className="chip min-h-12 justify-center bg-surface2 text-[15px]" onClick={() => answer(value)}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="mt-1 min-h-11 w-full text-left text-[13px] text-accent" onClick={() => onShort(c)}>
        I didn’t get all {set.reps} reps
      </button>
    </section>
  )
}

/** Before the first working set: a step up in weight, offered as one test set. */
export function TestOffer({ offer, unit, assist = false, each = false, onYes, onNo }) {
  const label = `${fmtNum(offer.weight)} ${unit}${assist ? ' assistance' : each ? ' each' : ''}`
  return (
    <section className="mt-4 rounded-[20px] border border-accent/40 bg-accent/10 px-4 py-3" aria-label="Test set offer">
      <p className="text-[16px] font-semibold">Ready to try {label}?</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink2">
        One set of {offer.reps}. If it goes well it becomes your working weight; if not, you carry on at{' '}
        {fmtNum(offer.from)} {unit}.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary min-h-11 !py-0 text-[15px]" onClick={onYes}>
          Try it
        </button>
        <button type="button" className="btn-secondary min-h-11 !py-0 text-[15px]" onClick={onNo}>
          Not today
        </button>
      </div>
    </section>
  )
}

/** During rest: how the test set just logged turned out. */
export function TestResult({ session }) {
  const c = session?.lastLogged
  const ex = c && session.exercises?.[c.ex]
  const set = ex?.sets?.[c.set]
  if (!set || set.status !== 'done' || !['passed', 'missed'].includes(set.test) || !ex.offer) return null
  const passed = set.test === 'passed'
  return (
    <p className="mb-3 flex items-start gap-2 rounded-[16px] bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink2" role="status">
      <Icon name={passed ? 'check' : 'info'} size={17} className="mt-0.5 shrink-0 text-accent" />
      <span>
        {passed
          ? `${fmtNum(ex.offer.weight)} ${session.unit} is your working weight now.`
          : `Back to ${fmtNum(ex.offer.from)} ${session.unit} for the rest. It’ll be offered again once this weight feels steady.`}
      </span>
    </p>
  )
}

/** A short line after the app changed the numbers, with a way to set them yourself. */
export function AdjustedNote({ ex, unit, onEdit }) {
  const a = ex?.adjusted
  if (!a || !Number.isFinite(a.reps)) return null
  // Built from the numbers (not stored text), so it follows a unit change.
  const load = metaOf(ex.exId)?.load
  const text = !Number.isFinite(a.weight)
    ? `${a.reps} reps`
    : load === 'assist'
      ? `${fmtNum(a.weight)} ${unit} assistance × ${a.reps}`
      : `${fmtNum(a.weight)} ${unit}${load === 'hand' ? ' each' : ''} × ${a.reps}`
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-accent" role="status">
      <span>Adjusted to {text}.</span>
      <button type="button" className="min-h-11 underline underline-offset-2" onClick={onEdit}>
        Change it
      </button>
    </p>
  )
}

/** Picks how many reps were actually done. */
function RepGrid({ max, onPick }) {
  const top = Math.max(1, Math.min(30, max))
  return (
    <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Reps you did">
      {Array.from({ length: top }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" className="chip num min-h-12 justify-center bg-surface2 text-[17px]" onClick={() => onPick(n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

/**
 * "I couldn't do this": too heavy, some reps, or it felt wrong. Each path
 * records what happened and lets the app adjust, so nothing has to be typed.
 */
export function CouldntSheet({ open, onClose, session, coord, mode, initialStep = 'why', onTooHeavy, onReps, onPain, onSwap, onType }) {
  const [step, setStep] = useState(initialStep)
  const ex = coord ? session.exercises[coord.ex] : null
  const set = ex?.sets[coord.set]
  const close = () => {
    setStep(initialStep)
    onClose()
  }
  if (!open || !ex || !set) return null
  const planned = set.reps || set.targetReps || 10
  return (
    <Modal
      open
      onClose={close}
      title={step === 'reps' ? 'How many did you get?' : 'What happened?'}
      subtitle={ex.name}
      footer={
        <button
          className="btn-ghost min-h-11 w-full text-[14px]"
          onClick={step === 'why' || initialStep !== 'why' ? close : () => setStep('why')}
        >
          {step === 'why' || initialStep !== 'why' ? 'Back to workout' : 'Back'}
        </button>
      }
    >
      {step === 'reps' ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Tap the reps you finished with good form. The next sets adjust to match.
          </p>
          <RepGrid
            max={planned - 1}
            onPick={(n) => {
              onReps(n)
              close()
            }}
          />
        </>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {mode === 'load' && (
            <SheetRow
              icon="minimize"
              label="I couldn’t lift it at all"
              detail="It gets a lot lighter right away"
              onClick={() => {
                onTooHeavy()
                close()
              }}
            />
          )}
          {mode && planned > 1 && (
            <SheetRow icon="repeat" label={`I got some of the ${planned} reps`} detail="Tap how many; the rest adjusts" onClick={() => setStep('reps')} />
          )}
          {!mode && (
            <SheetRow
              icon="edit"
              label="Log what I did"
              onClick={() => {
                onType()
                close()
              }}
            />
          )}
          <SheetRow
            icon="heart"
            label="It hurt or felt wrong"
            detail="Skips it and keeps it out for now"
            onClick={() => {
              onPain()
              close()
            }}
          />
          <SheetRow
            icon="repeat"
            label="Swap for something else"
            onClick={() => {
              onSwap()
              close()
            }}
          />
          {mode && (
            <SheetRow
              icon="edit"
              label="Enter the numbers myself"
              onClick={() => {
                onType()
                close()
              }}
            />
          )}
        </div>
      )}
    </Modal>
  )
}

function SheetRow({ icon, label, detail, onClick }) {
  return (
    <button type="button" className="flex min-h-16 w-full items-center gap-3 py-3 text-left" onClick={onClick}>
      <Icon name={icon} size={19} className="shrink-0 text-ink2" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        {detail && <span className="mt-0.5 block text-[13px] text-muted">{detail}</span>}
      </span>
    </button>
  )
}

/** What the app currently believes about this exercise, and odd sets it set aside. */
export function StrengthFacts({ ex, unit, now }) {
  const { state, today } = useApp()
  const p = profileOf(state)
  const summary = ex
    ? strengthSummary({
        exId: ex.exId,
        workouts: state.workouts,
        learning: state.learning,
        unit,
        today,
        now,
        experience: p.experience,
        customExercises: state.customExercises,
      })
    : null
  if (!summary) return null
  const label = { settled: 'confident', learning: 'learning', calibrating: 'still calibrating' }[summary.confidence] || 'learning'
  return (
    <div className="border-t border-line py-3 text-[13px] leading-relaxed text-ink2">
      <p>
        {summary.mode === 'load'
          ? `Estimated one-rep max: about ${fmtNum(Math.round(summary.oneRepMax))} ${unit} (${label}).`
          : `Estimated reps to failure: about ${Math.round(summary.maxReps)} (${label}).`}
      </p>
      {summary.rejected.length > 0 && (
        <p className="mt-1 text-muted">
          {summary.rejected.length === 1 ? 'One logged set looked' : `${summary.rejected.length} logged sets looked`} off and
          {summary.rejected.length === 1 ? ' is' : ' are'} ignored (for example{' '}
          {fmtNum(Number(summary.rejected[0].weight) || 0)} {unit} on {summary.rejected[0].date}). Fix it in History if it was
          a typo.
        </p>
      )}
    </div>
  )
}

/**
 * The library entry for an exercise: how much each muscle does, the closest
 * related exercises, and what Tally currently estimates here and from what.
 */
export function ExerciseLibrary({ exId, place }) {
  const { state, today } = useApp()
  const p = profileOf(state)
  const now = Date.now()
  const summary = strengthSummary({
    exId,
    workouts: state.workouts,
    learning: state.learning,
    metrics: state.metrics,
    unit: state.settings.weightUnit,
    today,
    now,
    experience: p.experience,
    customExercises: state.customExercises,
    place,
  })
  if (!summary?.muscles?.length) return null
  const unit = state.settings.weightUnit
  const label = { settled: 'confident', learning: 'learning', calibrating: 'still calibrating' }[summary.confidence]
  return (
    <section className="mt-4 border-t border-line pt-3" aria-label="What it trains">
      <h3 className="text-[14px] font-semibold">What it trains</h3>
      <ul className="mt-2 space-y-1.5">
        {summary.muscles.slice(0, 6).map(({ muscle, share }) => (
          <li key={muscle} className="flex items-center gap-3 text-[13px]">
            <span className="w-[112px] shrink-0 text-ink2">{MUSCLE_LABEL[muscle] || muscle}</span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, share)}%` }} />
            </span>
            <span className="num w-10 shrink-0 text-right text-muted">{share}%</span>
          </li>
        ))}
      </ul>
      {summary.related?.length > 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Works much the same as: {summary.related.map((r) => findExercise(r.id)?.name || r.id).join(', ')}.
        </p>
      )}
      {label && (summary.oneRepMax || summary.maxReps) && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink2">
          {summary.mode === 'reps'
            ? `Tally estimates about ${Math.round(summary.maxReps)} reps at most here (${label})`
            : `Tally estimates a one-rep max of about ${fmtNum(Math.round(summary.oneRepMax))} ${unit}${metaOf(exId)?.load === 'hand' ? ' per hand' : ''} (${label})`}
          {summary.source && summary.source !== 'own' ? `, from your ${summary.source.toLowerCase()}.` : '.'}
          {summary.readiness < 0.95 ? ' These muscles are still recovering, so today’s weights are a little lighter.' : ''}
        </p>
      )}
    </section>
  )
}

/**
 * "Set my working weight": a weight you can do for some reps with a couple
 * left. The app starts again from it. "Start over" forgets past weights.
 */
export function WorkingWeightSheet({ open, onClose, exercise, mode, unit, onSave }) {
  const current = exercise?.sets.find((s) => s.kind !== 'warmup' && s.status === 'todo') || exercise?.sets.at(-1)
  const [weight, setWeight] = useState(String(current?.weight ?? ''))
  const [reps, setReps] = useState(String(current?.reps ?? 10))
  if (!open || !exercise || !mode) return null
  const w = Number(String(weight).replace(',', '.'))
  const r = Number(reps)
  const valid = Number.isInteger(r) && r >= 1 && r <= 100 && (mode !== 'load' || (Number.isFinite(w) && w > 0 && w <= 10000))
  return (
    <Modal
      open
      onClose={onClose}
      title="Set your working weight"
      subtitle={exercise.name}
      footer={
        <div className="flex gap-2">
          <button className="btn-secondary min-h-12 flex-1" onClick={() => onSave({})}>
            Start over
          </button>
          <button className="btn-primary min-h-12 flex-1" disabled={!valid} onClick={() => onSave({ weight: mode === 'load' ? w : null, reps: r })}>
            Save
          </button>
        </div>
      }
    >
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        {mode === 'load'
          ? 'A weight you can lift for these reps with about two left in the tank. Tally starts again from here.'
          : 'Reps you can do with about two left in the tank. Tally starts again from here.'}
      </p>
      <div className="mt-3 space-y-3">
        {mode === 'load' && (
          <SetNumberField
            label={`Weight · ${unit}${metaOf(exercise.exId)?.load === 'hand' ? ' / hand' : ''}`}
            value={weight}
            decimal
            onChange={setWeight}
            stepTo={(v, d) => Math.max(0, Math.round((v + d * (unit === 'kg' ? 2.5 : 5)) * 10) / 10)}
          />
        )}
        <SetNumberField label="Reps" value={reps} onChange={setReps} stepTo={(v, d) => Math.max(1, Math.round(v + d))} />
      </div>
      <p className="mt-3 text-[12px] text-muted">“Start over” forgets past weights for this exercise and asks again.</p>
    </Modal>
  )
}
