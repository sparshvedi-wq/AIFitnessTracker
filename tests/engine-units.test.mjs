import test from 'node:test'
import assert from 'node:assert/strict'
import { metaOf } from '../src/lib/catalog/index.js'
import { findExercise } from '../src/lib/exercises.js'
import { comparableSessions, planTarget, progressionTrend, stepLoad } from '../src/lib/engine/progression.js'
import { outcomeFromSession, recordOutcome, normalizeReason } from '../src/lib/engine/ledger.js'
import { exerciseSignals, normalizeLearning, withLearningEvent, answerEvent, resetEvent } from '../src/lib/engine/learning.js'
import { chooseQuestion } from '../src/lib/engine/feedback.js'
import { exposureFrom } from '../src/lib/engine/exposure.js'
import { buildSession, findRecords, totals, personalBests } from '../src/lib/workout.js'
import { correctWorkout } from '../src/lib/workout-history.js'
import { makeUser, at } from './helpers/engine-sim.mjs'
import { CONTRIBUTION } from '../src/lib/engine/config.js'

const rec = (id, date, exId, sets, extra = {}) => ({
  id,
  date,
  startedAt: at(date),
  endedAt: at(date) + 3600000,
  unit: 'lb',
  kind: 'adaptive',
  exercises: [{ exId, name: findExercise(exId).name, type: findExercise(exId).type, weighted: findExercise(exId).weighted, sets }],
  ...extra,
})
const set = (reps, weight, extra = {}) => ({ kind: 'work', reps, weight, targetReps: 10, ...extra })
const target = (exId, sessions, extra = {}) =>
  planTarget({ meta: metaOf(exId), def: findExercise(exId), item: { reps: 10 }, sessions, unit: 'lb', ...extra })

test('progression uses only comparable completed working sets, in the current unit', () => {
  const workouts = [
    rec('a', '2026-10-01', 'db-bench', [set(10, 10, { kind: 'warmup' }), set(10, 20), set(10, 20)]),
    rec('b', '2026-10-03', 'db-bench', [set(10, 9.0718474), set(10, 9.0718474)], { unit: 'kg' }),
    { ...rec('c', '2026-10-04', 'db-bench', [set(10, 99)]), sample: true },
    { ...rec('d', '2026-10-05', 'db-bench', [set(10, 99)]), kind: 'pump' },
  ]
  const sessions = comparableSessions(workouts, 'db-bench', { unit: 'lb', today: '2026-10-06', type: 'reps', weighted: true })
  assert.equal(sessions.length, 2, 'samples and focus sessions excluded')
  assert.equal(sessions[0].sets.length, 2, 'warm-ups excluded')
  assert.ok(Math.abs(sessions[1].sets[0].weight - 20) < 1e-6, 'kg converted to lb with full precision')
  const next = target('db-bench', sessions)
  assert.equal(next.code, 'load-up')
  assert.equal(next.weight, 25, 'per-hand load steps by one dumbbell size, never summed')
})

test('listed dumbbell sizes bound increases; big jumps add a rep first', () => {
  const sessions = [{ sets: [set(10, 20), set(10, 20)] }]
  assert.equal(target('db-bench', sessions, { sizes: [10, 20, 30] }).code, 'more-reps-before-jump')
  assert.equal(target('db-bench', sessions, { sizes: [10, 20, 30] }).weight, 20)
  assert.equal(target('db-bench', sessions, { sizes: [10, 20, 22.5] }).weight, 22.5)
  assert.equal(target('db-bench', sessions, { sizes: [5, 10, 15] }).weight, 15, 'never above what the place has')
  assert.equal(stepLoad(135, 1, { load: 'bar', unit: 'lb' }), 140)
  assert.equal(stepLoad(60, 1, { load: 'bar', unit: 'kg' }), 62.5)
})

test('assistance progresses by reducing it, and less assistance is a record, not a weaker lift', () => {
  const sessions = [{ sets: [set(10, 50), set(10, 50)] }]
  const next = target('assisted-pull-up', sessions)
  assert.equal(next.code, 'less-assistance')
  assert.equal(next.weight, 40)
  const prior = [rec('p', '2026-10-01', 'assisted-pull-up', [set(8, 50)])]
  const session = { unit: 'lb', kind: 'adaptive', exercises: [{ exId: 'assisted-pull-up', name: 'Assisted pull-up', type: 'reps', weighted: true, sets: [{ ...set(8, 40), status: 'done' }] }] }
  assert.deepEqual(findRecords(session, prior).map((r) => r.label), ['Least assistance: 40 lb'])
  assert.equal(totals(session.exercises).volume, 0, 'assistance is not lifted volume')
  assert.equal(personalBests([...prior, { ...prior[0], id: 'q', exercises: session.exercises }])[0].assistance, 40)
})

test('timed work, missed reps, easy days, returns and missing data never invent progress', () => {
  assert.equal(
    planTarget({ meta: metaOf('plank'), def: findExercise('plank'), item: { sec: 30 }, sessions: [{ sets: [{ sec: 30, targetSec: 30 }, { sec: 32, targetSec: 30 }] }], unit: 'lb' }).sec,
    35,
  )
  assert.equal(target('db-bench', []).code, 'no-history')
  assert.equal(target('db-bench', []).up, false)
  const missed = [{ sets: [set(8, 20), set(7, 20)] }]
  assert.equal(target('db-bench', missed).weight, 20)
  assert.equal(target('db-bench', [missed[0], missed[0]]).code, 'missed-twice')
  assert.ok(target('db-bench', [missed[0], missed[0]]).weight < 20)
  const hit = [{ sets: [set(10, 100), set(10, 100)] }]
  assert.equal(target('bench-press', hit, { easy: true }).up, false)
  assert.equal(target('bench-press', hit, { easy: true }).weight, 90)
  assert.equal(target('bench-press', hit, { awayDays: 30 }).weight, 80)
  assert.equal(target('bench-press', hit, { comfort: 'some' }).up, false)
  assert.equal(progressionTrend(hit, metaOf('bench-press'), 'reps').direction, 'unknown', 'one session is not a trend')
})

test('an edited historical session changes the next target', () => {
  const original = rec('e', '2026-10-01', 'db-bench', [set(10, 20), set(10, 20)])
  const edited = correctWorkout(
    original,
    { date: '2026-10-01', note: '', exercises: [{ ...original.exercises[0], sets: [set(6, 20), set(6, 20)] }] },
    '2026-10-02',
  )
  const before = target('db-bench', comparableSessions([original], 'db-bench', { unit: 'lb', today: '2026-10-02', type: 'reps', weighted: true }))
  const after = target('db-bench', comparableSessions([edited], 'db-bench', { unit: 'lb', today: '2026-10-02', type: 'reps', weighted: true }))
  assert.equal(before.code, 'load-up')
  assert.equal(after.code, 'repeat-target')
})

test('the ledger separates complete, partial, unreached, skipped and warm-up work; missing reasons stay unknown', () => {
  const session = buildSession({ id: 'x', items: [{ exId: 'db-bench', sets: 3, reps: 10 }, { exId: 'db-row', sets: 2, reps: 10 }, { exId: 'plank', sets: 2, sec: 30 }, { exId: 'push-up', sets: 2, reps: 10 }] }, { now: 1, workouts: [rec('w', '2026-10-01', 'db-bench', [set(10, 20)])] })
  const mark = (e, statuses) => ({ ...e, sets: e.sets.map((s, i) => ({ ...s, status: statuses[i] ?? s.status })) })
  session.exercises[0] = mark(session.exercises[0], ['done', 'done', 'done', 'done']) // warm-up + 3
  session.exercises[1] = mark(session.exercises[1], ['done'])
  session.exercises[2] = { ...mark(session.exercises[2], ['skipped', 'skipped']), skipReason: 'equipment' }
  const outcome = outcomeFromSession({ ...session })
  const by = Object.fromEntries(outcome.exercises.map((o) => [o.exId, o]))
  assert.equal(by['db-bench'].status, 'complete')
  assert.equal(by['db-bench'].doneWarmup, 1)
  assert.equal(by['db-bench'].doneWork, 3)
  assert.equal(by['db-row'].status, 'partial')
  assert.equal(by['db-row'].reason, 'unknown', 'no reason given is unknown, not invented')
  assert.equal(by.plank.status, 'skipped')
  assert.equal(by.plank.reason, 'equipment')
  assert.equal(by['push-up'].status, 'not-reached')
  assert.equal(normalizeReason('pain'), 'discomfort')
  assert.equal(normalizeReason(undefined), 'unknown')
  // Old records without a ledger are reconstructed conservatively.
  const old = recordOutcome({ ...rec('o', '2026-10-01', 'db-row', [set(10, 20)]), finishReason: 'time', unfinished: [{ exId: 'db-row', reason: 'time' }, { exId: 'plank', reason: 'pain' }] })
  assert.equal(old.exercises.find((o) => o.exId === 'db-row').status, 'partial')
  assert.equal(old.exercises.find((o) => o.exId === 'plank').status, 'skipped')
})

test('exposure counts primary, secondary and stabiliser work with documented contributions', () => {
  const workouts = [rec('a', '2026-10-01', 'db-bench', [set(10, 20), set(10, 20)])]
  const e = exposureFrom(workouts, { now: at('2026-10-01') + 3 * 3600000, today: '2026-10-01' })
  assert.equal(e.muscle.chest.week, 2 * CONTRIBUTION.primary)
  assert.equal(e.muscle.triceps.week, 2 * CONTRIBUTION.secondary)
  assert.equal(e.area.Chest.week, 2)
  assert.ok(e.area.Chest.recent < 2 && e.area.Chest.recent > 1.9, 'fades with time')
  const later = exposureFrom(workouts, { now: at('2026-10-04'), today: '2026-10-04' })
  assert.ok(later.area.Chest.recent < e.area.Chest.recent / 2)
})

test('learning data is whitelisted, answers replace per workout, and resets are reversible windows', () => {
  let learning = normalizeLearning(null)
  learning = withLearningEvent(learning, answerEvent({ exId: 'push-up', question: 'again', value: 'yes', workoutId: 'w1', at: 10 }))
  learning = withLearningEvent(learning, answerEvent({ exId: 'push-up', question: 'again', value: 'no', workoutId: 'w1', at: 11 }))
  assert.equal(learning.events.length, 1, 'changing an answer replaces it')
  assert.equal(learning.events[0].value, 'no')
  const state = { ...makeUser(), learning }
  assert.equal(exerciseSignals(state, { now: 20 }).get('push-up').explicitDislike, true)
  const reset = { ...state, learning: withLearningEvent(learning, resetEvent({ exId: 'push-up', at: 15 })) }
  assert.equal(exerciseSignals(reset, { now: 20 }).get('push-up')?.explicitDislike ?? false, false)
  assert.equal(normalizeLearning({ events: [{ kind: 'answer', exId: 'x', question: 'again', value: 'sure?', at: 1 }] }).events.length, 0)
})

test('the feedback budget allows one question per session and cools down repeats', () => {
  let state = makeUser({ location: 'home', equipment: ['Dumbbells', 'Bench'] })
  const record = { ...rec('s1', '2026-11-01', 'db-floor-press', [{ ...set(10, 20), status: 'done' }]), location: 'home' }
  state = { ...state, workouts: [record] }
  const q = chooseQuestion(state, record, { now: at('2026-11-01', 14), today: '2026-11-01' })
  assert.equal(q.question, 'again')
  assert.equal(q.reason, 'new-exercise')
  const answered = { ...state, learning: withLearningEvent(state.learning, answerEvent({ exId: q.exId, question: 'again', value: 'unsure', workoutId: 's1', at: at('2026-11-01', 14) })) }
  assert.equal(chooseQuestion(answered, record, { now: at('2026-11-01', 15), today: '2026-11-01' }), null)
  // A later new record with the same exercise does not re-ask within the cooldown.
  const second = { ...rec('s2', '2026-11-03', 'db-floor-press', [{ ...set(10, 20), status: 'done' }]), location: 'home' }
  assert.equal(chooseQuestion({ ...answered, workouts: [record, second] }, second, { now: at('2026-11-03', 14), today: '2026-11-03' }), null)
  // “Not sure” is recorded but never becomes a preference.
  assert.equal(exerciseSignals(answered, { now: at('2026-11-02') }).get('db-floor-press').enjoyment.explicit, null)
})
