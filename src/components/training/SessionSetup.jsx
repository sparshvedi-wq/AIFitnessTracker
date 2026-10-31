import { useMemo, useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import Select from '../Select.jsx'
import { Toggle } from '../Ink.jsx'
import PlaceEditor from './PlaceEditor.jsx'
import { placeSummary, placesOf, quietAt, resolvePlace, updatePlace } from '../../lib/places.js'
import { useApp } from '../../store/AppContext.jsx'
import {
  buildDailyPlan,
  planSeconds,
  profileOf,
  readinessOf,
  buildEventPump,
  todayChoice,
} from '../../lib/planner.js'
import { buildSportWarmup, orderedSports } from '../../lib/sports.js'
import { findExercise, MUSCLES } from '../../lib/exercises.js'
import { buildSession, prepareSession, beginPrepared, fmtClock } from '../../lib/workout.js'
import { Choice, Field } from './Fields.jsx'
import { availableLoads } from '../../lib/preferences.js'
import { adaptRoutineItems } from '../../lib/workout-adjustments.js'
import MovementFields from './MovementFields.jsx'
import { movementPreferences, movementSummary } from '../../lib/movement-preferences.js'
import { sportScheduleContext } from '../../lib/sport-schedule.js'
import usePlanningTime from './usePlanningTime.js'
import { planSummary, count } from '../../lib/presentation.js'
import EnvironmentFields from './EnvironmentFields.jsx'
import BodyAreaPicker from './BodyAreaPicker.jsx'
import { SHORT_DURATIONS } from '../../lib/flexible-training.js'

const PLACE_ICON = { gym: 'train', equipment: 'dumbbell', space: 'minimize' }
const placeIcon = (place) => (place.id === 'home' ? 'home' : PLACE_ICON[place.type])
const AREAS = MUSCLES.filter((m) => !['Cardio', 'Mobility'].includes(m))

export default function SessionSetup({ routine, onClose, onStart }) {
  const { state, dispatch, today } = useApp()
  const [p, setSessionProfile] = useState(() => profileOf(state))
  const planningState = useMemo(
    () => ({ ...state, settings: { ...state.settings, training: p } }),
    [state, p],
  )
  const [equipmentValid, setEquipmentValid] = useState(true)
  const now = usePlanningTime()
  // Today's space/position changes, layered over the chosen place's own; null means none.
  const [onTheGo, setOnTheGo] = useState(null)
  const [addingPlace, setAddingPlace] = useState(false)
  const [focusAreas, setFocusAreas] = useState(routine.event?.focus || ['Shoulders', 'Biceps', 'Triceps'])
  const [kind, setKind] = useState(
    ['sport', 'adaptive', 'pump'].includes(routine.kind) ? routine.kind : 'routine',
  )
  const shortSession = Boolean(routine.shortSession && kind === 'adaptive')
  const [minutes, setMinutes] = useState(
    routine.shortSession
      ? routine.minutes || 10
      : routine.kind === 'pump'
        ? 10
        : routine.kind === 'sport'
          ? p.lastSportMinutes || 10
          : todayChoice(state, today).minutes || p.minutes,
  )
  const [location, setLocationState] = useState(todayChoice(state, today).location || p.location)
  const place = resolvePlace(p, location)
  const places = placesOf(p)
  const setLocation = (id) => {
    setLocationState(id)
    setOnTheGo(null)
  }
  const [sport, setSport] = useState(routine.sport || p.lastSport || p.sports[0] || '')
  const [lowImpact, setLowImpact] = useState(() => quietAt(p, location))
  const [rememberSetup, setRememberSetup] = useState(false)
  const [readiness, setReadiness] = useState(() => ({
    ...readinessOf(state, today),
    ...(routine.shortSession ? { intensity: 'easy' } : {}),
  }))
  const [step, setStep] = useState(p.completed && !p.flexibleTime && routine.kind !== 'sport' ? 3 : 0)
  const [panel, setPanel] = useState(null)
  const [returnToPlan, setReturnToPlan] = useState(false)
  const [replace, setReplace] = useState(false)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [exerciseReturn, setExerciseReturn] = useState(null)
  const movement = useMemo(() => movementPreferences(p, location, onTheGo), [p, location, onTheGo])
  const schedule = sportScheduleContext(p, { today, now, minutes })
  const steps = ['Time', 'Place', 'Feel', 'Plan']
  const lastStep = step === steps.length - 1
  const changeKind = (value) => {
    if (value === kind) return
    setKind(value)
    setMinutes(value === 'sport' || (routine.shortSession && value === 'adaptive') ? 10 : p.minutes)
    setStep(0)
    setReturnToPlan(false)
    setPanel(null)
    setReplace(false)
  }
  const plan = useMemo(() => {
    if (kind === 'pump')
      return buildEventPump(
        planningState,
        { ...routine.event, focus: focusAreas },
        { today, now, minutes, location, readiness, movement: onTheGo || undefined },
      )
    if (kind === 'sport')
      return {
        ...buildSportWarmup(sport, minutes, {
          lowImpact,
          movement,
          avoidMuscles: [...(p.avoidMuscles || []), ...readiness.pain, ...readiness.sore],
        }),
        location,
      }
    if (kind === 'adaptive')
      return buildDailyPlan(planningState, {
        today,
        now,
        minutes,
        location,
        readiness,
        movement: onTheGo || undefined,
        shortSession,
      })
    const adapted = adaptRoutineItems(planningState, routine.items, location, readiness, {
      today,
      now,
      minutes,
      movement: onTheGo || undefined,
    })
    const items = adapted.items
    while (items.length && planSeconds(items) > minutes * 60) {
      const item = [...items].reverse().find((it) => it.sets > 1)
      if (item) item.sets--
      else items.pop()
    }
    return {
      ...routine,
      name: routine.name,
      items,
      kind: 'routine',
      location,
      readiness,
      movement: adapted.movement,
      schedule: {
        next: adapted.schedule.next,
        lighter: adapted.schedule.lighter,
        muscles: adapted.schedule.muscles,
        overlap: Boolean(adapted.schedule.overlap),
      },
      lockedTargets: adapted.schedule.lighter,
      requestedMinutes: minutes,
      focus: adapted.changes.length
        ? 'Your routine, adjusted for this place.'
        : routine.blurb || 'Your routine, adjusted to the time you have.',
      reasons: [
        ...adapted.changes,
        'Your saved routine isn’t changed.',
        'You can pause or finish whenever you need to.',
      ],
    }
  }, [
    kind,
    sport,
    minutes,
    lowImpact,
    planningState,
    p,
    movement,
    today,
    location,
    readiness,
    routine,
    now,
    onTheGo,
    focusAreas,
    shortSession,
  ])
  const start = () => {
    if (!plan.items.length && !(kind === 'routine' && !routine.items.length)) return
    if (state.activeWorkout && !replace) {
      setReplace(true)
      return
    }
    dispatch({
      type: 'SET_READINESS',
      readiness: {
        ...readiness,
        ...(shortSession ? { intensity: readinessOf(state, today).intensity } : {}),
        date: today,
      },
    })
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: {
        // Only "Make today's setup my defaults" changes the saved profile.
        training: rememberSetup
          ? {
              ...(onTheGo ? updatePlace(p, location, { movement: { ...place.movement, ...onTheGo } }) : p),
              minutes: kind !== 'sport' && !shortSession ? minutes : p.minutes,
              location,
            }
          : profileOf(state),
      },
    })
    dispatch({
      type: 'SET_ACTIVE_WORKOUT',
      session: beginPrepared(
        prepareSession(
          buildSession(
            { ...plan, placeName: place.name, equipmentProfile: p },
            {
              workouts: state.workouts,
              customExercises: state.customExercises,
              unit: state.settings.weightUnit,
              dumbbellWeights: availableLoads(p, location),
            },
          ),
        ),
      ),
    })
    onStart()
  }
  const panelTitles = {
    options: 'Session options',
    soreness: 'Anything feeling sore?',
    pain: 'Anything to avoid?',
    exercises: 'Your exercises',
    exercise: 'Exercise details',
    reasons: 'Why this session?',
    movement: 'Space and movement',
    equipment: 'Equipment for today',
  }
  const title = panel
    ? panelTitles[panel]
    : step === 0
      ? 'How much time do you have?'
      : lastStep
        ? plan.name
        : step === 1
          ? 'Where are you training?'
          : 'How are you feeling?'
  const selectedExercise = plan.items[exerciseIndex]
  const exerciseDef = selectedExercise && findExercise(selectedExercise.exId, state.customExercises)
  const dose = (it) =>
    `${it.sets} × ${it.sec ? (it.sec >= 60 ? fmtClock(it.sec * 1000) : `${it.sec}s`) : `${it.reps}${it.unilateral ? ' / side' : ' reps'}`}`
  const back = () => {
    if (panel) setPanel(panel === 'exercise' ? exerciseReturn : null)
    else if (returnToPlan) {
      setStep(3)
      setReturnToPlan(false)
    } else {
      setStep(Math.max(0, step - 1))
      setReplace(false)
    }
  }
  return (
    <Modal
      open
      fullScreen
      onClose={onClose}
      title={title}
      headerAction={
        !panel ? (
          <button
            className="icon-btn !h-9 !w-9"
            aria-label="Session options"
            onClick={() => setPanel('options')}
          >
            <Icon name="more" size={20} />
          </button>
        ) : null
      }
      bodyKey={panel || step}
      footer={
        panel ? (
          <button onClick={back} className="btn-primary h-12 w-full">
            Done
          </button>
        ) : (
          <div>
            {replace && (
              <p role="alert" className="mb-3 text-[13px] text-muted">
                This replaces your unsaved workout.
              </p>
            )}
            <div className="flex gap-2">
              {(returnToPlan || (step > 0 && !(lastStep && p.completed && !p.flexibleTime))) && (
                <button onClick={back} className="btn-secondary h-12 px-5">
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (lastStep) start()
                  else if (returnToPlan) {
                    setStep(3)
                    setReturnToPlan(false)
                  } else setStep(step + 1)
                }}
                disabled={
                  (kind === 'sport' && !sport) ||
                  (lastStep &&
                    (!equipmentValid || !plan.items.length) &&
                    !(kind === 'routine' && !routine.items.length))
                }
                className="btn-primary h-12 flex-1"
              >
                {lastStep
                  ? replace
                    ? 'Replace unsaved workout'
                    : 'Start workout'
                  : returnToPlan
                    ? 'Update workout'
                    : 'Continue'}
              </button>
            </div>
          </div>
        )
      }
    >
      {!panel && (
        <>
          {!lastStep && (
            <ol className="session-steps mt-4" aria-label="Workout preparation">
              {steps.map((label, i) => (
                <li
                  key={label}
                  aria-current={step === i ? 'step' : undefined}
                  className={i <= step ? 'text-accent' : 'text-faint'}
                >
                  <span className={`dot h-7 w-7 text-[12px] ${i <= step ? 'bg-accent/15' : 'bg-bg'}`}>
                    {i < step ? <Icon name="check" size={13} /> : i + 1}
                  </span>
                  <span className="text-[12px]">{label}</span>
                </li>
              ))}
            </ol>
          )}
          {step === 0 && (
            <>
              {kind === 'sport' && (
                <Field label="Sport">
                  <Select
                    label="Sport"
                    placeholder="Choose your sport"
                    value={sport}
                    onChange={setSport}
                    options={orderedSports(p, p.lastSport).map((s) => [
                      s.id,
                      s.name,
                      s.id === p.lastSport ? 'Last used' : undefined,
                    ])}
                  />
                </Field>
              )}
              <div className="mt-8 grid grid-cols-2 gap-3">
                {(shortSession
                  ? SHORT_DURATIONS
                  : kind === 'pump'
                    ? [5, 10, 15]
                    : kind === 'sport'
                      ? [5, 10, 15, 20]
                      : [15, 20, 30, 45]
                ).map((v) => (
                  <button
                    key={v}
                    aria-label={`${v} minutes`}
                    aria-pressed={minutes === v}
                    onClick={() => setMinutes(v)}
                    className={`duration-choice ${minutes === v ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface2'}`}
                  >
                    <span className="num text-[42px] leading-none">{v}</span>
                    <span className="text-[14px] text-muted">minutes</span>
                    {minutes === v && <Icon name="check" size={17} className="absolute right-4 top-4" />}
                  </button>
                ))}
              </div>
              {!shortSession && !['sport', 'pump'].includes(kind) && (
                <details className="mt-5 border-t border-line">
                  <summary className="min-h-12 cursor-pointer py-3 text-[14px] text-muted">
                    {[15, 20, 30, 45].includes(minutes) ? 'Another duration' : `${minutes} minutes · change`}
                  </summary>
                  <div className="grid grid-cols-4 gap-2 pb-3" role="radiogroup" aria-label="Other duration">
                    {[10, 25, 35, 40, 50, 60, 75, 90].map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={minutes === v}
                        aria-label={`${v} minutes`}
                        className={`chip justify-center ${minutes === v ? 'chip-active' : 'bg-surface2'}`}
                        onClick={() => setMinutes(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <p className="mt-6 flex items-center gap-2 text-[14px] text-muted">
                <Icon name="clock" size={17} />A guide, not a countdown.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <div className="mt-7 space-y-3" role="radiogroup" aria-label="Where are you training?">
                {places.map((option) => (
                  <button
                    key={option.id}
                    role="radio"
                    aria-checked={location === option.id}
                    onClick={() => setLocation(option.id)}
                    className={`location-choice ${location === option.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}
                  >
                    <span className="icon-tile !h-12 !w-12">
                      <Icon name={placeIcon(option)} size={24} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[20px] font-semibold">{option.name}</span>
                      <span className="mt-1 block truncate text-[13px] text-muted">
                        {placeSummary(option)}
                      </span>
                    </span>
                    {location === option.id && <Icon name="check" size={19} className="text-accent" />}
                  </button>
                ))}
                <button
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-outline text-[15px] font-semibold text-ink2"
                  onClick={() => setAddingPlace(true)}
                >
                  <Icon name="plus" size={17} />
                  Add a place
                </button>
              </div>
              {place.type !== 'space' && (
                <OptionRow
                  label="Equipment for today"
                  detail="Adjust without changing your usual setup"
                  onClick={() => setPanel('equipment')}
                />
              )}
              {movement && (
                <div className="mt-4 border-t border-line">
                  <OptionRow
                    label="Space and movement"
                    detail={movementSummary(movement)}
                    onClick={() => setPanel('movement')}
                  />
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="mt-7 grid grid-cols-3 gap-2" role="group" aria-label="Energy today">
                {[
                  ['low', 'Low', 1],
                  ['normal', 'Usual', 2],
                  ['high', 'High', 3],
                ].map(([value, label, bars]) => (
                  <button
                    key={value}
                    aria-pressed={readiness.energy === value}
                    onClick={() => setReadiness((r) => ({ ...r, energy: value }))}
                    className={`energy-choice ${readiness.energy === value ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface2 text-ink2'}`}
                  >
                    <span className="flex h-7 items-end gap-1" aria-hidden="true">
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className={`w-2 rounded-sm bg-current ${n > bars ? 'opacity-15' : ''}`}
                          style={{ height: 8 + n * 6 }}
                        />
                      ))}
                    </span>
                    <span className="mt-3 text-[16px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-7 divide-y divide-line rounded-tuck bg-bg/60 px-4">
                <OptionRow
                  label="Sore or tired muscles"
                  detail={readiness.sore.join(', ') || 'Nothing selected'}
                  onClick={() => setPanel('soreness')}
                />
                <OptionRow
                  label="Pain or movements to avoid"
                  detail={readiness.pain.join(', ') || 'Nothing selected'}
                  onClick={() => setPanel('pain')}
                />
              </div>
            </>
          )}
          {lastStep && (
            <>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  [0, 'Time', `${minutes} min`],
                  [1, 'Place', place.name],
                  [
                    2,
                    'Feel',
                    readiness.sore.length || readiness.pain.length
                      ? 'Areas avoided'
                      : readiness.energy === 'low'
                        ? 'Low energy'
                        : readiness.energy === 'high'
                          ? 'High energy'
                          : 'Usual',
                  ],
                ].map(([value, label, detail]) => (
                  <button
                    key={value}
                    className="min-h-[76px] rounded-2xl border border-outline px-2 py-3 text-left"
                    onClick={() => {
                      setReturnToPlan(true)
                      setStep(value)
                    }}
                  >
                    <span className="block text-[12px] text-muted">{label}</span>
                    <span className="mt-1 block text-[14px] font-semibold">{detail}</span>
                  </button>
                ))}
              </div>
              <p className="mt-6 text-[18px] leading-relaxed text-ink2" aria-live="polite">
                {kind === 'adaptive' ? planSummary(plan) : plan.focus}
              </p>
              <p className="mt-4 text-[14px] text-muted">
                {plan.items.length} {kind === 'sport' ? 'drills' : 'exercises'} ·{' '}
                {count(
                  plan.items.reduce((n, it) => n + it.sets, 0),
                  'set',
                )}
              </p>
              <div className="mt-4 divide-y divide-line">
                {plan.items.slice(0, 3).map((it, i) => (
                  <OptionRow
                    key={`${it.exId}-${i}`}
                    label={findExercise(it.exId, state.customExercises)?.name}
                    detail={dose(it)}
                    onClick={() => {
                      setExerciseIndex(i)
                      setExerciseReturn(null)
                      setPanel('exercise')
                    }}
                  />
                ))}
              </div>
              {plan.items.length > 3 && (
                <button className="btn-ghost mt-2 min-h-11 w-full" onClick={() => setPanel('exercises')}>
                  View all {plan.items.length} {kind === 'sport' ? 'drills' : 'exercises'}
                </button>
              )}
              {plan.schedule?.overlap && (
                <p role="status" className="mt-4 rounded-2xl border border-accent/40 p-3 text-[14px]">
                  Overlaps {schedule.next?.name || 'an event you added'}. Adjust the time if needed.
                </p>
              )}
              {!plan.items.length && !(kind === 'routine' && !routine.items.length) && (
                <p className="mt-4 text-[14px] leading-relaxed text-muted">
                  Nothing fits those areas and this equipment. Change one, or rest today.
                </p>
              )}
              {kind === 'routine' && !routine.items.length && (
                <p className="mt-4 text-[15px] text-muted">Add exercises as you go.</p>
              )}
              {kind === 'pump' && !plan.items.length && (
                <button className="btn-secondary mt-4 w-full" onClick={() => setPanel('options')}>
                  Change focus areas
                </button>
              )}
            </>
          )}
        </>
      )}
      {panel === 'options' && (
        <>
          <Field label="Session type">
            <div className="space-y-2">
              {[
                ['adaptive', 'Recommended for today'],
                ['sport', 'Warm up for sport'],
                ...(routine.kind === 'pump' ? [['pump', 'Short focused session']] : []),
                ...(!['adaptive', 'sport', 'pump'].includes(routine.kind)
                  ? [['routine', 'Your saved routine']]
                  : []),
              ].map(([value, label]) => (
                <div key={value}>
                  <Choice value={value} selected={kind === value} onClick={changeKind}>
                    {label}
                  </Choice>
                </div>
              ))}
            </div>
          </Field>
          {kind === 'pump' && (
            <Field label="Areas for this short session">
              <div className="grid grid-cols-2 gap-2">
                {AREAS.map((m) => (
                  <Choice
                    key={m}
                    value={m}
                    selected={focusAreas.includes(m)}
                    onClick={() =>
                      setFocusAreas((v) => (v.includes(m) ? v.filter((a) => a !== m) : [...v, m]))
                    }
                  />
                ))}
              </div>
              <p className="mt-3 text-[12px] text-muted">Just for this session.</p>
            </Field>
          )}
          {kind === 'adaptive' && (
            <>
              <Field label="Where are you training?">
                <div className="flex flex-wrap gap-2">
                  {places.map((option) => (
                    <Choice
                      key={option.id}
                      value={option.id}
                      selected={location === option.id}
                      onClick={setLocation}
                    >
                      {option.name}
                    </Choice>
                  ))}
                </div>
              </Field>
              <Field label="Preferred effort">
                <div className="flex flex-wrap gap-2">
                  {[
                    ['easy', 'Easy'],
                    ['moderate', 'Moderate'],
                    ['challenging', 'Challenging'],
                  ].map(([value, label]) => (
                    <Choice
                      key={value}
                      value={value}
                      selected={readiness.intensity === value}
                      onClick={(intensity) => setReadiness({ ...readiness, intensity })}
                    >
                      {label}
                    </Choice>
                  ))}
                </div>
              </Field>
              <SwitchRow
                label="Sport today or tomorrow"
                checked={readiness.sportSoon}
                onChange={(sportSoon) => setReadiness({ ...readiness, sportSoon })}
              />
            </>
          )}
          {kind === 'sport' && (
            <SwitchRow label="No jumps or quick turns" checked={lowImpact} onChange={setLowImpact} />
          )}
          <OptionRow label="Why this session?" onClick={() => setPanel('reasons')} />
          {kind !== 'sport' && (
            <SwitchRow label="Save as my usual setup" checked={rememberSetup} onChange={setRememberSetup} />
          )}
        </>
      )}
      {panel === 'equipment' && (
        <>
          <p className="mt-3 text-[14px] text-muted">Just for this workout.</p>
          <EnvironmentFields
            key={location}
            place={place}
            unit={state.settings.weightUnit}
            onChange={(patch) => setSessionProfile((prev) => updatePlace(prev, location, patch))}
            onValidityChange={setEquipmentValid}
          />
        </>
      )}
      {panel === 'movement' && (
        <>
          <p className="mt-3 text-[13px] text-muted">
            {kind === 'sport' ? 'Just for this warm-up.' : 'Just for today.'}
          </p>
          <MovementFields value={onTheGo || place.movement} onChange={setOnTheGo} />
        </>
      )}
      {['soreness', 'pain'].includes(panel) && (
        <>
          {panel === 'pain' && (
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              We’ll avoid these. If pain persists, see a professional.
            </p>
          )}
          <BodyAreaPicker
            key={panel}
            value={readiness[panel === 'pain' ? 'pain' : 'sore']}
            locked={panel === 'pain' ? p.avoidMuscles : []}
            label={panel === 'pain' ? 'Areas to avoid' : 'Sore or tired areas'}
            onChange={(areas) => setReadiness((r) => ({ ...r, [panel === 'pain' ? 'pain' : 'sore']: areas }))}
          />
        </>
      )}
      {panel === 'exercises' && (
        <div className="mt-3 divide-y divide-line">
          {plan.items.map((it, i) => (
            <OptionRow
              key={`${it.exId}-${i}`}
              label={findExercise(it.exId, state.customExercises)?.name}
              detail={`${it.phaseLabel ? it.phaseLabel + ' · ' : ''}${dose(it)}`}
              onClick={() => {
                setExerciseIndex(i)
                setExerciseReturn('exercises')
                setPanel('exercise')
              }}
            />
          ))}
        </div>
      )}
      {panel === 'exercise' && exerciseDef && (
        <>
          <h3 className="mt-4 font-display text-[26px]">{exerciseDef.name}</h3>
          <p className="mt-2 text-[14px] text-accent">{dose(selectedExercise)}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">{selectedExercise.note}</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px]">
            {exerciseDef.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ol>
        </>
      )}
      {panel === 'reasons' && (
        <ul className="mt-4 list-disc space-y-3 pl-4 text-[14px] leading-relaxed text-ink2">
          {plan.reasons?.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {addingPlace && (
        <PlaceEditor
          profile={profileOf(state)}
          unit={state.settings.weightUnit}
          onClose={() => setAddingPlace(false)}
          onSave={(saved, id) => {
            // A new place is kept for next time; today's other choices stay today-only.
            dispatch({ type: 'UPDATE_SETTINGS', patch: { training: saved } })
            setSessionProfile((prev) => ({ ...prev, places: saved.places, location: saved.location }))
            if (id) setLocation(id)
            setAddingPlace(false)
          }}
        />
      )}
    </Modal>
  )
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <div className="mt-3 flex min-h-12 items-center gap-3 text-[15px]">
      <span className="min-w-0 flex-1">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function OptionRow({ label, detail, onClick }) {
  return (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 py-3.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{label}</span>
        {detail && <span className="mt-1 block text-[12px] text-muted">{detail}</span>}
      </span>
      <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
    </button>
  )
}
