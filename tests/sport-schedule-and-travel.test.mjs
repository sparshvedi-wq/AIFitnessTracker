import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { buildDailyPlan, planSeconds } from '../src/lib/planner.js'
import { sportOccurrences, sportScheduleContext, validSportEvent } from '../src/lib/sport-schedule.js'
import { DEFAULT_ON_THE_GO, movementAllowed, movementPreferences } from '../src/lib/movement-preferences.js'
import { adaptRoutineItems, replacementOptions } from '../src/lib/workout-adjustments.js'
import { SPORTS, buildSportWarmup } from '../src/lib/sports.js'
import { findExercise } from '../src/lib/exercises.js'
import { buildSession, prepareSession, weekStreak } from '../src/lib/workout.js'

const today = '2026-10-26' // Monday, in local calendar time.
const at = (date, time = '10:00') => new Date(`${date}T${time}:00`).getTime()
const now = at(today)
const event = (patch = {}) => ({
  id: 'practice',
  sport: 'soccer',
  type: 'practice',
  effort: 'normal',
  repeat: 'weekly',
  days: [1, 3],
  time: '18:00',
  minutes: 90,
  startsOn: today,
  skippedDates: [],
  ...patch,
})
const stateFor = (patch = {}) => {
  const state = defaultState()
  // Historical recurrence remains testable, but new app profiles use one-off events.
  state.settings.training = {
    ...state.settings.training,
    eventMode: 'legacy',
    completed: true,
    experience: 'Some experience',
    minutes: 45,
    ...patch,
  }
  return state
}

test('weekly and dated events expand in local time, with cancellation and start dates', () => {
  const events = [
    event({ skippedDates: ['2026-10-28'] }),
    event({ id: 'match', type: 'match', repeat: 'once', date: '2026-10-31', time: '09:30' }),
  ]
  const before = structuredClone(events)
  const rows = sportOccurrences(events, '2026-10-19', '2026-11-02')
  assert.deepEqual(
    rows.map((e) => e.date),
    [today, '2026-10-31', '2026-11-02'],
  )
  assert.equal(rows[1].at, at('2026-10-31', '09:30'))
  assert.equal(rows[1].endsAt - rows[1].at, 90 * 60000)
  assert.deepEqual(events, before)
  assert.equal(sportOccurrences(null, today, today).length, 0)
})
test('invalid events cannot affect a plan or crash recurrence expansion', () => {
  for (const patch of [
    { id: null },
    { sport: 'unknown' },
    { type: 'constructor' },
    { effort: 'toString' },
    { minutes: 0 },
    { minutes: 500 },
    { minutes: 30.5 },
    { days: [] },
    { days: 'Monday' },
    { time: '25:00' },
    { repeat: 'once', date: '2026-02-30' },
  ]) {
    assert.equal(validSportEvent(event(patch)), false)
    assert.equal(sportOccurrences([event(patch)], today, '2026-11-02').length, 0)
  }
})
test('nearby practices, competitions and recent hard events shape lighter planning without inventing attendance', () => {
  const context = (e, time = now) => sportScheduleContext({ sportSchedule: [e] }, { today, now: time })
  assert.equal(context(event()).lighter, true)
  assert.equal(context(event({ effort: 'easy' })).lighter, false)
  assert.equal(context(event({ repeat: 'once', date: '2026-10-27', type: 'match' })).lighter, true)
  assert.equal(context(event({ repeat: 'once', date: '2026-10-27' })).lighter, false)
  assert.equal(context(event({ skippedDates: [today] })).lighter, false)
  assert.equal(context(event({ effort: 'hard' }), at(today, '21:00')).lighter, true)
  assert.equal(context(event(), at(today, '21:00')).lighter, false)
  assert.match(
    context(event({ repeat: 'once', date: today, effort: 'hard' }), at(today, '21:00')).note,
    /after soccer/,
  )
})
test('schedule detects overlap and combines nearby sports, including events crossing midnight', () => {
  const ctx = sportScheduleContext(
    { sportSchedule: [event({ time: '10:15' }), event({ id: 'tennis', sport: 'tennis', time: '15:00' })] },
    { today, now, minutes: 30 },
  )
  assert.equal(ctx.overlap.sport, 'soccer')
  assert.ok(ctx.muscles.includes('Shoulders') && ctx.muscles.includes('Legs'))
  const late = event({
    repeat: 'once',
    date: '2026-10-25',
    startsOn: '2026-10-25',
    time: '23:30',
    minutes: 120,
    effort: 'hard',
  })
  assert.ok(sportScheduleContext({ sportSchedule: [late] }, { today, now: at(today, '00:30') }).overlap)
})
test('schedule reduces actual daily dose and loads; removing an event restores the recommendation', () => {
  const state = stateFor()
  state.workouts = [
    {
      id: 'last',
      date: '2026-10-20',
      unit: 'lb',
      exercises: [
        {
          ...findExercise('bench-press'),
          exId: 'bench-press',
          sets: [{ weight: 100, reps: 10, targetReps: 10 }],
        },
      ],
    },
  ]
  const base = buildDailyPlan(state, { today, now })
  state.settings.training.sportSchedule = [event()]
  const before = structuredClone(state)
  const light = buildDailyPlan(state, { today, now })
  assert.ok(light.schedule.lighter)
  assert.ok(light.items.reduce((sum, i) => sum + i.sets, 0) < base.items.reduce((sum, i) => sum + i.sets, 0))
  assert.ok(
    light.items.every(
      (i) => i.sets <= (['Legs', 'Glutes', 'Core'].includes(findExercise(i.exId).muscle) ? 1 : 2),
    ),
  )
  const bench = light.items.find((i) => i.exId === 'bench-press')
  if (bench) assert.ok(bench.weight <= 85)
  assert.deepEqual(state, before)
  state.settings.training.sportSchedule = []
  assert.deepEqual(buildDailyPlan(state, { today, now }).items, base.items)
})
test('saved routines keep authored data while schedule reductions lock targets against overload', () => {
  const state = stateFor({ sportSchedule: [event()] })
  const items = [
    { exId: 'bodyweight-squat', sets: 5, reps: 15 },
    { exId: 'bench-press', sets: 4, reps: 12, weight: 100 },
  ]
  const before = structuredClone(items)
  const adapted = adaptRoutineItems(state, items, 'gym', { pain: [], sore: [] }, { today, now })
  assert.equal(adapted.items[0].sets, 1)
  assert.equal(adapted.items[1].sets, 2)
  assert.equal(adapted.items[1].reps, 8)
  assert.equal(adapted.items[1].weight, 85)
  const session = buildSession(
    { ...adapted, lockedTargets: adapted.schedule.lighter, items: adapted.items },
    { now },
  )
  assert.equal(session.exercises[0].sets[0].reps, 8)
  assert.deepEqual(items, before)
})
test('on-the-go plans respect every space and position combination without becoming empty by default', () => {
  for (const position of ['any', 'standing', 'seated'])
    for (const noFloor of [false, true])
      for (const wall of [false, true]) {
        const movement = { ...DEFAULT_ON_THE_GO, space: 'small', position, noFloor, wall }
        const state = stateFor({ location: 'on-the-go', onTheGo: movement })
        const plan = buildDailyPlan(state, { today, now, minutes: 30 })
        assert.ok(plan.items.length >= 2, JSON.stringify(movement))
        assert.ok(plan.items.every((i) => movementAllowed(i.exId, movement)))
        assert.ok(planSeconds(plan.items) + 180 <= 30 * 60)
        assert.ok(plan.items.every((i) => !findExercise(i.exId).weighted))
        assert.deepEqual(buildSession(plan).movement, movement)
        if (position === 'seated') {
          assert.ok(plan.items.every((i) => i.exId.startsWith('seated-')))
          assert.equal(
            buildSession(plan).kind,
            'recovery',
            'light chair work must not count as strength training',
          )
        }
        if (position === 'standing')
          assert.ok(
            !plan.items.some((i) => ['push-up', 'dead-bug', 'prone-w', 'glute-bridge'].includes(i.exId)),
          )
      }
})
test('session movement overrides stay local and saved equipment preferences do not leak into gym training', () => {
  const state = stateFor({ location: 'on-the-go', onTheGo: { ...DEFAULT_ON_THE_GO, position: 'seated' } })
  const before = structuredClone(state)
  const plan = buildDailyPlan(state, {
    today,
    now,
    movement: { position: 'standing', wall: false, noFloor: true },
  })
  assert.ok(plan.items.every((i) => !i.exId.startsWith('seated-') && i.exId !== 'incline-push-up'))
  assert.equal(movementPreferences(state.settings.training, 'gym'), null)
  assert.deepEqual(state, before)
})
test('saved routine adaptation and replacements respect the session movement snapshot', () => {
  const state = stateFor({ location: 'on-the-go' })
  const movement = { ...DEFAULT_ON_THE_GO, space: 'small', position: 'standing', wall: false }
  const input = [
    { exId: 'prone-w', sets: 2, reps: 10 },
    { exId: 'push-up', sets: 2, reps: 10 },
    { exId: 'dead-bug', sets: 2, reps: 10 },
  ]
  const adapted = adaptRoutineItems(
    state,
    input,
    'on-the-go',
    { pain: [], sore: [] },
    { today, now, movement },
  )
  assert.ok(adapted.items.length > 0)
  assert.ok(adapted.items.every((i) => movementAllowed(i.exId, movement)))
  assert.ok(adapted.changes.some((s) => s.includes('omitted')))
  const session = prepareSession(
    buildSession(
      { location: 'on-the-go', movement, items: [{ exId: 'prone-w', sets: 2, reps: 10 }] },
      { now },
    ),
  )
  const choices = replacementOptions(state, session)
  assert.ok(choices.some((c) => c.id === 'standing-w'))
  assert.ok(choices.every((c) => movementAllowed(c.id, movement)))
})
test('every sport warmup respects seated, standing, no-floor and small-space filters at every duration', () => {
  for (const sport of SPORTS)
    for (const minutes of [5, 10, 15, 20])
      for (const position of ['any', 'standing', 'seated']) {
        const movement = { ...DEFAULT_ON_THE_GO, space: 'small', position, noFloor: true, wall: false }
        const plan = buildSportWarmup(sport.id, minutes, { movement })
        assert.ok(
          plan.items.every((i) => findExercise(i.exId) && movementAllowed(i.exId, movement)),
          `${sport.id}: ${position}`,
        )
        assert.equal(
          plan.items.reduce((sum, i) => sum + i.sec + i.restSec, 0),
          minutes * 60,
        )
        assert.equal(new Set(plan.items.map((i) => i.phaseLabel)).size, 4)
        assert.match(plan.reasons.join(' '), /does not rehearse every sport movement/)
        if (sport.id === 'tennis' && position === 'standing')
          assert.ok(
            plan.items.some((i) => i.exId === 'wu-racket-still'),
            'keep a stationary sport rehearsal instead of unrelated filler',
          )
      }
})
test('upgrading an old save adds defaults and retains workouts, new preferences and schedule in snapshots', () => {
  const state = stateFor({ sportSchedule: [event()], onTheGo: { ...DEFAULT_ON_THE_GO, position: 'seated' } })
  const restored = normalizeState(JSON.parse(JSON.stringify(state)))
  assert.deepEqual(restored.settings.training.sportSchedule, state.settings.training.sportSchedule)
  assert.deepEqual(restored.settings.training.onTheGo, state.settings.training.onTheGo)
  delete state.settings.training.sportSchedule
  delete state.settings.training.onTheGo
  const upgraded = normalizeState(state)
  assert.deepEqual(upgraded.settings.training.sportSchedule, [])
  assert.deepEqual(upgraded.settings.training.onTheGo, DEFAULT_ON_THE_GO)
})
test('light movement and duplicate sessions cannot inflate a weekly strength streak', () => {
  const rows = [
    { date: today, kind: 'adaptive' },
    { date: today, kind: 'routine' },
    { date: '2026-10-27', kind: 'recovery' },
    { date: '2026-10-28', kind: 'sport' },
  ]
  assert.equal(weekStreak(rows, 3, '2026-10-28'), 0)
  assert.equal(
    weekStreak(
      [...rows, { date: '2026-10-27', kind: 'adaptive' }, { date: '2026-10-28', kind: 'routine' }],
      3,
      '2026-10-28',
    ),
    1,
  )
})
