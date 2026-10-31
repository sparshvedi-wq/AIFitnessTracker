import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, saveState, loadState } from '../src/lib/storage.js'
import { initialBaselineMetric } from '../src/lib/starting-profile.js'
import {
  appendExercise,
  buildSession,
  completeSet,
  jumpTo,
  makeSessionExercise,
  totals,
  toWorkoutRecord,
  lastPerformance,
  personalBests,
  undoLastSet,
} from '../src/lib/workout.js'
import { correctWorkout, rebuildRecords, routineFromWorkout } from '../src/lib/workout-history.js'
import { findExercise } from '../src/lib/exercises.js'
import { buildSportWarmup, SPORTS, SPORT_DRILLS } from '../src/lib/sports.js'
import { historyTimeline } from '../src/lib/history-insights.js'
import { matchesExercise } from '../src/lib/exercise-search.js'
import { onboardingStage, onboardingSteps } from '../src/lib/onboarding.js'

const today = '2026-10-29'
const exercise = (weight = 20) => ({
  exId: 'bench-press',
  name: 'Bench press',
  muscle: 'Chest',
  type: 'reps',
  weighted: true,
  sets: [{ reps: 10, weight }],
})
const record = (id, date, weight = 20) => ({
  id,
  routineId: 'daily-' + date,
  name: 'Your training',
  kind: 'adaptive',
  date,
  startedAt: Date.parse(date + 'T12:00:00Z'),
  unit: 'lb',
  durationSec: 600,
  exercises: [exercise(weight)],
  totals: totals([exercise(weight)]),
})

test('saving unrelated profile changes never overwrites bodyweight with the onboarding baseline', () => {
  const state = defaultState(),
    profile = {
      ...state.settings.training,
      baselineMode: 'manual',
      manualBaseline: { weightKg: 70, heightCm: 175 },
    }
  assert.ok(initialBaselineMetric(state, profile, today))
  state.metrics[today] = { weight: 160, sampleWeight: false }
  assert.equal(initialBaselineMetric(state, profile, today), null)
  state.metrics = {}
  state.settings.training = profile
  assert.equal(initialBaselineMetric(state, { ...profile, minutes: 45 }, today), null)
})

test('opening a completed set never removes the logged set or changes session progress', () => {
  const s = buildSession({
    id: 'test',
    name: 'Test',
    items: [{ exId: 'push-up', sets: 2, reps: 10, restSec: 0 }],
  })
  const logged = completeSet(s)
  assert.equal(logged.exercises[0].sets[0].status, 'done')
  assert.equal(jumpTo(logged, { ex: 0, set: 0 }), logged)
  assert.equal(logged.exercises[0].sets[0].status, 'done')
})

test('manual logging pauses between exercises and can append another without losing completed work', () => {
  const s = buildSession({
    id: 'quick',
    kind: 'manual',
    name: 'Your workout',
    items: [{ exId: 'push-up', sets: 1, reps: 10, restSec: 0 }],
  })
  const logged = completeSet(s)
  assert.equal(logged.phase, 'between')
  assert.ok(logged.pausedAt)
  const def = findExercise('bodyweight-squat')
  const next = appendExercise(logged, makeSessionExercise(def, { sets: 1, restSec: 0 }, { reps: 10 }))
  assert.equal(next.phase, 'work')
  assert.equal(next.pausedAt, null)
  assert.equal(next.exercises[0].sets[0].status, 'done')
  assert.deepEqual(next.cursor, { ex: 1, set: 0 })
  const saved = toWorkoutRecord({ ...next, logDate: '2026-10-27' }, [])
  assert.equal(saved.date, '2026-10-27')
  assert.deepEqual(saved.unfinished, [])
})

test('undo reverses only the most recently logged set and preserves corrected earlier sets', () => {
  let s = buildSession({
    id: 'test',
    name: 'Test',
    items: [{ exId: 'push-up', sets: 3, reps: 10, restSec: 0 }],
  })
  s = completeSet(s, 1000, { reps: 12 })
  s = completeSet(s, 2000)
  const undone = undoLastSet(s, 3000)
  assert.equal(undone.exercises[0].sets[0].reps, 12)
  assert.equal(undone.exercises[0].sets[0].status, 'done')
  assert.equal(undone.exercises[0].sets[1].status, 'todo')
  assert.deepEqual(undone.cursor, { ex: 0, set: 1 })
  assert.equal(undoLastSet(undone), undone)
})

test('sport avoidance checks footwork and secondary muscles across all sport durations', () => {
  for (const sport of SPORTS)
    for (const minutes of [5, 10, 15, 20])
      for (const area of ['Legs', 'Shoulders', 'Core']) {
        const plan = buildSportWarmup(sport.id, minutes, { avoidMuscles: [area] })
        for (const item of plan.items) {
          const def = SPORT_DRILLS.find((d) => d.id === item.exId)
          if (def) assert.ok(!def.uses.includes(area), `${sport.id}: ${def.id} loads ${area}`)
        }
      }
  assert.ok(
    !buildSportWarmup('tennis', 10, { avoidMuscles: ['Legs'] }).items.some((i) => i.exId === 'wu-racket'),
  )
})

test('correcting an old workout updates totals and subsequent records without changing unrelated logs', () => {
  const first = record('a', '2026-10-27', 20),
    second = record('b', '2026-10-28', 30)
  const updated = correctWorkout(
    first,
    { date: first.date, note: 'Corrected load', exercises: [exercise(40)] },
    today,
  )
  assert.equal(updated.totals.volume, 400)
  assert.equal(first.exercises[0].sets[0].weight, 20)
  const logs = rebuildRecords([updated, second])
  assert.equal(logs[1].records.length, 0)
  assert.equal(logs[1].exercises[0].sets[0].weight, 30)
  for (const date of ['2026-02-30', '2027-01-01', 'nope'])
    assert.throws(() => correctWorkout(first, { date, note: '', exercises: first.exercises }, today))
  assert.throws(() =>
    correctWorkout(
      first,
      { date: today, note: '', exercises: [{ ...exercise(), sets: [{ reps: 0, weight: 20 }] }] },
      today,
    ),
  )
})

test('daily sessions remain repeatable after their temporary recommendation is gone and loads use current units', () => {
  const routine = routineFromWorkout(record('a', today, 100), 'kg')
  assert.ok(Math.abs(routine.items[0].weight - 45.3592) < 0.001)
  assert.equal(routine.items[0].sets, 1)
})

test('short adaptive sessions appear under Short sessions and never come from sample history', () => {
  const state = defaultState()
  state.workouts = [
    { ...record('short', today), planning: { shortSession: true } },
    { ...record('sample', today), sample: true },
  ]
  assert.deepEqual(
    historyTimeline(state, today, { filter: 'focus' }).rows.map((r) => r.id),
    ['short'],
  )
})

test('warmup sets stay in history but cannot increase working volume, overload targets or personal bests', () => {
  const working = exercise(20),
    warmup = { ...working, sets: [{ reps: 2, weight: 200, kind: 'warmup' }] }
  assert.equal(totals([working, warmup]).volume, 200)
  assert.equal(totals([working, warmup]).warmupSets, 1)
  assert.equal(lastPerformance([{ ...record('a', today), exercises: [warmup] }], 'bench-press', 'lb'), null)
  assert.equal(personalBests([{ ...record('a', today), exercises: [warmup] }]).length, 0)
  const s = buildSession({
    id: 'manual',
    name: 'Test',
    items: [{ exId: 'bench-press', sets: 1, reps: 2, weight: 20 }],
  })
  s.exercises[0].sets[0] = { ...s.exercises[0].sets[0], status: 'done', kind: 'warmup' }
  assert.equal(toWorkoutRecord(s, []).exercises[0].sets[0].kind, 'warmup')
})

test('search finds catalog exercises using common names, abbreviations and muscle groups', () => {
  const def = findExercise('db-overhead-press')
  for (const query of ['dumbbell overhead press', 'db ohp', 'shoulders'])
    assert.ok(matchesExercise(def, query))
  assert.equal(matchesExercise(def, 'leg curl'), false)
})

test('setup sport selection is explicit and stage counts remain stable as branches expand', () => {
  const profile = { ...defaultState().settings.training, wantsSport: true, sports: [] }
  assert.ok(onboardingSteps(profile).includes('sport-choice'))
  assert.deepEqual(profile.sports, [])
  assert.equal(onboardingStage('equipment').total, onboardingStage('goal').total)
})

test('a browser storage failure is reported to the app instead of silently claiming success', async () => {
  const previous = globalThis.localStorage,
    log = console.error
  globalThis.localStorage = {
    setItem() {
      throw new Error('Quota exceeded')
    },
  }
  console.error = () => {}
  try {
    await assert.rejects(saveState(defaultState()), /Quota/)
  } finally {
    globalThis.localStorage = previous
    console.error = log
  }
})

test('a corrupt browser save stops startup and is never replaced with a fresh default', () => {
  const previous = globalThis.localStorage,
    log = console.error
  let writes = 0
  globalThis.localStorage = {
    getItem: () => '{broken',
    setItem() {
      writes++
    },
  }
  console.error = () => {}
  try {
    assert.throws(() => loadState(), /not been replaced/)
    assert.equal(writes, 0)
  } finally {
    globalThis.localStorage = previous
    console.error = log
  }
})

test('exercise notes are kept per place and older shared notes still show', async () => {
  const { exerciseNote, withExerciseNote } = await import('../src/lib/exercise-notes.js')
  let notes = { 'goblet-squat': 'Elbows in' }
  assert.equal(exerciseNote(notes, 'goblet-squat', 'gym'), 'Elbows in')
  notes = withExerciseNote(notes, 'goblet-squat', 'gym', 'Use the 20s rack')
  assert.equal(exerciseNote(notes, 'goblet-squat', 'gym'), 'Use the 20s rack')
  assert.equal(exerciseNote(notes, 'goblet-squat', 'home'), 'Elbows in')
  notes = withExerciseNote(notes, 'goblet-squat', 'home', '')
  assert.equal(exerciseNote(notes, 'goblet-squat', 'home'), '')
  assert.equal(exerciseNote(notes, 'goblet-squat', 'gym'), 'Use the 20s rack')
})
