import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import {
  buildDailyPlan,
  MOVEMENTS,
  availableMovement,
  checkinSchedule,
  carryCandidates,
  planSeconds,
} from '../src/lib/planner.js'
import { SPORTS, buildSportWarmup, orderedSports } from '../src/lib/sports.js'
import { findExercise } from '../src/lib/exercises.js'
import {
  buildSession,
  prepareSession,
  beginPrepared,
  elapsedMs,
  tick,
  completeSet,
  skipRest,
  skipExercise,
  finish,
  toWorkoutRecord,
  pause,
  resume,
} from '../src/lib/workout.js'
import { withoutPhotoPreviews } from '../src/lib/photos.js'

const today = '2026-10-24'
const makeState = (profile = {}) => {
  const s = defaultState()
  s.settings.training = { ...s.settings.training, completed: true, ...profile }
  return s
}
const history = (overrides = {}) => ({
  id: 'w1',
  date: '2026-10-23',
  startedAt: new Date('2026-10-23T12:00:00').getTime(),
  exercises: [],
  ...overrides,
})

test('every sport and time retains four stages, valid drills and exactly the selected suggested duration', () => {
  for (const sport of SPORTS)
    for (const minutes of [5, 10, 15, 20]) {
      const plan = buildSportWarmup(sport.id, minutes)
      assert.equal(new Set(plan.items.map((it) => it.phaseLabel)).size, 4)
      assert.equal(
        plan.items.reduce((n, it) => n + it.sec + it.restSec, 0),
        minutes * 60,
      )
      assert.ok(plan.items.every((it) => findExercise(it.exId) && it.sec >= 15 && it.sets === 1))
      const session = buildSession(plan, {
        workouts: [
          history({
            exercises: [{ exId: plan.items[0].exId, sets: [{ sec: 999 }] }],
          }),
        ],
      })
      assert.equal(
        session.exercises[0].sets[0].sec,
        plan.items[0].sec,
        'warmups must never inherit progressive overload',
      )
    }
})
test('sport-specific final drills differ and low-impact variants replace jumping/cutting', () => {
  const basketball = buildSportWarmup('basketball', 15)
  const tennis = buildSportWarmup('tennis', 15)
  assert.ok(basketball.items.some((it) => it.exId === 'wu-basketball'))
  assert.ok(tennis.items.some((it) => it.exId === 'wu-racket'))
  assert.ok(
    !buildSportWarmup('basketball', 20, { lowImpact: true }).items.some((it) =>
      ['wu-landing', 'wu-cut', 'wu-strides'].includes(it.exId),
    ),
  )
})
test('last used sport ranks before onboarding sports, without mutating the catalogue', () => {
  const before = SPORTS.map((s) => s.id)
  const ordered = orderedSports({ sports: ['tennis', 'running'] }, 'golf')
  assert.equal(ordered[0].id, 'golf')
  assert.ok(['tennis', 'running'].includes(ordered[1].id))
  assert.deepEqual(
    SPORTS.map((s) => s.id),
    before,
  )
})
test('planner stays within time across goals, durations, locations and equipment', () => {
  for (const goal of ['Get stronger', 'Build muscle', 'General fitness', 'Sport performance'])
    for (const location of ['gym', 'home', 'on-the-go'])
      for (const minutes of [10, 15, 20, 30, 45, 60, 90]) {
        const state = makeState({
          goal,
          experience: 'Experienced',
          equipment: ['Dumbbells', 'Resistance bands'],
          sports: ['tennis'],
        })
        const plan = buildDailyPlan(state, { today, minutes, location })
        assert.ok(plan.estimatedSeconds <= minutes * 60, `${goal} ${location} ${minutes}`)
        assert.equal(plan.estimatedSeconds, planSeconds(plan.items) + 180)
        assert.ok(plan.items.length <= 6)
        for (const it of plan.items) {
          assert.ok(
            availableMovement(
              MOVEMENTS.find((m) => m.id === it.exId),
              location,
              location === 'on-the-go' ? [] : state.settings.training.equipment,
            ),
          )
          assert.ok(it.sets >= 1 && it.sets <= 3)
        }
      }
})
test('more time adds useful work; low energy, hard previous sessions and sport soon reduce load or volume', () => {
  const state = makeState({ experience: 'Experienced' })
  const short = buildDailyPlan(state, { today, minutes: 15 })
  const long = buildDailyPlan(state, { today, minutes: 60 })
  assert.ok(long.items.reduce((n, it) => n + it.sets, 0) > short.items.reduce((n, it) => n + it.sets, 0))
  const easy = buildDailyPlan(state, {
    today,
    minutes: 60,
    readiness: { energy: 'low' },
  })
  assert.ok(easy.items.every((it) => it.sets <= 2))
  state.workouts = [history({ effort: 4 })]
  assert.ok(buildDailyPlan(state, { today, minutes: 60 }).reasons.some((r) => r.includes('very hard')))
})
test('sore areas, pain, recent volume and pain-related skips change selection', () => {
  const state = makeState({ experience: 'Experienced' })
  const plan = buildDailyPlan(state, {
    today,
    readiness: { sore: ['Legs'], pain: ['Shoulders'] },
  })
  for (const it of plan.items)
    assert.ok(!MOVEMENTS.find((m) => m.id === it.exId).uses.some((v) => ['Legs', 'Shoulders'].includes(v)))
  state.workouts = [history({ unfinished: [{ exId: 'push-up', reason: 'pain' }] })]
  const safe = buildDailyPlan(state, { today })
  assert.ok(safe.items.every((it) => !MOVEMENTS.find((m) => m.id === it.exId).uses.includes('Shoulders')))
  const allPain = buildDailyPlan(state, {
    today,
    readiness: {
      pain: ['Legs', 'Glutes', 'Back', 'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Core'],
    },
  })
  assert.equal(allPain.items.length, 0)
  assert.equal(allPain.name, 'Rest day')
  assert.match(allPain.focus, /break/)
})
test('sport priorities alter actual selection, not just the session title', () => {
  const state = makeState({
    goal: 'Get stronger',
    experience: 'Experienced',
    sports: ['baseball'],
  })
  const main = buildDailyPlan(state, {
    today,
    minutes: 20,
    profile: { sportPriority: 'goal' },
  })
  const sport = buildDailyPlan(state, {
    today,
    minutes: 20,
    profile: { sportPriority: 'sport' },
  })
  assert.notDeepEqual(
    main.items.map((i) => i.exId),
    sport.items.map((i) => i.exId),
  )
})
test('only confirmed, current adult photo focus affects training, and extra side work requires a real comparison', () => {
  const state = makeState({
    experience: 'Experienced',
    confirmedFocus: ['arms'],
    focusCheckinId: 'photo1',
    weakerSide: 'left',
  })
  state.checkins = [{ id: 'photo1', date: today }]
  const focused = buildDailyPlan(state, { today, minutes: 45 })
  assert.ok(focused.items.some((it) => it.exId === 'biceps-curl'))
  assert.ok(focused.items.every((it) => !it.sideExtra))
  const comparison = {
    sideTestConfirmed: true,
    sideTestDate: today,
    weakerSide: 'left',
    sideExercise: 'biceps-curl',
  }
  const compared = buildDailyPlan(state, { today, minutes: 45, profile: comparison })
  assert.equal(compared.items.find((it) => it.exId === 'biceps-curl').sideExtra.side, 'left')
  assert.ok(compared.items.filter((it) => it.exId !== 'biceps-curl').every((it) => !it.sideExtra))
  assert.ok(
    buildDailyPlan(state, { today: '2026-10-25', profile: comparison }).items.every((it) => !it.sideExtra),
  )
  assert.ok(
    buildDailyPlan(state, { today, readiness: { energy: 'low' }, profile: comparison }).items.every(
      (it) => !it.sideExtra,
    ),
  )
  const teen = buildDailyPlan(state, { today, profile: { ageGroup: '13-17' } })
  assert.ok(!teen.reasons.some((r) => r.includes('confirmed photo')))
  const expired = buildDailyPlan(state, { today: '2026-12-24' })
  assert.ok(!expired.reasons.some((r) => r.includes('confirmed photo')))
})
test('time carry-over expires and permits only two saved offers without adding debt sets', () => {
  const state = makeState({ experience: 'Experienced' })
  state.workouts = [
    history({
      unfinished: [
        { exId: 'biceps-curl', reason: 'time', at: 1 },
        { exId: 'push-up', reason: 'pain' },
        { exId: 'rdl', reason: 'dislike' },
      ],
    }),
  ]
  assert.equal(carryCandidates(state.workouts, today).length, 1)
  state.workouts.push(history({ id: 'w2', startedAt: new Date('2026-10-23T16:00:00').getTime(), planning: { carriedFrom: ['w1:biceps-curl'] } }))
  assert.equal(carryCandidates(state.workouts, today).length, 1, 'offering is not completing')
  state.workouts.push(history({ id: 'w3', startedAt: new Date('2026-10-23T18:00:00').getTime(), planning: { carriedFrom: ['w1:biceps-curl'] } }))
  assert.equal(carryCandidates(state.workouts, today).length, 0)
  assert.equal(carryCandidates(state.workouts, '2026-12-01').length, 0)
})
test('prepared sessions count no time and timed exercises wait for Start after rest', () => {
  const plan = buildSportWarmup('tennis', 10)
  let s = prepareSession(buildSession(plan, { now: 1000 }))
  assert.equal(elapsedMs(s, 999999), 0)
  assert.equal(tick(s, 999999), s)
  s = beginPrepared(s, 5000)
  assert.equal(s.phaseEndsAt, null)
  assert.equal(s.startedAt, 5000)
  s = completeSet(s, 6000)
  assert.equal(s.phase, 'rest')
  s = skipRest(s, 7000)
  assert.equal(s.phase, 'work')
  assert.equal(s.phaseEndsAt, null)
})
test('paused phone-call time is excluded and skip reasons survive history', () => {
  let s = beginPrepared(prepareSession(buildSession(buildSportWarmup('running', 10))), 1000)
  s = completeSet(s, 5000)
  s = pause(s, 6000)
  s = resume(s, 1206000)
  assert.equal(elapsedMs(s, 1207000), 6000)
  s = skipExercise(s, 1208000, 'pain')
  s = finish(s, 1209000)
  const record = toWorkoutRecord(s, [], { now: 1210000 })
  assert.ok(record.unfinished.some((it) => it.reason === 'pain'))
  assert.equal(record.sport, 'running')
  assert.equal(record.kind, 'sport')
})
test('old saves retain workouts and new profile defaults; check-ins have a real due date and previews stay out of backups', () => {
  const normalized = normalizeState({
    entries: [],
    settings: { name: 'Test' },
    workouts: [history()],
  })
  assert.equal(normalized.settings.name, 'Test')
  assert.equal(normalized.workouts.length, 1)
  assert.deepEqual(normalized.settings.training.sports, [])
  assert.equal(checkinSchedule(normalized, today).due, true)
  normalized.checkins = [
    {
      id: 'photo',
      date: '2026-10-20',
      previews: { front: 'fake' },
      review: { summary: 'test' },
    },
  ]
  const schedule = checkinSchedule(normalized, today)
  assert.equal(schedule.next, '2026-11-03')
  assert.equal(schedule.due, false)
  const backup = withoutPhotoPreviews(normalized)
  assert.equal(backup.checkins[0].previews, undefined)
  assert.equal(backup.checkins[0].review.summary, 'test')
  assert.ok(normalized.checkins[0].previews)
})
