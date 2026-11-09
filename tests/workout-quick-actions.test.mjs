import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSession,
  beginPrepared,
  prepareSession,
  completeSet,
  pause,
  startSetTimer,
  toWorkoutRecord,
} from '../src/lib/workout.js'
import { skipWithUndo, undoQuickSkip, finishForTime } from '../src/lib/workout-quick-actions.js'
import { rolloverCandidates } from '../src/lib/engine/rollover.js'

const today = '2026-11-06'
const now = Date.parse(`${today}T12:00:00`)
const make = () =>
  beginPrepared(
    prepareSession(
      buildSession(
        {
          id: 'quick-test',
          kind: 'adaptive',
          name: 'Your training',
          items: [
            { exId: 'push-up', sets: 3, reps: 10, restSec: 60 },
            { exId: 'split-squat', sets: 2, reps: 8, restSec: 60 },
          ],
        },
        { now },
      ),
    ),
    now,
  )

test('quick skip keeps completed work and undo restores only an unchanged live workout', () => {
  const before = completeSet(make(), now + 1000)
  const copy = structuredClone(before)
  const change = skipWithUndo(before, now + 2000)
  assert.deepEqual(before, copy)
  assert.deepEqual(change.after.exercises[0].sets[0], before.exercises[0].sets[0])
  assert.ok(change.after.exercises[0].sets.slice(1).every((s) => s.status === 'skipped'))
  assert.equal(change.after.cursor.ex, 1)
  assert.deepEqual(undoQuickSkip(change.after, change, now + 3000), before)
  assert.equal(undoQuickSkip(null, change, now + 3000), null, 'a saved/closed session cannot be resurrected')
  assert.equal(undoQuickSkip({ ...change.after, id: 'another-workout' }, change), null)
  assert.equal(undoQuickSkip(completeSet(change.after, now + 2500), change), null)
  assert.equal(undoQuickSkip(pause(change.after, now + 2500), change), null)
  const edited = structuredClone(change.after)
  edited.exercises[1].sets[0].reps = 20
  assert.equal(undoQuickSkip(edited, change), null)
})

test('undo never auto-restarts a timed exercise and restores open-ended rest', () => {
  const timed = {
    ...make(),
    phase: 'work',
    exercises: [
      { ...make().exercises[0], type: 'time', sets: [{ status: 'todo', sec: 30 }] },
      make().exercises[1],
    ],
  }
  const running = startSetTimer(timed, now)
  const change = skipWithUndo(running, now + 5000)
  const restored = undoQuickSkip(change.after, change, now + 6000)
  assert.equal(restored.phase, 'work')
  assert.equal(restored.phaseEndsAt, null)
  const rest = completeSet(make(), now + 1000)
  const skipped = skipWithUndo(rest, now + 2000)
  assert.equal(undoQuickSkip(skipped.after, skipped, now + 120000).phaseEndsAt, null)
})

test('finish now records a time stop through the real save path so only unfinished work becomes a candidate', () => {
  const before = completeSet(make(), now + 1000)
  before.summaryDraft = { effort: 2, note: 'Keep this note.' }
  const stopped = finishForTime(before, now + 3000)
  assert.equal(stopped.phase, 'done')
  assert.equal(stopped.summaryDraft.finishReason, 'time')
  assert.equal(stopped.summaryDraft.note, 'Keep this note.')
  assert.deepEqual(stopped.exercises, before.exercises)
  const saved = toWorkoutRecord(stopped, [], { now: now + 3000, note: stopped.summaryDraft.note })
  const result = rolloverCandidates([saved], { today, now: now + 4000 })
  assert.equal(saved.exercises[0].sets.length, 1)
  assert.equal(result.active.find((c) => c.exId === 'push-up').remainingSets, 2)
  assert.equal(result.active.find((c) => c.exId === 'split-squat').remainingSets, 2)
  const done = {
    ...before,
    exercises: before.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, status: 'done' })) })),
  }
  const completed = toWorkoutRecord(finishForTime(done, now + 3000), [], { now: now + 3000 })
  assert.deepEqual(rolloverCandidates([completed], { today, now: now + 4000 }).active, [])
})

test('shortening never overwrites a prior discomfort reason or rolls pain-related work forward', () => {
  const before = completeSet(make(), now + 1000)
  assert.equal(
    finishForTime({ ...before, finishReason: 'pain', summaryDraft: { finishReason: 'other' } }, now)
      .finishReason,
    'pain',
  )
  for (const reason of ['pain', 'soreness', 'unwell', 'dislike']) {
    const stopped = finishForTime({ ...before, summaryDraft: { finishReason: reason } }, now + 3000)
    assert.equal(stopped.finishReason, reason)
    const saved = toWorkoutRecord(stopped, [], { now: now + 3000 })
    assert.deepEqual(rolloverCandidates([saved], { today, now: now + 4000 }).active, [])
  }
  const change = skipWithUndo(before, now + 2000, 'pain')
  const saved = toWorkoutRecord(finishForTime(change.after, now + 3000), [], { now: now + 3000 })
  assert.ok(!rolloverCandidates([saved], { today, now: now + 4000 }).active.some((c) => c.exId === 'push-up'))
})
