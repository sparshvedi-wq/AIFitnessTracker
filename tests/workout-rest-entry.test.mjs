import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSession,
  prepareSession,
  beginPrepared,
  completeSet,
  tick,
  pause,
  resume,
  skipRest,
  startSetTimer,
  sessionStatus,
  adjustTimer,
  undoLastSet,
  updateSet,
} from '../src/lib/workout.js'
import { loggedSetStats, setEntryPatch } from '../src/lib/set-entry.js'
import { skipWithUndo, undoQuickSkip } from '../src/lib/workout-quick-actions.js'
import { shortenSession } from '../src/lib/workout-adjustments.js'

const now = 1_000_000
const make = (exId = 'db-row') =>
  beginPrepared(
    prepareSession(
      buildSession(
        {
          id: 'rest-entry',
          kind: 'adaptive',
          items: [{ exId, sets: 3, reps: 10, sec: 30, restSec: 60 }],
        },
        { now },
      ),
    ),
    now,
  )

test('rest waits indefinitely for an explicit next-set action, retaining the completed log', () => {
  const rest = completeSet(make(), now + 1000, { weight: 20, reps: 12 })
  assert.equal(rest.phase, 'rest')
  assert.equal(rest.phaseEndsAt, null)
  assert.equal(rest.phaseLeft, null)
  assert.equal(rest.phaseTotal, 0)
  assert.equal(tick(rest, now + 20 * 60_000), rest)
  assert.equal(adjustTimer(rest, 15, now + 2000), rest)
  assert.equal(sessionStatus(rest), 'Resting · next One-arm dumbbell row')
  const ready = skipRest(rest, now + 3000)
  assert.equal(ready.phase, 'work')
  assert.equal(ready.phaseEndsAt, null)
  assert.deepEqual(ready.exercises, rest.exercises)
  assert.equal(ready.cursor.set, 1)
  const undone = undoLastSet(rest, now + 4000)
  assert.equal(undone.cursor.set, 0)
  assert.equal(undone.exercises[0].sets[0].status, 'todo')
})

test('old saved rest deadlines and paused remainders cannot restart a rest countdown', () => {
  const rest = completeSet(make(), now + 1000)
  for (const phaseEndsAt of [now + 2000, now - 2000]) {
    const legacy = { ...rest, phaseEndsAt, phaseTotal: 60_000 }
    const next = tick(legacy, now + 100_000)
    assert.equal(next.phase, 'rest')
    assert.equal(next.phaseEndsAt, null)
    assert.deepEqual(next.exercises, rest.exercises)
    assert.equal(shortenSession(legacy, 10, now + 2000).phaseEndsAt, null)
  }
  const legacyPaused = { ...rest, pausedAt: now + 2000, phaseLeft: 30_000, phaseTotal: 60_000 }
  const resumed = resume(legacyPaused, now + 10_000)
  assert.equal(resumed.phase, 'rest')
  assert.equal(resumed.phaseEndsAt, null)
  assert.equal(resumed.phaseLeft, null)
  assert.equal(resumed.pausedMs, 8000)
  const paused = pause(rest, now + 2000)
  assert.equal(paused.phaseLeft, null)
  assert.equal(resume(paused, now + 4000).phaseEndsAt, null)
})

test('timed movements still run only after Start and land in open-ended rest', () => {
  const waiting = make('plank')
  assert.equal(tick(waiting, now + 100_000), waiting)
  const running = startSetTimer(waiting, now)
  assert.equal(running.phaseEndsAt, now + 30_000)
  assert.equal(tick(running, now + 20_000), running)
  const rest = tick(running, now + 30_000)
  assert.equal(rest.exercises[0].sets[0].status, 'done')
  assert.equal(rest.phase, 'rest')
  assert.equal(rest.phaseEndsAt, null)
  assert.equal(skipRest(rest, now + 60_000).phaseEndsAt, null)
})

test('skipping and undoing during rest restores user-paced rest, including legacy sessions', () => {
  const rest = { ...completeSet(make(), now + 1000), phaseEndsAt: now + 60_000, phaseTotal: 60_000 }
  const change = skipWithUndo(rest, now + 2000)
  const restored = undoQuickSkip(change.after, change, now + 120_000)
  assert.equal(restored.phase, 'rest')
  assert.equal(restored.phaseEndsAt, null)
  assert.deepEqual(restored.exercises, rest.exercises)
})

test('rest statistics use only logged working sets, excluding warm-ups and assistance load', () => {
  const stats = loggedSetStats({
    exercises: [
      {
        type: 'reps',
        weighted: true,
        exId: 'db-row',
        sets: [
          { status: 'done', reps: 10, weight: 20 },
          { status: 'done', kind: 'warmup', reps: 10, weight: 10 },
          { status: 'todo', reps: 10, weight: 50 },
          { status: 'skipped', reps: 10, weight: 50 },
          { reps: 10, weight: 50 },
        ],
      },
      { type: 'time', exId: 'plank', sets: [{ status: 'done', sec: 30 }] },
      {
        type: 'reps',
        weighted: true,
        exId: 'assisted-pull-up',
        sets: [{ status: 'done', reps: 5, weight: 60 }],
      },
    ],
  })
  assert.deepEqual(stats, { sets: 3, reps: 15, volume: 200, seconds: 30, warmupSets: 1 })
})

test('direct entry accepts decimal loads and whole reps, preserving incomplete input until save', () => {
  const ex = { type: 'reps', weighted: true }
  for (const weight of ['12.5', '12,5'])
    assert.deepEqual(setEntryPatch(ex, { reps: '8', weight }), { reps: 8, weight: 12.5, kind: 'work' })
  for (const weight of ['', '0', '-5', 'NaN', 'Infinity', '0x10', '1e3', '12..5'])
    assert.equal(setEntryPatch(ex, { reps: '8', weight }), null)
  for (const reps of ['', '0', '-1', '2.5', 'abc'])
    assert.equal(setEntryPatch(ex, { reps, weight: '20' }), null)
  assert.deepEqual(setEntryPatch({ type: 'time' }, { sec: '5' }, 'warmup'), { sec: 5, kind: 'warmup' })
  assert.equal(setEntryPatch({ type: 'time' }, { sec: '5.5' }), null)
  const edited = updateSet(make(), setEntryPatch(ex, { reps: '8', weight: '12.5' }))
  const logged = completeSet(edited, now + 2000)
  assert.equal(logged.exercises[0].sets[0].weight, 12.5)
  assert.equal(logged.exercises[0].sets[1].weight, 12.5, 'chosen load carries into untouched sets')
})
