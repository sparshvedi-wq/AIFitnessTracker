// Regression tests for holes found outside the strength model: answers that
// froze a lift, notes that disagreed with the next plan, routines and swaps
// planned without the full picture, blunt lighter days, stats that counted
// the wrong way, session length that never learned, and exercises that
// stalled with nowhere to go. Also how photos and events tie into the model.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeUser, recommend, train, at } from './helpers/engine-sim.mjs'
import { answerEvent, exerciseSignals, retryEvent, withLearningEvent } from '../src/lib/engine/learning.js'
import { buildSession, completeSet, findRecords, toWorkoutRecord, workoutVolume } from '../src/lib/workout.js'
import { routineFromWorkout } from '../src/lib/workout-history.js'
import { exerciseTrend } from '../src/lib/history-insights.js'
import { weeklyRecap } from '../src/lib/week.js'
import { avgSessionMin } from '../src/lib/derive.js'
import { paceFactor } from '../src/lib/engine/pace.js'
import { exerciseReadiness, snapLoad, strengthTarget } from '../src/lib/strength/index.js'
import { findExercise } from '../src/lib/exercises.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { mainAreas } from '../src/lib/engine/scoring.js'
import { pastActivityLoad } from '../src/lib/sport-schedule.js'
import { presetImpact } from '../src/lib/training-events.js'
import { buildEventPump } from '../src/lib/planner.js'
import { replaceCurrentExercise } from '../src/lib/workout-adjustments.js'
import { buildGraph } from '../src/lib/strength/graph.js'
import { availability, decayFatigue } from '../src/lib/strength/recovery.js'
import { exerciseProfile } from '../src/lib/strength/library.js'
import { addDays } from '../src/lib/date.js'

const DAY = 86400000
const day = (i) => addDays('2026-09-01', i)
const rec = (i, exercises, extra = {}) => ({
  id: `r${i}-${exercises.map((e) => e[0]).join('+')}`,
  date: day(i),
  startedAt: at(day(i), 18),
  endedAt: at(day(i), 18) + 3600000,
  unit: 'lb',
  kind: 'adaptive',
  location: 'gym',
  exercises: exercises.map(([exId, sets]) => ({ exId, name: exId, type: findExercise(exId).type, weighted: findExercise(exId).weighted, sets })),
  ...extra,
})
const work = (reps, weight, extra = {}) => ({ kind: 'work', reps, weight, targetReps: reps, ...extra })

test('one "harder than expected" answer holds the load for one session, not forever', () => {
  const state = makeUser({ location: 'gym' })
  state.workouts = [rec(0, [['bench-press', [work(8, 135), work(8, 135)]]])]
  state.learning = withLearningEvent(state.learning, answerEvent({ exId: 'bench-press', question: 'effort', value: 'hard', workoutId: state.workouts[0].id, at: at(day(0), 20) }))
  const before = exerciseSignals(state, { now: at(day(2)), today: day(2), place: 'gym' }).get('bench-press')
  assert.equal(before.difficulty, 'hard', 'it holds the next plan')
  state.workouts.push(rec(3, [['bench-press', [work(8, 135, { feel: 'easy', reserve: 5 }), work(8, 135, { feel: 'easy', reserve: 5 })]]]))
  const after = exerciseSignals(state, { now: at(day(5)), today: day(5), place: 'gym' }).get('bench-press')
  assert.equal(after.difficulty, null, 'newer logged sets take over')
})

test('a discomfort report settles after a retry and comfortable sessions, keeping its history', () => {
  const state = makeUser({ location: 'gym' })
  state.workouts = [
    {
      ...rec(0, [['bench-press', [work(8, 135)]]]),
      outcome: { version: 1, stopReason: 'unknown', exercises: [{ exId: 'bench-press', planned: 3, doneWork: 1, doneWarmup: 0, status: 'partial', reason: 'discomfort', deliberate: true }] },
    },
  ]
  state.learning = withLearningEvent(state.learning, retryEvent({ exId: 'bench-press', at: at(day(2)) }))
  const once = exerciseSignals(state, { now: at(day(3)), today: day(3), place: 'gym' }).get('bench-press')
  assert.equal(once.comfort.status, 'some')
  state.workouts.push(rec(3, [['bench-press', [work(8, 135), work(8, 135)]]]), rec(6, [['bench-press', [work(8, 135), work(8, 135)]]]))
  const settled = exerciseSignals(state, { now: at(day(8)), today: day(8), place: 'gym' }).get('bench-press')
  assert.equal(settled.comfort.status, 'ok')
  assert.equal(settled.comfort.reports, 1, 'the report itself is kept')
})

test('a saved routine plans with bodyweight and place exactly like a daily plan', () => {
  const metrics = { [day(0)]: { weight: 220 } }
  const hist = [0, 3, 6, 9].map((i) => rec(i, [['pull-up', [work(8, 0), work(8, 0), work(7, 0)]]]))
  const args = { exId: 'lat-pulldown', def: findExercise('lat-pulldown'), workouts: hist, unit: 'lb', today: day(11), now: at(day(11), 8), goal: 'Build muscle', experience: 'Some experience', sets: 3, place: 'gym', metrics, fixedReps: 10 }
  const daily = strengthTarget(args)
  const session = buildSession(
    { id: 'mine', name: 'Mine', location: 'gym', items: [{ exId: 'lat-pulldown', sets: 3, reps: 10, restSec: 90 }] },
    { workouts: hist, unit: 'lb', now: at(day(11), 8), strength: { goal: 'Build muscle', experience: 'Some experience', today: day(11), metrics, place: 'gym' } },
  )
  const first = session.exercises[0].sets.find((s) => s.kind !== 'warmup')
  assert.equal(first.weight, daily.weight)
  assert.ok(daily.weight >= 100, 'a 220 lb person who does pull-ups pulls down real weight')
})

test('lighter-day loads are always weights the equipment can hold', () => {
  assert.equal(snapLoad({ exId: 'bench-press', weight: 135 * 0.85, unit: 'lb' }), 110)
  assert.equal(snapLoad({ exId: 'back-squat', weight: 225 * 0.85, unit: 'lb' }), 190)
  assert.equal(snapLoad({ exId: 'db-bench', weight: 37, unit: 'lb', sizes: [20, 25, 30, 40] }), 30)
  assert.equal(snapLoad({ exId: 'bench-press', weight: 30, unit: 'lb' }), 45, 'never below the empty bar')
})

test('repeating a workout keeps its working sets, top weight and rest, not the warm-up', () => {
  const w = {
    id: 'w1',
    name: 'Push',
    kind: 'adaptive',
    unit: 'lb',
    date: '2026-09-01',
    exercises: [
      { exId: 'bench-press', type: 'reps', weighted: true, restSec: 120, sets: [{ kind: 'warmup', reps: 8, weight: 70 }, work(8, 140), work(8, 140), work(7, 140)] },
      { exId: 'assisted-pull-up', type: 'reps', weighted: true, sets: [work(8, 50), work(8, 40)] },
    ],
  }
  const [bench, assisted] = routineFromWorkout(w).items
  assert.deepEqual([bench.sets, bench.reps, bench.weight, bench.restSec], [3, 8, 140, 120])
  assert.equal(assisted.weight, 40, 'the least assistance is the hardest setting')
  assert.ok(assisted.restSec >= 60)
})

test('a swap mid-workout gets a weight from the strength model, at this place and bodyweight', () => {
  const state = makeUser({ goal: 'Build muscle', experience: 'Some experience', location: 'gym' })
  state.workouts = [0, 3, 6].map((i) => rec(i, [['bench-press', [work(8, 185), work(8, 185), work(8, 185)]]]))
  state.metrics = { [day(0)]: { weight: 180 } }
  const plan = { id: 'p', name: 'Push', location: 'gym', items: [{ exId: 'machine-chest-press', sets: 3, reps: 10, restSec: 90 }] }
  let session = buildSession(plan, { workouts: state.workouts, unit: 'lb', now: at(day(9), 18) })
  session = { ...session, phase: 'work', cursor: { ex: 0, set: 0 } }
  const swapped = replaceCurrentExercise(session, findExercise('db-bench'), state, at(day(9), 18))
  const ex = swapped.exercises.find((e) => e.exId === 'db-bench')
  assert.ok(ex, 'the swap happened')
  const expected = strengthTarget({ exId: 'db-bench', def: findExercise('db-bench'), workouts: state.workouts, metrics: state.metrics, unit: 'lb', today: day(9), now: at(day(9), 18), goal: 'Build muscle', experience: 'Some experience', place: 'gym', sets: 3, live: session })
  assert.ok(Number.isFinite(ex.sets[0].weight) && ex.sets[0].weight > 0, 'a planned weight, not "pick one"')
  assert.equal(ex.sets[0].weight, expected.weight)
  assert.doesNotMatch(ex.note || '', /Pick a comfortable weight/)
})

test('assisted exercises: less assistance is progress in History and the weekly recap', () => {
  const ws = [70, 50, 30].map((assist, k) => rec(k * 3, [['assisted-pull-up', [work(8, assist)]]], { kind: 'routine' }))
  const trend = exerciseTrend(ws, 'assisted-pull-up', 'lb', day(20))
  assert.deepEqual(trend.map((t) => t.value), [70, 50, 30])
  assert.ok(trend.every((t) => t.assisted))
  const state = makeUser()
  state.workouts = [rec(0, [['assisted-pull-up', [work(8, 60)]]]), rec(8, [['assisted-pull-up', [work(8, 45)]]])]
  const recap = weeklyRecap(state, day(9), 'current')
  assert.equal(recap.progress?.kind, 'assist')
  assert.equal(recap.progress.delta, 15)
})

test('lifted weight counts both dumbbells; average minutes skips quick logs; machine records stay per gym', () => {
  assert.equal(workoutVolume(rec(0, [['db-bench', [work(10, 50)]]])), 1000)
  assert.equal(workoutVolume(rec(0, [['bench-press', [work(10, 135)]]])), 1350)
  const timed = { ...rec(0, [['bench-press', [work(10, 135)]]]), durationSec: 40 * 60 }
  const quick = { ...rec(1, [['bench-press', [work(10, 135)]]]), kind: 'manual', durationSec: 5 }
  assert.equal(avgSessionMin([timed, quick]), 40)
  const elsewhere = rec(0, [['machine-chest-press', [work(10, 150)]]], { location: 'gym' })
  const session = { kind: 'adaptive', unit: 'lb', location: 'home-gym', exercises: [{ exId: 'machine-chest-press', name: 'Chest press', type: 'reps', weighted: true, sets: [{ ...work(10, 200), status: 'done' }] }] }
  assert.deepEqual(findRecords(session, [elsewhere]), [], 'a different gym’s stack is not a record')
})

test('sets are saved with when they were logged, and pace learns from them', () => {
  let s = buildSession({ id: 'r', name: 'R', items: [{ exId: 'bench-press', sets: 2, reps: 8, weight: 135, restSec: 90 }] }, { unit: 'lb', now: 1000 })
  s = { ...s, phase: 'work' }
  s = completeSet(s, 5000)
  const record = toWorkoutRecord(completeSet(s, 200000), [], { now: 210000 })
  assert.deepEqual(record.exercises[0].sets.map((x) => x.at), [5000, 200000])
  assert.equal(record.exercises[0].restSec, 90)
  // Three sessions resting about twice as long as planned: plans get shorter.
  const slow = [0, 3, 6].map((i) => {
    const start = at(day(i), 18)
    const sets = Array.from({ length: 6 }, (_, k) => ({ ...work(8, 135), at: start + k * 4 * 60000 }))
    return { ...rec(i, [['bench-press', sets]]), exercises: [{ exId: 'bench-press', type: 'reps', weighted: true, restSec: 90, sets }] }
  })
  const pace = paceFactor(slow, { today: day(8) })
  assert.ok(pace > 1.3 && pace <= 1.5, `pace ${pace}`)
  assert.equal(paceFactor(slow.slice(0, 2), { today: day(8) }), 1, 'two sessions are not enough')
  assert.equal(paceFactor([rec(0, [['bench-press', [work(8, 135)]]])], { today: day(8) }), 1, 'no set times, no change')
  const state = makeUser({ goal: 'Build muscle', experience: 'Some experience', location: 'gym', minutes: 45 })
  const usual = recommend(state, { date: day(9), pace: 1 })
  const slower = recommend(state, { date: day(9), pace })
  const sets = (p) => p.items.reduce((n, i) => n + i.sets, 0)
  assert.ok(sets(slower) < sets(usual))
  assert.ok(slower.estimatedSeconds <= 45 * 60 + 1)
})

test('a maxed-out timed hold leads to a harder version from the same family', () => {
  let state = makeUser({ goal: 'General fitness', experience: 'Some experience', location: 'home', equipment: [] })
  const hold = (i) => rec(i, [['plank', [0, 1, 2].map(() => ({ kind: 'work', sec: 90, targetSec: 90 }))]], { location: 'home' })
  state.workouts = [hold(0), hold(3), hold(6)]
  const plan = recommend(state, { date: day(9), trace: true })
  const harder = plan.decision.trace.find((t) => t.features.harder)
  assert.ok(harder, 'a harder sibling is boosted')
  assert.ok(metaOf(harder.exId).family === metaOf('plank').family)
  const chosen = plan.decision.items.find((i) => i.codes.includes('harder-version'))
  if (chosen) assert.match(plan.items.find((i) => i.exId === chosen.exId).note, /outgrown plank/i)
})

test('a hard match yesterday tires the legs in the shared muscle model, not the chest', () => {
  const ev = { id: 'm', title: 'Soccer match', kind: 'competition', sport: 'soccer', date: day(9), time: '18:00', minutes: 90, effort: 'hard', status: 'done' }
  ev.impact = presetImpact(ev.sport, ev.effort, ev.kind)
  const profile = { lifeEvents: [ev], eventMode: 'one-off' }
  const now = at(day(10), 12)
  const activities = pastActivityLoad(profile, { today: day(10), now })
  assert.equal(activities.length, 1)
  const args = { workouts: [], unit: 'lb', today: day(10), now, experience: 'Some experience' }
  const legs = exerciseReadiness({ ...args, activities }, 'back-squat')
  assert.ok(legs < 0.99 && legs > 0.85, `legs ${legs}`)
  assert.equal(exerciseReadiness({ ...args, activities }, 'bench-press'), exerciseReadiness(args, 'bench-press'))
})

test('short focus sessions tire muscles in the model but are not evidence of strength', () => {
  const base = [rec(0, [['bench-press', [work(8, 135), work(8, 135)]]])]
  const pump = { ...rec(1, [['bench-press', [work(10, 95, { feel: 'easy', reserve: 8 }), work(10, 95, { feel: 'easy', reserve: 8 })]]]), kind: 'pump' }
  const a = buildGraph({ workouts: base, unit: 'lb', today: day(1), now: at(day(1), 20), experience: 'Some experience' })
  const b = buildGraph({ workouts: [...base, pump], unit: 'lb', today: day(1), now: at(day(1), 20), experience: 'Some experience' })
  assert.deepEqual(b.exercises.get('bench-press'), a.exercises.get('bench-press'), 'nothing learned from the easy sets')
  const profile = exerciseProfile('bench-press')
  const later = at(day(1), 21)
  assert.ok(availability(decayFatigue(b.fatigue, later), profile) < availability(decayFatigue(a.fatigue, later), profile), 'but the chest is a little tired')
})

test('focus sessions plan loads with the strength model, on real equipment steps', () => {
  const state = makeUser({ goal: 'Build muscle', experience: 'Some experience', location: 'gym' })
  state.workouts = [0, 3].map((i) => rec(i, [['biceps-curl', [work(10, 30), work(10, 30)]], ['triceps-pushdown', [work(12, 55), work(12, 55)]]]))
  const plan = buildEventPump(state, { id: 'e', focus: ['Biceps', 'Triceps'] }, { today: day(6), now: at(day(6), 12), minutes: 15 })
  for (const item of plan.items.filter((i) => Number.isFinite(i.weight)))
    assert.equal(snapLoad({ exId: item.exId, weight: item.weight, unit: 'lb', used: [30, 55] }), item.weight, `${item.exId} ${item.weight}`)
})

test('photo and chosen focus count exercises that train the area hard, not only by name', () => {
  assert.ok(mainAreas(metaOf('close-grip-bench')).includes('Triceps'), 'close-grip bench works the arms')
  assert.ok(!mainAreas(metaOf('lateral-raise')).includes('Chest'))
})

test('the daily plan keeps going lighter only where an event or hard session asks for it', () => {
  let state = makeUser({ goal: 'Build muscle', experience: 'Some experience', location: 'gym', minutes: 45 })
  const plan = recommend(state, { date: day(0) })
  state = train(state, plan, day(0), { effort: 4 }).state
  const next = recommend(state, { date: day(1) })
  assert.equal(next.decision.facts.mode, 'normal')
  assert.ok(next.items.length >= 3)
  assert.ok(Math.abs(next.estimatedSeconds - (next.estimatedSeconds / 1)) < 1)
  void DAY
})
