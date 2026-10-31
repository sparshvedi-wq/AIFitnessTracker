import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { editorialScene } from '../src/lib/editorial.js'
import { parseLoads, fitAvailableLoad, trainingDays, breakDays } from '../src/lib/preferences.js'
import { convertStateUnits } from '../src/lib/units.js'
import { buildDailyPlan, MOVEMENTS, availableMovement } from '../src/lib/planner.js'
import {
  buildSession,
  completeSet,
  currentSet,
  beginPrepared,
  prepareSession,
  pause,
  personalBests,
} from '../src/lib/workout.js'
import { findExercise, TEMPLATES } from '../src/lib/exercises.js'
import {
  replacementOptions,
  replaceCurrentExercise,
  shortenSession,
  adaptRoutineItems,
} from '../src/lib/workout-adjustments.js'

const today = '2026-10-26'
const now = Date.parse(today + 'T12:00:00Z')
const stateFor = () => {
  const state = defaultState()
  state.settings.training = {
    ...state.settings.training,
    completed: true,
    location: 'home',
    experience: 'Some experience',
    equipment: ['Dumbbells', 'Bench'],
    minutes: 30,
  }
  return state
}
const record = (date, exId = 'db-bench', weight = 20, kind = 'adaptive', unit = 'lb') => ({
  id: date + exId,
  date,
  startedAt: Date.parse(date + 'T12:00:00Z'),
  unit,
  kind,
  totals: { volume: weight * 10, sets: 1 },
  exercises: [{ ...findExercise(exId), exId, sets: [{ reps: 10, targetReps: 10, weight }] }],
})
const sessionFor = (state) =>
  beginPrepared(
    prepareSession(
      buildSession(
        {
          id: 'test',
          name: 'Your training',
          location: 'home',
          items: [{ exId: 'db-bench', sets: 3, reps: 10, restSec: 60 }],
        },
        { workouts: state.workouts, now },
      ),
    ),
    now,
  )

test('Home photography stays stable within a local slot and changes by day and time', () => {
  const morning = new Date(2026, 9, 26, 8)
  assert.equal(editorialScene(morning).key, editorialScene(new Date(2026, 9, 26, 11, 59)).key)
  assert.notEqual(editorialScene(morning).key, editorialScene(new Date(2026, 9, 27, 8)).key)
  assert.equal(editorialScene(new Date(2026, 9, 26, 4, 59)).period, 'evening')
  assert.equal(editorialScene(new Date(2026, 9, 26, 5)).period, 'morning')
  assert.equal(editorialScene(new Date(2026, 9, 26, 12)).period, 'day')
  assert.equal(editorialScene(new Date(2026, 9, 26, 18)).period, 'evening')
  assert.notEqual(editorialScene(morning).key, editorialScene(new Date(2026, 9, 26, 14)).key)
})
test('dumbbell limits reject malformed weights and never round a suggestion upwards', () => {
  assert.deepEqual(parseLoads('20, 5, 10, 5'), [5, 10, 20])
  assert.deepEqual(parseLoads(''), [])
  assert.throws(() => parseLoads('5, nope'))
  assert.throws(() => parseLoads('-5, 20'))
  assert.equal(fitAvailableLoad(17, [5, 10, 20]), 10)
  assert.equal(fitAvailableLoad(2, [5, 10]), null)
})
test('changing units preserves quantities in bodyweight, goals, routines, history and the active set', () => {
  const state = stateFor()
  state.metrics[today] = { weight: 100 }
  state.settings.liftGoal = { exId: 'db-bench', target: 100 }
  state.settings.training.homeDumbbells = [10, 20]
  state.workouts = [
    record('2026-10-20', 'db-bench', 100),
    record('2026-10-21', 'db-row', 50, 'adaptive', 'kg'),
  ]
  state.workouts[0].records = [{ label: 'Heaviest: 100 lb' }]
  state.routines = [{ items: [{ exId: 'db-bench', sets: 3, weight: 100 }] }]
  state.activeWorkout = sessionFor(state)
  const before = structuredClone(state)
  const kg = convertStateUnits(state, 'kg')
  assert.ok(Math.abs(kg.metrics[today].weight - 45.359237) < 0.00001)
  assert.equal(kg.workouts[1].exercises[0].sets[0].weight, 50)
  assert.equal(kg.workouts[0].records[0].label, 'Heaviest: 45.4 kg')
  assert.equal(kg.activeWorkout.unit, 'kg')
  const lb = convertStateUnits(kg, 'lb')
  assert.ok(Math.abs(lb.metrics[today].weight - 100) < 0.00001)
  assert.ok(Math.abs(lb.routines[0].items[0].weight - 100) < 0.00001)
  assert.deepEqual(state, before)
})
test('flexible goals count distinct strength days and exclude warmups and future records', () => {
  const state = stateFor()
  state.workouts = [
    record('2026-10-20'),
    record('2026-10-20', 'db-row'),
    record('2026-10-25', 'db-row', 20, 'sport'),
    record('2026-10-26'),
    record('2026-10-27'),
  ]
  assert.equal(trainingDays(state.workouts, state.settings, today).count, 2)
})
test('returning after a break reduces volume and suggested load without reading fatigue from photos', () => {
  const state = stateFor()
  state.workouts = [record('2026-10-01')]
  assert.equal(breakDays(state.workouts, today), 25)
  const plan = buildDailyPlan(state, { today })
  assert.match(plan.focus, /restart/)
  assert.ok(plan.items.every((it) => it.sets <= 2))
  const bench = plan.items.find((it) => it.exId === 'db-bench')
  if (bench) assert.ok(bench.weight <= 20)
  assert.ok(plan.reasons.some((r) => r.includes('25 days')))
})
test('home recommendations fit equipment and saved dumbbell sizes', () => {
  const state = stateFor()
  state.settings.training.homeDumbbells = [5, 10, 15]
  state.workouts = [record('2026-10-18', 'db-bench', 20)]
  const plan = buildDailyPlan(state, { today })
  for (const item of plan.items) {
    const m = MOVEMENTS.find((v) => v.id === item.exId)
    assert.ok(availableMovement(m, 'home', state.settings.training.equipment))
    if (
      ['goblet-squat', 'db-bench', 'db-row', 'lateral-raise', 'biceps-curl'].includes(item.exId) &&
      item.weight != null
    )
      assert.ok([5, 10, 15].includes(item.weight))
  }
})
test('a replacement keeps completed original sets and uses only its own weight history', () => {
  const state = stateFor()
  state.workouts = [record('2026-10-20', 'db-bench', 100)]
  let session = sessionFor(state)
  session = completeSet(session, now + 1000, { reps: 9, weight: 100 })
  session = pause(session, now + 2000)
  const def = replacementOptions(state, session).find((d) => d.id === 'push-up')
  assert.ok(def)
  const before = structuredClone(session)
  const next = replaceCurrentExercise(session, def, state, now + 3000)
  assert.equal(next.exercises[0].sets[0].status, 'done')
  assert.equal(next.exercises[0].sets[0].reps, 9)
  assert.equal(currentSet(next).ex.exId, 'push-up')
  assert.equal(currentSet(next).set.weight, null)
  assert.equal(next.pausedAt, session.pausedAt)
  assert.deepEqual(session, before)
})
test('replacement choices respect equipment and reported pain', () => {
  const state = stateFor()
  const session = sessionFor(state)
  session.readiness = { pain: ['Shoulders'], sore: [] }
  assert.deepEqual(replacementOptions(state, session), [])
  assert.equal(replaceCurrentExercise(session, findExercise('lat-pulldown'), state), session)
})
test('shortening preserves every logged set and marks only removed work as time-limited', () => {
  const state = stateFor()
  let session = sessionFor(state)
  session = completeSet(session, now + 1000, { reps: 7, weight: 15 })
  session = pause(session, now + 2000)
  const before = structuredClone(session)
  const next = shortenSession(session, 1, now + 3000)
  assert.deepEqual(next.exercises[0].sets[0], before.exercises[0].sets[0])
  assert.equal(next.exercises[0].skipReason, 'time')
  assert.ok(next.exercises[0].sets.slice(1).every((s) => s.status === 'skipped'))
  assert.equal(next.phase, 'done')
  assert.deepEqual(session, before)
})
test('quiet home routines replace jumping and unavailable equipment while preserving the saved routine', () => {
  const state = stateFor()
  state.settings.training.quiet = true
  const hiit = TEMPLATES.find((r) => r.id === 'tpl-hiit')
  const original = structuredClone(hiit)
  const adapted = adaptRoutineItems(state, hiit.items, 'home', { pain: [], sore: [] })
  assert.ok(adapted.items.length > 0)
  assert.ok(adapted.items.every((it) => it.exId.startsWith('quiet-')))
  assert.deepEqual(hiit, original)
  const push = adaptRoutineItems(state, TEMPLATES[0].items, 'on-the-go', { pain: [], sore: [] })
  assert.ok(push.items.every((it) => !findExercise(it.exId).weighted))
})
test('metric-light training ignores stored appearance emphasis without deleting it', () => {
  const state = stateFor()
  state.settings.training.confirmedFocus = ['arms']
  state.settings.training.focusCheckinId = 'photo'
  state.checkins = [{ id: 'photo', date: today }]
  state.settings.display.metricLight = true
  const plan = buildDailyPlan(state, { today })
  assert.ok(!plan.reasons.some((r) => r.includes('photo focus')))
  assert.deepEqual(state.settings.training.confirmedFocus, ['arms'])
})

test('a short balanced recommendation includes upper and lower body when both are available', () => {
  const state = stateFor()
  const plan = buildDailyPlan(state, { today, minutes: 20 })
  const muscles = plan.items.map((it) => findExercise(it.exId).muscle)
  assert.ok(muscles.some((m) => ['Legs', 'Glutes'].includes(m)))
  assert.ok(muscles.some((m) => !['Legs', 'Glutes', 'Core'].includes(m)))
})
test('custom routine progression respects the actual available dumbbell sizes', () => {
  const session = buildSession(
    { id: 'custom', items: [{ exId: 'db-bench', sets: 3, reps: 10 }] },
    { workouts: [record('2026-10-20', 'db-bench', 20)], dumbbellWeights: [5, 10, 15], now },
  )
  const [warmup, ...work] = session.exercises[0].sets
  assert.equal(warmup.kind, 'warmup')
  assert.equal(warmup.weight, 5)
  assert.ok(work.every((s) => s.kind === 'work' && s.weight === 15))
  assert.equal(currentSet(session).set.kind, 'warmup')
})
test('warm-up sets are added only before a loaded lift with a known weight', () => {
  const fresh = buildSession({ id: 'new', items: [{ exId: 'bench-press', sets: 3, reps: 8 }] }, { now })
  assert.ok(fresh.exercises[0].sets.every((s) => s.kind === 'work'))
  const circuit = buildSession(
    { id: 'c', circuit: true, items: [{ exId: 'db-bench', sets: 3, reps: 10 }] },
    { workouts: [record('2026-10-20', 'db-bench', 20)], now },
  )
  assert.ok(circuit.exercises[0].sets.every((s) => s.kind === 'work'))
})
test('preparation drills do not enter strength personal bests', () => {
  assert.deepEqual(personalBests([record(today, 'wu-jog', 0, 'sport')]), [])
})
test('arm replacements keep the intended muscle and beginners are not offered advanced substitutions', () => {
  const state = stateFor()
  state.settings.training.experience = 'Starting out'
  const session = buildSession(
    { id: 'test', location: 'home', items: [{ exId: 'goblet-squat', sets: 2, reps: 10 }] },
    { now },
  )
  assert.ok(
    replacementOptions(state, session).every(
      (d) => !['db-rdl', 'rdl', 'calf-raise', 'back-squat'].includes(d.id),
    ),
  )
  const curls = buildSession(
    { id: 'test', location: 'gym', items: [{ exId: 'biceps-curl', sets: 2, reps: 10 }] },
    { now },
  )
  assert.ok(replacementOptions(state, curls).every((d) => d.muscle === 'Biceps'))
})
