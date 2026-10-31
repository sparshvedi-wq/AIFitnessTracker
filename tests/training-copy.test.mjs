import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { buildDailyPlan } from '../src/lib/planner.js'
import { trainingTitle } from '../src/lib/training-copy.js'

test('generated training is named for its content, with a short description and no invented fatigue', () => {
  const plan = buildDailyPlan(defaultState(), { today: '2026-10-25' })
  assert.equal(plan.name, 'Full body')
  assert.equal(plan.focus, 'A first session to find comfortable starting weights.')
  assert.ok(!/fatigued|sore|overtrained/i.test(plan.focus))
})

test('reported sore legs produce an upper-body explanation only when the plan actually avoids legs', () => {
  const plan = buildDailyPlan(defaultState(), { today: '2026-10-25', readiness: { sore: ['Legs'] } })
  assert.equal(plan.name, 'Upper body')
  assert.match(plan.focus, /give your legs a break.*upper body/)
  assert.ok(plan.items.length > 0)
})

test('sport-aware daily descriptions mention the chosen sport without renaming the workout', () => {
  const state = defaultState()
  state.settings.training = { ...state.settings.training, sports: ['tennis'], sportPriority: 'balanced' }
  const plan = buildDailyPlan(state, { today: '2026-10-25' })
  assert.equal(plan.name, 'Full body')
  assert.match(plan.focus, /muscle balance.*tennis/)
  assert.ok(plan.items.length > 0)
})

test('session titles follow the muscles they train', () => {
  const t = (...ids) => trainingTitle(ids.map((exId) => ({ exId })))
  assert.equal(t('bench-press', 'ohp'), 'Push')
  assert.equal(t('db-row', 'biceps-curl'), 'Pull')
  assert.equal(t('bench-press', 'db-row'), 'Upper body')
  assert.equal(t('goblet-squat', 'glute-bridge'), 'Lower body')
  assert.equal(t('goblet-squat', 'db-row'), 'Full body')
  assert.equal(t('plank', 'dead-bug'), 'Core & conditioning')
  assert.equal(trainingTitle([{ exId: 'goblet-squat' }], { short: true }), 'Quick lower body')
  assert.equal(t('seated-scapular', 'seated-knee-extension'), 'Seated movement')
})
