// The onboarding story screens claim things about how Tally behaves. These
// tests keep every claim true by running the same engine the demos show.
import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { buildDailyPlan } from '../src/lib/planner.js'
import { buildSession, toWorkoutRecord } from '../src/lib/workout.js'
import { shortenSession } from '../src/lib/workout-adjustments.js'
import { rolloverCandidates } from '../src/lib/engine/rollover.js'
import { planSeconds } from '../src/lib/engine/session-time.js'
import { onboardingSteps } from '../src/lib/onboarding.js'
import { OFFER_PRICES, saveOfferPrice, SAVE_OFFER_PERCENT } from '../src/lib/onboarding-demo.js'
import {
  STORY_STEPS,
  feelChange,
  feelDemo,
  midWorkoutDemo,
  planChips,
  squeezeDemo,
  tallyMonthly,
  yearSessions,
  TRAINER_ANCHOR,
} from '../src/lib/onboarding-story.js'

const HOUR = 3600000
const keyOf = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const clock = { today: '2026-11-16', now: new Date('2026-11-16T12:00:00').getTime() }

test('every story screen is part of the flow', () => {
  const steps = onboardingSteps({
    ...defaultState().settings.training,
    onboardingProblem: 'often',
    location: 'gym', goal: 'Get stronger', onboardingBarriers: ['time', 'unsure', 'enjoyment', 'schedule', 'starting'],
    sports: ['tennis'],
    wantsSport: true,
  })
  for (const step of STORY_STEPS) assert.ok(steps.includes(step), step)
})

test('squeezing a session re-plans it with the real planner, inside the time', () => {
  for (const location of ['gym', 'home', 'on-the-go']) {
    const state = defaultState()
    const p = { ...state.settings.training, location }
    const plans = squeezeDemo(state, p, clock)
    assert.ok(plans[20].length && plans[20].length <= plans[45].length, location)
    for (const m of [20, 30, 45]) for (const move of plans[m]) assert.ok(move.name && move.detail, location)
  }
})

test('less time mid-workout keeps every logged set and cuts more as time runs out', () => {
  const state = defaultState()
  for (const location of ['gym', 'home']) {
    const demo = midWorkoutDemo(state, { ...state.settings.training, location }, clock)
    const cut = (rows) => rows.flatMap((r) => r.sets).filter((s) => s === 'cut').length
    const done = (rows) => rows.flatMap((r) => r.sets).filter((s) => s === 'done').length
    for (const left of [5, 10, 15]) assert.equal(done(demo.after[left]), done(demo.before), `${location} ${left}`)
    assert.ok(cut(demo.after[5]) >= cut(demo.after[10]) && cut(demo.after[10]) >= cut(demo.after[15]))
    assert.ok(cut(demo.after[5]) > 0, location)
    assert.equal(demo.before[0].state, 'saved')
  }
})

test('the weights demo is what a workout does after each answer', () => {
  for (const unit of ['lb', 'kg']) {
    const d = feelDemo(unit, clock)
    assert.equal(d.easy.weight, d.start.weight)
    assert.ok(d.easy.reps > d.start.reps, 'easy asks for more')
    assert.deepEqual(d.good, d.start)
    assert.equal(d.hard.weight, d.start.weight)
    assert.ok(d.hard.reps < d.start.reps, 'hard keeps the weight, fewer reps')
    assert.ok(d.heavy.weight < d.start.weight, 'too heavy goes lighter at once')
  }
  assert.equal(feelChange({ weight: 80, reps: 10 }, { weight: 80, reps: 12 }), '+2 reps')
  assert.equal(feelChange({ weight: 80, reps: 10 }, { weight: 60, reps: 8 }), '−20 lb')
  assert.equal(feelChange({ weight: 80, reps: 10 }, { weight: 80, reps: 10 }), 'Same')
})

// The rollover screen: cut for time, it waits while the muscles recover, then
// comes back in a later session; similar work done since covers it.
function cutSession(state, base, { feel = 'hard' } = {}) {
  const plan = buildDailyPlan({ ...state, readiness: null }, { today: keyOf(base), now: base, minutes: 45 })
  let ses = buildSession(plan, { now: base - 50 * 60000 })
  const last = ses.exercises.length - 1
  ses = {
    ...ses,
    exercises: ses.exercises.map((e, i) => ({
      ...e,
      sets: e.sets.map((x, j) =>
        i < last || j === 0
          ? { ...x, weight: e.weighted ? 60 : null, reps: x.reps || 8, status: 'done', feel, doneAt: base - 40 * 60000 + j * 60000 }
          : x,
      ),
    })),
  }
  ses = shortenSession(ses, 1, base - 5 * 60000)
  const record = { ...toWorkoutRecord(ses, state.workouts, { now: base }), date: keyOf(base), startedAt: base - 50 * 60000, endedAt: base }
  return { record, cutId: ses.exercises[last].exId }
}
function finishPlan(state, plan, t) {
  const ses = buildSession(plan, { now: t - 40 * 60000 })
  let i = 0
  const done = {
    ...ses,
    exercises: ses.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((x) => ({ ...x, weight: e.weighted ? 60 : null, reps: x.reps || 8, status: 'done', feel: 'good', doneAt: t - 30 * 60000 + i++ * 60000 })),
    })),
  }
  return { ...toWorkoutRecord(done, state.workouts, { now: t }), date: keyOf(t), startedAt: t - 40 * 60000, endedAt: t }
}

test('a move cut for time waits while its muscles recover, then comes back', () => {
  const base = new Date('2026-11-16T18:00:00').getTime()
  let state = defaultState()
  state = { ...state, settings: { ...state.settings, training: { ...state.settings.training, location: 'gym', experience: 'Some experience', goal: 'Get stronger', completed: true } } }
  const { record, cutId } = cutSession(state, base)
  assert.ok(record.outcome.exercises.some((o) => o.exId === cutId && o.reason === 'time'))
  state = { ...state, workouts: [record] }
  // Four hours later the same muscles are still recovering: it is not carried.
  let t = base + 4 * HOUR
  assert.ok(rolloverCandidates(state.workouts, { now: t, today: keyOf(t) }).active.some((c) => c.exId === cutId))
  const next = buildDailyPlan({ ...state, readiness: null }, { today: keyOf(t), now: t, minutes: 30 })
  assert.ok(!next.items.some((i) => i.exId === cutId), 'waits while recovering')
  state = { ...state, workouts: [...state.workouts, finishPlan(state, next, t)] }
  // The session after, it is offered again ("back in").
  t += 4 * HOUR
  const later = buildDailyPlan({ ...state, readiness: null }, { today: keyOf(t), now: t, minutes: 30 })
  assert.ok(later.planning.carriedFrom.some((s) => s.endsWith(`:${cutId}`)), 'comes back later')
  // Once the same work is done, nothing is owed.
  state = { ...state, workouts: [...state.workouts, finishPlan(state, later, t)] }
  t += 24 * HOUR
  assert.ok(!rolloverCandidates(state.workouts, { now: t, today: keyOf(t) }).active.some((c) => c.exId === cutId))
})

test('prices and numbers on the story screens are arithmetic on real inputs', () => {
  assert.deepEqual(yearSessions({ goalMode: 'target', weeklyGoal: 3 }), { perWeek: 3, count: 156, example: false })
  assert.equal(yearSessions({ goalMode: 'flexible' }).example, true)
  assert.equal(TRAINER_ANCHOR.perMonth, TRAINER_ANCHOR.perSession * 4)
  assert.equal(tallyMonthly(), Math.round((OFFER_PRICES.year / 12) * 100) / 100)
  const offer = saveOfferPrice()
  assert.equal(offer, 35.99)
  // Never a smaller discount than the badge says.
  assert.ok(offer <= OFFER_PRICES.year * (1 - SAVE_OFFER_PERCENT / 100))
  const p = { ...defaultState().settings.training, minutes: 30, location: 'gym', goal: 'Build muscle' }
  assert.deepEqual(planChips(p, { goalMode: 'target', weeklyGoal: 3, placeName: 'Gym' }), ['3× a week, any days', '30 min', 'Gym', 'Build muscle'])
  assert.equal(planChips(p, { goalMode: 'flexible' })[0], 'Whenever you’re free')
})

test('demo plans stay inside their time', () => {
  const state = defaultState()
  const plan = buildDailyPlan({ ...state, readiness: null }, { ...clock, minutes: 20 })
  assert.ok(planSeconds(plan.items) <= 20 * 60)
})
