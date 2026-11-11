import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { convertStateUnits } from '../src/lib/units.js'
import { recordBook, liftedTotal, validPersonalRecord, dailyArtwork } from '../src/lib/personal-records.js'
import { validateBackup } from '../src/lib/backup.js'

const today = '2026-11-10'
const record = (patch = {}) => ({
  id: 'pr-1',
  exId: 'bench-press',
  date: today,
  unit: 'lb',
  weight: 100,
  reps: 1,
  sec: 0,
  ...patch,
})
const workout = (patch = {}) => ({
  id: 'w1',
  date: today,
  unit: 'lb',
  exercises: [{ exId: 'bench-press', weighted: true, type: 'reps', sets: [{ weight: 100, reps: 5 }] }],
  ...patch,
})

test('PRs survive normalization, backup and unit changes without adding sessions or volume', () => {
  const state = normalizeState(
    validateBackup({
      ...defaultState(),
      personalRecords: [record(), record({ id: 'pr-2', weight: 90, reps: 8 })],
    }),
  )
  assert.equal(state.workouts.length, 0)
  assert.equal(liftedTotal(state.workouts, 'lb', today), 0)
  assert.equal(recordBook([], state.personalRecords, 'lb', today)[0].history.length, 2)
  const converted = convertStateUnits(state, 'kg')
  assert.equal(converted.personalRecords[0].unit, 'lb')
  assert.ok(
    Math.abs(recordBook([], converted.personalRecords, 'kg', today)[0].best.weight - 45.359237) < 0.00001,
  )
})

test('real workout volume uses per-workout units and excludes samples, warmups and future work', () => {
  const works = [
    workout(),
    workout({ id: 'kg', unit: 'kg' }),
    workout({ sample: true }),
    workout({ date: '2027-01-01' }),
    workout({
      exercises: [{ exId: 'bench-press', weighted: true, sets: [{ weight: 500, reps: 5, kind: 'warmup' }] }],
    }),
  ]
  assert.ok(Math.abs(liftedTotal(works, 'lb', today) - (500 + 500 / 0.45359237)) < 0.001)
})

test('record book combines sessions and manual bests; timed and assisted results retain their meaning', () => {
  const entries = [
    record({ weight: 110 }),
    record({ id: 'time', exId: 'plank', weight: 0, reps: 0, sec: 90 }),
    record({ id: 'a', exId: 'assisted-pull-up', weight: 20, reps: 5 }),
    record({ id: 'b', exId: 'assisted-pull-up', weight: 10, reps: 5 }),
  ]
  const book = recordBook([workout()], entries, 'lb', today)
  assert.equal(book.find((r) => r.exId === 'bench-press').history.length, 2)
  assert.equal(book.find((r) => r.exId === 'bench-press').best.weight, 110)
  assert.equal(book.find((r) => r.exId === 'plank').best.sec, 90)
  assert.equal(book.find((r) => r.exId === 'assisted-pull-up').best.weight, 10)
})

test('a workout adds one line per exercise (its best set), not one per set', () => {
  const sets = [
    { weight: 200, reps: 6 },
    { weight: 210, reps: 6 },
    { weight: 210, reps: 5 },
    { weight: 45, reps: 10, kind: 'warmup' },
  ]
  const earlier = workout({
    id: 'w0',
    date: '2026-11-03',
    exercises: [{ exId: 'back-squat', weighted: true, sets: [{ weight: 205, reps: 6 }] }],
  })
  const latest = workout({ exercises: [{ exId: 'back-squat', weighted: true, sets }] })
  const squat = recordBook([earlier, latest], [], 'lb', today).find((r) => r.exId === 'back-squat')
  assert.deepEqual(
    squat.history.map((h) => [h.date, h.weight, h.reps]),
    [
      [today, 210, 6],
      ['2026-11-03', 205, 6],
    ],
  )
  assert.equal(squat.best.weight, 210)
})

test('invalid entries are rejected and future records do not become current bests', () => {
  for (const patch of [
    { weight: -1 },
    { weight: Infinity },
    { reps: 1.5 },
    { sec: 1.2 },
    { unit: 'stones' },
    { date: 'bad' },
    { reps: 0, sec: 0 },
  ])
    assert.equal(validPersonalRecord(record(patch)), false)
  assert.deepEqual(recordBook([], [record({ date: '2027-01-01' })], 'lb', today), [])
})

test('daily artwork is stable within a day and changes across the week', () => {
  assert.equal(dailyArtwork(today), dailyArtwork(today))
  assert.ok(new Set(Array.from({ length: 7 }, (_, i) => dailyArtwork(`2026-11-${10 + i}`))).size > 1)
})
