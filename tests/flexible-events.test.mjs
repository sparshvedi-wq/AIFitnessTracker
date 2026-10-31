import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import {
  eventOccurrences,
  eventHistory,
  trainingEventContext,
  presetImpact,
  validTrainingEvent,
  saveTrainingEvent,
} from '../src/lib/training-events.js'
import { planSummary } from '../src/lib/presentation.js'
import { sportScheduleContext } from '../src/lib/sport-schedule.js'
import { buildDailyPlan, buildEventPump, MOVEMENTS, planSeconds } from '../src/lib/planner.js'
import { historyTimeline, exerciseTrend } from '../src/lib/history-insights.js'
import { onboardingSteps, onboardingResponse, nextOnboardingStep } from '../src/lib/onboarding.js'
import { trainingDays } from '../src/lib/preferences.js'
import { buildSession, prepareSession, personalBests, findRecords } from '../src/lib/workout.js'
import { historyVolumeView } from '../src/lib/history-view.js'
import { resetForTesting } from '../src/lib/testing.js'
import { buildSportWarmup, SPORT_DRILLS } from '../src/lib/sports.js'
const today = '2026-10-27'
const at = (date, time = '10:00') => new Date(`${date}T${time}:00`).getTime()
const now = at(today)
const event = (p = {}) => ({
  id: 'tennis',
  title: 'Tennis practice',
  sport: 'tennis',
  kind: 'activity',
  date: today,
  time: '18:00',
  minutes: 60,
  effort: 'normal',
  status: 'planned',
  impact: presetImpact('tennis'),
  ...p,
})
const stateFor = (p = {}) => {
  const s = defaultState()
  s.settings.training = { ...s.settings.training, experience: 'Some experience', minutes: 45, ...p }
  return s
}

test('one-off events validate local dates and finite windows without recurring dates', () => {
  assert.ok(validTrainingEvent(event()))
  assert.equal(eventOccurrences([event()], today, '2026-11-27').length, 1)
  for (const p of [
    { date: '2026-02-30' },
    { time: '25:00' },
    { minutes: 0 },
    { status: 'constructor' },
    { impact: { ...presetImpact('tennis'), beforeHours: Infinity } },
    { impact: { ...presetImpact('tennis'), muscles: ['invented'] } },
  ])
    assert.equal(validTrainingEvent(event(p)), false)
  assert.equal(eventOccurrences([null, event({ status: 'cancelled' })], today, today).length, 0)
})
test('adding, moving and cancelling an event changes only the planning window still ahead', () => {
  const s = stateFor({ lifeEvents: [event()] })
  assert.ok(trainingEventContext(s.settings.training, { today, now }).lighter)
  const adjusted = buildDailyPlan(s, { today, now })
  s.settings.training.lifeEvents = [event({ date: '2026-11-01' })]
  assert.equal(trainingEventContext(s.settings.training, { today, now }).lighter, false)
  const normal = buildDailyPlan(s, { today, now })
  assert.ok(adjusted.items.reduce((n, i) => n + i.sets, 0) < normal.items.reduce((n, i) => n + i.sets, 0))
  s.settings.training.lifeEvents = [event({ status: 'cancelled' })]
  assert.deepEqual(buildDailyPlan(s, { today, now }).items, normal.items)
})
test('recent completed custom activity affects dose, expires, and never invents attendance', () => {
  const p = {
    lifeEvents: [
      event({
        sport: '',
        title: 'Moving boxes',
        time: '07:00',
        status: 'done',
        effort: 'hard',
        impact: { ...presetImpact('', 'hard'), muscles: ['Back', 'Legs'], source: 'ai' },
      }),
    ],
  }
  const c = trainingEventContext(p, { today, now })
  assert.ok(c.lighter && c.muscles.includes('Back'))
  assert.match(c.note, /You logged/)
  p.lifeEvents[0].status = 'planned'
  assert.match(trainingEventContext(p, { today, now }).note, /had planned/)
  p.lifeEvents[0].date = '2026-10-20'
  assert.equal(trainingEventContext(p, { today, now }).lighter, false)
  assert.equal(eventHistory(p, today).length, 0)
})
test('competition preparation looks ahead one week without making every day a lighter day', () => {
  const c = trainingEventContext(
    {
      lifeEvents: [
        event({
          date: '2026-11-02',
          kind: 'competition',
          sport: 'soccer',
          title: 'Soccer game',
          impact: presetImpact('soccer', 'hard', 'competition'),
        }),
      ],
    },
    { today, now },
  )
  assert.equal(c.preparation.title, 'Soccer game')
  assert.equal(c.lighter, false)
  const close = trainingEventContext(
    {
      lifeEvents: [
        event({
          date: '2026-10-28',
          kind: 'competition',
          impact: presetImpact('tennis', 'hard', 'competition'),
        }),
      ],
    },
    { today, now },
  )
  assert.ok(close.lighter)
  const late = trainingEventContext({ lifeEvents: [event({ time: '10:10' })] }, { today, now, minutes: 30 })
  assert.ok(late.overlap)
})
test('switching to one-off mode keeps old recurring data but stops using it', () => {
  const p = {
    eventMode: 'one-off',
    sportSchedule: [
      {
        id: 'old',
        sport: 'tennis',
        type: 'practice',
        effort: 'hard',
        repeat: 'weekly',
        days: [2],
        time: '18:00',
        minutes: 90,
      },
    ],
    lifeEvents: [],
  }
  const before = structuredClone(p)
  assert.equal(sportScheduleContext(p, { today, now }).lighter, false)
  assert.deepEqual(p, before)
})
test('a future occasion cannot take credit for adjustments caused by an earlier physical activity', () => {
  const s = stateFor({
    lifeEvents: [
      event({ id: 'boxes', title: 'Moving boxes', time: '07:00', status: 'done' }),
      event({ id: 'party', kind: 'occasion', title: 'A party', time: '18:00' }),
    ],
  })
  const plan = buildDailyPlan(s, { today, now })
  assert.match(planSummary(plan), /after moving boxes/)
  assert.ok(!planSummary(plan).includes('party'))
})
test('event updates and undo retain other events and strip stale occurrence timestamps', () => {
  let p = stateFor().settings.training
  p = saveTrainingEvent(p, event({ id: 'a' }))
  p = saveTrainingEvent(p, event({ id: 'b' }))
  p = saveTrainingEvent(p, event({ id: 'a', status: 'cancelled' }))
  p = saveTrainingEvent(p, { ...event({ id: 'a' }), at: 123, key: 'stale' })
  assert.equal(p.lifeEvents.length, 2)
  assert.ok(p.lifeEvents.some((e) => e.id === 'b'))
  assert.equal(p.lifeEvents.find((e) => e.id === 'a').at, undefined)
})
test('the after-onboarding test reset clears one-off activity history and stays past setup', () => {
  const s = stateFor({ lifeEvents: [event({ status: 'done' })] })
  const reset = resetForTesting(s, 'after-onboarding')
  assert.deepEqual(reset.settings.training.lifeEvents, [])
  assert.equal(reset.settings.training.onboardingVersion, 2)
  assert.equal(s.settings.training.lifeEvents.length, 1)
})
test('pump sessions fit time, setup, readiness and actual protected areas; remain unstarted', () => {
  const s = stateFor({
    location: 'home',
    equipment: ['Dumbbells'],
    avoidMuscles: ['Shoulders'],
    lifeEvents: [],
  })
  const e = event({ kind: 'occasion', focus: ['Chest', 'Shoulders', 'Biceps', 'Triceps'] })
  for (const minutes of [5, 10, 15]) {
    const p = buildEventPump(s, e, {
      today,
      now,
      minutes,
      location: 'home',
      readiness: { pain: [], sore: ['Chest'], energy: 'normal' },
    })
    assert.ok(
      p.items.every(
        (i) => !MOVEMENTS.find((m) => m.id === i.exId).uses.some((m) => ['Shoulders', 'Chest'].includes(m)),
      ),
    )
    assert.ok(planSeconds(p.items) + 120 <= minutes * 60)
    assert.ok(p.items.every((i) => i.sets <= 2 && !i.sideExtra))
    assert.equal(prepareSession(buildSession(p, { now })).phase, 'prepared')
  }
  s.settings.training.lifeEvents = [
    event({ impact: { ...presetImpact('tennis'), muscles: ['Biceps', 'Triceps', 'Chest', 'Shoulders'] } }),
  ]
  assert.equal(buildEventPump(s, e, { today, now }).items.length, 0)
})
test('persistent movement exclusions cannot be removed by an empty daily check-in', () => {
  const s = stateFor({ avoidMuscles: ['Legs', 'Glutes'] })
  const plan = buildDailyPlan(s, { today, now, readiness: { pain: [], sore: [] } })
  assert.ok(
    plan.items.every(
      (i) => !MOVEMENTS.find((m) => m.id === i.exId).uses.some((m) => ['Legs', 'Glutes'].includes(m)),
    ),
  )
})
test('long onboarding branches sensibly and no-sport feedback does not invent a sport', () => {
  const p = stateFor().settings.training
  assert.ok(onboardingSteps(p).length >= 12)
  assert.ok(!onboardingSteps(p).includes('priority'))
  assert.match(onboardingResponse('sports', p)[0], /perfectly fine/)
  assert.ok(onboardingSteps({ ...p, sports: ['tennis'] }).includes('priority'))
  assert.ok(onboardingSteps({ ...p, hasHomeSetup: true }).includes('equipment'))
  assert.ok(onboardingSteps({ ...p, location: 'on-the-go' }).includes('movement'))
  const old = normalizeState({
    settings: { training: { completed: true, sports: ['tennis'] } },
    workouts: [],
  })
  assert.deepEqual(old.settings.training.avoidMuscles, [])
  assert.equal(nextOnboardingStep('sports', p, 'sports'), 'review')
  assert.equal(nextOnboardingStep('sports', { ...p, sports: ['tennis'] }, 'sports'), 'sport-choice')
  assert.equal(nextOnboardingStep('priority', { ...p, sports: ['tennis'] }, 'sports'), 'review')
  assert.equal(nextOnboardingStep('time', p, 'time'), 'rhythm')
  assert.equal(nextOnboardingStep('rhythm', p, 'time'), 'review')
  assert.equal(nextOnboardingStep('home', { ...p, hasHomeSetup: true }, 'location'), 'equipment')
  assert.equal(nextOnboardingStep('equipment', { ...p, hasHomeSetup: true }, 'location'), 'review')
})
test('sport warmups respect areas flagged during onboarding instead of prescribing through them', () => {
  const result = buildSportWarmup('tennis', 10, { avoidMuscles: ['Shoulders', 'Legs', 'Glutes'] })
  assert.ok(
    result.items.every(
      (i) =>
        !['Shoulders', 'Legs', 'Glutes', 'Cardio'].includes(
          SPORT_DRILLS.find((d) => d.id === i.exId)?.muscle,
        ),
    ),
  )
  assert.ok(result.estimatedSeconds <= 600)
  assert.match(result.reasons[0], /omitted/)
})
test('history unifies done activities with real sessions while keeping planned events and samples separate', () => {
  const s = stateFor({
    lifeEvents: [
      event({ status: 'done', time: '08:00' }),
      event({ id: 'future', date: '2026-10-28' }),
      event({ id: 'cancel', status: 'cancelled' }),
    ],
  })
  s.workouts = [
    {
      id: 'w',
      kind: 'routine',
      date: today,
      name: 'Your training',
      exercises: [
        {
          exId: 'push-up',
          name: 'Push-up',
          sets: [
            { status: 'done', reps: 10 },
            { status: 'skipped', reps: 10 },
          ],
        },
      ],
    },
    { id: 'sample', sample: true, date: today, name: 'Sample', exercises: [] },
  ]
  const h = historyTimeline(s, today)
  assert.equal(h.activities, 1)
  assert.equal(h.sets, 1)
  assert.equal(h.days, 1)
  assert.equal(h.rows.length, 2)
  assert.equal(historyTimeline(s, today, { query: 'tennis' }).rows.length, 1)
  assert.equal(historyTimeline(s, today, { filter: 'training' }).rows.length, 1)
})
test('short sessions never become strength PRs, volume or goal days; trends normalize units', () => {
  const s = stateFor()
  const w = {
    id: 'pump',
    kind: 'pump',
    date: today,
    unit: 'lb',
    name: 'Short session',
    totals: { volume: 9999 },
    exercises: [
      {
        exId: 'biceps-curl',
        name: 'Curl',
        muscle: 'Biceps',
        type: 'reps',
        weighted: true,
        sets: [{ reps: 10, weight: 100, status: 'done' }],
      },
    ],
  }
  assert.equal(trainingDays([w], s.settings, today).count, 0)
  assert.deepEqual(personalBests([w]), [])
  assert.deepEqual(findRecords(w, []), [])
  assert.equal(historyVolumeView([w], 'month', today, 'lb').now, 0)
  const b = {
    ...w,
    id: 'regular',
    kind: 'routine',
    unit: 'kg',
    exercises: [
      {
        ...w.exercises[0],
        sets: [
          { reps: 8, weight: 10, status: 'done' },
          { reps: 100, weight: 100, status: 'skipped' },
        ],
      },
    ],
  }
  assert.equal(exerciseTrend([w, b], 'biceps-curl', 'kg', today).length, 1)
  assert.equal(exerciseTrend([w, b], 'biceps-curl', 'lb', today)[0].reps, 8)
  assert.ok(exerciseTrend([w, b], 'biceps-curl', 'lb', today)[0].value > 22)
})
