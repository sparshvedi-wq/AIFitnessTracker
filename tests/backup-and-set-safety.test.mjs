import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSnapshot } from '../expo/src/protocol.js'
import { validateBackup } from '../src/lib/backup.js'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { makeSampleWorkouts } from '../src/lib/sample.js'
import { SET_LIMITS, setEntryPatch } from '../src/lib/set-entry.js'
import { correctWorkout } from '../src/lib/workout-history.js'
import {
  beginPrepared,
  buildSession,
  completeSet,
  loadReady,
  pause,
  prepareSession,
  resume,
  routineLoad,
  skipRest,
  startAfterIntro,
  suggestTarget,
  toWorkoutRecord,
} from '../src/lib/workout.js'
import { findExercise } from '../src/lib/exercises.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { planTarget } from '../src/lib/engine/progression.js'
import { customDurationOptions, durationChoices, fitDuration } from '../src/lib/flexible-training.js'

const restore = (value) => validateBackup(validateSnapshot(JSON.stringify(value)))
const record = (patch = {}) => ({
  id: 'w1',
  date: '2026-11-07',
  kind: 'adaptive',
  exercises: [{ exId: 'goblet-squat', name: 'Goblet squat', type: 'reps', weighted: true, sets: [{ reps: 8, weight: 20 }] }],
  ...patch,
})

test('a restore with unreadable records is refused before anything is replaced', () => {
  const ok = { ...defaultState(), workouts: [record(), ...makeSampleWorkouts()] }
  assert.equal(restore(ok).workouts.length, ok.workouts.length, 'real and sample records restore')
  assert.ok(restore({ entries: [] }), 'saves from before the rename still open')
  assert.ok(normalizeState(restore(ok)))
  for (const bad of [
    { workouts: [{ id: 'x', date: '2026-11-01', kind: 'adaptive' }] },
    { workouts: [record({ date: 20261101 })] },
    { workouts: [record({ exercises: [{ exId: 'goblet-squat', sets: null }] })] },
    { workouts: [record({ exercises: [{ exId: 'goblet-squat', sets: [null] }] })] },
    { workouts: [], routines: [{ id: 'r', name: 'R' }] },
    { workouts: [], customExercises: [{ name: 'No id' }] },
    { workouts: [], activeWorkout: { id: 'a', exercises: 'push-up' } },
    { workouts: [], settings: { training: [] } },
  ])
    assert.throws(() => restore(bad), /can’t read/, JSON.stringify(bad))
})

test('zero assistance is the hardest assisted setting and can be logged as prescribed', () => {
  const assisted = { exId: 'assisted-pull-up', type: 'reps', weighted: true }
  const goblet = { exId: 'goblet-squat', type: 'reps', weighted: true }
  assert.deepEqual(setEntryPatch(assisted, { reps: '8', weight: '0' }), { reps: 8, kind: 'work', weight: 0 })
  assert.equal(setEntryPatch(goblet, { reps: '8', weight: '0' }), null, 'other loads still need a weight')
  assert.equal(setEntryPatch(assisted, { reps: '8', weight: '-5' }), null)
  assert.equal(loadReady(assisted, { weight: 0 }), true)
  assert.equal(loadReady(assisted, { weight: null }), false, 'no assistance chosen yet')
  assert.equal(loadReady(goblet, { weight: 0 }), false)
  assert.equal(loadReady({ exId: 'push-up', weighted: false }, {}), true)

  const def = findExercise('assisted-pull-up')
  const sessions = [{ sets: [1, 2, 3].map(() => ({ reps: 8, weight: 10, targetReps: 8 })) }]
  const target = planTarget({ meta: metaOf(def.id), def, item: { reps: 8, sets: 3 }, sessions, unit: 'lb' })
  assert.equal(target.weight, 0)
  const session = buildSession(
    { id: 'p', kind: 'adaptive', name: 'Plan', lockedTargets: true, items: [{ exId: def.id, sets: 3, reps: 8, weight: 0, restSec: 60 }] },
    { unit: 'lb' },
  )
  assert.equal(loadReady(session.exercises[0], session.exercises[0].sets[0]), true, 'the player can log it')
})

test('routines and added exercises progress assistance downward, never upward', () => {
  const def = findExercise('assisted-pull-up')
  const last = { date: '2026-11-01', sets: [40, 45, 45].map((weight) => ({ reps: 8, weight, targetReps: 8 })) }
  const up = suggestTarget(def, { reps: 8 }, last, 'lb')
  assert.equal(up.target.weight, 35, 'least assistance used, minus one step')
  assert.equal(up.up, true)
  const missed = { date: '2026-11-01', sets: [{ reps: 5, weight: 40, targetReps: 8 }] }
  assert.equal(suggestTarget(def, { reps: 8 }, missed, 'lb').target.weight, 40)
  const floor = { date: '2026-11-01', sets: [{ reps: 8, weight: 0, targetReps: 8 }] }
  assert.equal(suggestTarget(def, { reps: 8 }, floor, 'lb').target.weight, 0)
  assert.equal(routineLoad({ exId: def.id, weighted: true, sets: [{ weight: 50, kind: 'warmup' }, { weight: 45 }, { weight: 40 }] }), 40)
  assert.equal(routineLoad({ exId: 'goblet-squat', weighted: true, sets: [{ weight: 10, kind: 'warmup' }, { weight: 30 }, { weight: 35 }] }), 35)
  assert.equal(routineLoad({ exId: 'push-up', weighted: false, sets: [{}] }), null)
})

test('a set saved during a workout stays within the limits a later correction accepts', () => {
  const ex = { exId: 'goblet-squat', type: 'reps', weighted: true }
  assert.equal(setEntryPatch(ex, { reps: String(SET_LIMITS.reps + 1), weight: '20' }), null)
  assert.equal(setEntryPatch(ex, { reps: '8', weight: String(SET_LIMITS.weight + 1) }), null)
  assert.equal(setEntryPatch({ type: 'time' }, { sec: String(SET_LIMITS.sec + 1) }), null)
  const patch = setEntryPatch(ex, { reps: String(SET_LIMITS.reps), weight: String(SET_LIMITS.weight) })
  assert.ok(patch)
  const saved = record({ exercises: [{ ...ex, name: 'Goblet squat', sets: [{ kind: 'work', ...patch }] }] })
  assert.doesNotThrow(() => correctWorkout(saved, { date: saved.date, note: 'note only', exercises: saved.exercises }, '2026-11-08'))
})

test('session setup opens on a visible time: requested custom minutes stay, others snap to a quick choice', () => {
  assert.equal(fitDuration(25, 'adaptive'), 25)
  assert.ok(customDurationOptions(25, 'adaptive').includes(25))
  assert.ok(customDurationOptions(12, 'adaptive').includes(12), 'any requested time can be shown')
  assert.ok(!customDurationOptions(25, 'adaptive').some((v) => durationChoices('adaptive').includes(v)))
  assert.equal(fitDuration(30, 'adaptive'), 30)
  assert.equal(fitDuration(25, 'sport'), 20, 'no custom field for sport: nearest quick choice')
  assert.equal(fitDuration(60, 'pump'), 15)
  assert.equal(fitDuration(12, 'adaptive', true), 10)
  assert.equal(fitDuration(undefined, 'adaptive'), 20)
  assert.equal(fitDuration(0, 'sport'), 10)
})

test('an idle pause on the first-session intro does not erase the workout’s duration', () => {
  const M = 60000
  const t0 = Date.parse('2026-11-08T10:00:00')
  let s = beginPrepared(
    prepareSession(
      buildSession({ id: 'r', kind: 'adaptive', name: 'Your training', items: [{ exId: 'push-up', sets: 2, reps: 10, restSec: 60 }] }, { now: t0 }),
    ),
    t0,
  )
  s = { ...pause(s, t0 + 5 * M), pauseReason: 'Paused after a long quiet spell.' }
  const go = t0 + 40 * M
  s = startAfterIntro(s, go)
  assert.equal(s.pausedAt, null)
  assert.equal(s.introSeen, true)
  s = resume(s, go)
  s = completeSet(s, go + 10 * M)
  s = skipRest(s, go + 12 * M)
  s = completeSet(s, go + 30 * M)
  assert.equal(toWorkoutRecord(s, [], { now: go + 31 * M }).durationSec, 30 * 60)
  const prepared = prepareSession(buildSession({ id: 'r2', name: 'Routine', items: [{ exId: 'push-up', sets: 1, reps: 5 }] }))
  assert.equal(startAfterIntro(prepared, go).startedAt, null, 'a prepared session starts on its own button')
})
