// Regressions found by simulating lifters and fuzzing live workouts:
// failures and "too heavy" never make the rest harder, deloads are lighter
// and don't repeat, backdated logs don't distort recovery, and assisted
// machines count less help as progress.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGraph, graphAt } from '../src/lib/strength/graph.js'
import { readiness } from '../src/lib/strength/recovery.js'
import { strengthFailures, strengthTarget } from '../src/lib/strength/index.js'
import { liveContext, logShortSet, markTooHeavy } from '../src/lib/strength/session.js'

const DAY = 86400000
const at = (date, hour = 18) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()
const keyOf = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const metrics = { '2026-01-01': { weight: 180 } }

function record(id, date, start, exId, sets, extra = {}) {
  return {
    id,
    date,
    kind: 'adaptive',
    unit: 'lb',
    startedAt: start,
    endedAt: start + 30 * 60000,
    location: 'gym',
    exercises: [{ exId, type: 'reps', weighted: true, sets: sets.map((s, i) => ({ kind: 'work', targetReps: s.reps, at: start + (i + 1) * 150000, ...s })) }],
    ...extra,
  }
}
const three = (weight, reps, feel) => [0, 1, 2].map(() => ({ weight, reps, ...(feel ? { feel } : {}) }))

function liveSession(exId, sets, extra = {}) {
  return {
    id: 'live',
    kind: 'adaptive',
    unit: 'lb',
    location: 'gym',
    phase: 'work',
    pausedMs: 0,
    cursor: { ex: 0, set: sets.findIndex((s) => s.status === 'todo') },
    exercises: [{ exId, name: exId, type: 'reps', weighted: true, restSec: 90, repRange: [8, 12], targetRir: 2, sets, ...extra }],
  }
}
const ctxFor = (workouts, now) =>
  liveContext({ workouts, learning: null, unit: 'lb', now, today: keyOf(now), goal: 'Build muscle', experience: 'Some experience', readiness: {}, sizes: [], customExercises: [], metrics, activities: [] })
const todo = (s) => s.exercises[0].sets.filter((x) => x.status === 'todo')

test('a failed set never makes the rest heavier, even against conflicting history', () => {
  // Earlier logs disagree with each other (a strong "good" set, then failures
  // at a much lighter weight): the failure today must win for today.
  const workouts = [
    record('a', '2026-03-02', at('2026-03-02'), 'lat-pulldown', [{ weight: 125, reps: 8, feel: 'good' }, { weight: 85, reps: 8, feel: 'easy' }]),
    record('b', '2026-03-06', at('2026-03-06'), 'lat-pulldown', [{ weight: 55, reps: 7, targetReps: 8 }, { weight: 50, reps: 7, targetReps: 10, feel: 'failed' }]),
  ]
  const now = at('2026-03-09')
  const sets = [0, 1, 2].map(() => ({ kind: 'work', status: 'todo', weight: 50, targetWeight: 50, reps: 12, targetReps: 12 }))
  const after = logShortSet(liveSession('lat-pulldown', sets), 11, ctxFor(workouts, now), now)
  for (const s of todo(after)) {
    assert.ok(s.weight <= 50, `rest went up to ${s.weight}`)
    if (s.weight === 50) assert.ok(s.reps <= 11, `${s.reps} reps after managing 11`)
  }
  assert.equal(strengthFailures(), 0)
})

test('the bigger the failure, the bigger the drop (clean history)', () => {
  const workouts = []
  let t = at('2026-03-02')
  for (let i = 0; i < 8; i++, t += 3 * DAY) workouts.push(record(`h${i}`, keyOf(t), t - 1800000, 'bench-press', three(150, 8, 'good')))
  const now = t
  const plan = strengthTarget({ exId: 'bench-press', workouts, unit: 'lb', today: keyOf(now), now, goal: 'Build muscle', experience: 'Some experience', metrics, sets: 3, place: 'gym' })
  const rest = (reps) => {
    const sets = [0, 1, 2].map(() => ({ kind: 'work', status: 'todo', weight: plan.weight, targetWeight: plan.weight, reps: plan.reps, targetReps: plan.reps }))
    return todo(logShortSet(liveSession('bench-press', sets), reps, ctxFor(workouts, now), now))[0].weight
  }
  const mild = rest(plan.reps - 2)
  const severe = rest(1)
  assert.ok(mild < plan.weight, `mild failure kept ${mild}`)
  assert.ok(severe < mild, `one rep (${severe}) should drop further than ${plan.reps - 2} (${mild})`)
  // One rep means today's max is about the planned weight: the rest (about
  // 9 reps, 2 in reserve) has to sit near 1 / (1 + 10/28) of it, not above.
  assert.ok(severe <= plan.weight / (1 + 10 / 28) + 1e-6, `after one rep at ${plan.weight}, still planned ${severe}`)
})

test('"too heavy" never makes the set harder', () => {
  // A new exercise whose earlier sets today disagree with "too heavy".
  // (A case found by fuzzing live workouts: the old code went to 25 × 18.)
  const now = at('2026-03-09')
  const sets = [
    { kind: 'work', status: 'done', weight: 45, reps: 13, targetReps: 13, doneAt: now - 720000 },
    { kind: 'work', status: 'done', weight: 40, targetWeight: 40, reps: 6, targetReps: 10, feel: 'failed', doneAt: now - 450000 },
    { kind: 'work', status: 'todo', weight: 20, targetWeight: 20, reps: 15, targetReps: 15 },
  ]
  const session = {
    ...liveSession('db-hammer-curl', sets, {
      repRange: [10, 15],
      attempts: [
        { weight: 45, unit: 'lb', setIndex: 1, at: now - 630000, reps: 12 },
        { weight: 30, unit: 'lb', setIndex: 2, at: now - 360000 },
      ],
    }),
    startedAt: now - 4320000,
  }
  const ctx = { ...ctxFor([], now), experience: 'Experienced', goal: 'General fitness' }
  for (const soft of [true, false]) {
    const after = markTooHeavy(session, ctx, now, { soft })
    const cur = after.exercises[0].sets[2]
    assert.ok(cur.weight < 20, `soft=${soft}: ${cur.weight} after "too heavy" at 20`)
    assert.ok(cur.reps <= 15)
  }
})

test('a deload is lighter in effort and does not repeat back to back', () => {
  // A plateau: every session hard at the same numbers, so the lift stalls.
  const workouts = []
  let t = at('2026-03-02')
  const codes = []
  for (let i = 0; i < 14; i++, t += 3 * DAY) {
    const today = keyOf(t)
    const target = strengthTarget({ exId: 'bench-press', workouts, unit: 'lb', today, now: t, goal: 'Build muscle', experience: 'Some experience', metrics, sets: 3, place: 'gym' })
    codes.push(target.code)
    if (target.code === 'deload') assert.ok(target.rir > 2, `deload aims for ${target.rir} reps in reserve, the same as a normal day`)
    const weight = target.weight ?? 150
    // Even the deload is logged as hard: it still must not deload again next time.
    workouts.push(record(`p${i}`, today, t - 1800000, 'bench-press', three(weight, target.reps, 'hard')))
  }
  assert.ok(codes.includes('deload'), `a stalled lift should get a deload: ${codes.join(', ')}`)
  for (let i = 1; i < codes.length; i++) assert.ok(!(codes[i] === 'deload' && codes[i - 1] === 'deload'), `two deloads in a row: ${codes.join(', ')}`)
})

test('a workout logged later with an earlier date counts at its date for recovery', () => {
  const now = at('2026-11-16')
  const base = [
    record('a', '2026-11-10', at('2026-11-10'), 'bench-press', three(135, 8)),
    record('c', '2026-11-14', at('2026-11-14'), 'bench-press', three(135, 8)),
  ]
  // Entered this morning but dated the 12th (the summary's date picker).
  const entered = { ...record('b', '2026-11-12', at('2026-11-16', 9), 'back-squat', three(185, 8)), kind: 'manual' }
  const onItsDay = { ...record('b', '2026-11-12', at('2026-11-12', 9), 'back-squat', three(185, 8)), kind: 'manual' }
  const view = (b) => readiness(graphAt(buildGraph({ workouts: [...base, b], unit: 'lb', today: '2026-11-16', now, experience: 'Some experience' }), now).fatigue)
  const a = view(entered)
  const b = view(onItsDay)
  for (const m of ['chest', 'quads', 'glutes']) assert.ok(Math.abs(a[m] - b[m]) < 0.005, `${m}: ${a[m]} vs ${b[m]}`)
  assert.ok(a.quads > 0.95, `squats four days ago still read as fresh fatigue: ${a.quads}`)
})

test('on an assisted machine, less help is progress and more help is not', () => {
  const now = at('2026-11-16', 20)
  const steady = []
  const workouts = []
  for (const [d, assist] of [['2026-11-02', 50], ['2026-11-05', 60], ['2026-11-08', 40], ['2026-11-11', 30]]) {
    workouts.push(record(d, d, at(d), 'assisted-pull-up', [0, 1].map(() => ({ weight: assist, reps: 8 }))))
    const G = buildGraph({ workouts, unit: 'lb', today: '2026-11-16', now, experience: 'Some experience', metrics })
    steady.push(G.exercises.get('assisted-pull-up').last.steady)
  }
  // 50, then more help (not held), then less help twice (progress).
  assert.deepEqual(steady, [1, 1, 2, 3])
})
