import test from 'node:test'
import assert from 'node:assert/strict'
import { tallySessions, firstSessionAchievement } from '../src/lib/milestones.js'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { resetForTesting } from '../src/lib/testing.js'
const today = '2026-11-06'
const workout = {
  id: 'first',
  date: today,
  exercises: [{ exId: 'biceps-curl', sets: [{ kind: 'warmup', reps: 10 }, { reps: 8 }, { reps: 8 }] }],
}

test('tally marks and the first-session milestone count actual work, not samples, future or empty sessions', () => {
  const state = defaultState()
  assert.deepEqual(firstSessionAchievement(state, workout, today), {
    workoutId: 'first',
    sets: 2,
    exercises: 1,
  })
  for (const patch of [
    { sample: true },
    { synthetic: true },
    { date: '2026-11-07' },
    { exercises: [] },
    { exercises: [{ sets: [{ reps: 0 }, { reps: 8, status: 'todo' }, { reps: 10, kind: 'warmup' }] }] },
  ]) {
    const invalid = { ...workout, ...patch }
    assert.equal(tallySessions([invalid], today).length, 0)
    assert.equal(firstSessionAchievement(state, invalid, today), null)
  }
  const timed = { ...workout, exercises: [{ sets: [{ sec: 30 }] }] }
  assert.equal(firstSessionAchievement(state, timed, today).sets, 1)
})

test('saving the first log works before or after the state update, while existing real history prevents a false first', () => {
  const state = defaultState()
  state.workouts = [workout]
  assert.ok(firstSessionAchievement(state, workout, today))
  state.workouts.push({ ...workout, id: 'older', date: '2026-11-05' })
  assert.equal(firstSessionAchievement(state, workout, today), null)
})

test('the once-only milestone survives restore and deleting logs; explicit testing resets re-enable it', () => {
  const state = defaultState()
  state.settings.milestones.firstSession = workout.id
  const restored = normalizeState(JSON.parse(JSON.stringify(state)))
  assert.equal(firstSessionAchievement(restored, workout, today), null)
  for (const stage of ['onboarding', 'after-onboarding']) {
    const reset = resetForTesting(restored, stage)
    assert.deepEqual(reset.settings.milestones, {})
    assert.ok(firstSessionAchievement(reset, workout, today))
  }
})
