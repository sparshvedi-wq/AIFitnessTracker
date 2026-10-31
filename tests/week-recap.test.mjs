import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { weekOverview, weeklyRecap, defaultRecapPeriod } from '../src/lib/week.js'
import { historyVolumeView } from '../src/lib/history-view.js'
import { findExercise } from '../src/lib/exercises.js'

const today = '2026-10-28'
const workout = (date, options = {}) => ({
  id: date + (options.id || ''),
  date,
  name: 'Your training',
  kind: 'adaptive',
  unit: 'lb',
  startedAt: new Date(date + 'T12:00:00').getTime(),
  exercises: [{ ...findExercise('biceps-curl'), exId: 'biceps-curl', sets: [{ reps: 10, weight: 20 }] }],
  totals: { sets: 1, volume: 200 },
  ...options,
})
const exercise = (exId, sets) => ({ ...findExercise(exId), exId, sets })

test('compact week aligns Monday through Sunday and keeps scheduled events separate from saved work', () => {
  const s = defaultState()
  s.settings.training.sportSchedule = [
    {
      id: 'tennis',
      sport: 'tennis',
      type: 'practice',
      effort: 'normal',
      time: '18:00',
      minutes: 60,
      repeat: 'weekly',
      days: [3],
      skippedDates: [],
    },
  ]
  s.workouts = [
    workout(today),
    workout(today, { id: 'two', kind: 'sport' }),
    workout('2026-10-29'),
    workout('2026-10-27', { sample: true }),
  ]
  s.checkins = [{ id: 'photo', date: '2026-10-26' }]
  const before = structuredClone(s)
  const week = weekOverview(s, today)
  assert.equal(week.start, '2026-10-26')
  assert.equal(week.end, '2026-11-01')
  assert.equal(week.days[2].workouts.length, 2)
  assert.equal(week.days[2].events.length, 1)
  assert.equal(week.days[3].workouts.length, 0)
  assert.equal(week.days[1].workouts.length, 0)
  assert.equal(week.days[0].photos.length, 1)
  assert.deepEqual(s, before)
  assert.equal(weekOverview(s, today, 1).start, '2026-11-02')
})
test('photo reminders roll overdue dates to today, stay optional, and respect hidden metrics', () => {
  const s = defaultState()
  s.checkins = [{ id: 'old', date: '2026-10-01' }]
  assert.ok(weekOverview(s, today).days[2].photoDue)
  assert.equal(
    weekOverview(s, today, -1).days.some((d) => d.photoDue),
    false,
  )
  s.settings.display.metricLight = true
  assert.ok(weekOverview(s, today).days.every((d) => !d.photoDue && !d.photos.length))
})
test('recap counts unique strength dates and actual sets without scheduled sport, sample or future inflation', () => {
  const s = defaultState()
  s.workouts = [
    workout('2026-10-19'),
    workout('2026-10-19', { id: 'two' }),
    workout('2026-10-20', { kind: 'sport' }),
    workout('2026-10-21', { kind: 'recovery' }),
    workout('2026-10-22', { sample: true }),
    workout('2026-10-25', {
      exercises: [
        exercise('push-up', [
          { reps: 10 },
          { reps: 10, status: 'done' },
          { reps: 10, status: 'todo' },
          { status: 'skipped' },
        ]),
      ],
    }),
    workout('2026-10-29'),
  ]
  const r = weeklyRecap(s, today)
  assert.equal(r.days, 2)
  assert.equal(r.sets, 4)
  assert.equal(r.warmups, 1)
  assert.equal(r.movement, 1)
  assert.equal(r.exercises, 2)
  assert.equal(
    r.bars.reduce((n, b) => n + b.sets, 0),
    4,
  )
  assert.equal(
    r.muscles.reduce((n, m) => n + m.sets, 0),
    4,
  )
  assert.equal(defaultRecapPeriod(s, today), 'last')
})
test('this-week comparison uses matching elapsed days, with an honest empty recap', () => {
  const s = defaultState()
  s.workouts = [workout('2026-10-19'), workout('2026-10-23'), workout('2026-10-26'), workout('2026-10-28')]
  const r = weeklyRecap(s, today, 'current')
  assert.equal(r.days, 2)
  assert.equal(r.priorDays, 1)
  assert.equal(r.priorSets, 1)
  assert.ok(r.bars.slice(3).every((b) => b.future && !b.sets))
  const empty = weeklyRecap(defaultState(), today)
  assert.equal(empty.progress, null)
  assert.equal(empty.hasComparison, false)
  assert.equal(empty.sets, 0)
  assert.equal(defaultRecapPeriod(defaultState(), today), 'current')
})
test('rep progress compares the latest same-load result with a genuine preceding-week baseline', () => {
  const s = defaultState()
  s.workouts = [
    workout('2026-10-17', { exercises: [exercise('biceps-curl', [{ reps: 8, weight: 20 }])] }),
    workout('2026-10-19'),
    workout('2026-10-22', { exercises: [exercise('biceps-curl', [{ reps: 12, weight: 20 }])] }),
  ]
  const progress = weeklyRecap(s, today).progress
  assert.equal(progress.kind, 'reps')
  assert.equal(progress.delta, 4)
  assert.equal(progress.previousDate, '2026-10-17')
  assert.equal(progress.date, '2026-10-22')
  assert.equal(progress.load, 20)
})
test('more weight needs comparable reps, mixed units are converted, and timed targets do not claim progress', () => {
  const s = defaultState()
  s.settings.weightUnit = 'kg'
  s.workouts = [
    workout('2026-10-17', {
      unit: 'lb',
      exercises: [exercise('biceps-curl', [{ reps: 10, weight: 22.0462262185 }])],
    }),
    workout('2026-10-22', { unit: 'kg', exercises: [exercise('biceps-curl', [{ reps: 10, weight: 12 }])] }),
  ]
  assert.ok(Math.abs(weeklyRecap(s, today).progress.delta - 2) < 0.001)
  s.workouts[1].exercises[0].sets[0].reps = 5
  assert.equal(weeklyRecap(s, today).progress, null)
  s.workouts = [
    workout('2026-10-17', { exercises: [exercise('plank', [{ sec: 20 }])] }),
    workout('2026-10-22', { exercises: [exercise('plank', [{ sec: 60 }])] }),
  ]
  assert.equal(weeklyRecap(s, today).progress, null)
})
test('recap surfaces reported equipment limits without inventing a weakness or fatigue', () => {
  const s = defaultState()
  s.workouts = [
    workout('2026-10-22', {
      unfinished: [
        { exId: 'pull-up', reason: 'equipment' },
        { exId: 'dead-bug', reason: 'time' },
      ],
    }),
  ]
  assert.deepEqual(weeklyRecap(s, today).skips, [
    { reason: 'equipment', count: 1 },
    { reason: 'time', count: 1 },
  ])
  assert.equal(weeklyRecap(s, today).progress, null)
})
test('History Month shows this calendar month and Year sums year-to-date rather than one month', () => {
  const rows = [
    workout('2026-01-10', { totals: { volume: 100 } }),
    workout('2026-09-10', { totals: { volume: 200 } }),
    workout('2026-10-02', { totals: { volume: 300 } }),
    workout(today, { totals: { volume: 400 } }),
    workout('2026-10-29', { totals: { volume: 9000 } }),
  ]
  const month = historyVolumeView(rows, 'month', today, 'lb')
  assert.equal(month.now, 700)
  assert.equal(month.prev, 200)
  assert.equal(month.bars.length, 31)
  assert.equal(
    month.bars.reduce((n, b) => n + b.volume, 0),
    700,
  )
  const year = historyVolumeView(rows, 'year', today, 'lb')
  assert.equal(year.now, 1000)
  assert.equal(year.bars[0].volume, 100)
  assert.equal(year.bars[9].volume, 700)
})
test('History comparisons handle a short previous month and normalize mixed weight units', () => {
  const rows = [
    workout('2026-02-28', { totals: { volume: 100 } }),
    workout('2026-03-01', { unit: 'kg', totals: { volume: 100 } }),
  ]
  const month = historyVolumeView(rows, 'month', '2026-03-31', 'kg')
  assert.equal(month.now, 100)
  assert.ok(Math.abs(month.prev - 45.359237) < 0.000001)
})
test('changing an exercise definition cannot turn unlike performances into a progress claim', () => {
  const s = defaultState()
  s.workouts = [
    workout('2026-10-17'),
    workout('2026-10-22', { exercises: [{ ...exercise('biceps-curl', [{ reps: 20 }]), weighted: false }] }),
  ]
  assert.equal(weeklyRecap(s, today).progress, null)
})
