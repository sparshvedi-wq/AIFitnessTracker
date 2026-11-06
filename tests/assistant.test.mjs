import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateParser, EVAL_CONTEXT } from './helpers/assistant-eval.mjs'
import { parseRequest, parseRange, spellCorrect } from '../src/lib/assistant/parse.js'
import { applyPreview, historyResult, previewChanges, progressResult, undoChange } from '../src/lib/assistant/actions.js'
import { toParsed, remoteInterpretationAvailable } from '../src/lib/assistant/remote.js'
import { makeUser, recommend, at } from './helpers/engine-sim.mjs'
import { buildSession, beginPrepared, prepareSession, completeSet } from '../src/lib/workout.js'
import { findExercise } from '../src/lib/exercises.js'

const today = '2026-11-05'
const rec = (id, date, extra = {}) => ({
  id,
  date,
  startedAt: at(date),
  unit: 'lb',
  kind: 'adaptive',
  name: 'Full body',
  exercises: [{ exId: 'goblet-squat', name: 'Goblet squat', type: 'reps', weighted: true, sets: [{ kind: 'work', reps: 10, weight: 30 }, { kind: 'warmup', reps: 10, weight: 15 }] }],
  ...extra,
})

test('the labeled language set: common requests are understood locally, unsafe text never becomes more than a preview', () => {
  const r = evaluateParser()
  assert.equal(r.byGroup.common.accuracy, 1, JSON.stringify(r.failures))
  assert.ok(r.accuracy >= 0.95, JSON.stringify(r.failures))
  // Every common command is handled without any remote call.
  assert.ok(r.byGroup.common.cases > 25)
  for (const g of ['malicious', 'empty', 'unknown', 'unknown-exercise']) assert.equal(r.byGroup[g].accuracy, 1, g)
  const heldOut = evaluateParser(JSON.parse(readFileSync(new URL('./fixtures/assistant-heldout.json', import.meta.url))))
  assert.ok(heldOut.accuracy >= 0.9, JSON.stringify(heldOut.failures))
  assert.equal(remoteInterpretationAvailable(), false, 'off unless the build enables it')
})

test('dates use local calendar days; “past 30 days” includes today and 29 days before', () => {
  assert.deepEqual(parseRange('past 30 days', today), { from: '2026-10-07', to: today, label: 'past 30 days' })
  assert.equal(parseRange('yesterday', today).from, '2026-11-04')
  assert.equal(parseRange('this month', today).from, '2026-11-01')
  assert.equal(spellCorrect('sqaut'), 'squat')
  assert.equal(spellCorrect('zercher'), 'zercher')
})

test('history results count real training only, excluding future, sample and warm-up work', () => {
  const state = makeUser()
  state.workouts = [
    rec('a', '2026-10-06'),
    rec('b', '2026-10-07'),
    rec('c', '2026-11-04'),
    rec('d', '2026-11-04', { kind: 'sport', name: 'Your warmup', exercises: [{ exId: 'wu-jog', name: 'Jog', type: 'time', weighted: false, sets: [{ sec: 120 }] }] }),
    rec('e', '2026-11-06'),
    { ...rec('f', '2026-11-01'), sample: true },
  ]
  const r = historyResult(state, parseRequest('Show workouts over the past 30 days', EVAL_CONTEXT).intents[0].args, today)
  assert.equal(r.trainingSessions, 2, 'Oct 7 and Nov 4; Oct 6 is outside, Nov 6 is in the future')
  assert.equal(r.trainingDays, 2)
  assert.equal(r.workingSets, 2, 'warm-up sets are not working sets')
  assert.equal(r.warmups, 1)
  const empty = historyResult(makeUser(), { from: '2026-10-07', to: today, label: 'past 30 days' }, today)
  assert.equal(empty.trainingSessions, 0)
  assert.deepEqual(empty.recent, [])
})

test('progress compares like with like and says when there is not enough to show', () => {
  const state = makeUser()
  assert.equal(progressResult(state, 'goblet-squat', today).enough, false)
  state.workouts = [rec('a', '2026-10-01'), rec('b', '2026-10-20', { exercises: [{ exId: 'goblet-squat', name: 'Goblet squat', type: 'reps', weighted: true, sets: [{ kind: 'work', reps: 10, weight: 40 }] }] })]
  const r = progressResult(state, 'goblet-squat', today)
  assert.equal(r.enough, true)
  assert.equal(r.direction, 'up')
  assert.match(r.to.text, /40 lb × 10/)
})

test('a plan preview applies once, refuses stale state, and undo restores only what it changed', () => {
  let state = makeUser({ location: 'gym', minutes: 45 })
  const preview = previewChanges(state, [{ type: 'plan.minutes', args: { minutes: 15 } }], { today, now: at(today) })
  assert.equal(preview.target, 'plan')
  assert.deepEqual(preview.diff.minutes, { from: 45, to: 15 })
  assert.ok(preview.diff.estimate <= 15)
  const applied = applyPreview(state, preview, { today, now: at(today) })
  assert.equal(applied.status, 'applied')
  const reducer = (s, a) => (a.type === 'SET_READINESS' ? { ...s, readiness: a.readiness } : s)
  state = applied.actions.reduce(reducer, state)
  assert.equal(state.readiness.todayMinutes, 15)
  assert.equal(state.settings.training.minutes, 45, 'the usual setup is untouched')
  // Applying the same preview again is refused rather than doubled.
  assert.equal(applyPreview(state, preview, { today, now: at(today) }).status, 'stale')
  const undone = undoChange(state, applied.undo)
  assert.equal(undone.status, 'undone')
  state = undone.actions.reduce(reducer, state)
  assert.equal(state.readiness, null)
})

test('a workout preview never overwrites newer logs; undo is refused once more work is logged', () => {
  let state = makeUser({ location: 'gym', minutes: 45 })
  const plan = recommend(state, { date: today })
  let session = beginPrepared(prepareSession(buildSession(plan, { now: at(today) })), at(today))
  session = completeSet(session, at(today) + 60000, { reps: 8 })
  state = { ...state, activeWorkout: session }
  const target = plan.items[1].exId
  const parsed = parseRequest(`replace ${findExercise(target).name}`, { ...EVAL_CONTEXT, workoutIds: plan.items.map((i) => i.exId), planIds: [] })
  const preview = previewChanges(state, parsed.intents, { today, now: at(today) + 70000 })
  assert.equal(preview.target, 'workout')
  // A set is logged before Apply is tapped: the preview is stale.
  const moved = { ...state, activeWorkout: completeSet(session, at(today) + 80000, { reps: 8 }) }
  assert.equal(applyPreview(moved, preview, { today, now: at(today) + 90000 }).status, 'stale')
  const applied = applyPreview(state, preview, { today, now: at(today) + 90000 })
  assert.equal(applied.status, 'applied')
  state = { ...state, activeWorkout: applied.actions[0].session }
  assert.ok(!state.activeWorkout.exercises.some((e) => e.exId === target && e.sets.some((s) => s.status === 'todo')))
  assert.deepEqual(
    state.activeWorkout.exercises.flatMap((e) => e.sets.filter((s) => s.status === 'done')),
    session.exercises.flatMap((e) => e.sets.filter((s) => s.status === 'done')),
    'logged work is kept exactly',
  )
  const later = { ...state, activeWorkout: completeSet(state.activeWorkout, at(today) + 100000, { reps: 8 }) }
  assert.equal(undoChange(later, applied.undo).status, 'stale')
  assert.equal(undoChange(state, applied.undo).status, 'undone')
})

test('a remote interpretation is only a suggestion: it is re-validated and cannot invent IDs', () => {
  const ctx = { ...EVAL_CONTEXT, nameOf: (id) => findExercise(id)?.name }
  assert.equal(toParsed({ intent: 'delete.everything' }, ctx).unknown, true)
  assert.ok(toParsed({ intent: 'plan.minutes', minutes: 500, scope: 'temporary', needsClarification: false }, ctx).clarify)
  assert.ok(toParsed({ intent: 'plan.place', place: 'Moon base', scope: 'temporary', needsClarification: false }, ctx).clarify)
  assert.ok(toParsed({ intent: 'exercise.replace', exercise: 'Zercher squat', scope: 'temporary', needsClarification: false }, ctx).clarify)
  const ok = toParsed({ intent: 'exercise.replace', exercise: 'Walking lunge', scope: 'always', needsClarification: false }, ctx)
  assert.deepEqual(ok.intents, [{ type: 'exercise.replace', args: { exId: 'lunge' } }])
  assert.equal(ok.scope, 'temporary', 'unknown scope values fall back to temporary')
  assert.ok(toParsed({ intent: 'plan.minutes', minutes: 15, needsClarification: true, clarification: 'Which day?' }, ctx).clarify)
})
