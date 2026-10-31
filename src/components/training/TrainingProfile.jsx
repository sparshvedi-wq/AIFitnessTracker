import { count } from '../../lib/presentation.js'
import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { GOALS, profileOf, buildDailyPlan } from '../../lib/planner.js'
import { SPORTS } from '../../lib/sports.js'
import { MUSCLES, findExercise } from '../../lib/exercises.js'
import {
  ONBOARDING_VERSION,
  onboardingStage,
  onboardingSteps,
  nextOnboardingStep,
} from '../../lib/onboarding.js'
import {
  hasStartingProfile,
  initialBaselineMetric,
  manualEntryOf,
  readManualBaseline,
} from '../../lib/starting-profile.js'
import { TallyLogo } from '../Ink.jsx'
import EnvironmentFields from './EnvironmentFields.jsx'
import { placeSummary, placesOf, resolvePlace, updatePlace } from '../../lib/places.js'
import MovementFields from './MovementFields.jsx'
import ManualBaselineFields from './ManualBaselineFields.jsx'
import PhotoCheckins from './PhotoCheckins.jsx'
import { Choice, Field } from './Fields.jsx'
import { hasTrainingTarget } from '../../lib/preferences.js'
export { Choice, Field } from './Fields.jsx'

const TITLES = {
  welcome: 'Training, built around you.',
  goal: 'What’s your main goal?',
  experience: 'How much have you trained?',
  about: 'A little about you',
  sports: 'Do you play a sport?',
  'sport-choice': 'Which sports?',
  priority: 'What comes first?',
  location: 'Where do you usually train?',
  home: 'Do you also train at home?',
  equipment: 'What equipment do you have?',
  movement: 'What works in your space?',
  time: 'How long is a usual session?',
  rhythm: 'Target or no target?',
  comfort: 'Any areas to avoid?',
  photos: 'Your starting photos',
  manual: 'Your starting profile',
  review: 'Here’s your starting plan',
}
const DEV = import.meta.env.DEV
export default function TrainingProfile({ onClose }) {
  const { state, dispatch, toast, today } = useApp()
  const draft = state.settings.training.onboardingDraft
  const [p, setP] = useState(() => ({ ...profileOf(state), ...(draft?.profile || {}) }))
  const [name, setName] = useState(draft?.name ?? state.settings.name)
  const [weeklyGoal, setWeeklyGoal] = useState(draft?.weeklyGoal || state.settings.workout.weeklyGoal)
  const [goalMode, setGoalMode] = useState(
    draft?.goalMode || (hasTrainingTarget(state.settings) ? 'target' : 'flexible'),
  )
  const returning =
    state.settings.training.completed && state.settings.training.onboardingVersion === ONBOARDING_VERSION
  const [current, setCurrent] = useState(draft?.step || (returning ? 'review' : 'welcome'))
  const [editingGroup, setEditingGroup] = useState(draft?.editingGroup || null)
  const [environmentValid, setEnvironmentValid] = useState(true)
  const steps = onboardingSteps(p)
  const step = steps.includes(current) ? current : 'welcome'
  const index = steps.indexOf(step)
  const stage = onboardingStage(step)
  const latestTraining = useRef(state.settings.training)
  useEffect(() => {
    latestTraining.current = state.settings.training
  }, [state.settings.training])
  const committing = useRef(false)
  useEffect(() => {
    if (committing.current) return
    const flush = () => {
      if (committing.current) return
      const onboardingDraft = {
        profile: { ...p, onboardingDraft: undefined },
        step: current,
        name,
        weeklyGoal,
        goalMode,
        editingGroup,
      }
      dispatch({
        type: 'UPDATE_SETTINGS',
        patch: { training: { ...latestTraining.current, onboardingDraft } },
      })
    }
    const timer = setTimeout(flush, 400)
    const background = () => {
      if (document.hidden) flush()
    }
    document.addEventListener('visibilitychange', background)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', background)
    }
  }, [p, current, name, weeklyGoal, goalMode, editingGroup, dispatch])
  const set = (patch) => setP((prev) => ({ ...prev, ...patch }))
  const toggle = (key, value) =>
    set({ [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value] })
  const persist = (next = step, profile = p, group = editingGroup) =>
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: {
        training: {
          ...state.settings.training,
          onboardingDraft: {
            profile: { ...profile, onboardingDraft: undefined },
            step: next,
            name,
            weeklyGoal,
            goalMode,
            editingGroup: group,
          },
        },
      },
    })
  const close = () => {
    persist()
    onClose()
  }
  const move = (next, profile = p) => {
    setP(profile)
    setCurrent(next)
    persist(next, profile, next === 'review' ? null : editingGroup)
    if (next === 'review') setEditingGroup(null)
  }
  const manualEntry = p.manualEntry || manualEntryOf(p.manualBaseline, state.settings.weightUnit)
  const baselineReady = hasStartingProfile(p, state.checkins, DEV)
  const advance = () => {
    if (step === 'review') {
      if (!baselineReady) {
        move(p.baselineMode === 'manual' ? 'manual' : 'photos')
        return
      }
      committing.current = true
      const { onboardingDraft, manualEntry: unused, ...profile } = p
      dispatch({
        type: 'UPDATE_SETTINGS',
        patch: {
          name: name.trim().slice(0, 60),
          training: {
            ...profile,
            completed: true,
            eventMode: 'one-off',
            onboardingVersion: ONBOARDING_VERSION,
            onboardingDraft: undefined,
            ...(p.ageGroup === '13-17'
              ? { weakerSide: '', sideTestConfirmed: false, confirmedFocus: [] }
              : {}),
          },
          workout: { ...state.settings.workout, weeklyGoal, goalMode },
        },
      })
      const baselineMetric = initialBaselineMetric(state, p, today)
      if (baselineMetric) dispatch({ type: 'SET_METRIC', date: today, patch: baselineMetric })
      if (returning) toast('Preferences saved')
      onClose()
      return
    }
    if (step === 'manual') {
      const result = readManualBaseline(manualEntry)
      if (!result.valid) return
      move('review', { ...p, baselineMode: 'manual', manualBaseline: { ...result.value, date: today } })
      return
    }
    move(nextOnboardingStep(step, p, editingGroup))
  }
  const back = () => {
    if (step === editingGroup || (step === 'manual' && returning)) {
      setCurrent('review')
      setEditingGroup(null)
      return
    }
    if (step === 'manual') {
      move('photos', { ...p, baselineMode: 'photos' })
      return
    }
    move(steps[Math.max(0, index - 1)])
  }
  const testExit =
    !returning && DEV ? (
      <button
        title="Exit setup for testing"
        aria-label="Exit setup for testing"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint"
        onClick={close}
      >
        <Icon name="x" size={13} />
      </button>
    ) : null
  const plan =
    step === 'review'
      ? buildDailyPlan({ ...state, settings: { ...state.settings, training: p } }, { today })
      : null
  if (step === 'photos')
    return (
      <PhotoCheckins
        onboarding
        profile={p}
        onClose={close}
        onBack={() => move('comfort')}
        onManual={() => move('manual', { ...p, baselineMode: 'manual', manualEntry })}
        onComplete={(checkin, focusPatch) =>
          move('review', {
            ...p,
            ...focusPatch,
            baselineMode: checkin.synthetic ? 'test' : 'photos',
            baselinePhotoId: checkin.id,
          })
        }
      />
    )
  return (
    <Modal
      open
      fullScreen
      dismissible={returning}
      headerAction={testExit}
      onClose={close}
      title={TITLES[step]}
      subtitle={
        returning ? 'Changes save when you finish' : `${stage.label} · ${stage.index + 1} of ${stage.total}`
      }
      bodyKey={step}
      footer={
        <div className="flex gap-3">
          {index > 0 && !(returning && step === 'review') && (
            <button className="btn-secondary min-h-12 px-5" onClick={back}>
              Back
            </button>
          )}
          <button
            className="btn-primary min-h-12 flex-1"
            disabled={
              (step === 'equipment' && !environmentValid) ||
              (step === 'sport-choice' && !p.sports.length) ||
              (step === 'manual' && !readManualBaseline(manualEntry).valid)
            }
            onClick={advance}
          >
            {step === 'welcome'
              ? 'Build my plan'
              : step === 'review'
                ? !baselineReady
                  ? 'Finish starting profile'
                  : returning
                    ? 'Save changes'
                    : 'Go to my plan'
                : 'Continue'}
          </button>
        </div>
      }
    >
      {!returning && (
        <div
          className="mt-3 h-1 rounded-full bg-line"
          aria-label={`Setup ${Math.round(((stage.index + 1) / stage.total) * 100)} percent complete`}
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${((stage.index + 1) / stage.total) * 100}%` }}
          />
        </div>
      )}
      <div className="onboarding-question animate-fade-in">
        {step === 'welcome' && (
          <>
            <div className="mt-5 flex items-center gap-2 text-[14px] font-semibold">
              <TallyLogo width={26} />
              Tally
            </div>
            <p className="mt-7 text-[19px] leading-relaxed text-ink2">
              Photos set your start. Your day shapes each workout.
            </p>
            <div className="mt-8 space-y-3">
              {[
                ['camera', 'Start with your photos', 'Front, side and back'],
                ['train', 'Get your next workout', 'Exercises, sets and guidance'],
                ['sport', 'Warm up or keep it short', 'For your sport or a busy day'],
              ].map(([icon, title, detail], i) => (
                <div key={title} className="setup-feature">
                  <span className="icon-tile !h-14 !w-14 text-accent">
                    <Icon name={icon} size={25} />
                  </span>
                  <span>
                    <span className="block text-[17px] font-semibold">{title}</span>
                    <span className="mt-1 block text-[14px] text-muted">{detail}</span>
                  </span>
                  <span className="num ml-auto text-[22px] text-faint">0{i + 1}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 'goal' && (
          <Cards values={GOALS.map((g) => [g, g])} value={p.goal} onChange={(goal) => set({ goal })} />
        )}
        {step === 'experience' && (
          <Cards
            values={[
              ['Starting out', 'New or returning'],
              ['Some experience', 'I’ve trained before'],
              ['Experienced', 'I train regularly'],
            ]}
            value={p.experience}
            onChange={(experience) => set({ experience })}
          />
        )}
        {step === 'about' && (
          <>
            <Field label="Name (optional)">
              <input
                className="input"
                aria-label="Your name"
                value={name}
                maxLength={60}
                placeholder="First name"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Gender">
              <div className="grid grid-cols-2 gap-2">
                {['Man', 'Woman', 'Non-binary', 'Prefer not to say'].map((v) => (
                  <Choice key={v} value={v} selected={p.gender === v} onClick={(gender) => set({ gender })} />
                ))}
              </div>
            </Field>
            <Field label="Age group">
              <div className="grid grid-cols-2 gap-2">
                {['13-17', '18+'].map((v) => (
                  <Choice
                    key={v}
                    value={v}
                    selected={p.ageGroup === v}
                    onClick={(ageGroup) => set({ ageGroup })}
                  />
                ))}
              </div>
            </Field>
          </>
        )}
        {step === 'sports' && (
          <Cards
            values={[
              [true, 'Yes'],
              [false, 'No sport right now'],
            ]}
            value={Boolean(p.wantsSport || p.sports.length)}
            onChange={(yes) => set({ wantsSport: yes, sports: yes ? p.sports : [] })}
          />
        )}
        {step === 'sport-choice' && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            {SPORTS.map((s) => (
              <Choice
                key={s.id}
                value={s.id}
                selected={p.sports.includes(s.id)}
                onClick={() => toggle('sports', s.id)}
              >
                {s.name}
              </Choice>
            ))}
          </div>
        )}
        {step === 'priority' && (
          <Cards
            values={[
              ['goal', p.goal],
              ['balanced', 'A balance of both'],
              [
                'sport',
                p.sports.map((id) => SPORTS.find((s) => s.id === id)?.name).join(' / ') || 'My sport',
              ],
            ]}
            value={p.sportPriority}
            onChange={(sportPriority) => set({ sportPriority })}
          />
        )}
        {step === 'location' && (
          <Cards
            values={placesOf(p).map((place) => [
              place.id,
              place.name,
              { gym: 'Full gym equipment', home: 'My own equipment', 'on-the-go': 'Bodyweight' }[place.id] ||
                placeSummary(place),
            ])}
            value={p.location}
            onChange={(location) => set({ location, ...(location === 'home' ? { hasHomeSetup: true } : {}) })}
          />
        )}
        {step === 'home' && (
          <Cards
            values={[
              [true, 'Yes, sometimes'],
              [false, 'No'],
            ]}
            value={Boolean(p.hasHomeSetup)}
            onChange={(hasHomeSetup) => set({ hasHomeSetup })}
          />
        )}
        {step === 'equipment' && (
          <EnvironmentFields
            place={resolvePlace(p, 'home')}
            compact
            onChange={(patch) => setP((prev) => updatePlace(prev, 'home', patch))}
            unit={state.settings.weightUnit}
            onValidityChange={setEnvironmentValid}
          />
        )}
        {step === 'movement' && <MovementFields value={p.onTheGo} onChange={(onTheGo) => set({ onTheGo })} />}
        {step === 'time' && (
          <Cards
            values={[
              [15, '15 minutes'],
              [30, '30 minutes'],
              [45, '45 minutes'],
              [20, 'It changes', 'Ask me before each session'],
            ]}
            value={p.flexibleTime ? 20 : p.minutes}
            onChange={(minutes) => set({ minutes, flexibleTime: minutes === 20 })}
          />
        )}
        {step === 'rhythm' && (
          <>
            <Cards
              values={[
                ['flexible', 'No weekly target'],
                ['target', 'Use a rough target'],
              ]}
              value={goalMode}
              onChange={setGoalMode}
            />
            {goalMode === 'target' && (
              <Field label="Days in any seven">
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Choice key={n} value={n} selected={weeklyGoal === n} onClick={setWeeklyGoal}>
                      {n} days
                    </Choice>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        {step === 'comfort' && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {MUSCLES.filter((m) => !['Cardio', 'Mobility'].includes(m)).map((m) => (
                <Choice
                  key={m}
                  value={m}
                  selected={p.avoidMuscles.includes(m)}
                  onClick={() => toggle('avoidMuscles', m)}
                />
              ))}
            </div>
            <button className="btn-ghost mt-4 w-full" onClick={() => set({ avoidMuscles: [] })}>
              Nothing to avoid
            </button>
          </>
        )}
        {step === 'manual' && (
          <>
            <p className="mt-5 text-[15px] text-muted">Your starting point, without photos.</p>
            <ManualBaselineFields value={manualEntry} onChange={(manualEntry) => set({ manualEntry })} />
            <button
              className="btn-ghost mt-4 w-full"
              onClick={() => move('photos', { ...p, baselineMode: 'photos' })}
            >
              Use photos instead
            </button>
          </>
        )}
        {step === 'review' && (
          <>
            <div className="mt-5 rounded-tuck bg-bg/70 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold">
                  {plan.name}{' '}
                  <span className="font-normal text-muted">· {count(plan.items.length, 'exercise')}</span>
                </h3>
                <Icon name="train" size={22} className="text-accent" />
              </div>
              <div className="mt-4 divide-y divide-line">
                {plan.items.map((it) => (
                  <div key={it.exId} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[15px]">{findExercise(it.exId)?.name}</span>
                    <span className="shrink-0 text-[13px] text-muted">
                      {it.sets} {it.sets === 1 ? 'set' : 'sets'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-muted">
                {p.sports.length
                  ? 'Includes your sport. Adjusted before you start.'
                  : 'Fits your usual time and place.'}
              </p>
            </div>
            <div className="mt-5 divide-y divide-line">
              {[
                ['goal', p.goal],
                [
                  'time',
                  `${p.minutes} min · ${goalMode === 'flexible' ? 'no weekly target' : `${weeklyGoal} days in any 7`}`,
                ],
                ['location', p.location === 'home' ? 'Home setup' : resolvePlace(p, p.location).name],
                [
                  'sports',
                  p.sports.length
                    ? p.sports.map((id) => SPORTS.find((s) => s.id === id)?.name).join(', ')
                    : 'No sport',
                ],
                [
                  p.baselineMode === 'manual' ? 'manual' : 'photos',
                  p.baselineMode === 'manual'
                    ? 'Manual starting profile'
                    : p.baselineMode === 'test'
                      ? 'Test photos'
                      : baselineReady
                        ? 'Starting photos added'
                        : 'Add starting photos',
                ],
              ].map(([group, label]) => (
                <button
                  key={group}
                  className="list-row !min-h-14"
                  onClick={() => {
                    setCurrent(group)
                    setEditingGroup(group)
                  }}
                >
                  <span className="flex-1 text-[14px]">{label}</span>
                  <Icon name="edit" size={15} className="text-muted" />
                </button>
              ))}
            </div>
            {returning && (
              <button
                className="btn-ghost mt-4 min-h-11 w-full"
                onClick={() => {
                  setCurrent('welcome')
                  setEditingGroup(null)
                  persist('welcome', p, null)
                }}
              >
                Review setup from the start
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
function Cards({ values, value, onChange }) {
  return (
    <div className="mt-7 space-y-3">
      {values.map(([id, title, detail]) => (
        <button
          key={String(id)}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`onboarding-choice ${value === id ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[20px] font-semibold">{title}</span>
            {detail && <span className="mt-1.5 block text-[14px] text-muted">{detail}</span>}
          </span>
          <span
            className={`dot h-7 w-7 shrink-0 border ${value === id ? 'border-accent text-accent' : 'border-outline text-transparent'}`}
          >
            <Icon name="check" size={16} />
          </span>
        </button>
      ))}
    </div>
  )
}
