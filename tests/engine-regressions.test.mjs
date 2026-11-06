import test from 'node:test'
import assert from 'node:assert/strict'
import { makeUser, train, at, answer } from './helpers/engine-sim.mjs'
import { rolloverCandidates } from '../src/lib/engine/rollover.js'
import { recordOutcome, recordTime } from '../src/lib/engine/ledger.js'
import { correctWorkout } from '../src/lib/workout-history.js'
import { exerciseSignals, answerEvent, resetEvent } from '../src/lib/engine/learning.js'
import { comparableSessions, planTarget } from '../src/lib/engine/progression.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { findExercise } from '../src/lib/exercises.js'
import { nextTimeNotes } from '../src/lib/next-time.js'
import { exposureFrom } from '../src/lib/engine/exposure.js'
import { applyReplan, previewReplan, sessionFingerprint } from '../src/lib/engine/replan.js'
import { buildSession, prepareSession, beginPrepared } from '../src/lib/workout.js'
import { applyPreview, previewChanges, undoChange } from '../src/lib/assistant/actions.js'

const today = '2026-11-05'
const plan = (exId = 'db-row', carriedFrom = []) => ({
  id: 'regression', kind: 'adaptive', name: 'Your training', location: 'gym',
  planning: { carriedFrom },
  items: [{ exId: 'push-up', sets: 1, reps: 10, restSec: 60 }, { exId, sets: 3, reps: 10, restSec: 60 }],
})
const missed = () => train(makeUser({ experience: 'Some experience' }), plan(), '2026-11-02', {
  sets: (e) => e.exId === 'db-row' ? 0 : Infinity, finishReason: 'time',
}).state
const root = (state) => `${state.workouts[0].id}:db-row`
const rolls = (state) => rolloverCandidates(state.workouts, { today, now: at(today, 20) })

test('applying an older prepared preview preserves a newly started session and current rest timing', () => {
  const state = makeUser()
  const prepared = prepareSession(buildSession(plan(), { now: 1000 }))
  const preview = previewReplan(state, prepared, { minutes: 10 }, { today, now: 1000 })
  const started = beginPrepared(prepared, 5000)
  const result = applyReplan(started, preview, 6000)
  assert.equal(result.status, 'applied')
  assert.equal(result.session.startedAt, 5000)
  assert.equal(result.session.phase, 'work')
  const rest = { ...started, phase: 'rest', phaseEndsAt: 15000, phaseLeft: null, phaseTotal: 10000 }
  const same = applyReplan(rest, preview, 7000)
  assert.equal(same.session.phaseEndsAt, 15000)
  assert.equal(same.session.phaseTotal, 10000)
})

test('partial and mixed-load sessions cannot claim a load increase from hitting only the completed targets', () => {
  const result = train(makeUser(), plan(), today, { sets: (e) => e.exId === 'db-row' ? 1 : Infinity, finishReason: 'time' })
  const record = result.state.workouts.at(-1)
  const args = { meta: metaOf('db-row'), def: findExercise('db-row'), item: { reps: 10 }, unit: 'lb' }
  const sessions = comparableSessions([record], 'db-row', { unit: 'lb', today, type: 'reps', weighted: true })
  assert.equal(sessions[0].incomplete, true)
  assert.equal(planTarget({ ...args, sessions }).up, false)
  assert.ok(!nextTimeNotes(record, result.state.settings.training, 'lb').some((n) => n.exId === 'db-row' && n.up))
  const mixed = [{ sets: [{ reps: 10, targetReps: 10, weight: 20 }, { reps: 10, targetReps: 10, weight: 30 }] }]
  assert.equal(planTarget({ ...args, sessions: mixed }).up, false)
  assert.equal(planTarget({ ...args, sessions: mixed }).code, 'mixed-loads')
})

test('an offered but uncompleted rollover gets another bounded chance, including a different equipment variant', () => {
  let state = missed()
  const source = root(state)
  state = train(state, plan('cable-row', [source]), '2026-11-03', { sets: (e) => e.exId === 'cable-row' ? 0 : Infinity, finishReason: 'time' }).state
  let result = rolls(state)
  const candidate = result.active.find((c) => c.source === source)
  assert.ok(candidate, 'being offered is not completion')
  assert.equal(candidate.offers, 1)
  assert.equal(candidate.remainingSets, 3)
  assert.equal(result.active.filter((c) => c.family === candidate.family).length, 1, 'the variant does not create a fresh debt')
  state = train(state, plan('cable-row', [source]), '2026-11-04', { sets: (e) => e.exId === 'cable-row' ? 0 : Infinity, finishReason: 'time' }).state
  result = rolls(state)
  assert.ok(result.closed.some((c) => c.source === source && c.closedBy === 'offer-limit'))
  assert.ok(!result.active.some((c) => c.source === source))
})

test('partial equivalent work reduces a rollover; one completed set cannot erase three missed sets', () => {
  let state = missed()
  const source = root(state)
  const oneRow = { ...plan(), kind: 'manual', planning: {}, items: [{ exId: 'cable-row', sets: 1, reps: 10, restSec: 60 }] }
  state = train(state, oneRow, '2026-11-03').state
  const partial = rolls(state).active.find((c) => c.source === source)
  assert.ok(partial)
  assert.equal(partial.remainingSets, 2)
  state = train(state, { ...oneRow, items: [{ ...oneRow.items[0], sets: 2 }] }, '2026-11-04').state
  assert.ok(rolls(state).closed.some((c) => c.source === source && c.closedBy === 'same-family'))
})

test('explicit discomfort on carried work closes it instead of presenting another attempt', () => {
  let state = missed()
  const source = root(state)
  state = train(state, plan('cable-row', [source]), '2026-11-03', { skip: { 'cable-row': 'pain' } }).state
  assert.ok(rolls(state).closed.some((c) => c.source === source && c.closedBy === 'declined'))
})

test('history edits rebuild completion evidence and clear fulfilled unfinished work through the real edit function', () => {
  const state = missed()
  const old = state.workouts[0]
  const row = { exId: 'db-row', name: 'One-arm dumbbell row', muscle: 'Back', type: 'reps', weighted: true, sets: Array.from({ length: 3 }, () => ({ kind: 'work', reps: 10, weight: 20 })) }
  const edited = correctWorkout(old, { date: old.date, note: 'Actually completed', exercises: [...old.exercises, row] }, today)
  const outcome = recordOutcome(edited).exercises.find((e) => e.exId === 'db-row')
  assert.equal(outcome.doneWork, 3)
  assert.equal(outcome.status, 'complete')
  assert.ok(!edited.unfinished.some((e) => e.exId === 'db-row'))
  assert.ok(!rolls({ ...state, workouts: [edited] }).active.some((c) => c.exId === 'db-row'))
  const fewer = correctWorkout(edited, { date: edited.date, note: '', exercises: edited.exercises.map((e) => e.exId === 'db-row' ? { ...e, sets: e.sets.slice(0, 1) } : e) }, today)
  assert.equal(recordOutcome(fewer).exercises.find((e) => e.exId === 'db-row').doneWork, 1)
})

test('manual/backdated records affect their chosen day; genuine overnight sessions keep their completion time', () => {
  const record = train(makeUser(), plan(), today).record
  const backdated = { ...record, date: '2026-10-01' }
  assert.equal(new Date(recordTime(backdated)).getDate(), 1)
  assert.equal(exposureFrom([backdated], { today, now: at(today, 20) }).records, 0)
  const overnight = { ...record, date: '2026-11-04', startedAt: at('2026-11-04', 23), endedAt: at(today, 1) }
  assert.equal(recordTime(overnight), overnight.endedAt)
})

test('malformed current-version ledger and future preference resets cannot erase valid training evidence', () => {
  const state = missed()
  const record = state.workouts[0]
  assert.doesNotThrow(() => recordOutcome({ ...record, outcome: { version: 1, exercises: 'broken' } }))
  const prior = answer(state, answerEvent({ exId: 'db-row', question: 'feel', value: 'uncomfortable', at: at('2026-11-03') }))
  const future = answer(prior, resetEvent({ exId: 'db-row', at: at('2026-12-01') }))
  assert.equal(exerciseSignals(future, { today, now: at(today) }).get('db-row').comfort.restricted, true)
})

test('missing assistance is unknown, never interpreted as an unassisted successful set', () => {
  const workouts = [{ id: 'assist', date: today, exercises: [{ exId: 'assisted-pull-up', type: 'reps', sets: [{ kind: 'work', reps: 10, weight: null }] }] }]
  assert.deepEqual(comparableSessions(workouts, 'assisted-pull-up', { today, unit: 'lb', type: 'reps', weighted: true }), [])
})

test('replan fingerprints catch rest and side-work edits but tolerate timer updates', () => {
  const state = makeUser({ experience: 'Some experience' })
  const session = beginPrepared(prepareSession(buildSession(plan(), { now: at(today) })), at(today))
  const preview = previewReplan(state, session, { minutes: 5 }, { today, now: at(today) })
  const changed = { ...session, exercises: session.exercises.map((e, i) => i ? e : { ...e, restSec: e.restSec + 30 }) }
  assert.equal(applyReplan(changed, preview).status, 'stale')
  assert.equal(sessionFingerprint({ ...session, pausedMs: 5000, phaseEndsAt: at(today, 13) }), sessionFingerprint(session))
})

test('replacing the current timed exercise clears its old countdown and still waits for Start', () => {
  const state = makeUser({ experience: 'Some experience' })
  const session = beginPrepared(prepareSession(buildSession({ id: 'timed', kind: 'adaptive', items: [{ exId: 'plank', sets: 2, sec: 30, restSec: 45 }] }, { now: at(today) })), at(today))
  session.phaseEndsAt = at(today) + 30000
  session.phaseTotal = 30000
  const preview = previewReplan(state, session, { avoid: ['plank'] }, { today, now: at(today) + 5000 })
  assert.ok(preview.diff.replaced.length)
  const applied = applyReplan(session, preview, at(today) + 6000)
  assert.equal(applied.session.phaseEndsAt, null)
  assert.equal(applied.session.phase, 'work')
})

test('Ask/adjust updates a prepared workout and refuses a dashboard preview after another workout starts', () => {
  const state = makeUser({ experience: 'Some experience' })
  const intents = [{ type: 'plan.minutes', args: { minutes: 5 } }]
  const prepared = prepareSession(buildSession(plan(), { now: at(today) }))
  const active = { ...state, activeWorkout: prepared }
  const preview = previewChanges(active, intents, { today, now: at(today) })
  assert.equal(preview.target, 'workout')
  const result = applyPreview(active, preview, { today, now: at(today) })
  assert.equal(result.status, 'applied')
  assert.equal(result.actions[0].session.phase, 'prepared')
  assert.equal(result.actions[0].session.startedAt, null)
  const dashboard = previewChanges(state, intents, { today, now: at(today) })
  assert.equal(applyPreview(active, dashboard, { today, now: at(today) }).status, 'stale')
  const accepted = applyPreview(state, dashboard, { today, now: at(today) })
  const later = { ...state, readiness: accepted.actions[0].readiness, workouts: missed().workouts }
  assert.equal(undoChange(later, accepted.undo).status, 'stale')
})
