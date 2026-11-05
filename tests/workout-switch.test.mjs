import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSession, completeSet, pause } from '../src/lib/workout.js'
import { endForSwitch } from '../src/lib/workout-switch.js'

const make = () =>
  buildSession(
    {
      id: 'switch-test',
      name: 'Your training',
      items: [{ exId: 'bodyweight-squat', sets: 3, reps: 10, restSec: 60 }],
    },
    { now: 1000, unit: 'kg' },
  )

test('ending for a switch saves completed sets without crediting unfinished targets or mutating the session', () => {
  const session = completeSet(make(), 6000)
  const before = structuredClone(session)
  const record = endForSwitch(session, [], 11000)
  assert.equal(record.exercises.length, 1)
  assert.equal(record.exercises[0].sets.length, 1)
  assert.equal(record.unfinished.length, 1)
  assert.equal(record.finishReason, 'changed-plan')
  assert.equal(record.unit, 'kg')
  assert.deepEqual(session, before)
})

test('an untouched workout does not produce a history entry when replaced', () => {
  assert.equal(endForSwitch(make(), [], 5000), null)
  assert.equal(endForSwitch(null, [], 5000), null)
})

test('switching away from a paused workout does not count the time away', () => {
  const session = pause(completeSet(make(), 6000), 10000)
  const early = endForSwitch(session, [], 12000)
  const later = endForSwitch(session, [], 120000)
  assert.equal(later.durationSec, early.durationSec)
})

test('switching preserves a drafted note, effort and reported reason for stopping', () => {
  const session = completeSet(make(), 6000)
  session.summaryDraft = { note: 'Shoulder felt uncomfortable', effort: 4, finishReason: 'pain' }
  const record = endForSwitch(session, [], 11000)
  assert.equal(record.note, session.summaryDraft.note)
  assert.equal(record.effort, 4)
  assert.equal(record.finishReason, 'pain')
})
