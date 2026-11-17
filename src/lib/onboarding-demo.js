import { buildDailyPlan } from './planner.js'
import { findExercise } from './exercises.js'
import { planSeconds } from './engine/session-time.js'
import { exerciseThumb } from './exercise-thumbs.js'

// Said the way people say it about themselves, so they recognise their own
// reason on the list.
export const ONBOARDING_BARRIERS = [
  ['time', 'Short on time', 'clock'],
  ['unsure', 'Unsure what to do', 'help'],
  ['schedule', 'Changing schedule', 'repeat'],
  ['enjoyment', 'Repetitive workouts', 'repeat'],
  ['starting', 'Getting started again', 'play'],
  ['none', 'None of these', 'check'],
]
// What Tally does about each obstacle. Every line is something the app
// actually does; they are reused on the plan and the offer so the answer a
// person gave keeps being answered.
export const BARRIER_ANSWERS = {
  time: 'A real session for the time you have, even 15 minutes',
  unsure: 'Every session laid out for you, with a guide for each move',
  schedule: 'Miss a day and nothing piles up: the next session re-plans',
  enjoyment: 'Swap any exercise you don’t like, and it stays out',
  starting: 'After a break, sessions restart lighter and build back up',
}
export const barrierLabel = (id) => ONBOARDING_BARRIERS.find(([key]) => key === id)?.[1] || ''
/** The obstacles a person picked, without "nothing". */
export const pickedBarriers = (profile) =>
  (profile?.onboardingBarriers || []).filter((id) => id !== 'none' && BARRIER_ANSWERS[id])

// Roughly half of people who begin an exercise programme stop within six
// months: a long-standing finding in exercise-adherence research (Dishman,
// 1988, "Exercise Adherence: Its Impact on Public Health"; restated in
// Wilson & Brookfield, 2009, Int. J. Sport and Exercise Psychology 7(1)).
// Check the wording against the source again before a public release.
export const DROPOUT_FACT = {
  figure: '1 in 2',
  text: 'people who start training stop within six months.',
  source: 'Exercise-adherence research',
}

// When the first session will happen. Naming a time makes following through
// more likely (implementation intentions; Gollwitzer & Sheeran, 2006).
// No set days: the question is when they are next free, not which weekday.
export const FIRST_SESSION_OPTIONS = [
  ['now', 'Right now'],
  ['later', 'Later today'],
  ['unsure', 'Not sure'],
]
export const firstSessionLabel = (id) =>
  ({ now: 'right now', later: 'later today', today: 'today', tomorrow: 'tomorrow', week: 'this week' })[id] ||
  null

export const DEMO_STEPS = [
  'loop-demo',
  'solution-demo',
  'goal-demo',
  'year-demo',
  'fix-demo',
  'barrier-unsure-demo',
  'barrier-enjoyment-demo',
  'sport-demo',
  'equipment-demo',
  'recent-demo',
  'recovery-demo',
  'photo-demo',
  'building-demo',
  'squeeze-demo',
  'midworkout-demo',
  'rollover-demo',
  'feel-demo',
  'tally-demo',
  'path-demo',
  'proof-demo',
  'value-demo',
  'ready-demo',
  // Earlier versions of the flow; saved drafts move on from these.
  'why-demo',
  'barrier-demo',
]
export const isOnboardingDemo = (step) =>
  DEMO_STEPS.includes(step) || ONBOARDING_BARRIERS.some(([id]) => step === `barrier-${id}-demo`)

export function toggleOnboardingBarrier(selected = [], value) {
  if (value === 'none') return selected.includes('none') ? [] : ['none']
  const allowed = ONBOARDING_BARRIERS.some(([id]) => id === value)
  if (!allowed) return selected
  const current = selected.filter((v) => v !== 'none')
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

// A real recommendation using temporary controls. Never writes readiness,
// training history, photos, or made-up completions into the person's account.
export function onboardingDemoPlan(
  state,
  profile,
  {
    today,
    now = Date.now(),
    minutes = profile.minutes,
    location = profile.location,
    sore = [],
    energy = 'normal',
  } = {},
) {
  const plan = buildDailyPlan(
    { ...state, readiness: null, settings: { ...state.settings, training: profile } },
    {
      today,
      now,
      minutes,
      location,
      readiness: { energy, sore, pain: [] },
    },
  )
  return {
    ...plan,
    estimatedMinutes: Math.max(1, Math.round(planSeconds(plan.items) / 60)),
    moves: plan.items.map((item) => ({
      ...item,
      name: findExercise(item.exId, state.customExercises)?.name || item.exId,
      muscle: findExercise(item.exId, state.customExercises)?.muscle || '',
      image: exerciseThumb(item.exId),
    })),
  }
}

// These are labelled scheduling illustrations, not measured strength gains,
// body-transformation promises, or predictions of time-to-goal.
export function consistencyExample() {
  const steady = Array.from({ length: 8 }, (_, i) => (i + 1) * 30)
  const occasional = [60, 60, 60, 120, 120, 120, 180, 180]
  return { steady, occasional, steadyMinutes: 240, occasionalMinutes: 180, weeks: 8 }
}
export function planningTimeExample(
  minutesPerSession = 5,
  sessionsPerWeek = 3,
  weeks = 12,
  workoutMinutes = 30,
) {
  const perSession = Math.max(0, Math.min(30, Number(minutesPerSession) || 0))
  const sessions = Math.max(1, Math.min(7, Number(sessionsPerWeek) || 3))
  const period = Math.max(1, Math.min(52, Number(weeks) || 12))
  const minutes = perSession * sessions * period
  const length = Math.max(5, Math.min(120, Number(workoutMinutes) || 30))
  return {
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
    minutesPerSession: perSession,
    sessionsPerWeek: sessions,
    weeks: period,
    // The same time, counted in the person's own workouts (plain division).
    workoutMinutes: length,
    workouts: Math.floor(minutes / length),
  }
}

/**
 * What goes into this person's plan, as short true statements for the
 * "building your plan" screen. Each line is something the planner really
 * does with an answer they gave.
 */
export function planIngredients(profile, plan, placeName = '') {
  const lines = []
  lines.push(
    profile.flexibleTime ? 'Sized to the time you choose each day' : `Sized for ${profile.minutes} minutes`,
  )
  lines.push(
    profile.location === 'on-the-go'
      ? 'No equipment needed'
      : profile.location === 'gym'
        ? 'Using the gym’s full equipment'
        : profile.location === 'home'
          ? 'Using only what you have at home'
          : placeName
            ? `Using what’s at ${placeName}`
            : '',
  )
  const extras = {
    time: 'With a 15-minute version for busy days',
    unsure: 'A guide attached to every exercise',
    schedule: 'Nothing carried over when you miss a day',
    enjoyment: 'Swaps ready for any move you don’t like',
    starting: 'An easy restart after any break',
  }
  for (const id of pickedBarriers(profile).slice(0, 2)) lines.push(extras[id])
  if (profile.avoidMuscles?.length) lines.push(`Leaving out ${profile.avoidMuscles.join(', ').toLowerCase()}`)
  const areas = new Set((plan?.moves || []).map((m) => m.muscle).filter(Boolean)).size
  if (areas >= 2) lines.push(`Balanced across ${areas} muscle groups`)
  // The last line is the one that keeps the plan alive after day one.
  return [...lines.filter(Boolean).slice(0, 5), 'Weights that adjust from your first session']
}

/**
 * The first weeks, as the app will actually behave. Product behaviour only:
 * no promise about results or how fast they come.
 */
export function firstWeeks(profile, { startingPoint = false } = {}) {
  const when = firstSessionLabel(profile.firstSession)
  return [
    [
      when ? `First session, ${when}` : 'First session',
      startingPoint
        ? 'Find your starting weights: one easy set of each movement.'
        : 'Your first workout. Weights are found as you go.',
    ],
    ['Every session after', 'Weights and reps adjust to what you logged.'],
    ['When you’re ready', 'A test set at the next weight up. You decide.'],
    ['On a bad week', 'Shorter sessions, lighter restarts. Nothing to make up.'],
  ]
}

/** What the subscription gives this person, in their own answers first. */
export function offerPoints(profile) {
  const mine = pickedBarriers(profile)
    .slice(0, 2)
    .map((id) => BARRIER_ANSWERS[id])
  const always = [
    'A session ready whenever you open the app',
    'Weights and reps that adjust to every set you log',
    'A guide for every exercise',
    'Train anywhere: gym, home or on the go',
  ]
  return [...mine, ...always.filter((line) => !mine.includes(line))].slice(0, 4)
}

// Preview prices only: nothing here charges anyone (lib/billing.js has no
// store connected). `yearNow` is the yearly price when the free trial is
// switched off; `saveOffer` is the one-time discount after a cancelled
// purchase sheet. All of these are business decisions to confirm before release.
export const OFFER_PRICES = { year: 59.99, month: 12.99, yearNow: 49.99 }
export const TRIAL_DAYS = 7
export const SAVE_OFFER_PERCENT = 40
/** Per-week prices and the yearly saving, worked out from the two prices. */
export function offerPricing({ year, month } = OFFER_PRICES) {
  const money = (n) => `$${n.toFixed(2)}`
  return {
    year: { price: money(year), perWeek: money(Math.round((year / 52) * 100) / 100) },
    month: { price: money(month), perWeek: money(Math.round(((month * 12) / 52) * 100) / 100) },
    // Rounded down, so the saving is never overstated.
    saving: Math.floor((1 - year / (month * 12)) * 100),
  }
}
/** The one-time yearly price after the discount, ending in .99 and never above the discount. */
export function saveOfferPrice(year = OFFER_PRICES.year, percent = SAVE_OFFER_PERCENT) {
  const target = year * (1 - percent / 100)
  const price = Math.floor(target) + 0.99 > target ? Math.floor(target) - 0.01 : Math.floor(target) + 0.99
  return Math.round(price * 100) / 100
}
