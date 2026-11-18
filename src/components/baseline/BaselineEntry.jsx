// Ways into the starting point: the Home card for someone new, the sheet for
// typing numbers already known, and the balance section on the You tab.
import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import Icon from '../Icon.jsx'
import Modal from '../Modal.jsx'
import StrengthBalance from './StrengthBalance.jsx'
import { CardFacts } from '../TrainingCard.jsx'
import { SectionHead } from '../Ink.jsx'
import { findExercise } from '../../lib/exercises.js'
import { metaOf } from '../../lib/catalog/index.js'
import { profileOf } from '../../lib/planner.js'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import { strengthBalance } from '../../lib/strength/index.js'
import { BASELINE_MINUTES, baselineAnchors, baselineMoves, buildBaselineSession } from '../../lib/baseline.js'

/** Starts the session (asking first if another workout is in progress). */
export function useStartBaseline(nav) {
  const { state, dispatch, today, toast } = useApp()
  return () => {
    const begin = () => {
      const session = buildBaselineSession(state, { today, now: Date.now() })
      if (!session) {
        toast('Nothing fits your place and settings right now.', 'info')
        return
      }
      dispatch({ type: 'SET_ACTIVE_WORKOUT', session })
      nav.openPlayer()
    }
    if (state.activeWorkout) nav.confirmWorkoutChange(begin)
    else begin()
  }
}

const setBaseline = (state, dispatch, status) =>
  dispatch({
    type: 'UPDATE_SETTINGS',
    patch: { training: { ...state.settings.training, baseline: { status, at: Date.now() } } },
  })

/** Home, before any strength training is saved: the first thing to do. */
export function BaselineCard({ nav }) {
  const { state, dispatch, today, toast } = useApp()
  const start = useStartBaseline(nav)
  const [typing, setTyping] = useState(false)
  const moves = useMemo(() => baselineMoves(state, { today }).moves, [state, today])
  return (
    <section className="training-card">
      <div className="training-art" aria-hidden="true">
        <span className="training-art-orbit" />
        <img src={ONBOARDING_ART.strength} alt="" decoding="async" />
      </div>
      <p className="training-card-eyebrow">Start here</p>
      <h2 className="training-card-title">Find your starting point</h2>
      <CardFacts
        facts={[
          [BASELINE_MINUTES, 'min'],
          [moves.length, 'moves'],
          [1, 'set each'],
        ]}
      />
      <button onClick={start} className="btn-primary mt-5 w-full" disabled={!moves.length}>
        Start
        <Icon name="arrowRight" size={17} />
      </button>
      <div className="mt-2 flex flex-wrap justify-center gap-x-2">
        <button
          className="btn-ghost min-h-11 whitespace-nowrap !px-3 text-[14px]"
          onClick={() => setTyping(true)}
        >
          I know my numbers
        </button>
        <button
          className="btn-ghost min-h-11 whitespace-nowrap !px-3 text-[14px]"
          onClick={() => {
            setBaseline(state, dispatch, 'skipped')
            toast('Skipped. It’s on the You tab if you want it later.', 'info')
          }}
        >
          Skip for now
        </button>
      </div>
      {typing && <BaselineNumbers onClose={() => setTyping(false)} />}
    </section>
  )
}

function balanceArgs(state, today) {
  const p = profileOf(state)
  return {
    workouts: state.workouts,
    learning: state.learning,
    metrics: state.metrics,
    customExercises: state.customExercises,
    unit: state.settings.weightUnit,
    today,
    now: Date.now(),
    experience: p.experience,
  }
}

/**
 * "I know my numbers": a weight and reps for each movement, with about two
 * left. Blank rows are estimated from the rest. Saved as starting numbers
 * for the strength model, not as a workout.
 */
export function BaselineNumbers({ onClose }) {
  const { state, dispatch, today } = useApp()
  const unit = state.settings.weightUnit
  const moves = useMemo(
    () => baselineMoves(state, { today }).moves.filter((m) => findExercise(m.exId)?.type === 'reps'),
    // The list is fixed while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [values, setValues] = useState({})
  const [saved, setSaved] = useState(false)
  const entries = moves.map((m) => {
    const def = findExercise(m.exId)
    const v = values[m.exId] || {}
    return {
      exId: m.exId,
      weight: def.weighted ? v.weight : undefined,
      reps: v.reps ?? (def.weighted && v.weight ? '10' : ''),
    }
  })
  const events = baselineAnchors(entries, { unit })
  const set = (exId, patch) => setValues((all) => ({ ...all, [exId]: { ...all[exId], ...patch } }))
  if (saved)
    return (
      <Modal
        open
        onClose={onClose}
        title="Your starting point"
        footer={
          <button className="btn-primary min-h-12 w-full" onClick={onClose}>
            Done
          </button>
        }
      >
        <p className="mt-1 text-[15px] leading-relaxed text-ink2">
          Every related exercise now starts from your numbers. They keep adjusting as you train.
        </p>
        <h3 className="mt-5 text-[15px] font-semibold">How your areas compare</h3>
        <StrengthBalance balance={strengthBalance(balanceArgs(state, today))} className="mt-3 pb-2" />
      </Modal>
    )
  return (
    <Modal
      open
      onClose={onClose}
      title="Your numbers"
      subtitle={`A weight you can lift for those reps with about two left. Leave blank what you don’t know.${
        state.workouts.some((w) => !w.sample) ? ' Lifts you fill in start again from your numbers.' : ''
      }`}
      footer={
        <button
          className="btn-primary min-h-12 w-full"
          disabled={!events.length}
          onClick={() => {
            for (const event of events) dispatch({ type: 'LEARNING_EVENT', event })
            setBaseline(state, dispatch, 'typed')
            setSaved(true)
          }}
        >
          {events.length
            ? `Save ${events.length} ${events.length === 1 ? 'lift' : 'lifts'}`
            : 'Enter at least one'}
        </button>
      }
    >
      <ul className="mt-2 divide-y divide-line">
        {moves.map((m) => {
          const def = findExercise(m.exId)
          const load = metaOf(m.exId)?.load
          const v = values[m.exId] || {}
          return (
            <li key={m.exId} className="py-3">
              <p className="text-[15px] font-semibold">{def.name}</p>
              <div className="mt-2 flex items-center gap-2">
                {def.weighted && (
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      className="input num min-h-12 min-w-0 flex-1 text-center text-[18px]"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`${def.name}: ${load === 'assist' ? 'assistance' : 'weight'} in ${unit}`}
                      value={v.weight ?? ''}
                      onChange={(e) => set(m.exId, { weight: e.target.value })}
                    />
                    <span className="shrink-0 text-[13px] text-muted">
                      {unit}
                      {load === 'hand' ? ' each' : load === 'assist' ? ' assist.' : ''}
                    </span>
                  </label>
                )}
                <label
                  className={`flex items-center gap-2 ${def.weighted ? 'w-[112px] shrink-0' : 'flex-1'}`}
                >
                  {def.weighted && <span className="text-[15px] text-muted">×</span>}
                  <input
                    className="input num min-h-12 min-w-0 flex-1 text-center text-[18px] placeholder:text-faint"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`${def.name}: reps`}
                    placeholder={def.weighted ? '10' : ''}
                    value={v.reps ?? ''}
                    onChange={(e) => set(m.exId, { reps: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })}
                  />
                  <span className="shrink-0 text-[13px] text-muted">reps</span>
                </label>
              </div>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

/** You tab: how the areas compare, and ways to (re)do the starting point. */
export function BalanceSection({ nav }) {
  const { state, today } = useApp()
  const start = useStartBaseline(nav)
  const [typing, setTyping] = useState(false)
  const balance = useMemo(
    () => strengthBalance(balanceArgs(state, today)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.workouts,
      state.learning,
      state.metrics,
      state.settings.weightUnit,
      state.settings.training.experience,
      today,
    ],
  )
  const status = state.settings.training.baseline?.status
  const measured = (balance?.measured || 0) >= 2
  return (
    <section className="page-section">
      <SectionHead title="Strength balance" />
      <div className="mt-3 rounded-tuck bg-surface p-4">
        {measured ? (
          <StrengthBalance balance={balance} />
        ) : (
          <p className="text-[14px] leading-snug text-muted">
            See how your main lifts compare. Test them in a short session, or enter what you know.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="btn-secondary min-h-11 !px-3 text-[14px]"
            onClick={start}
            disabled={Boolean(state.activeWorkout)}
          >
            {status === 'done' ? 'Redo check' : 'Start check'}
          </button>
          <button className="btn-secondary min-h-11 !px-3 text-[14px]" onClick={() => setTyping(true)}>
            Enter lifts
          </button>
        </div>
      </div>
      {typing && <BaselineNumbers onClose={() => setTyping(false)} />}
    </section>
  )
}
