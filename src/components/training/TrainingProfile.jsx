import { count } from '../../lib/presentation.js'
import './onboarding.css'
import { physiqueOptions, physiqueChoice } from '../../lib/physique-preferences.js'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  onboardingStage,
  chapterFills,
  chapterRecap,
  restoredOnboardingResponse,
  editableStep,
  PAYWALL_STEPS,
} from '../../lib/onboarding.js'
import { isStoryStep, NIGHT_STEPS, OWN_CTA_STEPS } from '../../lib/onboarding-story.js'
import OnboardingStory from './OnboardingStory.jsx'
import { BASELINE_MINUTES, baselineMoves } from '../../lib/baseline.js'
import {
  hasStartingProfile,
  initialBaselineMetric,
  manualEntryOf,
  readManualBaseline,
} from '../../lib/starting-profile.js'
import { PlanRibbon, SetupHeader, SetupRecap } from './SetupVisuals.jsx'
import { ArtOptions, QuestionHead, StoryOptions } from './OnboardingQuestions.jsx'
import { FirstSession } from './OnboardingStoryMore.jsx'
import { ONBOARDING_BARRIERS, toggleOnboardingBarrier } from '../../lib/onboarding-demo.js'
import { EXPERIENCE_OPTIONS, TIME_OPTIONS, VARIETY_OPTIONS } from '../../lib/onboarding-questions.js'
import ExerciseThumbs from '../ExerciseThumbs.jsx'
import { onboardingScene } from '../../lib/onboarding-art.js'
import BodyAreaPicker from './BodyAreaPicker.jsx'
import EnvironmentFields from './EnvironmentFields.jsx'
import { placesOf, resolvePlace, updatePlace } from '../../lib/places.js'
import MovementFields from './MovementFields.jsx'
import ManualBaselineFields from './ManualBaselineFields.jsx'
import PhotoCheckins from './PhotoCheckins.jsx'
import { Choice, Field } from './Fields.jsx'
import { hasTrainingTarget } from '../../lib/preferences.js'
import { experienceSuggestion } from '../../lib/strength/index.js'
export { Choice, Field } from './Fields.jsx'

const TITLES = {
  welcome: 'Welcome to Tally',
  goal: 'What’s your main goal?',
  physique: 'What would you like to build toward?',
  experience: 'How familiar is training?',
  barriers: 'What gets in the way?',
  'photo-choice': 'How would you like to start?',
  variety: 'What keeps training interesting?',
  about: 'What should we call you?',
  gender: 'How do you describe yourself?',
  age: 'Which age group?',
  sports: 'Do you play a sport?',
  'sport-choice': 'Which sports?',
  priority: 'What comes first?',
  location: 'Where do you usually train?',
  home: 'Do you also train at home?',
  equipment: 'What’s at home?',
  'home-loads': 'Which dumbbells are at home?',
  movement: 'What works in your space?',
  time: 'How much time usually works?',
  rhythm: 'How often can you train?',
  problem: 'Ever had a plan fall apart?',
  'solution-demo': 'Tally re-plans around real life',
  'year-demo': 'Your year in sessions',
  'fix-demo': 'Here’s the fix',
  'squeeze-demo': 'Squeeze a session',
  'midworkout-demo': 'Less time mid-workout',
  'rollover-demo': 'Where cut moves go',
  'feel-demo': 'Weights from a tap',
  'tally-demo': 'Your first tally',
  'path-demo': 'Your first month',
  fallout: 'What happens next?',
  'loop-demo': 'The restart loop',
  'barrier-unsure-demo': 'Exercise guides',
  'barrier-enjoyment-demo': 'Swap a move',
  'recent-demo': 'Recovery between sessions',
  'photo-demo': 'Starting photos',
  'proof-demo': 'Why a time helps',
  pledge: 'How committed are you?',
  'value-demo': 'What Tally costs',
  'ready-demo': 'Your plan is ready',
  paywall: 'Start your plan free',
  'paywall-reminder': 'Trial reminder',
  'paywall-plans': 'Choose a plan',
  comfort: 'Any areas to avoid?',
  photos: 'Your starting photos',
  manual: 'Your details',
  review: 'Your plan',
  offer: 'Keep this plan going',
  'goal-demo': 'Your goal in action',
  'why-demo': 'Why most plans don’t last',
  'building-demo': 'Building your plan',
  'barrier-demo': 'Your training, adapted',
  'sport-demo': 'Your sport warm-up',
  'equipment-demo': 'Train in different places',
  'time-demo': 'Training that fits your time',
  'consistency-demo': 'Small sessions add up',
  'planning-demo': 'Less time choosing workouts',
  'recovery-demo': 'Training with how you feel',
}
const HINTS = {
  'home-loads': 'Weight of one dumbbell. Leave empty if you’re not sure.',
}
// What the main button says where "Continue" would undersell the moment.
const NEXT_LABEL = {
  'why-demo': 'Show me',
  'barrier-demo': 'That works for me',
  'building-demo': 'See my plan',
  commit: 'Continue',
  welcome: 'Build my plan',
  'solution-demo': 'Let’s build yours',
  'year-demo': 'Make them count',
  'fix-demo': 'That works for me',
  'squeeze-demo': 'Looks good',
  'midworkout-demo': 'Where do cuts go?',
  'rollover-demo': 'Smart. Continue',
  'tally-demo': 'Keep going',
  'path-demo': 'This is my plan',
  'loop-demo': 'Break the loop',
  'goal-demo': 'That’s what I want',
  'barrier-unsure-demo': 'That helps',
  'barrier-enjoyment-demo': 'Nice',
  'equipment-demo': 'Handy',
  'sport-demo': 'Ready to play',
  'recent-demo': 'Makes sense',
  'recovery-demo': 'I like that',
  'photo-demo': 'Continue',
  'proof-demo': 'Let’s do it',
  'value-demo': 'Sounds fair',
  'ready-demo': 'Unlock my plan',
}
// The main button's motion on a few story screens.
const CTA_MOTION = { welcome: 'story-cta--glow', 'ready-demo': 'story-cta--shine' }
const LOCATION_SCENE = { gym: 'gym', home: 'equipment', 'on-the-go': 'movement' }
const PLACE_DETAIL = { gym: 'Any equipment', home: 'What you have at home', 'on-the-go': 'No equipment at all' }
const timePatch = (minutes) => (minutes === 'flexible' ? { flexibleTime: true } : { minutes, flexibleTime: false })
const placePatch = (location) => ({ location, ...(location === 'home' ? { hasHomeSetup: true } : {}) })
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
  // After enough consistent training, suggest the next level (never automatic).
  const suggestedLevel = returning
    ? experienceSuggestion({
        workouts: state.workouts,
        experience: state.settings.training.experience,
        today,
      })
    : null
  const [current, setCurrent] = useState(draft?.step || (returning ? 'review' : 'welcome'))
  const [responseFor, setResponseFor] = useState(() =>
    returning ? null : restoredOnboardingResponse(draft, p),
  )
  const [sportSearch, setSportSearch] = useState('')
  const [allSports, setAllSports] = useState(false)
  const [editingGroup, setEditingGroup] = useState(draft?.editingGroup || null)
  const [environmentValid, setEnvironmentValid] = useState(true)
  const [demoNow] = useState(Date.now)
  const steps = onboardingSteps(p).filter((s) => !editingGroup || editableStep(s))
  // Saved drafts from earlier versions of the flow resume at the nearest step.
  const migratedStep =
    {
      commit: 'photo-demo',
      'why-demo': 'barriers',
      'barrier-demo': steps.find((id) => id.startsWith('barrier-')) || 'variety',
      'planning-demo': 'comfort',
      'time-demo': 'recent-demo',
      'compress-demo': 'recent-demo',
      'consistency-demo': 'recent-demo',
      'rotation-demo': 'comfort',
      'warmup-time-demo': 'sport-demo',
      'warmup-energy-demo': 'sport-demo',
      'photo-purpose-demo': 'photo-demo',
      'photo-use-demo': 'photo-demo',
      'photo-privacy-demo': 'photo-demo',
      'barrier-time-demo': steps.find((id) => id.startsWith('barrier-')) || 'variety',
      'barrier-compress-demo': steps.find((id) => id.startsWith('barrier-')) || 'variety',
      'barrier-schedule-demo': steps.find((id) => id.startsWith('barrier-')) || 'variety',
      'barrier-starting-demo': steps.find((id) => id.startsWith('barrier-')) || 'variety',
      'barrier-form-demo': 'variety',
      offer: 'ready-demo',
    }[current] || current
  const step = steps.includes(migratedStep) ? migratedStep : 'welcome'
  const index = steps.indexOf(step)
  const heading = useRef(null)
  const recap = responseFor ? chapterRecap(responseFor, { ...p, goalMode, weeklyGoal, name }) : null
  const nextStep = nextOnboardingStep(step, p, editingGroup)
  // Welcome carries the brand; every question after it shows the five chapters.
  const fills = ['welcome', 'goal', ...PAYWALL_STEPS].includes(step)
    ? null
    : editingGroup
      ? [1, 1, 1, 1, 1]
      : chapterFills(step, p, Boolean(recap))
  // Someone new starts with the starting-point session (lib/baseline.js);
  // the review says so, and lets them skip it.
  const startingMoves = useMemo(() => {
    if (step !== 'review') return 0
    const fresh = !state.workouts.some((w) => !w.sample && !['sport', 'recovery', 'pump'].includes(w.kind))
    if (!fresh) return 0
    try {
      return baselineMoves({ ...state, settings: { ...state.settings, training: p } }, { today }).moves.length
    } catch {
      return 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, p.location, p.equipment, p.experience, p.avoidMuscles, today])
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
  // A one-tap answer: save it and move on, with the steps that answer brings.
  const choose = (patch) => {
    const next = { ...p, ...patch }
    move(nextOnboardingStep(step, next, editingGroup), next)
  }
  const ageFix = (ageGroup) => ({
    ageGroup,
    ...(ageGroup === '13-17' && p.goal === 'Lose weight' ? { goal: 'General fitness' } : {}),
  })
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
  // Without a new profile, keep the latest one: a story screen may have just
  // saved an answer in the same tick (the pledge's hold).
  const move = (next, profile = null) => {
    setResponseFor(null)
    if (profile) setP(profile)
    setCurrent(next)
    persist(next, profile || p, next === 'review' ? null : editingGroup, null)
    if (next === 'review') setEditingGroup(null)
  }
  // The first time through, the plan is built on screen before it is shown.
  const afterBaseline = returning || editingGroup ? 'review' : 'building-demo'
  const manualEntry = p.manualEntry || manualEntryOf(p.manualBaseline, state.settings.weightUnit)
  const skipStart = p.baseline?.status === 'skipped'
  const baselineReady = hasStartingProfile(p, state.checkins, DEV)
  // Saves the answers and closes setup: after the paywall, or "Save changes".
  const finish = (choice = null) => {
    if (!baselineReady) {
      move(p.baselineMode === 'manual' ? 'manual' : 'photos')
      return
    }
    committing.current = true
    const { onboardingDraft, manualEntry: unused, ...profile } = p
    // The plan they chose on the preview paywall, for when a store is connected.
    if (choice)
      profile.offerChoice = {
        plan: choice.plan,
        trial: Boolean(choice.trial),
        offer: Boolean(choice.offer),
        at: Date.now(),
      }
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
  }
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
      if (returning) {
        finish()
        return
      }
    }
    if (step === 'manual') {
      const result = readManualBaseline(manualEntry)
      if (!result.valid) return
      move(afterBaseline, { ...p, baselineMode: 'manual', manualBaseline: { ...result.value, date: today } })
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
      move('photo-choice')
      return
    }
    // Back from the plan returns to the last question, not to the screen that built it.
    const previous = steps[Math.max(0, index - 1)]
    move(previous)
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
      ? buildDailyPlan(
          {
            ...state,
            readiness: null,
            settings: {
              ...state.settings,
              training: p,
              workout: { ...state.settings.workout, weeklyGoal, goalMode },
            },
          },
          { today, now: demoNow },
        )
      : null
  const story = isStoryStep(step) && !recap
  const paywall = PAYWALL_STEPS.includes(step)
  const ownCta = story && OWN_CTA_STEPS.includes(step)
  const storyProps = {
    step,
    headingRef: heading,
    state,
    profile: p,
    set,
    name,
    today,
    now: demoNow,
    goalMode,
    weeklyGoal,
    setGoalMode,
    setWeeklyGoal,
    onNext: () => move(nextStep),
    onChoose: choose,
    onBack: back,
    onSubscribe: finish,
  }
  if (step === 'photos')
    return (
      <PhotoCheckins
        onboarding
        profile={p}
        onClose={close}
        onBack={() => move(editingGroup === 'photos' ? 'review' : 'photo-choice')}
        onManual={() => move('manual', { ...p, baselineMode: 'manual', manualEntry })}
        onComplete={(checkin, focusPatch) =>
          move(afterBaseline, {
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
      // First run opens straight into setup; only an edit slides in over the app.
      animate={returning}
      headerAction={testExit}
      header={
        paywall ? (
          <span aria-hidden="true" />
        ) : !returning ? (
          <SetupHeader
            fills={fills}
            label={step === 'review' ? 'Your plan' : onboardingStage(step).label}
            onBack={index > 0 ? back : null}
            action={testExit}
          />
        ) : null
      }
      hideHandle={!returning}
      className={`${!returning ? 'setup-dialog' : ''} ${NIGHT_STEPS.includes(step) ? 'dark setup-dialog--night' : ''} ${paywall ? 'setup-dialog--pay' : ''}`}
      bodyClassName={`${!returning ? 'setup-body' : ''} ${paywall ? 'setup-body--pay' : ''}`}
      footerClassName={!returning ? 'setup-footer' : ''}
      onClose={close}
      title={
        recap
          ? recap.title
          : returning && step === 'review'
            ? 'Your training setup'
            : TITLES[step] || 'Your training, adapted'
      }
      subtitle={returning ? 'Changes save when you finish' : null}
      bodyKey={`${step}:${responseFor || 'question'}`}
      footer={
        ownCta ? null : (
        <div className="flex gap-3">
          {returning && index > 0 && step !== 'review' && (
            <button className="btn-secondary min-h-12 px-5" onClick={back}>
              Back
            </button>
          )}
          <button
            className={`btn-primary min-h-12 flex-1 ${!responseFor && CTA_MOTION[step] ? CTA_MOTION[step] : ''}`}
            disabled={
              (['equipment', 'home-loads'].includes(step) && !environmentValid) ||
              (step === 'sport-choice' && !p.sports.length) ||
              (step === 'barriers' && !p.onboardingBarriers?.length) ||
              (step === 'problem' && !p.onboardingProblem) ||
              (step === 'fallout' && !p.onboardingFallout) ||
              (step === 'manual' && !readManualBaseline(manualEntry).valid)
            }
            onClick={advance}
          >
            {responseFor
              ? 'Continue'
              : step === 'review'
                ? !baselineReady
                  ? 'Add photos or details'
                  : returning
                    ? 'Save changes'
                    : 'See how it adapts'
                : step === 'barriers' && p.onboardingBarriers?.filter((id) => id !== 'none').length
                  ? `Fix ${p.onboardingBarriers.filter((id) => id !== 'none').length === 1 ? 'this' : `these ${p.onboardingBarriers.filter((id) => id !== 'none').length}`}`
                  : NEXT_LABEL[step] || 'Continue'}
          </button>
        </div>
        )
      }
    >
      <div
        className={`onboarding-question ${!returning ? `setup-page setup-page--${responseFor ? 'response' : step}` : ''}`}
      >
        {recap ? (
          <SetupRecap
            scene={onboardingScene(step, p, true)}
            chapter={recap.chapter}
            title={recap.title}
            headingRef={heading}
          />
        ) : story ? (
          <OnboardingStory key={step} {...storyProps} />
        ) : (
          <>
            {!returning && step !== 'review' && (
              <QuestionHead step={step} headingRef={heading} title={TITLES[step]} />
            )}
            {HINTS[step] && <p className="setup-hint">{HINTS[step]}</p>}
            {step === 'photo-choice' && (
              <StoryOptions
                label="Starting point"
                options={[
                  { id: 'photos', title: 'Use my photos', detail: 'Front, side and back', icon: 'camera' },
                  { id: 'manual', title: 'Skip photos', detail: 'Height and weight instead', icon: 'note' },
                ]}
                value={p.baselineMode === 'manual' ? 'manual' : 'photos'}
                onSelect={(baselineMode) => set({ baselineMode })}
                onDone={(baselineMode) => choose({ baselineMode })}
              />
            )}
            {step === 'goal' && (
              <ArtOptions
                label="Main goal"
                options={[
                  { id: 'Build muscle', title: 'Build muscle', art: 'muscle' },
                  { id: 'Get stronger', title: 'Get stronger', art: 'strength' },
                  ...(p.ageGroup !== '13-17' ? [{ id: 'Lose weight', title: 'Lose weight', art: 'weight' }] : []),
                  { id: 'General fitness', title: 'Feel fitter', art: 'rhythm' },
                ]}
                value={p.goal}
                onSelect={(goal) => set({ goal })}
                onDone={(goal) => choose({ goal })}
              />
            )}
            {step === 'physique' && (
              <>
                <ArtOptions
                  label="Build preference"
                  layout="row"
                  options={physiqueOptions(p.goal, p.ageGroup).map((o) => ({ id: o.id, title: o.label, art: o.scene }))}
                  value={physiqueChoice(p)}
                  onSelect={(id) => set({ idealPhysique: { goal: p.goal, id } })}
                  onDone={(id) => choose({ idealPhysique: { goal: p.goal, id } })}
                />
                <button type="button" className="q-skip" onClick={() => choose({ idealPhysique: null })}>
                  Not sure yet
                </button>
              </>
            )}
            {step === 'experience' && (
              <StoryOptions
                label="Experience"
                options={EXPERIENCE_OPTIONS.map(([id, title, detail], i) => ({ id, title, detail, icon: i + 1 }))}
                value={p.experience}
                onSelect={(experience) => set({ experience })}
                onDone={(experience) => choose({ experience })}
              />
            )}
            {step === 'about' && (
              <Field label="Name (optional)" hideLabel={!returning}>
                <input
                  className={`input ${!returning ? 'q-input' : ''}`}
                  autoComplete="given-name"
                  aria-label="Your name"
                  value={name}
                  maxLength={60}
                  placeholder="First name"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            )}
            {step === 'gender' && (
              <StoryOptions
                label="Gender"
                layout="grid"
                options={['Man', 'Woman', 'Non-binary', 'Prefer not to say'].map((v) => ({ id: v, title: v }))}
                value={p.gender}
                onSelect={(gender) => set({ gender })}
                onDone={(gender) => choose({ gender })}
              />
            )}
            {step === 'age' && (
              <StoryOptions
                label="Age group"
                layout="grid"
                options={[
                  { id: '13-17', title: '13 to 17' },
                  { id: '18+', title: '18 or over' },
                ]}
                value={p.ageGroup}
                onSelect={(ageGroup) => set(ageFix(ageGroup))}
                onDone={(ageGroup) => choose(ageFix(ageGroup))}
              />
            )}
            {step === 'barriers' && (
              <StoryOptions
                multi
                label="Training obstacles"
                options={ONBOARDING_BARRIERS.map(([id, title, icon]) => ({ id, title, icon }))}
                value={p.onboardingBarriers}
                onSelect={(id) => set({ onboardingBarriers: toggleOnboardingBarrier(p.onboardingBarriers, id) })}
              />
            )}
            {step === 'variety' && (
              <StoryOptions
                label="Variety"
                options={VARIETY_OPTIONS.map(([id, title, detail], i) => ({
                  id,
                  title,
                  detail,
                  icon: ['target', 'repeat', 'sparkle'][i],
                }))}
                value={p.variety}
                onSelect={(variety) => set({ variety })}
                onDone={(variety) => choose({ variety })}
              />
            )}
            {step === 'sports' && (
              <ArtOptions
                label="Sport"
                layout="row"
                options={[
                  { id: true, title: 'Yes, I play', art: 'sports' },
                  { id: false, title: 'Not right now', art: 'neutral' },
                ]}
                value={Boolean(p.wantsSport || p.sports.length)}
                onSelect={(yes) => set({ wantsSport: yes, sports: yes ? p.sports : [] })}
                onDone={(yes) => choose({ wantsSport: yes, sports: yes ? p.sports : [] })}
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
              <StoryOptions
                label="Priority"
                options={[
                  {
                    id: 'goal',
                    title: p.goal === 'General fitness' ? 'Feeling fitter' : p.goal,
                    detail: 'Sport fits around it',
                    icon: 'target',
                  },
                  { id: 'balanced', title: 'A balance of both', detail: 'Lighter near games', icon: 'pair' },
                  {
                    id: 'sport',
                    title:
                      p.sports.length === 1 ? SPORTS.find((x) => x.id === p.sports[0])?.name || 'My sport' : 'My sports',
                    detail: 'Training supports your game',
                    icon: 'sport',
                  },
                ]}
                value={p.sportPriority}
                onSelect={(sportPriority) => set({ sportPriority })}
                onDone={(sportPriority) => choose({ sportPriority })}
              />
            )}
            {step === 'location' && (
              <ArtOptions
                label="Usual place"
                layout="rows"
                options={placesOf(p).map((place) => ({
                  id: place.id,
                  title: place.name,
                  detail: PLACE_DETAIL[place.id] || PLACE_DETAIL[place.base],
                  art: LOCATION_SCENE[place.id] || LOCATION_SCENE[place.base] || 'location',
                }))}
                value={p.location}
                onSelect={(location) => set(placePatch(location))}
                onDone={(location) => choose(placePatch(location))}
              />
            )}
            {step === 'home' && (
              <StoryOptions
                label="Home training"
                options={[
                  { id: true, title: 'Yes, sometimes', detail: 'Next, tell Tally what’s there', icon: 'home' },
                  { id: false, title: 'Not for now', detail: 'You can add it later', icon: 'x' },
                ]}
                value={Boolean(p.hasHomeSetup)}
                onSelect={(hasHomeSetup) => set({ hasHomeSetup })}
                onDone={(hasHomeSetup) => choose({ hasHomeSetup })}
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
              <StoryOptions
                label="Session length"
                layout="grid"
                options={[
                  ...[...TIME_OPTIONS, ...(!TIME_OPTIONS.includes(p.minutes) && !p.flexibleTime ? [p.minutes] : [])].map(
                    (m) => ({ id: m, num: m, unit: 'min' }),
                  ),
                  { id: 'flexible', title: 'It varies', detail: 'Choose the time before each session', icon: 'clock', wide: true },
                ]}
                value={p.flexibleTime ? 'flexible' : p.minutes}
                onSelect={(minutes) => set(timePatch(minutes))}
                onDone={(minutes) => choose(timePatch(minutes))}
              />
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
                {!returning && (
                  <FirstSession {...storyProps} startingPoint={startingMoves > 0 && !skipStart} />
                )}
                {startingMoves > 0 && !returning && (
                  <label className="baseline-preview-option">
                    <input
                      type="checkbox"
                      checked={!skipStart}
                      onChange={(e) =>
                        set({ baseline: e.target.checked ? null : { status: 'skipped', at: Date.now() } })
                      }
                    />
                    <span>
                      Find my starting weights first<small>{BASELINE_MINUTES} min</small>
                    </span>
                  </label>
                )}
                {returning && (
                  <section className="lit-card mt-5 p-4" aria-label="Session preview">
                    <p className="text-[13px] font-bold text-accent-ink">Current plan</p>
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
                )}
                <details className="funnel-edit-answers" open={returning || undefined}>
                  <summary>Edit answers</summary>
                  <div className="checklist mt-2.5">
                    {[
                      ['goal', p.goal === 'General fitness' ? 'Feel fitter' : p.goal],
                      // Experience changes sets, exercise options and targets, so it stays one tap away.
                      ['experience', p.experience],
                      [
                        'barriers',
                        p.onboardingBarriers
                          ?.filter((id) => id !== 'none')
                          .map((id) => ONBOARDING_BARRIERS.find(([key]) => key === id)?.[1])
                          .join(', ') || 'Nothing right now',
                      ],
                      [
                        'variety',
                        {
                          familiar: 'Keep it familiar',
                          balanced: 'A mix of both',
                          more: 'Try new exercises',
                        }[p.variety],
                      ],
                      ['time', p.flexibleTime ? 'Time varies' : `${p.minutes} min`],
                      ['rhythm', goalMode === 'flexible' ? 'Whenever I’m free' : `${weeklyGoal} in any 7 days`],
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
                          ? 'Height and weight'
                          : p.baselineMode === 'test'
                            ? 'Starting photos'
                            : baselineReady
                              ? 'Starting photos added'
                              : 'Add photos or details',
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
                          <span
                            className={`checklist-mark ${pending ? 'is-pending' : ''}`}
                            aria-hidden="true"
                          >
                            {!pending && <Icon name="check" size={13} strokeWidth={3.2} />}
                          </span>
                          <span className="w-[74px] shrink-0 text-[14px] text-muted">
                            {CHECK_LABEL[group]}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{label}</span>
                          <Icon name="edit" size={15} className="shrink-0 text-muted" />
                        </button>
                      )
                    })}
                  </div>
                </details>
                {returning && suggestedLevel && suggestedLevel !== p.experience && (
                  <div className="mt-4 rounded-2xl border border-accent/30 p-3 text-[14px] leading-relaxed">
                    <p>
                      You’ve trained consistently for a while. “{suggestedLevel}” would add more sets and
                      unlock more exercises.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary mt-2 min-h-11 w-full"
                      onClick={() => set({ experience: suggestedLevel })}
                    >
                      Switch to {suggestedLevel}
                    </button>
                  </div>
                )}
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
  experience: 'Level',
  barriers: 'Obstacles',
  variety: 'Variety',
  time: 'Time',
  rhythm: 'How often',
  location: 'Place',
  sports: 'Sports',
  photos: 'Body',
  manual: 'Body',
}
