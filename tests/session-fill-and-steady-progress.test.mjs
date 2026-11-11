// Sessions that use the time asked for, plans that never collapse to a
// single exercise, and progression for people who log sets without saying
// how they felt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeUser, recommend, train } from './helpers/engine-sim.mjs'
import { addDays } from '../src/lib/date.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { strengthTarget } from '../src/lib/strength/index.js'

const DAY = 86400000
const at = (date, hour = 18) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()
const day = (i) => new Date(Date.UTC(2026, 8, 1) + i * DAY).toISOString().slice(0, 10)
const set = (reps, weight, extra = {}) => ({ kind: 'work', reps, weight, targetReps: reps, ...extra })
const rec = (i, exId, sets, extra = {}) => ({
  id: `w${i}`,
  kind: 'adaptive',
  unit: 'lb',
  location: 'gym',
  date: day(i),
  startedAt: at(day(i)),
  endedAt: at(day(i)) + 3600000,
  durationSec: 3600,
  exercises: [{ exId, sets }],
  effort: 2,
  ...extra,
})
const base = {
  unit: 'lb',
  goal: 'Get stronger',
  experience: 'Experienced',
  learning: null,
  metrics: {},
  place: 'gym',
}
const target = (exId, workouts, i, extra = {}) =>
  strengthTarget({ ...base, exId, workouts, today: day(i), now: at(day(i), 7), ...extra })
const minutesOf = (plan) => plan.estimatedSeconds / 60
const totalSets = (plan) => plan.items.reduce((n, i) => n + i.sets, 0)
const squats = (i, reps, weight, extra) =>
  rec(i, 'back-squat', [set(reps, weight), set(reps, weight), set(reps, weight)], extra)

test('a longer session is actually longer: more exercises and a fourth set from an hour', () => {
  const user = (minutes) =>
    makeUser({ goal: 'Build muscle', experience: 'Experienced', location: 'gym', minutes })
  const p45 = recommend(user(45), { date: '2026-11-02' })
  const p60 = recommend(user(60), { date: '2026-11-02' })
  const p90 = recommend(user(90), { date: '2026-11-02' })
  assert.ok(
    p45.items.length <= 6 && p45.items.every((i) => i.sets <= 3),
    'a normal session keeps the usual caps',
  )
  assert.ok(minutesOf(p60) >= 52 && minutesOf(p60) <= 60, `60 minutes plans ${minutesOf(p60).toFixed(0)}`)
  assert.ok(minutesOf(p90) >= 66 && minutesOf(p90) <= 90, `90 minutes plans ${minutesOf(p90).toFixed(0)}`)
  assert.ok(totalSets(p90) > totalSets(p60) && totalSets(p60) > totalSets(p45))
  assert.ok(p90.items.length <= 8 && p90.items.every((i) => i.sets <= 4))
})

test('someone starting out keeps two sets at first, then fills the time they asked for', () => {
  let state = makeUser({ goal: 'General fitness', experience: 'Starting out', location: 'gym', minutes: 45 })
  const plans = []
  for (const d of [0, 2, 4, 7, 9]) {
    const date = addDays('2026-10-05', d)
    const plan = recommend(state, { date })
    plans.push(plan)
    state = train(state, plan, date, { weight: () => 40 }).state
  }
  for (const plan of plans.slice(0, 3))
    assert.ok(
      plan.items.every((i) => i.sets <= 2),
      'first sessions stay gentle',
    )
  for (const plan of plans.slice(3)) {
    assert.ok(plan.items.every((i) => i.sets <= 3))
    assert.ok(minutesOf(plan) >= 38, `later sessions use the time: ${minutesOf(plan).toFixed(0)} of 45`)
  }
})

test('training most days never collapses a requested session to one exercise', () => {
  let state = makeUser({ goal: 'Get stronger', experience: 'Experienced', location: 'gym', minutes: 90 })
  const plans = []
  for (let d = 0; d < 14; d++) {
    if (![0, 1, 2, 4, 5].includes(d % 7)) continue
    const date = addDays('2026-10-05', d)
    const plan = recommend(state, { date })
    plans.push(plan)
    state = train(state, plan, date, {
      weight: (e) => plan.items.find((i) => i.exId === e.exId)?.weight ?? 95,
    }).state
  }
  assert.ok(
    plans.every((p) => p.items.length >= 2),
    plans.map((p) => p.items.length).join(','),
  )
  const average = plans.reduce((n, p) => n + minutesOf(p), 0) / plans.length
  assert.ok(average >= 50, `average ${average.toFixed(0)} of 90 minutes`)
  // A plan well short of the time says so instead of claiming to fit it.
  for (const p of plans) {
    const short = Math.round(minutesOf(p)) <= 90 * 0.7
    assert.equal(
      p.reasons.some((r) => r.startsWith('Fits 90 minutes')),
      !short,
      `${minutesOf(p).toFixed(1)} minutes: ${p.reasons.join(' | ')}`,
    )
    if (short) assert.ok(p.reasons.some((r) => /^About \d+ of your 90 minutes/.test(r)))
  }
})

test('filling a short plan never repeats a family, and allows at most two moves of one pattern', () => {
  let state = makeUser({
    goal: 'Get stronger',
    experience: 'Starting out',
    location: 'home',
    equipment: [],
    minutes: 45,
  })
  for (let d = 0; d < 14; d++) {
    if (![0, 1, 3, 4].includes(d % 7)) continue
    const date = addDays('2026-10-05', d)
    const plan = recommend(state, { date })
    const metas = plan.items.map((i) => metaOf(i.exId))
    assert.equal(new Set(metas.map((m) => m.family)).size, metas.length, 'one exercise per family')
    const perPattern = {}
    for (const m of metas) perPattern[m.pattern] = (perPattern[m.pattern] || 0) + 1
    assert.ok(Object.values(perPattern).every((n) => n <= 2))
    state = train(state, plan, date).state
  }
})

test('sets logged without an answer still progress: one more rep, then the next weight', () => {
  // One clean session is not enough to step.
  const afterOne = target('back-squat', [squats(0, 7, 135)], 3)
  assert.ok(afterOne.weight === 135 && afterOne.reps <= 8)
  // The same numbers again: now a step.
  const step = target('back-squat', [squats(0, 7, 135), squats(3, 7, 135)], 6)
  assert.equal(step.weight, 135)
  assert.equal(step.reps, 8)
  assert.equal(step.code, 'reps-up')
  // At the top of the range (5–8), the next weight, inside the range.
  const top = [squats(0, 7, 135), squats(3, 8, 135), squats(6, 8, 135)]
  const up = target('back-squat', top, 9)
  assert.equal(up.weight, 140)
  assert.ok(up.reps >= 5 && up.reps <= 8)
  assert.equal(up.code, 'load-up')
  // The heavier weight done cleanly is kept next time, never taken back.
  const kept = target('back-squat', [...top, squats(9, up.reps, 140)], 12)
  assert.ok(kept.weight >= 140, `kept ${kept.weight}`)
})

test('the step never fires after a hard, missed or very hard session, on lighter days or when held', () => {
  const two = [squats(0, 7, 135), squats(3, 7, 135)]
  assert.equal(target('back-squat', two, 6).reps, 8)
  // A hard answer, a missed set, or a very hard session each stop it.
  const hard = [
    squats(0, 7, 135),
    rec(3, 'back-squat', [set(7, 135, { feel: 'hard' }), set(7, 135), set(7, 135)]),
  ]
  assert.ok(target('back-squat', hard, 6).reps <= 7)
  const missed = [
    squats(0, 7, 135),
    rec(3, 'back-squat', [set(7, 135), set(7, 135), set(5, 135, { targetReps: 7 })]),
  ]
  const afterMiss = target('back-squat', missed, 6)
  assert.ok(afterMiss.weight <= 135 && afterMiss.reps <= 7)
  const veryHard = [squats(0, 7, 135), squats(3, 7, 135, { effort: 4 })]
  assert.ok(target('back-squat', veryHard, 6).reps <= 7)
  // A lighter day, or a held load, never steps.
  const easy = target('back-squat', two, 6, { easy: true })
  assert.ok(easy.weight <= 135 && easy.code !== 'reps-up' && easy.code !== 'load-up')
  const held = target('back-squat', two, 6, { noIncrease: true })
  assert.ok(held.weight === 135 && held.reps <= 7)
})

test('a full-body day is not described as leg work the next day', () => {
  const state = makeUser({
    goal: 'Build muscle',
    experience: 'Some experience',
    location: 'gym',
    minutes: 45,
  })
  const sets = (reps, weight) => [set(reps, weight), set(reps, weight), set(reps, weight)]
  const yesterday = {
    ...rec(0, 'goblet-squat', sets(10, 40)),
    date: '2026-11-10',
    startedAt: at('2026-11-10'),
    endedAt: at('2026-11-10') + 2700000,
    exercises: [
      { exId: 'goblet-squat', sets: sets(10, 40) },
      { exId: 'push-up', sets: sets(12, null) },
      { exId: 'db-row', sets: sets(10, 30) },
      { exId: 'glute-bridge', sets: sets(12, null) },
      { exId: 'plank', sets: [{ kind: 'work', sec: 30 }] },
    ],
  }
  const plan = recommend({ ...state, workouts: [yesterday] }, { date: '2026-11-11' })
  assert.notEqual(plan.explanation?.code, 'rotate-emphasis', plan.focus)
  assert.ok(!/leg work/.test(plan.focus))
})
