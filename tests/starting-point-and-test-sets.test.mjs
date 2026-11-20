// The starting-point session, typed starting numbers, the strength balance,
// one-tap "Too heavy" and offered test sets.
import test from 'node:test'
import assert from 'node:assert/strict'
import { at, makeUser, recommend } from './helpers/engine-sim.mjs'
import { lifter, runBaseline } from './helpers/baseline-sim.mjs'
import * as B from '../src/lib/baseline.js'
import { buildSession, currentSet, toWorkoutRecord } from '../src/lib/workout.js'
import { rebuildRecords, routineFromWorkout } from '../src/lib/workout-history.js'
import { resetForTesting } from '../src/lib/testing.js'
import { findExercise } from '../src/lib/exercises.js'
import { profileOf } from '../src/lib/planner.js'
import { normalizeLearning, withLearningEvent, anchorEvent } from '../src/lib/engine/learning.js'
import { convertStateUnits } from '../src/lib/units.js'
import {
  startingWeights,
  strengthBalance,
  strengthFailures,
  strengthSummary,
  strengthTarget,
} from '../src/lib/strength/index.js'
import {
  acceptTest,
  declineTest,
  liveContext,
  logSet,
  logShortSet,
  markTooHeavy,
  recordFeel,
  testOffer,
} from '../src/lib/strength/session.js'

const DAY = 86400000
const day = (i) => new Date(Date.UTC(2026, 8, 1) + i * DAY).toISOString().slice(0, 10)
const when = (date, hour = 18) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()
const set = (reps, weight, extra = {}) => ({ kind: 'work', reps, weight, targetReps: reps, ...extra })
const rec = (i, exId, sets, extra = {}) => ({
  id: `w${i}`,
  kind: 'adaptive',
  unit: 'lb',
  location: 'gym',
  date: day(i),
  startedAt: when(day(i)),
  endedAt: when(day(i)) + 3600000,
  durationSec: 3600,
  exercises: [{ exId, sets }],
  effort: 2,
  ...extra,
})
const squats = (i, reps, weight, extra) =>
  rec(i, 'back-squat', [set(reps, weight), set(reps, weight), set(reps, weight)], extra)
const base = {
  unit: 'lb',
  goal: 'Get stronger',
  experience: 'Experienced',
  learning: null,
  metrics: {},
  place: 'gym',
}
const modelArgs = (state, date, hour = 10) => {
  const p = profileOf(state)
  return {
    workouts: state.workouts,
    learning: state.learning,
    metrics: state.metrics,
    unit: state.settings.weightUnit,
    today: date,
    now: at(date, hour),
    goal: p.goal,
    experience: p.experience,
    customExercises: [],
  }
}
const gymUser = (profile = {}) => {
  const state = makeUser({
    goal: 'Build muscle',
    experience: 'Some experience',
    location: 'gym',
    minutes: 45,
    ...profile,
  })
  state.metrics = { '2026-11-01': { weight: 170 } }
  return state
}

// ── The starting-point session ──────────────────────────────────────────

test('a starting point is offered only to someone with no strength training saved, and can be skipped', () => {
  const fresh = gymUser()
  assert.equal(B.baselineDue(fresh), true)
  assert.equal(
    B.baselineDue({
      ...fresh,
      settings: {
        ...fresh.settings,
        training: { ...fresh.settings.training, baseline: { status: 'skipped', at: 1 } },
      },
    }),
    false,
  )
  assert.equal(B.baselineDue({ ...fresh, workouts: [squats(0, 5, 135)] }), false)
  assert.equal(B.baselineDue(makeUser({ completed: false })), false)
})

test('the movements fit the place, the equipment and the level', () => {
  const gym = B.baselineMoves(gymUser({ experience: 'Starting out' }), { today: '2026-11-02' }).moves
  assert.deepEqual(
    gym.map((m) => m.slot),
    ['legs', 'push', 'row', 'hinge', 'overhead', 'pulldown', 'curl', 'core'],
  )
  // Someone starting out is not handed a barbell for a first-day test.
  assert.ok(!gym.some((m) => ['back-squat', 'bench-press', 'deadlift', 'ohp'].includes(m.exId)))
  const trained = B.baselineMoves(gymUser({ experience: 'Experienced' }), { today: '2026-11-02' }).moves
  assert.ok(trained.some((m) => m.exId === 'back-squat') && trained.some((m) => m.exId === 'bench-press'))
  assert.ok(!trained.some((m) => m.exId === 'deadlift'), 'no max-effort deadlift in a test session')
  const home = B.baselineMoves(gymUser({ location: 'home', equipment: [] }), { today: '2026-11-02' }).moves
  assert.ok(home.length >= 4)
  assert.ok(
    home.every((m) => !findExercise(m.exId).weighted),
    'no equipment means bodyweight only',
  )
  const bells = B.baselineMoves(gymUser({ location: 'home', equipment: ['Dumbbells', 'Bench'] }), {
    today: '2026-11-02',
  }).moves
  assert.ok(bells.some((m) => m.exId === 'db-bench') && bells.some((m) => m.exId === 'biceps-curl'))
  // An area someone said hurts stays out.
  const sore = { ...gymUser(), readiness: { date: '2026-11-02', pain: ['Legs'] } }
  assert.ok(!B.baselineMoves(sore, { today: '2026-11-02' }).moves.some((m) => m.slot === 'legs'))
})

test('one set per movement, a second only after "5 or more", and the record is an ordinary workout', () => {
  const state = gymUser()
  const date = '2026-11-02'
  let s = B.buildBaselineSession(state, { today: date, now: at(date, 10) })
  assert.equal(s.kind, 'baseline')
  assert.equal(s.baseline.step, 'intro')
  s = B.beginBaseline(s, at(date, 10))
  assert.equal(s.baseline.step, 'pick')
  const args = { ...modelArgs(state, date), place: s.location }
  const guess = startingWeights({ ...args, exId: s.exercises[0].exId }, s)
  assert.ok(guess.choices.includes(guess.suggested) && guess.choices.length >= 3)
  assert.ok(new Set(guess.choices).size === guess.choices.length)
  s = B.pickBaselineWeight(s, guess.suggested)
  assert.equal(s.baseline.step, 'do')
  s = B.finishBaselineSet(s)
  s = B.logBaselineReps(s, 11, at(date, 10) + 60000)
  assert.equal(s.baseline.step, 'left')
  // Back out and correct the reps.
  s = B.backBaseline(s)
  assert.equal(s.baseline.step, 'reps')
  assert.equal(currentSet(s).set.status, 'todo')
  s = B.logBaselineReps(s, 10, at(date, 10) + 90000)
  // "1 or 2 left" is a clear answer: straight on to the next movement.
  s = B.answerBaselineLeft(s, 1, args, at(date, 10) + 120000)
  assert.equal(s.cursor.ex, 1)
  assert.equal(s.exercises[0].sets.length, 1)
  assert.deepEqual([s.exercises[0].sets[0].feel, s.exercises[0].sets[0].reserve], ['good', 1])
  // "5 or more" is open-ended: one heavier set is offered.
  s = B.pickBaselineWeight(s, startingWeights({ ...args, exId: s.exercises[1].exId }, s).suggested)
  const first = currentSet(s).set.weight
  s = B.logBaselineReps(B.finishBaselineSet(s), 15, at(date, 10) + 200000)
  s = B.answerBaselineLeft(s, 6, args, at(date, 10) + 220000)
  assert.equal(s.baseline.step, 'again')
  assert.ok(s.baseline.second.weight > first && s.baseline.second.reason === 'light')
  s = B.acceptSecondSet(s)
  assert.equal(currentSet(s).set.weight, s.exercises[1].sets[1].weight)
  s = B.logBaselineReps(B.finishBaselineSet(s), 9, at(date, 10) + 300000)
  // Never a third set, whatever the answer.
  s = B.answerBaselineLeft(s, 6, args, at(date, 10) + 320000)
  assert.equal(s.cursor.ex, 2)
  assert.equal(s.exercises[1].sets.length, 2)
  // Too heavy: remembered, and the next suggestion is lighter.
  const third = startingWeights({ ...args, exId: s.exercises[2].exId }, s).suggested
  s = B.pickBaselineWeight(s, third * 2)
  s = B.baselineTooHeavy(s, at(date, 10) + 400000)
  assert.equal(s.baseline.step, 'pick')
  assert.equal(s.exercises[2].attempts.length, 1)
  assert.ok(startingWeights({ ...args, exId: s.exercises[2].exId }, s).suggested < third * 2)
  // Swap and skip never leave anything owed.
  const before = s.exercises[2].exId
  s = B.swapBaselineMove(s)
  assert.notEqual(s.exercises[2].exId, before)
  s = B.skipBaselineMove(s, at(date, 10) + 500000)
  assert.equal(s.cursor.ex, 3)
  s = B.endBaseline(s, at(date, 10) + 600000)
  assert.equal(s.baseline.step, 'results')
  const record = toWorkoutRecord(s, state.workouts, { now: at(date, 10) + 700000 })
  assert.equal(record.kind, 'baseline')
  assert.deepEqual(record.unfinished, [], 'nothing from a starting point carries over')
  assert.equal(record.exercises.length, 2)
  assert.equal(record.exercises[1].sets[0].reserve, 6)
  assert.deepEqual(
    B.baselineRows(record, 'lb').map((r) => r.exId),
    record.exercises.map((e) => e.exId),
  )
})

test('after a starting point every related exercise has a weight, close to what the person can do', () => {
  for (const [profile, who] of [
    [{ experience: 'Starting out' }, { general: -0.3, areas: { Legs: 0.15, Glutes: 0.15 } }],
    [{ experience: 'Some experience' }, { general: 0.05 }],
    [{ experience: 'Experienced', goal: 'Get stronger' }, { general: 0.3 }],
    [{ experience: 'Some experience', location: 'home', equipment: ['Dumbbells', 'Bench'] }, { general: 0 }],
  ]) {
    const person = lifter(who)
    const out = runBaseline(gymUser(profile), person, '2026-11-02')
    const sets = out.record.exercises.reduce((n, e) => n + e.sets.length, 0)
    assert.ok(out.record.exercises.length >= 7, `${out.record.exercises.length} movements`)
    assert.ok(
      sets <= out.record.exercises.length + 3,
      `${sets} sets for ${out.record.exercises.length} movements`,
    )
    // The next plans arrive with weights filled in.
    let missing = 0
    let weighted = 0
    for (const date of ['2026-11-04', '2026-11-06']) {
      const plan = recommend(out.state, { date })
      for (const item of plan.items) {
        if (!findExercise(item.exId).weighted) continue
        weighted++
        if (!(item.weight > 0)) missing++
      }
    }
    assert.ok(weighted >= 4 && missing === 0, `${missing} of ${weighted} weighted exercises had no weight`)
    // Lifts that were never done are estimated within a sensible margin.
    const args = modelArgs(out.state, '2026-11-04')
    for (const id of ['bench-press', 'db-bench', 'barbell-row', 'lat-pulldown', 'ohp', 'biceps-curl']) {
      const estimate = strengthSummary({ ...args, exId: id })?.oneRepMax
      const truth = person.oneRepMax(id)
      assert.ok(
        estimate > truth * 0.75 && estimate < truth * 1.25,
        `${id}: ${Math.round(estimate)} vs ${Math.round(truth)}`,
      )
    }
  }
  assert.equal(strengthFailures(), 0)
})

test('a planned weight borrowed from a looser relative is cautious, never above what the person can do', () => {
  const person = lifter({ general: 0.1 })
  const out = runBaseline(gymUser({ experience: 'Experienced' }), person, '2026-11-02')
  const args = { ...modelArgs(out.state, '2026-11-04'), place: 'gym' }
  for (const id of [
    'leg-extension',
    'seated-leg-curl',
    'triceps-pushdown',
    'machine-chest-press',
    'leg-press',
    'lateral-raise',
  ]) {
    const target = strengthTarget({ ...args, exId: id, sets: 3 })
    assert.ok(target && target.weight > 0, `${id} has a first weight`)
    assert.equal(target.code, 'estimated-start')
    assert.ok(
      person.capacity(id, target.weight) >= target.reps + 1,
      `${id}: ${target.weight} × ${target.reps} is doable`,
    )
  }
})

// ── "I know my numbers" ─────────────────────────────────────────────────

test('typed starting numbers inform related exercises; a plain "set my working weight" does not', () => {
  const state = gymUser({ experience: 'Experienced' })
  const date = '2026-11-02'
  const events = B.baselineAnchors(
    [
      { exId: 'bench-press', weight: '185', reps: '8' },
      { exId: 'back-squat', weight: '245', reps: '6' },
      { exId: 'barbell-row', weight: '', reps: '10' },
      { exId: 'push-up', reps: '25' },
      { exId: 'plank', reps: '60' },
      { exId: 'ohp', weight: '-5', reps: '8' },
    ],
    { unit: 'lb', at: at(date, 9) },
  )
  assert.deepEqual(
    events.map((e) => e.exId),
    ['bench-press', 'back-squat', 'push-up'],
  )
  assert.ok(events.every((e) => e.scope === 'baseline'))
  let learning = normalizeLearning(null)
  for (const e of events) learning = withLearningEvent(learning, e)
  assert.ok(
    learning.events.every((e) => e.scope === 'baseline'),
    'the scope survives saving',
  )
  const typed = { ...state, learning }
  const args = (s) => ({ ...modelArgs(s, date, 12), place: 'gym' })
  const fresh = strengthSummary({ ...args(state), exId: 'db-bench' })
  const informed = strengthSummary({ ...args(typed), exId: 'db-bench' })
  assert.equal(fresh.oneRepMax, null)
  // 185 × 8 with two left is roughly a 245 lb max; a dumbbell is about 40% of it.
  assert.ok(informed.oneRepMax > 80 && informed.oneRepMax < 115, `db bench ${informed.oneRepMax}`)
  assert.ok(strengthTarget({ ...args(typed), exId: 'db-bench', sets: 3 }).weight >= 50)
  assert.ok(strengthTarget({ ...args(typed), exId: 'leg-press', sets: 3 })?.weight > 0)
  // The same numbers as an ordinary anchor stay with that one lift.
  let plain = normalizeLearning(null)
  plain = withLearningEvent(
    plain,
    anchorEvent({ exId: 'bench-press', at: at(date, 9), weight: 185, reps: 8, unit: 'lb' }),
  )
  const only = strengthSummary({ ...args({ ...state, learning: plain }), exId: 'db-bench' })
  assert.ok(!only.oneRepMax || only.oneRepMax < informed.oneRepMax * 0.85)
})

// ── Strength balance ────────────────────────────────────────────────────

test('an area clearly behind the person’s other lifts is called out; a balanced lifter is not', () => {
  const date = '2026-11-04'
  const balanceOf = (who, profile = { experience: 'Experienced' }) => {
    const out = runBaseline(gymUser(profile), lifter(who), '2026-11-02')
    return { balance: strengthBalance(modelArgs(out.state, date)), state: out.state }
  }
  const even = balanceOf({ general: 0.2 }).balance
  assert.deepEqual(even.behind, [])
  assert.ok(even.areas.filter((a) => a.status !== 'unknown').length >= 5)
  assert.ok(even.areas.filter((a) => a.status !== 'unknown').every((a) => Math.abs(a.percent) <= 8))
  // A chest that is a third weaker, measured with a barbell: clear.
  const weak = balanceOf({ general: 0.2, lifts: { 'bench-press': -0.35 } })
  assert.deepEqual(weak.balance.behind, ['Chest'])
  assert.ok(weak.balance.areas.find((a) => a.id === 'Chest').percent <= -15)
  const notes = B.balanceNotes(weak.balance)
  assert.equal(notes.length, 1)
  assert.match(notes[0].text, /^Chest is behind your other lifts \(about \d+%\)\.$/)
  assert.match(notes[0].fix, /chest work a little more room/)
  // The planner gives that area more weekly work, and says so when it does.
  const plans = ['2026-11-04', '2026-11-06', '2026-11-08'].map((d) => recommend(weak.state, { date: d }))
  assert.ok(
    plans.some((p) => p.reasons.some((r) => /extra chest work: it’s behind your other lifts/.test(r))),
  )
  // The same gap on a machine is not enough on its own: machines differ too much.
  const machine = balanceOf(
    { general: -0.3, lifts: { 'machine-chest-press': -0.25 } },
    { experience: 'Starting out' },
  ).balance
  assert.deepEqual(machine.behind, [])
  // One lift alone has nothing to be compared with.
  const one = strengthBalance(modelArgs({ ...gymUser(), workouts: [squats(0, 5, 185)] }, date))
  assert.equal(one.measured, 0)
  // At most two areas are ever called behind.
  const many = balanceOf({
    general: 0.2,
    lifts: { 'bench-press': -0.4, 'cable-row': -0.9, 'lat-pulldown': -0.9, ohp: -0.4, 'biceps-curl': -0.5 },
  }).balance
  assert.ok(many.behind.length <= 2)
})

// ── Offered test sets ───────────────────────────────────────────────────

const steady = [squats(0, 7, 135), squats(3, 8, 135), squats(6, 8, 135)]
const routine = {
  id: 'r1',
  name: 'Squat day',
  kind: 'routine',
  location: 'gym',
  items: [{ exId: 'back-squat', sets: 3, reps: 8, restSec: 120 }],
}
function squatSession(workouts, i) {
  const now = when(day(i), 7)
  const session = buildSession(routine, {
    workouts,
    unit: 'lb',
    now,
    strength: {
      learning: null,
      metrics: {},
      goal: 'Get stronger',
      experience: 'Experienced',
      today: day(i),
      place: 'gym',
    },
  })
  const ctx = (t) =>
    liveContext({
      workouts,
      learning: null,
      unit: 'lb',
      now: t,
      today: day(i),
      goal: 'Get stronger',
      experience: 'Experienced',
      metrics: {},
      sizes: [],
      customExercises: [],
    })
  return { session: { ...session, phase: 'work' }, ctx, now }
}
const saveSession = (workouts, session, i) => {
  const now = when(day(i), 8)
  return rebuildRecords([
    ...workouts,
    {
      ...toWorkoutRecord({ ...session, phase: 'done' }, workouts, { now, effort: 2 }),
      id: `s${i}`,
      date: day(i),
    },
  ])
}
const logAll = (session, ctx, now, feel = null) => {
  let s = session
  let t = now
  for (let guard = 0; guard < 12 && s.cursor && currentSet(s)?.set.status === 'todo'; guard++) {
    const c = s.cursor
    t += 180000
    s = logSet(s, ctx(t), t)
    if (feel && s.exercises[c.ex].sets[c.set].kind !== 'warmup') s = recordFeel(s, c, feel, ctx(t))
    s = { ...s, phase: 'work' }
    if (s.exercises.every((e) => e.sets.every((x) => x.status !== 'todo'))) break
  }
  return s
}

test('a step up in weight is offered, not imposed: the plan keeps the last weight', () => {
  const args = { ...base, exId: 'back-squat', workouts: steady, today: day(9), now: when(day(9), 7) }
  const plain = strengthTarget(args)
  assert.deepEqual([plain.weight, plain.code], [140, 'load-up'])
  const offered = strengthTarget({ ...args, offerIncrease: true })
  assert.equal(offered.weight, 135)
  assert.equal(offered.up, false)
  assert.deepEqual([offered.offer.weight, offered.offer.from], [140, 135])
  assert.ok(offered.offer.reps >= 5 && offered.offer.reps <= 8)
  // One more rep is still just planned; and nothing is offered when held or lighter.
  const reps = strengthTarget({
    ...args,
    workouts: [squats(0, 7, 135), squats(3, 7, 135)],
    today: day(6),
    now: when(day(6), 7),
    offerIncrease: true,
  })
  assert.ok(!reps.offer && reps.code === 'reps-up')
  assert.ok(!strengthTarget({ ...args, offerIncrease: true, noIncrease: true }).offer)
  assert.ok(!strengthTarget({ ...args, offerIncrease: true, easy: true }).offer)
  // A weight that was plainly too light ("8 or more left") simply goes up.
  const roomy = [
    squats(0, 8, 95),
    rec(3, 'back-squat', [set(8, 95, { feel: 'easy', reserve: 8 }), set(8, 95), set(8, 95)]),
  ]
  const up = strengthTarget({
    ...args,
    workouts: roomy,
    today: day(6),
    now: when(day(6), 7),
    offerIncrease: true,
  })
  assert.ok(!up.offer && up.weight > 95)
  // The daily plan carries the same offer.
  const state = { ...gymUser({ goal: 'Get stronger', experience: 'Experienced' }), workouts: steady }
  assert.ok(recommend(state, { date: day(9), hour: 7 }).decision.items.length > 0)
})

test('accepting a test: a pass makes it the working weight, today and next time', () => {
  const { session, ctx, now } = squatSession(steady, 9)
  const ex = session.exercises[0]
  assert.deepEqual([ex.offer.weight, ex.offer.from], [140, 135])
  assert.ok(ex.sets.filter((s) => s.kind !== 'warmup').every((s) => s.weight === 135))
  // The offer waits for the first working set (after the warm-up).
  let s = session
  assert.equal(testOffer(s), null)
  s = { ...logSet(s, ctx(now + 60000), now + 60000), phase: 'work' }
  const offer = testOffer(s)
  assert.equal(offer.weight, 140)
  s = acceptTest(s)
  assert.equal(testOffer(s), null)
  const c = s.cursor
  assert.deepEqual([currentSet(s).set.weight, currentSet(s).set.test], [140, 'pending'])
  assert.ok(
    s.exercises[0].sets.slice(c.set + 1).every((x) => x.weight === 135),
    'the rest waits for the result',
  )
  s = logSet(s, ctx(now + 240000), now + 240000)
  s = recordFeel(s, c, 'good', ctx(now + 250000))
  assert.equal(s.exercises[0].offer.status, 'passed')
  assert.equal(s.exercises[0].sets[c.set].test, 'passed')
  assert.ok(s.exercises[0].sets.slice(c.set + 1).every((x) => x.weight === 140))
  s = logAll({ ...s, phase: 'work' }, ctx, now + 300000)
  const saved = saveSession(steady, s, 9)
  assert.equal(saved.at(-1).exercises[0].sets.find((x) => x.test)?.test, 'passed')
  const next = strengthTarget({
    ...base,
    exId: 'back-squat',
    workouts: saved,
    today: day(12),
    now: when(day(12), 7),
    offerIncrease: true,
  })
  assert.equal(next.weight, 140)
})

test('a test that is hard or short steps back with no penalty, and is not offered again straight away', () => {
  for (const how of ['hard', 'short', 'too-heavy']) {
    const { session, ctx, now } = squatSession(steady, 9)
    let s = { ...logSet(session, ctx(now + 60000), now + 60000), phase: 'work' }
    s = acceptTest(s)
    const c = s.cursor
    const planned = currentSet(s).set.reps
    if (how === 'hard') {
      s = logSet(s, ctx(now + 240000), now + 240000)
      // Logged in full, so it stands until the answer says otherwise.
      assert.equal(s.exercises[0].offer.status, 'passed')
      s = recordFeel(s, c, 'hard', ctx(now + 250000))
    } else if (how === 'short') s = logShortSet(s, planned - 2, ctx(now + 240000), now + 240000)
    else s = markTooHeavy(s, ctx(now + 200000), now + 200000, { soft: true })
    assert.equal(s.exercises[0].offer.status, 'missed', how)
    const rest = s.exercises[0].sets.filter((x) => x.kind !== 'warmup' && x.status === 'todo')
    assert.ok(
      rest.length >= 2 && rest.every((x) => x.weight === 135 && x.reps === 8),
      `${how}: back to 135 × 8`,
    )
    s = logAll({ ...s, phase: 'work' }, ctx, now + 300000)
    const saved = saveSession(steady, s, 9)
    const next = strengthTarget({
      ...base,
      exId: 'back-squat',
      workouts: saved,
      today: day(12),
      now: when(day(12), 7),
      offerIncrease: true,
    })
    assert.equal(next.weight, 135, `${how}: next time starts from the usual weight`)
    assert.ok(next.reps >= 7, `${how}: no penalty, ${next.reps} reps`)
    assert.ok(!next.offer, `${how}: not offered again right away`)
  }
})

test('"Not today" leaves the plan alone and the offer returns next session', () => {
  const { session, ctx, now } = squatSession(steady, 9)
  let s = { ...logSet(session, ctx(now + 60000), now + 60000), phase: 'work' }
  s = declineTest(s)
  assert.equal(testOffer(s), null)
  assert.equal(currentSet(s).set.weight, 135)
  s = logAll(s, ctx, now + 120000)
  const saved = saveSession(steady, s, 9)
  const again = strengthTarget({
    ...base,
    exId: 'back-squat',
    workouts: saved,
    today: day(12),
    now: when(day(12), 7),
    offerIncrease: true,
  })
  assert.deepEqual([again.weight, again.offer?.weight], [135, 140])
})

test('a pass on one lift lifts its close relatives more than distant ones', () => {
  const history = [
    ...steady,
    rec(1, 'front-squat', [set(8, 105), set(8, 105), set(8, 105)], { id: 'f1' }),
    rec(2, 'bench-press', [set(8, 135), set(8, 135), set(8, 135)], { id: 'b1' }),
  ].sort((a, b) => a.startedAt - b.startedAt)
  const estimate = (workouts, exId) =>
    strengthSummary({ ...base, exId, workouts, today: day(12), now: when(day(12), 7) }).oneRepMax
  const passed = [
    ...history,
    rec(
      9,
      'back-squat',
      [set(8, 150, { feel: 'good', test: 'passed' }), set(8, 150, { feel: 'good' }), set(8, 150)],
      { id: 'p' },
    ),
  ]
  const held = [...history, squats(9, 8, 135, { id: 'h' })]
  const gain = (id) => estimate(passed, id) / estimate(held, id) - 1
  assert.ok(gain('back-squat') > 0.03, `squat ${gain('back-squat')}`)
  assert.ok(gain('front-squat') > 0.005, `front squat ${gain('front-squat')}`)
  assert.ok(gain('front-squat') < gain('back-squat'))
  assert.ok(Math.abs(gain('bench-press')) < gain('front-squat'), 'an unrelated lift barely moves')
})

// ── One-tap "Too heavy" ─────────────────────────────────────────────────

test('one tap on "Too heavy" always goes at least one real weight down, and the next session agrees', () => {
  const history = [squats(0, 8, 135), squats(3, 8, 135)]
  const { session, ctx, now } = squatSession(history, 6)
  let s = { ...logSet(session, ctx(now + 60000), now + 60000), phase: 'work' }
  const before = currentSet(s).set.weight
  s = markTooHeavy(s, ctx(now + 120000), now + 120000, { soft: true })
  const after = currentSet(s).set
  assert.ok(after.weight < before && after.weight >= before * 0.7, `${before} → ${after.weight}`)
  assert.ok(after.weight % 5 === 0)
  assert.ok(s.exercises[0].sets.filter((x) => x.kind !== 'warmup').every((x) => x.weight === after.weight))
  assert.equal(s.exercises[0].attempts[0].reps, 7, 'too heavy for the planned reps, not impossible')
  // A second tap goes down again.
  const twice = markTooHeavy(s, ctx(now + 150000), now + 150000, { soft: true })
  assert.ok(currentSet(twice).set.weight < after.weight)
  // "Couldn't lift it at all" is a much bigger step.
  const hard = markTooHeavy(
    { ...logSet(session, ctx(now + 60000), now + 60000), phase: 'work' },
    ctx(now + 120000),
    now + 120000,
  )
  assert.ok(currentSet(hard).set.weight < after.weight)
  s = logAll(s, ctx, now + 180000)
  const saved = saveSession(history, s, 6)
  assert.equal(saved.at(-1).exercises[0].attempts.length, 1)
  const next = strengthTarget({
    ...base,
    exId: 'back-squat',
    workouts: saved,
    today: day(9),
    now: when(day(9), 7),
    offerIncrease: true,
  })
  assert.ok(next.weight <= after.weight + 5 && next.weight < before, `next ${next.weight}`)
  // On an assisted machine "too heavy" means more help.
  const assisted = {
    id: 'r2',
    name: 'Pull',
    kind: 'routine',
    location: 'gym',
    items: [{ exId: 'assisted-pull-up', sets: 3, reps: 8, weight: 40, restSec: 90 }],
  }
  let a = buildSession(assisted, {
    workouts: [],
    unit: 'lb',
    now,
    strength: {
      learning: null,
      metrics: {},
      goal: 'Build muscle',
      experience: 'Starting out',
      today: day(6),
      place: 'gym',
    },
  })
  a = { ...a, phase: 'work' }
  const help = currentSet(a).set.weight
  a = markTooHeavy(a, ctx(now), now, { soft: true })
  assert.ok(currentSet(a).set.weight > help)
})

test('answers with a rep count are read as measurements, and survive saving and a unit change', () => {
  const answered = (reserve, feel) => [rec(0, 'bench-press', [set(10, 135, { feel, reserve })])]
  const max = (workouts) =>
    strengthSummary({ ...base, exId: 'bench-press', workouts, today: day(2), now: when(day(2), 7) }).oneRepMax
  const none = max(answered(0, 'hard'))
  const some = max(answered(1, 'good'))
  const few = max(answered(3, 'easy'))
  const many = max(answered(6, 'easy'))
  assert.ok(none < some && some < few && few < many, [none, some, few, many].join(' < '))
  // 135 × 10 with nothing left is about a 180 lb max.
  assert.ok(none > 165 && none < 195, `none left: ${none}`)
  // A count paired with the wrong answer is ignored rather than trusted.
  assert.equal(max(answered(0, 'easy')), max(answered(undefined, 'easy')))
  const state = gymUser()
  let s = B.beginBaseline(
    B.buildBaselineSession(state, { today: '2026-11-02', now: at('2026-11-02', 10) }),
    at('2026-11-02', 10),
  )
  s = B.pickBaselineWeight(s, 100)
  s = B.baselineTooHeavy(s, at('2026-11-02', 10))
  const kg = convertStateUnits({ ...state, activeWorkout: s }, 'kg').activeWorkout
  assert.ok(Math.abs(kg.exercises[0].attempts[0].weight - 45.359) < 0.01)
  assert.equal(kg.exercises[0].attempts[0].unit, 'kg')
})

// ── Found while building this ───────────────────────────────────────────

test('logging sets exactly as planned never changes the sets still to do', () => {
  // The model only knows these sets were completed, so on paper it doubts
  // the third set; the person is doing them, so nothing may move.
  const { session, ctx, now } = squatSession([squats(0, 8, 135), squats(3, 8, 135)], 6)
  let s = session
  let t = now
  const planned = s.exercises[0].sets.map((x) => [x.weight, x.reps])
  for (let i = 0; i < s.exercises[0].sets.length; i++) {
    t += 180000
    s = { ...logSet(s, ctx(t), t), phase: 'work' }
    assert.deepEqual(
      s.exercises[0].sets.map((x) => [x.weight, x.reps]),
      planned,
      `after set ${i + 1}`,
    )
  }
  assert.ok(!s.exercises[0].adjusted)
})

test('a saved routine progresses too, by offer, and one workout offers at most two tests', () => {
  const sets = (reps, weight) => [set(reps, weight), set(reps, weight), set(reps, weight)]
  const lifts = [
    ['back-squat', 8, 185],
    ['bench-press', 8, 155],
    ['ohp', 8, 95],
    ['rdl', 8, 175],
  ]
  const history = [0, 3, 6].map((i) => ({
    ...rec(i, 'back-squat', []),
    exercises: lifts.map(([exId, reps, weight]) => ({ exId, sets: sets(reps, weight) })),
  }))
  const mine = {
    id: 'r9',
    name: 'Big four',
    kind: 'routine',
    location: 'gym',
    items: lifts.map(([exId, reps]) => ({ exId, sets: 3, reps, restSec: 120 })),
  }
  const session = buildSession(mine, {
    workouts: history,
    unit: 'lb',
    now: when(day(9), 7),
    strength: {
      learning: null,
      metrics: {},
      goal: 'Get stronger',
      experience: 'Experienced',
      today: day(9),
      place: 'gym',
    },
  })
  const offered = session.exercises.filter((e) => e.offer)
  assert.equal(offered.length, 2)
  // The routine's own reps and last weight are kept; only the test is heavier.
  for (const e of session.exercises) {
    const [, reps, weight] = lifts.find(([id]) => id === e.exId)
    assert.ok(
      e.sets.filter((x) => x.kind !== 'warmup').every((x) => x.weight === weight && x.reps >= reps),
      e.exId,
    )
    if (!e.offer) assert.ok(!/Ready to test/.test(e.note || ''), `${e.exId}: ${e.note}`)
  }
  assert.ok(offered.every((e) => e.offer.weight > e.offer.from && e.offer.reps === 8))
  // The daily plan follows the same limit.
  const state = {
    ...gymUser({ goal: 'Get stronger', experience: 'Experienced', minutes: 60 }),
    workouts: history,
  }
  const plan = recommend(state, { date: day(9), hour: 7 })
  assert.ok(plan.items.filter((i) => i.offer).length <= 2)
  assert.ok(plan.items.some((i) => i.offer))
})

test('a bodyweight move that is still out of reach gives way to an easier version of it', () => {
  const state = gymUser({ experience: 'Starting out', location: 'home', equipment: [], minutes: 30 })
  const out = runBaseline(state, lifter({ general: -0.3, areas: { Legs: 0.15, Glutes: 0.15 } }), '2026-11-02')
  assert.ok(
    out.record.exercises.some((e) => e.exId === 'kneeling-push-up'),
    'the sim could not do full push-ups',
  )
  for (const date of ['2026-11-04', '2026-11-06', '2026-11-08']) {
    const plan = recommend(out.state, { date })
    assert.ok(
      !plan.items.some((i) => i.exId === 'push-up'),
      `${date}: ${plan.items.map((i) => i.exId).join(', ')}`,
    )
    for (const item of plan.items.filter((i) => /push-up/.test(i.exId)))
      assert.ok(item.reps >= 3, `${item.exId} × ${item.reps}`)
  }
})

test('repeating a starting point is an ordinary session, and a test reset clears it', () => {
  const out = runBaseline(gymUser(), lifter({ general: 0 }), '2026-11-02')
  assert.equal(routineFromWorkout(out.record).kind, 'routine')
  const reset = resetForTesting(out.state, 'after-onboarding')
  assert.equal(reset.settings.training.baseline, null)
  assert.equal(B.baselineDue(reset), true)
})
