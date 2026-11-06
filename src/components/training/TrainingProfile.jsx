import { count } from '../../lib/presentation.js'
import './onboarding.css'
import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { profileOf, buildDailyPlan } from '../../lib/planner.js'
import { SPORTS } from '../../lib/sports.js'
import { findExercise } from '../../lib/exercises.js'
import {
  ONBOARDING_VERSION,
  onboardingSteps,
  nextOnboardingStep,
  onboardingProgress,
  onboardingResponse,
  shouldShowOnboardingResponse,
  restoredOnboardingResponse,
} from '../../lib/onboarding.js'
import {
  hasStartingProfile,
  initialBaselineMetric,
  manualEntryOf,
  readManualBaseline,
} from '../../lib/starting-profile.js'
import {
  ChoiceArt,
  GuideBubble,
  ImageChoices,
  PlanRibbon,
  SetupHeader,
  SetupIllustration,
  SetupResponse,
  SetupWelcome,
} from './SetupVisuals.jsx'
import ExerciseThumbs from '../ExerciseThumbs.jsx'
import { onboardingScene } from '../../lib/onboarding-art.js'
import BodyAreaPicker from './BodyAreaPicker.jsx'
import EnvironmentFields from './EnvironmentFields.jsx'
import { placeSummary, placesOf, resolvePlace, updatePlace } from '../../lib/places.js'
import MovementFields from './MovementFields.jsx'
import ManualBaselineFields from './ManualBaselineFields.jsx'
import PhotoCheckins from './PhotoCheckins.jsx'
import { Choice, Field } from './Fields.jsx'
import { hasTrainingTarget } from '../../lib/preferences.js'
export { Choice, Field } from './Fields.jsx'

const TITLES = {
  welcome: 'Welcome to Tally',
  goal: 'What’s your main goal?',
  experience: 'How familiar is training?',
  about: 'A little about you',
  sports: 'Do you play a sport?',
  'sport-choice': 'Which sports?',
  priority: 'What comes first?',
  location: 'Where do you usually train?',
  home: 'Do you also train at home?',
  equipment: 'What’s at home?',
  'home-loads': 'Which dumbbells are at home?',
  movement: 'What works in your space?',
  time: 'How much time usually works?',
  rhythm: 'How much structure feels right?',
  comfort: 'Any areas to avoid?',
  photos: 'Your starting photos',
  manual: 'Your starting profile',
  review: 'Your first session',
}
const HINTS = {
  'home-loads': 'Weight of one dumbbell. Leave empty if you’re not sure.',
  comfort: 'These areas stay out of your suggested workouts.',
}
// What M1 says on each question. Shorter than the plain title, same meaning.
const GUIDE = {
  goal: 'What are we training for?',
  experience: 'How familiar is training?',
  about: 'A little about you',
  sports: 'Play any sports?',
  'sport-choice': 'Which ones?',
  priority: 'What comes first?',
  location: 'Where do you usually train?',
  home: 'Do you also train at home?',
  equipment: 'What’s at home?',
  'home-loads': 'Which dumbbells are there?',
  movement: 'What works in your space?',
  time: 'How much time usually works?',
  rhythm: 'How much structure feels right?',
  comfort: 'Any areas to avoid?',
  manual: 'Your starting profile',
  review: 'Here’s your first session',
}
// Questions without their own artwork show one lit scene; it never repeats on the reply.
const STAGED = ['experience', 'priority', 'home', 'movement', 'time', 'rhythm']
const BADGE = { goal: 'Goal set', 'sport-choice': 'Sports added', time: 'Time set', priority: 'Priority set' }
const LOCATION_SCENE = { gym: 'gym', home: 'equipment', 'on-the-go': 'movement' }
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
  const [responseFor, setResponseFor] = useState(() =>
    returning ? null : restoredOnboardingResponse(draft, p),
  )
  const [sportSearch, setSportSearch] = useState('')
  const [allSports, setAllSports] = useState(false)
  const [editingGroup, setEditingGroup] = useState(draft?.editingGroup || null)
  const [environmentValid, setEnvironmentValid] = useState(true)
  const steps = onboardingSteps(p)
  const step = steps.includes(current) ? current : 'welcome'
  const index = steps.indexOf(step)
  const heading = useRef(null)
  const response = responseFor ? onboardingResponse(responseFor, { ...p, goalMode, weeklyGoal }) : null
  const nextStep = nextOnboardingStep(step, p, editingGroup)
  const progress = editingGroup
    ? 100
    : ['welcome', 'goal'].includes(step) && !responseFor
      ? null
      : onboardingProgress(responseFor ? nextStep : step)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [step, responseFor])
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
        responseFor,
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
  }, [p, current, name, weeklyGoal, goalMode, editingGroup, responseFor, dispatch])
  const set = (patch) => setP((prev) => ({ ...prev, ...patch }))
  const toggle = (key, value) =>
    set({ [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value] })
  const persist = (next = step, profile = p, group = editingGroup, responseStep = responseFor) =>
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
            responseFor: responseStep,
          },
        },
      },
    })
  const close = () => {
    persist()
    onClose()
  }
  const move = (next, profile = p) => {
    setResponseFor(null)
    setP(profile)
    setCurrent(next)
    persist(next, profile, next === 'review' ? null : editingGroup, null)
    if (next === 'review') setEditingGroup(null)
  }
  const manualEntry = p.manualEntry || manualEntryOf(p.manualBaseline, state.settings.weightUnit)
  const baselineReady = hasStartingProfile(p, state.checkins, DEV)
  const advance = () => {
    if (responseFor) {
      move(nextStep)
      return
    }
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
    if (!returning && !editingGroup && shouldShowOnboardingResponse(step, p)) {
      setResponseFor(step)
      persist(step, p, editingGroup, step)
      return
    }
    move(nextStep)
  }
  const back = () => {
    if (responseFor) {
      setResponseFor(null)
      persist(step, p, editingGroup, null)
      return
    }
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
        setupProgress={onboardingProgress('photos')}
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
      header={
        !returning ? (
          <SetupHeader progress={progress} onBack={index > 0 ? back : null} action={testExit} />
        ) : null
      }
      hideHandle={!returning}
      className={!returning ? 'setup-dialog' : ''}
      bodyClassName={!returning ? 'setup-body' : ''}
      footerClassName={!returning ? 'setup-footer' : ''}
      onClose={close}
      title={response ? response[0] : returning && step === 'review' ? 'Your training setup' : TITLES[step]}
      subtitle={returning ? 'Changes save when you finish' : null}
      bodyKey={`${step}:${responseFor || 'question'}`}
      footer={
        <div className="flex gap-3">
          {returning && index > 0 && step !== 'review' && (
            <button className="btn-secondary min-h-12 px-5" onClick={back}>
              Back
            </button>
          )}
          <button
            className="btn-primary min-h-12 flex-1"
            disabled={
              (['equipment', 'home-loads'].includes(step) && !environmentValid) ||
              (step === 'sport-choice' && !p.sports.length) ||
              (step === 'manual' && !readManualBaseline(manualEntry).valid)
            }
            onClick={advance}
          >
            {responseFor
              ? 'Continue'
              : step === 'welcome'
                ? 'Build my plan'
                : step === 'review'
                  ? !baselineReady
                    ? 'Finish starting profile'
                    : returning
                      ? 'Save changes'
                      : 'Open my dashboard'
                  : 'Continue'}
          </button>
        </div>
      }
    >
      <div
        className={`onboarding-question ${!returning ? `setup-page setup-page--${responseFor ? 'response' : step}` : ''}`}
      >
        {response ? (
          <SetupResponse
            scene={onboardingScene(step, p, true)}
            badge={BADGE[step]}
            title={response[0]}
            copy={response[1]}
            headingRef={heading}
          />
        ) : (
          <>
            {!returning && step !== 'welcome' && (
              <GuideBubble headingRef={heading}>{GUIDE[step] || TITLES[step]}</GuideBubble>
            )}
            {!returning && STAGED.includes(step) && (
              <SetupIllustration scene={onboardingScene(step, p)} variant="question" />
            )}
            {!returning && step === 'sport-choice' && <SetupIllustration scene="sports" variant="sports" />}
            {HINTS[step] && <p className="setup-hint">{HINTS[step]}</p>}
            {step === 'welcome' && <SetupWelcome headingRef={heading} />}
            {step === 'goal' && (
              <ImageChoices
                label="Main goal"
                options={[
                  ['Build muscle', 'Build muscle', 'muscle'],
                  ['Get stronger', 'Get stronger', 'strength'],
                  ...(p.ageGroup !== '13-17' ? [['Lose weight', 'Lose weight', 'weight']] : []),
                  ['General fitness', 'Feel fitter', 'rhythm'],
                ]}
                value={p.goal}
                onChange={(goal) => set({ goal })}
              />
            )}
            {step === 'experience' && (
              <Cards
                kind="experience"
                values={[
                  ['Starting out', 'New or returning'],
                  ['Some experience', 'I know the basics'],
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
                      <Choice
                        key={v}
                        value={v}
                        selected={p.gender === v}
                        onClick={(gender) => set({ gender })}
                      />
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
                        onClick={(ageGroup) =>
                          set({
                            ageGroup,
                            ...(ageGroup === '13-17' && p.goal === 'Lose weight'
                              ? { goal: 'General fitness' }
                              : {}),
                          })
                        }
                      />
                    ))}
                  </div>
                </Field>
              </>
            )}
            {step === 'sports' && (
              <ImageChoices
                label="Sport"
                layout="rows"
                options={[
                  [true, 'Yes, I play', 'sports', 'Warm-ups fit your sport'],
                  [false, 'No sport right now', 'neutral', 'Training follows your goal'],
                ]}
                value={Boolean(p.wantsSport || p.sports.length)}
                onChange={(yes) => set({ wantsSport: yes, sports: yes ? p.sports : [] })}
              />
            )}
            {step === 'sport-choice' && (
              <>
                <input
                  type="search"
                  className="input mt-3"
                  aria-label="Find a sport"
                  placeholder="Find a sport"
                  value={sportSearch}
                  onChange={(e) => setSportSearch(e.target.value)}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SPORTS.filter((s, i) =>
                    sportSearch.trim()
                      ? s.name.toLowerCase().includes(sportSearch.toLowerCase().trim())
                      : allSports || i < 8 || p.sports.includes(s.id),
                  ).map((s) => (
                    <Choice
                      key={s.id}
                      value={s.id}
                      selected={p.sports.includes(s.id)}
                      onClick={() => toggle('sports', s.id)}
                    >
                      <span className="block font-semibold">{s.name}</span>
                    </Choice>
                  ))}
                </div>
                {!sportSearch.trim() && (
                  <button
                    type="button"
                    className="btn-ghost mt-2 min-h-11 w-full"
                    onClick={() => setAllSports(!allSports)}
                  >
                    {allSports ? 'Show fewer sports' : 'More sports'}
                  </button>
                )}
                {sportSearch.trim() &&
                  !SPORTS.some((s) => s.name.toLowerCase().includes(sportSearch.toLowerCase().trim())) && (
                    <p className="mt-3 text-[14px] text-muted">No match. Try another name.</p>
                  )}
              </>
            )}
            {step === 'priority' && (
              <Cards
                values={[
                  ['goal', p.goal],
                  ['balanced', 'A balance of both'],
                  [
                    'sport',
                    p.sports.length === 1
                      ? SPORTS.find((s) => s.id === p.sports[0])?.name || 'My sport'
                      : 'My sports',
                  ],
                ]}
                value={p.sportPriority}
                onChange={(sportPriority) => set({ sportPriority })}
              />
            )}
            {step === 'location' && (
              <ImageChoices
                label="Usual place"
                layout="rows"
                options={placesOf(p).map((place) => [
                  place.id,
                  place.name,
                  LOCATION_SCENE[place.id] || LOCATION_SCENE[place.base] || 'location',
                  { gym: 'Full gym equipment', home: 'What you own', 'on-the-go': 'Bodyweight, any room' }[
                    place.id
                  ] || placeSummary(place),
                ])}
                value={p.location}
                onChange={(location) =>
                  set({ location, ...(location === 'home' ? { hasHomeSetup: true } : {}) })
                }
              />
            )}
            {step === 'home' && (
              <Cards
                values={[
                  [true, 'Yes, sometimes'],
                  [false, 'Not for now'],
                ]}
                value={Boolean(p.hasHomeSetup)}
                onChange={(hasHomeSetup) => set({ hasHomeSetup })}
              />
            )}
            {['equipment', 'home-loads'].includes(step) && (
              <EnvironmentFields
                place={resolvePlace(p, 'home')}
                compact
                variant="icons"
                section={step === 'equipment' ? 'equipment' : 'loads'}
                onChange={(patch) => setP((prev) => updatePlace(prev, 'home', patch))}
                unit={state.settings.weightUnit}
                onValidityChange={setEnvironmentValid}
              />
            )}
            {step === 'movement' && (
              <MovementFields value={p.onTheGo} onChange={(onTheGo) => set({ onTheGo })} />
            )}
            {step === 'time' && (
              <Cards
                kind="time"
                values={[
                  [15, 'Keep it short'],
                  [30, 'Half an hour'],
                  [45, 'A little longer'],
                  ...(![15, 30, 45].includes(p.minutes) && !p.flexibleTime
                    ? [[p.minutes, 'My usual session']]
                    : []),
                  ['flexible', 'It changes'],
                ]}
                value={p.flexibleTime ? 'flexible' : p.minutes}
                onChange={(minutes) =>
                  set(minutes === 'flexible' ? { flexibleTime: true } : { minutes, flexibleTime: false })
                }
              />
            )}
            {step === 'rhythm' && (
              <>
                <Cards
                  kind="rhythm"
                  values={[
                    ['flexible', 'Take it as it comes'],
                    ['target', 'A rough weekly target'],
                  ]}
                  value={goalMode}
                  onChange={setGoalMode}
                />
                {goalMode === 'target' && (
                  <Field label="Training days in any seven days">
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <Choice key={n} value={n} selected={weeklyGoal === n} onClick={setWeeklyGoal}>
                          {count(n, 'day')}
                        </Choice>
                      ))}
                    </div>
                  </Field>
                )}
              </>
            )}
            {step === 'comfort' && (
              <BodyAreaPicker
                value={p.avoidMuscles}
                onChange={(avoidMuscles) => set({ avoidMuscles })}
                label="Areas to avoid"
              />
            )}
            {step === 'manual' && (
              <>
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
                <section className="lit-card mt-5 p-4" aria-label="First session preview">
                  <p className="text-[13px] font-bold text-accent-ink">
                    {returning
                      ? 'Current plan'
                      : name.trim()
                        ? `${name.trim().split(' ')[0]}’s first session`
                        : 'Built from your answers'}
                  </p>
                  <h4 className="mt-2 font-display text-[28px] leading-tight">{plan.name}</h4>
                  <p className="mt-1 text-[14px] font-semibold text-ink2">
                    {count(plan.items.length, 'exercise')} · {plan.requestedMinutes} min
                  </p>
                  <ExerciseThumbs items={plan.items} className="mt-4" />
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer text-[14px] font-semibold">
                      All exercises
                    </summary>
                    <PlanRibbon items={plan.items} findExercise={findExercise} />
                    <div className="mt-2 divide-y divide-line/70">
                      {plan.items.map((it) => (
                        <div key={it.exId} className="flex items-center justify-between gap-3 py-3">
                          <span className="text-[15px]">{findExercise(it.exId)?.name}</span>
                          <span className="shrink-0 text-[13px] text-muted">
                            {it.sets} {it.sets === 1 ? 'set' : 'sets'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </section>
                <div className="checklist mt-5">
                  {[
                    ['goal', p.goal],
                    [
                      'time',
                      `${p.flexibleTime ? 'Time varies' : `${p.minutes} min`} · ${goalMode === 'flexible' ? 'no weekly target' : `${weeklyGoal} days in any 7`}`,
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
                          ? 'Starting photos'
                          : baselineReady
                            ? 'Starting photos added'
                            : 'Add starting photos',
                    ],
                  ].map(([group, label]) => {
                    const pending = ['photos', 'manual'].includes(group) && !baselineReady
                    return (
                      <button
                        key={group}
                        className="checklist-row"
                        aria-label={`Edit ${CHECK_LABEL[group]}: ${label}`}
                        onClick={() => {
                          setCurrent(group)
                          setEditingGroup(group)
                        }}
                      >
                        <span className={`checklist-mark ${pending ? 'is-pending' : ''}`} aria-hidden="true">
                          {!pending && <Icon name="check" size={13} strokeWidth={3.2} />}
                        </span>
                        <span className="w-[74px] shrink-0 text-[14px] text-muted">{CHECK_LABEL[group]}</span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{label}</span>
                        <Icon name="edit" size={15} className="shrink-0 text-muted" />
                      </button>
                    )
                  })}
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
          </>
        )}
      </div>
    </Modal>
  )
}
const CHECK_LABEL = {
  goal: 'Goal',
  time: 'Time',
  location: 'Place',
  sports: 'Sports',
  photos: 'Start',
  manual: 'Start',
}
function Cards({ values, value, onChange, kind }) {
  return (
    <div className={`setup-options ${kind === 'time' ? 'setup-options--grid' : ''}`}>
      {values.map(([id, title]) => {
        const on = value === id
        const art = kind ? <ChoiceArt kind={kind} value={id} /> : null
        return (
          <button
            key={String(id)}
            type="button"
            aria-label={kind === 'time' && typeof id === 'number' ? `${id} minutes, ${title}` : undefined}
            aria-pressed={on}
            onClick={() => onChange(id)}
            className="tile onboarding-choice"
          >
            {art}
            <span className="min-w-0 flex-1 text-[17px] font-bold leading-snug">{title}</span>
            <span className={`choice-ring ${on ? 'is-on' : ''}`} aria-hidden="true">
              {on && <Icon name="check" size={14} strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
