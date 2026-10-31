import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { hasTrainingTarget } from '../src/lib/preferences.js'
import { buildDailyPlan, MOVEMENTS } from '../src/lib/planner.js'
import { prepareSession, buildSession, toWorkoutRecord } from '../src/lib/workout.js'
import { BODY_AREAS, toggleBodyArea } from '../src/lib/body-areas.js'
import {
  SHORT_DURATIONS,
  shortSessionRequest,
  nextVisitInvitation,
  returnMessage,
} from '../src/lib/flexible-training.js'
import { onboardingResponse } from '../src/lib/onboarding.js'

const today = '2026-10-28'
const now = new Date(`${today}T10:00:00`).getTime()

test('a flexible default preserves a dormant target and opt-in round-trips with old data', () => {
  const s = normalizeState({ settings: { workout: { weeklyGoal: 4 } }, workouts: [{ id: 'kept' }] })
  assert.equal(hasTrainingTarget(s.settings), false)
  assert.equal(s.settings.workout.weeklyGoal, 4)
  assert.equal(s.workouts[0].id, 'kept')
  s.settings.workout.goalMode = 'target'
  const restored = normalizeState(JSON.parse(JSON.stringify(s)))
  assert.equal(hasTrainingTarget(restored.settings), true)
  assert.equal(restored.settings.workout.weeklyGoal, 4)
  assert.match(
    onboardingResponse('rhythm', { ...s.settings.training, goalMode: 'flexible' })[1],
    /No weekly target/,
  )
})

test('5/10/15-minute plans fit without reducing rests to fill the screen or starting timers', () => {
  for (const location of ['gym', 'home', 'on-the-go'])
    for (const position of ['any', 'standing', 'seated'])
      for (const minutes of SHORT_DURATIONS) {
        const s = defaultState()
        s.settings.training.onTheGo.position = position
        const before = structuredClone(s)
        const plan = buildDailyPlan(s, {
          today,
          now,
          minutes,
          location,
          shortSession: true,
          readiness: { intensity: 'easy' },
        })
        assert.ok(plan.items.length, `${location}, ${position}, ${minutes}`)
        assert.ok(plan.items.length <= 3)
        assert.ok(plan.items.every((i) => i.sets <= 2 && i.restSec >= 45))
        assert.ok(plan.estimatedSeconds <= minutes * 60)
        assert.equal(plan.planning.shortSession, true)
        const session = prepareSession(buildSession(plan, { now }))
        assert.equal(session.phase, 'prepared')
        assert.equal(session.phaseEndsAt, null)
        assert.deepEqual(s, before)
      }
})

test('every diagram group excludes the same loading areas from short and normal plans', () => {
  for (const area of BODY_AREAS)
    for (const shortSession of [true, false]) {
      const s = defaultState()
      const selected = toggleBodyArea([], area)
      const plan = buildDailyPlan(s, { today, now, shortSession, minutes: 15, readiness: { sore: selected } })
      assert.ok(
        plan.items.every((i) => !MOVEMENTS.find((m) => m.id === i.exId).uses.includes(area)),
        area,
      )
      assert.deepEqual(toggleBodyArea(selected, area), [])
      assert.deepEqual(selected, [area])
    }
  const all = BODY_AREAS.reduce(toggleBodyArea, [])
  assert.equal(
    buildDailyPlan(defaultState(), { today, now, shortSession: true, readiness: { sore: all } }).items.length,
    0,
  )
  assert.deepEqual(toggleBodyArea(['Back'], 'invented'), ['Back'])
})

test('a short preview is an undated request that re-evaluates the next visit rather than prescribing tomorrow', () => {
  const s = defaultState()
  const before = structuredClone(s)
  const request = shortSessionRequest()
  assert.equal(request.date, undefined)
  assert.equal(request.minutes, 10)
  assert.deepEqual(request.items, [])
  assert.match(nextVisitInvitation({}).text, /If you feel like/)
  assert.ok(!nextVisitInvitation({ finishReason: 'pain' }).text.includes('tomorrow'))
  assert.ok(!nextVisitInvitation({ effort: 4 }).text.includes('tomorrow'))
  const todayPlan = buildDailyPlan(s, { ...request, today, now })
  const nextPlan = buildDailyPlan(s, {
    ...request,
    today: '2026-10-29',
    now: now + 86400000,
    readiness: { sore: ['Legs', 'Glutes'] },
  })
  assert.ok(todayPlan.items.some((i) => MOVEMENTS.find((m) => m.id === i.exId).uses.includes('Legs')))
  assert.ok(nextPlan.items.every((i) => !MOVEMENTS.find((m) => m.id === i.exId).uses.includes('Legs')))
  assert.deepEqual(s, before)
})

test('a week away gets a lighter return while samples, future records and unlogged plans do not trigger messages', () => {
  const s = defaultState()
  const record = {
    id: 'last',
    date: '2026-10-21',
    startedAt: 1,
    exercises: [{ exId: 'goblet-squat', muscle: 'Legs', sets: [{ reps: 10, weight: 20 }] }],
  }
  s.workouts = [record]
  assert.match(returnMessage(s.workouts, today), /Welcome back/)
  assert.match(buildDailyPlan(s, { today, now }).focus, /lighter restart/)
  assert.equal(returnMessage([{ ...record, sample: true }], today), null)
  assert.equal(returnMessage([{ ...record, exercises: [] }], today), null)
  assert.equal(returnMessage([{ ...record, date: '2026-10-29' }], today), null)
})

test('saving an early finish keeps the actual reason so the invitation never pushes through pain', () => {
  const s = defaultState()
  const session = buildSession(buildDailyPlan(s, { today, now }), { now })
  session.exercises[0].sets[0].status = 'done'
  session.finishReason = 'pain'
  const record = toWorkoutRecord(session, [], { now: now + 60000, effort: 2 })
  assert.equal(record.finishReason, 'pain')
  assert.ok(record.unfinished.every((item) => item.reason === 'pain'))
  assert.ok(!nextVisitInvitation(record).text.includes('tomorrow'))
})
