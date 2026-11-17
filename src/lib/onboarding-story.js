// The story screens of onboarding: what they show, worked out from the real
// planner, workout and strength code. Nothing here writes to the person's
// history; every demo runs on temporary data.
import { buildSession } from './workout.js'
import { shortenSession } from './workout-adjustments.js'
import { liveContext, markTooHeavy, recordFeel } from './strength/session.js'
import { findExercise } from './exercises.js'
import { exerciseThumb } from './exercise-thumbs.js'
import { onboardingDemoPlan, OFFER_PRICES, pickedBarriers } from './onboarding-demo.js'
import { PAYWALL_STEPS } from './onboarding.js'

/** Full-screen story steps, drawn by OnboardingStory.jsx. */
export const STORY_STEPS = [
  'welcome',
  'problem',
  'solution-demo',
  'rhythm',
  'year-demo',
  'fix-demo',
  'building-demo',
  'squeeze-demo',
  'midworkout-demo',
  'rollover-demo',
  'feel-demo',
  'tally-demo',
  'path-demo',
  'pledge',
  'value-demo',
  'ready-demo',
  ...PAYWALL_STEPS,
]
export const isStoryStep = (step) => STORY_STEPS.includes(step)
/** Screens with their own main button (a gate, a hold, or the paywall). */
export const OWN_CTA_STEPS = ['building-demo', 'pledge', ...PAYWALL_STEPS]
/** Screens drawn on the night palette in both themes. */
export const NIGHT_STEPS = ['year-demo', 'tally-demo']

export const PROBLEM_OPTIONS = [
  ['often', 'Yes, often'],
  ['some', 'Sometimes'],
  ['no', 'Not really'],
  ['new', 'I’m brand new'],
]

/** Sessions in a year at their rhythm. With no target, twice a week is shown as an example. */
export function yearSessions({ goalMode = 'flexible', weeklyGoal = 3 } = {}) {
  const perWeek = goalMode === 'target' ? Math.max(1, Math.min(7, Number(weeklyGoal) || 3)) : 2
  return { perWeek, count: perWeek * 52, example: goalMode !== 'target' }
}

const moveOf = (exId, customExercises) => ({
  exId,
  name: findExercise(exId, customExercises)?.name || exId,
  image: exerciseThumb(exId),
})

/** The same day planned for 20, 30 and 45 minutes: the real planner each time. */
export function squeezeDemo(state, profile, { today, now }) {
  const out = {}
  for (const minutes of [20, 30, 45]) {
    const plan = onboardingDemoPlan(state, profile, { today, now, minutes })
    out[minutes] = plan.moves.map((m) => ({
      ...moveOf(m.exId, state.customExercises),
      detail: m.reps ? `${m.sets} × ${m.reps}` : `${m.sets} ${m.sets === 1 ? 'set' : 'sets'}`,
    }))
  }
  return out
}

/**
 * A 45-minute session with the first exercise done and one set of the second,
 * then "less time left" for 5, 10 and 15 minutes through shortenSession.
 * Each row lists its sets as done, now, todo or cut.
 */
export function midWorkoutDemo(state, profile, { today, now }) {
  const plan = onboardingDemoPlan(state, profile, { today, now, minutes: 45 })
  let session = buildSession(plan, { now, customExercises: state.customExercises })
  session = {
    ...session,
    exercises: session.exercises.map((e, i) => ({
      ...e,
      sets: e.sets.map((s) => {
        const work = e.sets.filter((x) => x.kind !== 'warmup')
        const done = i === 0 || (i === 1 && s === work[0])
        return done ? { ...s, status: 'done' } : s
      }),
    })),
  }
  const rows = (ses) => {
    let current = false
    return ses.exercises.slice(0, 4).map((e) => {
      const work = e.sets.filter((s) => s.kind !== 'warmup')
      const sets = work.map((s) => {
        if (s.status === 'done') return 'done'
        if (s.status === 'skipped') return 'cut'
        if (!current) {
          current = true
          return 'now'
        }
        return 'todo'
      })
      const kept = sets.filter((x) => x === 'now' || x === 'todo').length
      const cut = sets.filter((x) => x === 'cut').length
      return {
        ...moveOf(e.exId, state.customExercises),
        sets,
        state: sets.every((x) => x === 'done') ? 'saved' : cut && !kept ? 'cut' : cut ? 'part' : 'kept',
        kept,
      }
    })
  }
  const after = {}
  for (const left of [5, 10, 15]) after[left] = rows(shortenSession(session, left, now))
  return { before: rows(session), after }
}

// The rollover story, as the engine behaves (tests/onboarding-story.test.mjs
// keeps it true): work cut for time is reconsidered at every plan, waits while
// those muscles recover, and is dropped when similar work covers it.
export const ROLLOVER_STORY = {
  cut: [moveOf('lat-pulldown'), moveOf('biceps-curl')],
  next: { when: 'Next time you train', title: 'Legs', base: ['Squat', 'RDL'] },
  after: { when: 'The time after', title: 'Pull', base: ['Pull-ups', 'Rows'] },
}

/**
 * What the next set becomes after each answer to "how did that feel?",
 * from the live strength code (recordFeel and markTooHeavy) on a first-time
 * lat pulldown, so the demo shows exactly what a workout would.
 */
export function feelDemo(unit = 'lb', { now = Date.now(), today, goal = 'Get stronger', experience = 'Some experience' } = {}) {
  const weight = unit === 'kg' ? 35 : 80
  const ctx = liveContext({
    workouts: [],
    learning: null,
    unit,
    now,
    today,
    goal,
    experience,
    readiness: {},
    sizes: [],
    customExercises: [],
    metrics: {},
    activities: [],
  })
  const session = () => ({
    id: 'onboarding-feel',
    kind: 'adaptive',
    unit,
    location: 'gym',
    phase: 'work',
    pausedMs: 0,
    cursor: { ex: 0, set: 1 },
    exercises: [
      {
        exId: 'lat-pulldown',
        name: 'Lat pulldown',
        type: 'reps',
        weighted: true,
        restSec: 90,
        repRange: [8, 12],
        targetRir: 2,
        sets: [
          { kind: 'work', status: 'done', weight, targetWeight: weight, reps: 10, targetReps: 10, doneAt: now - 60000 },
          { kind: 'work', status: 'todo', weight, targetWeight: weight, reps: 10, targetReps: 10 },
          { kind: 'work', status: 'todo', weight, targetWeight: weight, reps: 10, targetReps: 10 },
        ],
      },
    ],
  })
  const next = (s) => {
    const set = s.exercises[0].sets.find((x) => x.status === 'todo')
    return { weight: set?.weight ?? weight, reps: set?.reps ?? 10 }
  }
  const out = { start: { weight, reps: 10 } }
  for (const feel of ['easy', 'good', 'hard']) {
    try {
      out[feel] = next(recordFeel(session(), { ex: 0, set: 0 }, feel, ctx))
    } catch {
      out[feel] = { weight, reps: 10 }
    }
  }
  try {
    out.heavy = next(markTooHeavy(session(), ctx, now))
  } catch {
    out.heavy = { weight, reps: 10 }
  }
  return out
}

/** What changed between the first set and the next, in a few words. */
export function feelChange(start, next, unit = 'lb') {
  if (next.weight !== start.weight) {
    const d = Math.round((next.weight - start.weight) * 10) / 10
    return `${d > 0 ? '+' : '−'}${Math.abs(d)} ${unit}`
  }
  if (next.reps !== start.reps) {
    const d = next.reps - start.reps
    return `${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'rep' : 'reps'}`
  }
  return 'Same'
}

/** The first month, week by week, as the app behaves. No promise about results. */
export function pathWeeks() {
  return [
    ['Week 1', 'Find your weights'],
    ['Week 2', 'Weights adjust'],
    ['Week 3', 'Busy-proof'],
    ['Week 4', 'Ready to step up'],
  ]
}

// Price anchor. A US one-hour personal training session averages about $60
// (Bark national average, cited by fitbudd.com and blog.trainero.com, 2026).
// Once a week is four a month.
export const TRAINER_ANCHOR = { perSession: 60, perMonth: 240 }
export const tallyMonthly = (year = OFFER_PRICES.year) => Math.round((year / 12) * 100) / 100

/** Their plan in four short chips, from their own answers. */
export function planChips(profile, { goalMode, weeklyGoal, placeName = '' } = {}) {
  const often = goalMode === 'target' ? `${weeklyGoal}× a week, any days` : 'Whenever you’re free'
  const time = profile.flexibleTime ? 'Any length' : `${profile.minutes} min`
  const place =
    profile.location === 'on-the-go'
      ? 'On the go'
      : profile.hasHomeSetup && profile.location !== 'home'
        ? `${placeName || 'Gym'} + home`
        : placeName || 'Home'
  const goal = profile.goal === 'General fitness' ? 'Feel fitter' : profile.goal
  return [often, time, place, goal].filter(Boolean)
}

/** The fixes they asked for, in their own words first. */
export function fixCards(profile) {
  return pickedBarriers(profile).slice(0, 2)
}
