import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { resetForTesting } from '../src/lib/testing.js'

function savedState() {
  const s = defaultState()
  s.settings.name = 'QA profile'
  s.settings.weightUnit = 'kg'
  s.settings.training = {
    ...s.settings.training,
    completed: true,
    goal: 'Build muscle',
    sports: ['tennis'],
    equipment: ['Dumbbells'],
    location: 'home',
    minutes: 45,
    confirmedFocus: ['arms'],
    focusCheckinId: 'photo',
    sideTestConfirmed: true,
    weakerSide: 'left',
    lastSport: 'tennis',
  }
  s.workouts = [{ id: 'saved' }]
  s.activeWorkout = { id: 'active' }
  s.checkins = [{ id: 'photo', previews: { front: 'fixture' } }]
  s.routines = [{ id: 'routine' }]
  s.customExercises = [{ id: 'exercise' }]
  s.metrics = { '2026-10-25': { weight: 70 } }
  s.readiness = { energy: 'low' }
  return s
}

test('reset to onboarding creates a clean first-run state without mutating the existing save', () => {
  const original = savedState()
  const before = structuredClone(original)
  const reset = resetForTesting(original, 'onboarding')
  assert.deepEqual(reset, defaultState())
  assert.equal(reset.settings.training.completed, false)
  assert.deepEqual(original, before)
})

test('reset after onboarding clears all progress but retains independent training preferences', () => {
  const original = savedState()
  const before = structuredClone(original)
  const reset = resetForTesting(original, 'after-onboarding')
  assert.equal(reset.settings.training.completed, true)
  assert.equal(reset.settings.name, 'QA profile')
  assert.equal(reset.settings.weightUnit, 'kg')
  for (const key of ['goal', 'sports', 'equipment', 'location', 'minutes'])
    assert.deepEqual(reset.settings.training[key], original.settings.training[key])
  for (const key of ['workouts', 'checkins', 'routines', 'customExercises']) assert.deepEqual(reset[key], [])
  assert.deepEqual(reset.metrics, {})
  assert.equal(reset.activeWorkout, null)
  assert.equal(reset.readiness, null)
  assert.deepEqual(reset.settings.training.confirmedFocus, [])
  assert.equal(reset.settings.training.focusCheckinId, null)
  assert.equal(reset.settings.training.sideTestConfirmed, false)
  assert.equal(reset.settings.training.lastSport, null)
  assert.deepEqual(original, before)
})

test('an unknown reset destination leaves the existing save untouched', () => {
  const original = savedState()
  assert.equal(resetForTesting(original, 'unknown'), original)
})
