import test from 'node:test'
import assert from 'node:assert/strict'
import { makeUser, at, train } from './helpers/engine-sim.mjs'
import { buildDailyPlan, buildEventPump } from '../src/lib/planner.js'
import { buildBaselineSession, baselineDue } from '../src/lib/baseline.js'
import { buildSession, finish, toWorkoutRecord, totals } from '../src/lib/workout.js'
import { previewReplan } from '../src/lib/engine/replan.js'
import {
  exerciseSignals,
  normalizeLearning,
  answerEvent,
  dismissEvent,
  retryEvent,
} from '../src/lib/engine/learning.js'
import { buildSportWarmup } from '../src/lib/sports.js'
import { progressionTrend, comparableSessions } from '../src/lib/engine/progression.js'
import { mergeBrowserEdits } from '../src/lib/browser-save.js'
import { validateBackup } from '../src/lib/backup.js'
import { nextLoadLimit, preferredLoadQuestion } from '../src/lib/engine/load-preference.js'
import { routineFromWorkout, rebuildRecords } from '../src/lib/workout-history.js'
import { convertStateUnits } from '../src/lib/units.js'
import { adaptRoutineItems } from '../src/lib/workout-adjustments.js'

const today = '2026-11-18',
  now = at(today)
const args = { today, now }
test('readiness and a five minute request agree across training entry points', () => {
  const state = makeUser({ experience: 'Experienced' })
  const short = buildDailyPlan(state, { ...args, minutes: 5 })
  assert.equal(short.requestedMinutes, 5)
  assert.ok(short.estimatedSeconds <= 300)
  state.readiness = { date: today, unwell: true }
  assert.equal(baselineDue(state, today), false)
  assert.equal(buildBaselineSession(state, args), null)
  assert.equal(buildEventPump(state, { focus: ['Chest'] }, args).items.length, 0)
  assert.equal(buildDailyPlan(state, args).kind, 'recovery')
})
test('mixed-place sessions snap pending sets, preserve logged place and retain failed attempts separately', () => {
  const state = makeUser({ location: 'gym', equipment: ['Dumbbells'], homeDumbbells: [10, 15] })
  const session = buildSession(
    {
      id: 'mix',
      location: 'gym',
      lockedTargets: true,
      items: [
        { exId: 'machine-chest-press', sets: 1, reps: 10, weight: 100 },
        { exId: 'biceps-curl', sets: 2, reps: 10, weight: 50 },
      ],
    },
    { now },
  )
  session.exercises[0].sets.forEach((s) => {
    s.status = 'done'
  })
  const moved = previewReplan(state, session, { location: 'home' }, args).session
  assert.equal(moved.exercises[1].sets[0].weight, 15)
  moved.exercises[1].attempts = [{ weight: 15, unit: 'lb', location: 'home', setIndex: 0, at: now }]
  const record = toWorkoutRecord(finish(moved, now), [], { now })
  assert.equal(record.location, 'gym')
  assert.ok(record.exercises[0].sets.every((s) => s.location === 'gym'))
  assert.equal(record.attemptOnly[0].attempts[0].weight, 15)
  assert.equal(routineFromWorkout(record).items.length, 1)
  assert.equal(routineFromWorkout(record).items[0].sets, 1)
  const first = rebuildRecords([record])
  assert.equal(rebuildRecords([...first, { ...record, id: 'later', date: '2026-11-19' }], first)[0], first[0])
})
test('a seated skip and an old explicit discomfort answer both remain effective until retry', () => {
  const state = makeUser()
  const routine = {
    id: 'seat',
    kind: 'recovery',
    location: 'on-the-go',
    lockedTargets: true,
    items: [
      { exId: 'seated-heel-raise', sets: 1, reps: 8 },
      { exId: 'seated-reach', sets: 1, reps: 8 },
    ],
  }
  const exId = 'seated-heel-raise'
  const saved = train(state, routine, '2026-11-17', { skip: { [exId]: 'pain' } }).state
  assert.ok(exerciseSignals(saved, args).get(exId).comfort.restricted)
  state.learning = normalizeLearning({
    events: [
      answerEvent({ exId, question: 'feel', value: 'uncomfortable', at: now - 1000 }),
      ...Array.from({ length: 601 }, (_, i) =>
        dismissEvent({ exId: 'squat', question: 'again', at: now - 900 + i }),
      ),
    ],
  })
  assert.ok(exerciseSignals(state, args).get(exId).comfort.restricted)
  state.learning.events.push(retryEvent({ exId, at: now }))
  assert.equal(exerciseSignals(state, args).get(exId).comfort.restricted, false)
})
test('quiet substitutions respect exclusions and rep-based warmup drills run on time', () => {
  const user = makeUser({ location: 'home', homeQuiet: true, excludedExercises: ['quiet-step'] })
  const adapted = adaptRoutineItems(
    user,
    [{ exId: 'jumping-jack', sets: 1, sec: 40 }],
    'home',
    { sore: [], pain: [] },
    args,
  )
  assert.ok(!adapted.items.some((i) => i.exId === 'quiet-step'))
  const warm = buildSportWarmup('tennis', 10, {
    movement: { position: 'seated', space: 'small', wall: false, noFloor: true },
    excluded: new Set(['seated-heel-raise']),
  })
  const session = buildSession(warm, { now })
  assert.ok(session.exercises.length)
  for (const e of session.exercises) {
    assert.equal(e.type, 'time')
    assert.ok(e.sets[0].sec > 0)
    assert.notEqual(e.exId, 'seated-heel-raise')
  }
})
test('assisted trends are invariant under actual saved-history unit conversions', () => {
  const state = makeUser()
  state.workouts = [
    [8, 60],
    [8, 55],
    [6, 40],
  ].map(([reps, weight], i) => ({
    id: String(i),
    date: '2026-11-1' + i,
    kind: 'adaptive',
    location: 'gym',
    unit: 'lb',
    exercises: [{ exId: 'assisted-pull-up', type: 'reps', weighted: true, sets: [{ reps, weight }] }],
  }))
  const trend = (s) =>
    progressionTrend(
      comparableSessions(s.workouts, 'assisted-pull-up', {
        today,
        unit: s.settings.weightUnit,
        type: 'reps',
        weighted: true,
      }),
      { load: 'assist' },
      'reps',
    )
  assert.equal(trend(state).direction, trend(convertStateUnits(state, 'kg')).direction)
  assert.equal(
    totals([
      { exId: 'db-row', type: 'reps', weighted: true, unilateral: true, sets: [{ reps: 10, weight: 30 }] },
    ]).volume,
    600,
  )
})
test('concurrent settings and workout additions survive a simultaneous units change', () => {
  const base = makeUser(),
    left = structuredClone(base)
  left.settings.theme = 'dark'
  left.workouts.push({
    id: 'added',
    date: today,
    unit: 'lb',
    exercises: [{ exId: 'biceps-curl', sets: [{ reps: 8, weight: 30 }] }],
  })
  const merged = mergeBrowserEdits(base, convertStateUnits(base, 'kg'), left)
  assert.equal(merged.settings.theme, 'dark')
  assert.equal(merged.settings.weightUnit, 'kg')
  assert.ok(Math.abs(merged.workouts[0].exercises[0].sets[0].weight - 13.60777) < 0.001)
  const active = { ...base, activeWorkout: { id: 'session', exercises: [] } }
  assert.throws(
    () =>
      mergeBrowserEdits(
        active,
        { ...active, activeWorkout: null },
        { ...active, activeWorkout: { id: 'session', exercises: [{}] } },
      ),
    /Another tab/,
  )
  assert.throws(() => validateBackup(makeUser({ sports: {} })), /backup/)
  assert.throws(
    () => validateBackup({ ...base, activeWorkout: { exercises: [], cursor: { ex: 4, set: 0 } } }),
    /backup/,
  )
  assert.throws(
    () => validateBackup({ ...base, workouts: [{ date: today, exercises: [], attemptOnly: {} }] }),
    /backup/,
  )
})
test('the repeated weight choice is specific to the place and lasts one completed visit', () => {
  const state = makeUser()
  state.workouts = Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    kind: 'adaptive',
    unit: 'lb',
    location: 'gym',
    endedAt: now - 3 + i,
    exercises: [
      {
        exId: 'bench-press',
        name: 'Bench press',
        weighted: true,
        sets: [{ manual: true, reps: 8, weight: 125, targetWeight: 135 }],
      },
    ],
  }))
  const q = preferredLoadQuestion(state, state.workouts[2])
  assert.equal(q.weight, 125)
  const opts = {
    ...q,
    learning: normalizeLearning({ events: [{ ...q, kind: 'load-limit', question: 'load', at: now }] }),
    now: now + 2,
    workouts: state.workouts,
  }
  assert.equal(nextLoadLimit(opts), 125)
  assert.equal(nextLoadLimit({ ...opts, place: 'home' }), null)
  assert.equal(
    nextLoadLimit({ ...opts, workouts: [...state.workouts, { ...state.workouts[0], endedAt: now + 1 }] }),
    null,
  )
})
