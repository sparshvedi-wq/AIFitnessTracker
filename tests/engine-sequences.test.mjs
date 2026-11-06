// Realistic sequences of sessions through the whole loop:
// recommend → train → record → selectively ask → update preferences → reassess.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeUser, recommend, train, answer, ids, at } from './helpers/engine-sim.mjs'
import { metaOf } from '../src/lib/catalog/index.js'
import { MUSCLE_AREA } from '../src/lib/catalog/vocabulary.js'
import { rolloverCandidates } from '../src/lib/engine/rollover.js'
import { exerciseSignals, answerEvent, dismissEvent, retryEvent } from '../src/lib/engine/learning.js'
import { chooseQuestion } from '../src/lib/engine/feedback.js'
import { exposureFrom } from '../src/lib/engine/exposure.js'
import { recordOutcome } from '../src/lib/engine/ledger.js'
import { correctWorkout, rebuildRecords } from '../src/lib/workout-history.js'
import { ROLLOVER_MAX_IN_PLAN } from '../src/lib/engine/config.js'

const fam = (id) => metaOf(id)?.family
const region = (id) => metaOf(id)?.region
const pressing = (id) => ['push'].includes(region(id))
const pulling = (id) => ['pull'].includes(region(id))
const gymUser = (extra = {}) =>
  makeUser({ experience: 'Some experience', goal: 'Build muscle', location: 'gym', minutes: 45, ...extra })

test('cutting a workout short for time: missed pulling is reconsidered tomorrow, not the whole workout', () => {
  let state = gymUser()
  const day1 = recommend(state, { date: '2026-11-02', hour: 8 })
  assert.ok(day1.items.some((i) => pulling(i.exId)), 'day 1 includes pulling work')
  // Pressing done, pulling not reached: ran out of time.
  const { state: after, record } = train(state, day1, '2026-11-02', {
    hour: 8,
    sets: (e) => (pulling(e.exId) ? 0 : Infinity),
    finishReason: 'time',
  })
  state = after
  const outcome = recordOutcome(record)
  const missed = outcome.exercises.filter((o) => o.status === 'not-reached')
  assert.ok(missed.length > 0 && missed.every((o) => o.reason === 'time'))
  const active = rolloverCandidates(state.workouts, { now: at('2026-11-03'), today: '2026-11-03' }).active
  assert.ok(active.length > 0, 'unfinished work becomes an optional candidate')

  const day2 = recommend(state, { date: '2026-11-03' })
  assert.ok(day2.items.some((i) => pulling(i.exId)), 'tomorrow gives pulling attention')
  assert.ok(day2.planning.carriedFrom.length >= 1 && day2.planning.carriedFrom.length <= ROLLOVER_MAX_IN_PLAN)
  // Not a copy of yesterday, and nothing appended: every item keeps a normal dose.
  assert.notDeepEqual(ids(day2), ids(day1))
  assert.ok(day2.items.every((i) => i.sets <= 3))
  assert.ok(day2.items.filter((i) => pressing(i.exId)).length <= day1.items.filter((i) => pressing(i.exId)).length)
  assert.ok(day2.estimatedSeconds <= 45 * 60)
  assert.ok(day2.reasons.some((r) => r.includes('not owed')), 'never promised as debt')

  // Doing the carried work resolves it exactly once.
  const { state: day2State } = train(state, day2, '2026-11-03')
  const day3 = rolloverCandidates(day2State.workouts, { now: at('2026-11-04'), today: '2026-11-04' })
  const carried = new Set(day2.planning.carriedFrom)
  assert.ok(day3.active.every((c) => !carried.has(c.source)))
  assert.ok(day3.closed.filter((c) => carried.has(c.source)).length === carried.size)
})

test('stopping because of discomfort excludes that movement until a retry, and never rolls it over', () => {
  let state = gymUser()
  const plan = recommend(state, { date: '2026-11-02' })
  const sore = plan.items[1].exId
  state = train(state, plan, '2026-11-02', { skip: { [sore]: 'pain' } }).state
  const next = recommend(state, { date: '2026-11-03' })
  assert.ok(!ids(next).includes(sore), 'the uncomfortable exercise is not suggested')
  // Areas it loads rest for two days after a reported pain skip.
  const areas = metaOf(sore).areas
  assert.ok(next.items.every((i) => !metaOf(i.exId).areas.some((a) => areas.includes(a))))
  assert.ok(!rolloverCandidates(state.workouts, { now: at('2026-11-03'), today: '2026-11-03' }).active.some((c) => c.exId === sore))
  // Much later the area is free again, but the exercise itself still waits for an explicit retry.
  const later = recommend(state, { date: '2026-11-20' })
  assert.ok(!ids(later).includes(sore))
  assert.ok(later.decision.excluded['reported-discomfort'] >= 1, 'held by the comfort report, not just the area')
  state = answer(state, retryEvent({ exId: sore, at: at('2026-11-20', 9) }))
  const signal = exerciseSignals(state, { now: at('2026-11-20', 10), today: '2026-11-20' }).get(sore)
  assert.equal(signal.comfort.restricted, false)
  assert.equal(signal.retryActive, true)
})

test('a retried exercise gets a comfort question first, and an uncomfortable answer restores the hold', () => {
  let state = gymUser({ location: 'home', equipment: ['Dumbbells', 'Bench'] })
  const plan = recommend(state, { date: '2026-11-02' })
  const ex = plan.items[0].exId
  state = train(state, plan, '2026-11-02', { skip: { [ex]: 'pain' } }).state
  state = answer(state, retryEvent({ exId: ex, at: at('2026-11-05', 8) }))
  const retryPlan = { ...plan, items: [plan.items[0]] }
  const { state: s2, record } = train(state, retryPlan, '2026-11-05', { hour: 9 })
  const q = chooseQuestion(s2, record, { now: at('2026-11-05', 10), today: '2026-11-05' })
  assert.equal(q.question, 'feel')
  assert.equal(q.exId, ex)
  const s3 = answer(s2, answerEvent({ exId: ex, question: 'feel', value: 'uncomfortable', workoutId: record.id, at: at('2026-11-05', 10) }))
  assert.equal(exerciseSignals(s3, { now: at('2026-11-06'), today: '2026-11-06' }).get(ex).comfort.restricted, true)
})

test('training twice in one day: the second recommendation accounts for the morning’s work', () => {
  let state = gymUser({ goal: 'General fitness' })
  const fresh = recommend(state, { date: '2026-11-04', hour: 18 })
  const morning = recommend(state, { date: '2026-11-04', hour: 7, minutes: 30 })
  state = train(state, morning, '2026-11-04', { hour: 7 }).state
  const evening = recommend(state, { date: '2026-11-04', hour: 18 })
  const morningAreas = new Set(morning.items.flatMap((i) => metaOf(i.exId).primary.map((m) => MUSCLE_AREA[m])))
  const overlap = (plan) => plan.items.filter((i) => metaOf(i.exId).primary.some((m) => morningAreas.has(MUSCLE_AREA[m]))).length
  assert.ok(overlap(evening) < overlap(fresh), 'less repetition of the morning’s main areas')
  assert.ok(evening.items.every((i) => !morning.items.some((m) => m.exId === i.exId)), 'no exact repeats')
  assert.ok(evening.decision.facts.recentWhen === 'earlier today' || evening.decision.facts.recentAreas.length > 0)
})

test('repeatedly shortening sessions never accumulates unlimited debt', () => {
  let state = gymUser()
  const sizes = []
  for (let d = 2; d <= 9; d++) {
    const date = `2026-11-${String(d).padStart(2, '0')}`
    const plan = recommend(state, { date })
    assert.ok(plan.planning.carriedFrom.length <= ROLLOVER_MAX_IN_PLAN)
    assert.ok(plan.items.every((i) => i.sets <= 3))
    assert.ok(plan.estimatedSeconds <= 45 * 60)
    // Only the first two exercises get done each time.
    state = train(state, plan, date, { sets: (_e, index) => (index < 2 ? Infinity : 0), finishReason: 'time' }).state
    sizes.push(rolloverCandidates(state.workouts, { now: at(date, 20), today: date }).active.length)
  }
  // Candidates are bounded by families and expire with age: no growth over the week.
  assert.ok(Math.max(...sizes) <= 8, `active candidates stayed bounded: ${sizes}`)
  assert.ok(sizes.at(-1) <= sizes.reduce((a, b) => Math.max(a, b), 0))
  // Work that was carried and missed again is not carried a second time.
  const carriedTwice = state.workouts.flatMap((w) => w.planning?.carriedFrom || [])
  assert.equal(new Set(carriedTwice).size, carriedTwice.length)
})

test('switching equipment between sessions: home plans use home gear, and missed gym work maps to a home variant', () => {
  let state = gymUser({ equipment: ['Dumbbells', 'Bench'] })
  const gym = recommend(state, { date: '2026-11-02' })
  const row = gym.items.find((i) => fam(i.exId) === 'horizontal-row') || gym.items.find((i) => pulling(i.exId))
  state = train(state, gym, '2026-11-02', { sets: (e) => (e.exId === row.exId ? 0 : Infinity), finishReason: 'time' }).state
  const home = recommend(state, { date: '2026-11-03', location: 'home' })
  for (const i of home.items) {
    const m = metaOf(i.exId)
    assert.ok(m.equipment.every((alts) => alts.some((c) => ['db', 'bench'].includes(c))), i.exId)
  }
  assert.ok(home.items.some((i) => fam(i.exId) === fam(row.exId)), 'the same family, with home equipment')
})

test('one dislike is weak; repeated dislikes lower priority; an explicit “rather not” excludes until retried', () => {
  let state = gymUser({ location: 'home', equipment: ['Dumbbells', 'Bench'] })
  const plan = recommend(state, { date: '2026-11-02' })
  const ex = plan.items[0].exId
  state = train(state, plan, '2026-11-02', { skip: { [ex]: 'dislike' } }).state
  let s = exerciseSignals(state, { now: at('2026-11-03'), today: '2026-11-03', place: 'home' }).get(ex)
  assert.ok(s.enjoyment.score < 0 && s.enjoyment.score > -0.3, 'one skip is a weak, inferred signal')
  assert.equal(s.explicitDislike, false)
  const second = recommend(state, { date: '2026-11-04' })
  if (second.items.some((i) => i.exId === ex)) state = train(state, second, '2026-11-04', { skip: { [ex]: 'dislike' } }).state
  else state = train(state, { ...plan, items: [plan.items[0]] }, '2026-11-04', { skip: { [ex]: 'dislike' } }).state
  s = exerciseSignals(state, { now: at('2026-11-05'), today: '2026-11-05', place: 'home' }).get(ex)
  assert.ok(s.enjoyment.score <= -0.3, 'two skips become a noticeable preference')
  assert.equal(s.explicitDislike, false, 'still inferred, still reversible')
  state = answer(state, answerEvent({ exId: ex, question: 'again', value: 'no', at: at('2026-11-05', 8) }))
  const plan3 = recommend(state, { date: '2026-11-06' })
  assert.ok(!ids(plan3).includes(ex))
  assert.ok(plan3.decision.excluded['explicit-dislike'] >= 1)
  state = answer(state, retryEvent({ exId: ex, at: at('2026-11-07', 8) }))
  assert.equal(exerciseSignals(state, { now: at('2026-11-07', 9), today: '2026-11-07' }).get(ex).explicitDislike, false)
})

test('a substitute preferred at home is favoured at home, not at the gym', () => {
  let state = gymUser({ location: 'home', equipment: ['Dumbbells', 'Bench'], minutes: 30 })
  const home = recommend(state, { date: '2026-11-02', location: 'home' })
  const original = home.items.find((i) => fam(i.exId) === 'horizontal-press')
  assert.ok(original)
  const substitute = original.exId === 'push-up' ? 'db-floor-press' : 'push-up'
  for (const date of ['2026-11-02', '2026-11-04']) {
    const plan = recommend(state, { date, location: 'home' })
    // Whatever press was planned that day is the one swapped away.
    const replaced = plan.items.find((i) => fam(i.exId) === 'horizontal-press')?.exId || original.exId
    const items = plan.items.map((i) => (fam(i.exId) === 'horizontal-press' ? { ...i, exId: substitute, weight: null } : i))
    const { state: s, session } = train(state, { ...plan, items }, date)
    // Mark the swap the way replaceCurrentExercise records it.
    const last = s.workouts.at(-1)
    last.exercises = last.exercises.map((e) => (e.exId === substitute ? { ...e, swappedFrom: replaced } : e))
    last.outcome.exercises = last.outcome.exercises.map((o) => (o.exId === substitute ? { ...o, swappedFrom: replaced } : o))
    state = s
    assert.ok(session)
  }
  const atHome = exerciseSignals(state, { now: at('2026-11-06'), today: '2026-11-06', place: 'home' }).get(substitute)
  const atGym = exerciseSignals(state, { now: at('2026-11-06'), today: '2026-11-06', place: 'gym' }).get(substitute)
  assert.equal(atHome.chosenAsSubstituteHere >= 1.5, true)
  assert.equal(atGym.chosenAsSubstituteHere, 0)
  const next = recommend(state, { date: '2026-11-06', location: 'home' })
  const press = next.items.find((i) => fam(i.exId) === 'horizontal-press')
  if (press) assert.equal(press.exId, substitute)
})

test('dismissed questions never become dislikes, and repeated dismissals pause questions', () => {
  let state = gymUser()
  const plan = recommend(state, { date: '2026-11-02' })
  let result = train(state, plan, '2026-11-02')
  state = result.state
  const q = chooseQuestion(state, result.record, { now: at('2026-11-02', 13), today: '2026-11-02' })
  assert.ok(q, 'a new exercise earns a question')
  const before = exerciseSignals(state, { now: at('2026-11-03'), today: '2026-11-03' }).get(q.exId)
  state = answer(state, dismissEvent({ exId: q.exId, question: q.question, workoutId: q.workoutId, at: at('2026-11-02', 13) }))
  const after = exerciseSignals(state, { now: at('2026-11-03'), today: '2026-11-03' }).get(q.exId)
  assert.deepEqual(after, before)
  assert.equal(chooseQuestion(state, result.record, { now: at('2026-11-02', 14), today: '2026-11-02' }), null, 'one per session')
  for (const date of ['2026-11-03', '2026-11-04']) {
    result = train(state, recommend(state, { date }), date)
    state = result.state
    const next = chooseQuestion(state, result.record, { now: at(date, 13), today: date })
    if (next) state = answer(state, dismissEvent({ exId: next.exId, question: next.question, workoutId: next.workoutId, at: at(date, 13) }))
  }
  result = train(state, recommend(state, { date: '2026-11-05' }), '2026-11-05')
  const dismissals = state.learning.events.filter((e) => e.kind === 'dismiss').length
  if (dismissals >= 3) assert.equal(chooseQuestion(result.state, result.record, { now: at('2026-11-05', 13), today: '2026-11-05' }), null)
})

test('returning after a break reassesses capacity instead of resuming old targets', () => {
  let state = gymUser({ location: 'home', equipment: ['Dumbbells', 'Bench'] })
  const plan = recommend(state, { date: '2026-09-01' })
  state = train(state, plan, '2026-09-01', { weight: () => 40, finishReason: 'time', sets: (_e, i) => (i < 2 ? Infinity : 0) }).state
  const back = recommend(state, { date: '2026-10-01' })
  assert.match(back.focus, /restart/)
  assert.ok(back.items.every((i) => i.sets <= 2))
  assert.equal(back.planning.carriedFrom.length, 0, 'month-old unfinished work has expired')
  const repeated = back.items.find((i) => plan.items.some((p) => p.exId === i.exId) && i.weight)
  if (repeated) assert.ok(repeated.weight < 40)
  assert.ok(!back.decision.items.some((i) => i.codes.includes('exploring')))
})

test('completing equivalent work later satisfies a rollover candidate', () => {
  let state = gymUser()
  const plan = recommend(state, { date: '2026-11-02' })
  const row = plan.items.find((i) => pulling(i.exId))
  state = train(state, plan, '2026-11-02', { sets: (e) => (e.exId === row.exId ? 0 : Infinity), finishReason: 'time' }).state
  // A different exercise from the same family, done on its own initiative.
  const sibling = ['cable-row', 'machine-row', 'db-row', 'lat-pulldown', 'assisted-pull-up'].find(
    (id) => fam(id) === fam(row.exId) && id !== row.exId,
  )
  state = train(state, { ...plan, id: 'manual', items: [{ exId: sibling, sets: 3, reps: 10, restSec: 60 }] }, '2026-11-02', { hour: 18 }).state
  const { active, closed } = rolloverCandidates(state.workouts, { now: at('2026-11-03'), today: '2026-11-03' })
  assert.ok(!active.some((c) => c.exId === row.exId))
  assert.ok(closed.some((c) => c.exId === row.exId && c.closedBy === 'same-family'))
})

test('a sport event between recommendations makes the plan lighter around it, without forcing missed work', () => {
  let state = gymUser({ sports: ['soccer'] })
  const before = recommend(state, { date: '2026-11-03' })
  state = {
    ...state,
    settings: {
      ...state.settings,
      training: {
        ...state.settings.training,
        sportSchedule: [{ id: 'match', sport: 'soccer', date: '2026-11-04', time: '10:00', durationMinutes: 90, intensity: 'hard', kind: 'game' }],
      },
    },
  }
  const after = recommend(state, { date: '2026-11-03', hour: 12 })
  const sets = (p) => p.items.reduce((n, i) => n + i.sets, 0)
  assert.ok(sets(after) <= sets(before))
  assert.ok(after.estimatedSeconds <= 45 * 60)
})

test('editing an earlier workout updates what counts, without double counting', () => {
  let state = gymUser()
  const plan = recommend(state, { date: '2026-11-02' })
  const row = plan.items.find((i) => pulling(i.exId))
  const result = train(state, plan, '2026-11-02', { sets: (e) => (e.exId === row.exId ? 0 : Infinity), finishReason: 'time' })
  state = result.state
  const exposure1 = exposureFrom(state.workouts, { now: at('2026-11-03'), today: '2026-11-03' })
  // The person edits the record to add the row they actually did.
  const record = state.workouts.at(-1)
  const edited = correctWorkout(
    record,
    {
      date: record.date,
      note: '',
      exercises: [...record.exercises, { exId: row.exId, name: 'Row', type: 'reps', weighted: metaOf(row.exId).load !== 'bw', sets: [{ kind: 'work', reps: 10, weight: 30 }, { kind: 'work', reps: 10, weight: 30 }] }],
    },
    '2026-11-03',
  )
  assert.ok(edited.outcome.exercises.some((item) => item.exId === row.exId && item.doneWork === 2))
  state = { ...state, workouts: rebuildRecords(state.workouts.map((w) => (w.id === edited.id ? edited : w))) }
  const exposure2 = exposureFrom(state.workouts, { now: at('2026-11-03'), today: '2026-11-03' })
  assert.ok(exposure2.area.Back.week > exposure1.area.Back.week)
  assert.equal(exposure2.records, exposure1.records, 'still one record, counted once')
  // Duplicated records (e.g. a re-imported backup) still count once.
  const doubled = exposureFrom([...state.workouts, ...state.workouts], { now: at('2026-11-03'), today: '2026-11-03' })
  assert.equal(doubled.area.Back.week, exposure2.area.Back.week)
  assert.ok(!rolloverCandidates(state.workouts, { now: at('2026-11-03'), today: '2026-11-03' }).active.some((c) => c.exId === row.exId))
})

test('no useful history: a sensible first plan with nothing to roll over and no exploration', () => {
  const state = gymUser()
  const plan = recommend(state, { date: '2026-11-02' })
  assert.ok(plan.items.length >= 3)
  assert.equal(plan.planning.carriedFrom.length, 0)
  assert.ok(!plan.decision.items.some((i) => i.codes.includes('exploring')))
  assert.ok(plan.items.every((i) => metaOf(i.exId)?.reviewed && i.sets > 0))
  assert.ok(plan.decision.facts.items === plan.items.length)
})

test('a variant is not “exploration” when the familiar exercise in its family is unavailable here', async () => {
  const { makeSampleWorkouts } = await import('../src/lib/sample.js')
  const state = gymUser({ location: 'home', equipment: ['Dumbbells', 'Bench'], homeDumbbells: [10, 15, 20, 25, 30], minutes: 30 })
  // Synthetic gym history: cable pushdowns are familiar, but there is no cable machine at home.
  state.workouts = makeSampleWorkouts('2026-11-05').slice(-6).map((w) => ({ ...w, sample: false }))
  const plan = recommend(state, { date: '2026-11-05', hour: 19, trace: true })
  const exploring = plan.decision.items.filter((i) => i.codes.includes('exploring')).length
  assert.ok(exploring <= 1)
  // Under-trained chest this week gets a compound press, not only isolation work.
  assert.ok(plan.items.some((i) => metaOf(i.exId).family === 'horizontal-press' && metaOf(i.exId).role === 'compound'), ids(plan).join(', '))
  assert.ok(plan.decision.trace.length > plan.items.length, 'a full trace is available on request')
})
