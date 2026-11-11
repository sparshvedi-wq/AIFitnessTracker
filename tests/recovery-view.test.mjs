import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { recoveryTimeline } from '../src/lib/recovery-view.js'
import { todayReadiness } from '../src/lib/strength/index.js'

const today = '2026-11-10'
const now = new Date(`${today}T18:00:00`).getTime()
const workout = (patch = {}) => ({
  id: 'recovery-session',
  date: today,
  unit: 'lb',
  startedAt: now - 3600000,
  endedAt: now - 600000,
  exercises: [
    {
      exId: 'bench-press',
      type: 'reps',
      weighted: true,
      sets: Array.from({ length: 4 }, () => ({ weight: 100, reps: 8, feel: 'hard', status: 'done' })),
    },
  ],
  ...patch,
})
const stateWith = (workouts) => ({ ...defaultState(), workouts })

test('recently trained muscles use the existing recovery estimate and improve with rest', () => {
  const state = stateWith([workout()])
  const rows = recoveryTimeline(state, today, now)
  const chest = rows.find((r) => r.muscle === 'chest')
  assert.ok(chest)
  const estimate = todayReadiness({
    workouts: state.workouts,
    unit: 'lb',
    today,
    now,
    experience: state.settings.training.experience,
    metrics: state.metrics,
    learning: state.learning,
    customExercises: [],
  })
  assert.equal(chest.values[0], Math.round(estimate.readiness.chest * 100))
  assert.ok(chest.values[0] < 100)
  assert.ok(chest.values[1] >= chest.values[0])
  assert.ok(chest.values[2] >= chest.values[1])
  assert.ok(!rows.some((r) => r.muscle === 'quads'))
})

test('samples, future workouts, warmup-only and skipped sets never become recently trained muscles', () => {
  const emptyWork = [
    {
      exId: 'bench-press',
      sets: [
        { kind: 'warmup', reps: 8 },
        { status: 'skipped', reps: 8 },
      ],
    },
  ]
  for (const w of [
    workout({ sample: true }),
    workout({ date: '2026-11-11' }),
    workout({ endedAt: now + 3600000, startedAt: now + 600000 }),
    workout({ exercises: emptyWork }),
    workout({ date: '2026-10-01', startedAt: undefined, endedAt: undefined }),
  ]) {
    assert.deepEqual(recoveryTimeline(stateWith([w]), today, now), [])
  }
})

test('future same-day records cannot leak into 24/48-hour forecasts', () => {
  const baseline = recoveryTimeline(stateWith([workout()]), today, now)
  const later = workout({ id: 'later', startedAt: now + 3600000, endedAt: now + 7200000 })
  assert.deepEqual(recoveryTimeline(stateWith([workout(), later]), today, now), baseline)
})

test('reported soreness and avoidance remain visible rather than being replaced by Ready', () => {
  const state = stateWith([workout()])
  state.readiness = { date: today, sore: ['Triceps'], pain: ['Chest'] }
  const rows = recoveryTimeline(state, today, now)
  assert.equal(rows.find((r) => r.muscle === 'chest').avoid, true)
  assert.equal(rows.find((r) => r.muscle === 'triceps').sore, true)
})
