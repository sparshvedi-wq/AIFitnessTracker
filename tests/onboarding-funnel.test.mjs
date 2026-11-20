import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import {
  onboardingSteps,
  nextOnboardingStep,
  ONBOARDING_VERSION,
  PAYWALL_STEPS,
  retiredOnboardingSteps,
  editableStep,
} from '../src/lib/onboarding.js'
import {
  onboardingDemoPlan,
  toggleOnboardingBarrier,
  consistencyExample,
  planningTimeExample,
  pickedBarriers,
  offerPoints,
  offerPricing,
  planIngredients,
  firstWeeks,
  BARRIER_ANSWERS,
  ONBOARDING_BARRIERS,
  OFFER_PRICES,
  FIRST_SESSION_OPTIONS,
} from '../src/lib/onboarding-demo.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { equipmentSatisfied, placeCapabilities } from '../src/lib/engine/eligibility.js'
import { resolvePlace } from '../src/lib/places.js'
import { planSeconds } from '../src/lib/engine/session-time.js'

const clock = { today: '2026-11-13', now: new Date('2026-11-13T12:00:00').getTime() }

test('photo and manual branches go from their real session preview straight to membership', () => {
  for (const baselineMode of ['manual', 'photos']) {
    const p = { ...defaultState().settings.training, baselineMode }
    const steps = onboardingSteps(p)
    assert.deepEqual(steps.slice(-3), [baselineMode, 'review', ...PAYWALL_STEPS])
    assert.equal(nextOnboardingStep('paywall-plans', p), undefined)
    assert.equal(nextOnboardingStep('welcome', p), 'goal')
    assert.equal(nextOnboardingStep('goal', p), 'age')
    assert.equal(nextOnboardingStep('age', p), 'goal-demo')
    for (const destination of Object.values(retiredOnboardingSteps))
      assert.ok(steps.includes(destination), destination)
  }
})

test('the demonstration responds to the obstacle and available equipment', () => {
  const p = { ...defaultState().settings.training, location: 'gym', goal: 'Get stronger' }
  const none = onboardingSteps({ ...p, onboardingBarriers: ['none'] })
  for (const [answer, step] of [['time', 'midworkout-demo'], ['schedule', 'rollover-demo'],
    ['starting', 'fix-demo'], ['unsure', 'barrier-unsure-demo'], ['enjoyment', 'barrier-enjoyment-demo']]) {
    assert.equal(none.includes(step), false)
    const route = onboardingSteps({ ...p, onboardingBarriers: [answer] })
    assert.equal(route.filter((id) => id === step).length, 1)
    assert.ok(route.indexOf(step) < route.indexOf('review'))
  }
  assert.ok(none.includes('feel-demo'))
  assert.ok(!onboardingSteps({ ...p, location: 'on-the-go' }).includes('feel-demo'))
  assert.ok(!none.includes('sport-demo'))
  assert.ok(onboardingSteps({ ...p, wantsSport: true, sports: ['tennis'] }).includes('sport-demo'))
})

test('every persuasive line is either the person’s own answer, real arithmetic or something the app does', () => {
  const p = {
    ...defaultState().settings.training,
    minutes: 45,
    onboardingBarriers: ['time', 'starting', 'unsure'],
  }
  // Obstacles are answered in the order they were picked, never invented.
  assert.deepEqual(pickedBarriers(p), ['time', 'starting', 'unsure'])
  assert.deepEqual(pickedBarriers({ ...p, onboardingBarriers: ['none'] }), [])
  assert.deepEqual(pickedBarriers({ ...p, onboardingBarriers: ['made-up'] }), [])
  for (const [id] of ONBOARDING_BARRIERS) if (id !== 'none') assert.ok(BARRIER_ANSWERS[id], id)
  const points = offerPoints(p)
  assert.equal(points.length, 4)
  assert.deepEqual(points.slice(0, 2), [BARRIER_ANSWERS.time, BARRIER_ANSWERS.starting])
  assert.equal(new Set(points).size, 4)
  assert.equal(offerPoints({ ...p, onboardingBarriers: ['none'] }).length, 4)
  // Prices: per-week figures and the saving follow from the two prices, rounded against us.
  const pricing = offerPricing()
  assert.equal(pricing.year.perWeek, '$1.15')
  assert.equal(pricing.month.perWeek, '$3.00')
  assert.ok(pricing.saving <= (1 - OFFER_PRICES.year / (OFFER_PRICES.month * 12)) * 100)
  assert.equal(pricing.saving, 61)
  assert.equal(offerPricing({ year: 120, month: 10 }).saving, 0)
  // Deciding time counted in the person's own sessions is plain division.
  const deciding = planningTimeExample(5, 3, 12, p.minutes)
  assert.equal(deciding.workouts, Math.floor(180 / 45))
  assert.equal(planningTimeExample(2, 3, 12, 90).workouts, 0)
  // The plan's ingredients quote the answers; the weeks describe behaviour, not results.
  const plan = onboardingDemoPlan(defaultState(), p, clock)
  const lines = planIngredients({ ...p, avoidMuscles: ['Shoulders'] }, plan, 'Gym')
  assert.equal(lines[0], 'Sized for 45 minutes')
  assert.ok(lines.includes('Leaving out shoulders'))
  assert.equal(lines.at(-1), 'Weights that adjust from your first session')
  assert.ok(lines.length <= 6 && lines.every(Boolean))
  assert.equal(
    planIngredients({ ...p, flexibleTime: true }, plan)[0],
    'Sized to the time you choose each day',
  )
  const weeks = firstWeeks({ ...p, firstSession: 'tomorrow' }, { startingPoint: true })
  assert.equal(weeks[0][0], 'First session, tomorrow')
  assert.match(weeks[0][1], /starting weights/)
  assert.equal(firstWeeks({ ...p, firstSession: 'unsure' })[0][0], 'First session')
  const everything = [...points, ...lines, ...weeks.flat(), ...Object.values(BARRIER_ANSWERS)].join(' ')
  // No promised results, timelines, guarantees or invented popularity.
  assert.doesNotMatch(
    everything,
    /\b(guarantee|lose \d|gain \d|\d+ ?(lb|kg|pounds)|in \d+ (days|weeks|months)|users|rated|#1)\b/i,
  )
  assert.ok(
    FIRST_SESSION_OPTIONS.some(([id]) => id === 'unsure'),
    'not committing is always an option',
  )
})

test('editing answers bypasses demonstrations and the subscription placeholder', () => {
  const p = defaultState().settings.training
  assert.equal(nextOnboardingStep('goal', p, 'goal'), 'physique')
  assert.equal(nextOnboardingStep('physique', p, 'goal'), 'review')
  assert.equal(nextOnboardingStep('time', p, 'time'), 'review')
  assert.equal(nextOnboardingStep('rhythm', p, 'rhythm'), 'review')
  assert.equal(nextOnboardingStep('barriers', p, 'barriers'), 'review')
  // Stories, the pledge and the paywall are never part of an edit.
  for (const step of ['problem', 'fallout', 'pledge', 'squeeze-demo', ...PAYWALL_STEPS])
    assert.equal(editableStep(step), false)
  assert.equal(nextOnboardingStep('variety', p, 'variety'), 'review')
})

test('Nothing right now is exclusive without losing multi-select obstacle answers', () => {
  assert.deepEqual(toggleOnboardingBarrier(['time', 'schedule'], 'none'), ['none'])
  assert.deepEqual(toggleOnboardingBarrier(['none'], 'time'), ['time'])
  assert.deepEqual(toggleOnboardingBarrier(['time'], 'schedule'), ['time', 'schedule'])
  assert.deepEqual(toggleOnboardingBarrier(['time', 'schedule'], 'time'), ['schedule'])
  assert.deepEqual(toggleOnboardingBarrier(['none'], 'none'), [])
  assert.deepEqual(toggleOnboardingBarrier(['time'], 'unknown'), ['time'])
})

test('live previews obey real equipment, time and avoidance rules without changing saved data', () => {
  const state = defaultState()
  const before = structuredClone(state)
  const p = {
    ...state.settings.training,
    location: 'home',
    equipment: ['Dumbbells'],
    avoidMuscles: ['Shoulders'],
  }
  const short = onboardingDemoPlan(state, p, { ...clock, minutes: 15 })
  const long = onboardingDemoPlan(state, p, { ...clock, minutes: 45 })
  for (const plan of [short, long]) {
    assert.ok(plan.moves.length)
    for (const move of plan.moves) {
      const meta = metaOf(move.exId)
      assert.ok(equipmentSatisfied(meta, placeCapabilities(resolvePlace(p, 'home'))))
      assert.ok(!meta.areas.includes('Shoulders'))
      assert.ok(move.name && move.muscle)
    }
    assert.ok(planSeconds(plan.items) <= plan.requestedMinutes * 60)
  }
  assert.ok(planSeconds(short.items) <= planSeconds(long.items))
  assert.deepEqual(state, before)
})

test('soreness demonstration adapts the plan without writing simulated readiness or completions', () => {
  const state = defaultState()
  const before = structuredClone(state)
  const normal = onboardingDemoPlan(state, state.settings.training, clock)
  const sore = onboardingDemoPlan(state, state.settings.training, { ...clock, sore: ['Legs', 'Glutes'] })
  assert.ok(normal.moves.some((m) => m.muscle === 'Legs'))
  assert.ok(!sore.moves.some((m) => m.muscle === 'Legs'))
  assert.deepEqual(state, before)
})

test('chart figures are reproducible scheduling examples, not invented physique outcomes', () => {
  const c = consistencyExample()
  assert.equal(c.steady.length, c.weeks)
  assert.equal(c.steadyMinutes, 15 * 2 * 8)
  assert.equal(c.occasionalMinutes, 60 * 3)
  assert.equal(c.steady.at(-1), c.steadyMinutes)
  assert.equal(c.occasional.at(-1), c.occasionalMinutes)
  assert.equal(planningTimeExample(5).minutes, 5 * 3 * 12)
  assert.equal(planningTimeExample(5).hours, 3)
  assert.equal(planningTimeExample(-2).minutes, 0)
  assert.ok(planningTimeExample(Infinity, Infinity, Infinity).hours <= (30 * 7 * 52) / 60)
})

test('drafts can resume the plan or placeholder without forcing existing users back through setup', () => {
  for (const step of ['why-demo', 'barrier-demo', 'commit', 'building-demo', 'review', 'offer']) {
    const state = defaultState()
    state.settings.training.onboardingDraft = {
      step,
      profile: { ...state.settings.training, onboardingBarriers: ['time'], variety: 'familiar' },
    }
    const restored = normalizeState(JSON.parse(JSON.stringify(state)))
    assert.equal(restored.settings.training.completed, false)
    assert.equal(restored.settings.training.onboardingDraft.step, step)
    assert.deepEqual(restored.settings.training.onboardingDraft.profile.onboardingBarriers, ['time'])
  }
  const existing = normalizeState({
    settings: { training: { completed: true, onboardingVersion: ONBOARDING_VERSION } },
  })
  assert.equal(existing.settings.training.completed, true)
  assert.equal(existing.settings.training.onboardingVersion, 2)
})
