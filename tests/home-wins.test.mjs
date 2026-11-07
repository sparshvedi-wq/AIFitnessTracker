import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { latestWin, tallySessions, warmupSetCount, workingSetCount } from '../src/lib/milestones.js'
import { noteFocusSuggestions } from '../src/lib/profile-notes.js'
import { lastRecordedAt } from '../src/components/training/usePlanningTime.js'
import { planningContext } from '../src/lib/engine/recommend.js'
import { profileOf, readinessOf } from '../src/lib/planner.js'
import { planSummary } from '../src/lib/presentation.js'
import { buildDailyPlan } from '../src/lib/planner.js'
import { addDays } from '../src/lib/date.js'

const today = '2026-11-06'
const session = (id, date, sets = [{ reps: 8, weight: 20 }], patch = {}) => ({
  id,
  date,
  kind: 'adaptive',
  endedAt: Date.parse(`${date}T18:00:00`),
  exercises: [{ exId: 'goblet-squat', name: 'Goblet squat', sets }],
  ...patch,
})

test('the latest win is drawn from saved working sets only, with a five-mark ring', () => {
  assert.equal(latestWin([], today).kind, 'next')
  assert.equal(latestWin([], today).bundle, 0)
  const warmupOnly = session('w', today, [{ kind: 'warmup', reps: 8, weight: 10 }])
  assert.equal(tallySessions([warmupOnly], today).length, 0)
  assert.equal(latestWin([warmupOnly], today).kind, 'next')
  const first = latestWin([session('a', today)], today)
  assert.deepEqual([first.kind, first.title, first.bundle, first.when], ['first', 'First mark', 1, 'Today'])
  const five = Array.from({ length: 5 }, (_, i) => session(`s${i}`, addDays(today, -20 + i * 4)))
  const milestone = latestWin(five, today)
  assert.deepEqual([milestone.kind, milestone.title, milestone.bundle], ['milestone', '5 marks', 5])
  const six = [...five, session('s5', today)]
  assert.equal(latestWin(six, today).bundle, 1)
  const best = [...six, session('s6', today, undefined, { records: [{ name: 'Goblet squat' }] })]
  assert.deepEqual([latestWin(best, today).kind, latestWin(best, today).detail], ['best', 'Goblet squat'])
  const back = [session('o1', addDays(today, -30)), session('o2', addDays(today, -21)), session('n', today)]
  assert.equal(latestWin(back, today).kind, 'back')
  const samples = [session('x', today, undefined, { sample: true })]
  assert.equal(latestWin(samples, today).kind, 'next')
  const future = [session('f', addDays(today, 1))]
  assert.equal(latestWin(future, today).kind, 'next')
})

test('saved-sheet counts match the milestone: working sets and warm-ups apart', () => {
  const w = session('a', today, [
    { kind: 'warmup', reps: 8, weight: 10 },
    { reps: 8, weight: 20 },
    { reps: 0 },
  ])
  assert.equal(workingSetCount(w), 1)
  assert.equal(warmupSetCount(w), 1)
})

test('spoken cues are opt-in: older saves are turned off once, later choices are kept', () => {
  assert.equal(defaultState().settings.workout.voice, false)
  const old = defaultState()
  old.settings.workout = { ...old.settings.workout, voice: true }
  delete old.settings.workout.cuesVersion
  const migrated = normalizeState(JSON.parse(JSON.stringify(old)))
  assert.equal(migrated.settings.workout.voice, false)
  assert.equal(migrated.settings.workout.cuesVersion, 2)
  migrated.settings.workout.voice = true
  assert.equal(normalizeState(JSON.parse(JSON.stringify(migrated))).settings.workout.voice, true)
})

test('note suggestions ignore pain, caution and "get back into" phrasing', () => {
  for (const note of [
    'Getting back into lifting after a year off',
    'My lower back is sore',
    'Bad back, careful with deadlifts',
    'Knee surgery last year, legs are weak',
    'Tight hips from sitting all day',
    'Never train legs',
  ])
    assert.deepEqual(noteFocusSuggestions(note), [], note)
  assert.deepEqual(noteFocusSuggestions('I want a bigger upper back'), ['back'])
  assert.deepEqual(noteFocusSuggestions('My shoulders look a little uneven'), ['shoulders'])
})

test('Home plans from no earlier than the last saved workout', () => {
  const ended = Date.parse(`${today}T18:00:00`)
  assert.equal(
    lastRecordedAt([
      session('a', today),
      session('s', today, undefined, { sample: true, endedAt: ended + 9e9 }),
    ]),
    ended,
  )
  assert.equal(lastRecordedAt([]), 0)
})

test('the first session has no summary line on the card; its own screen explains it', () => {
  const plan = buildDailyPlan(defaultState(), { today })
  assert.equal(plan.firstSession, true)
  assert.equal(planSummary(plan), '')
})

test('a manual starting profile does not keep applying an older photo priority', () => {
  const s = defaultState()
  s.settings.training = {
    ...s.settings.training,
    ageGroup: '18+',
    baselineMode: 'manual',
    manualBaseline: { focusAreas: [] },
    focusCheckinId: 'first',
    confirmedFocus: ['shoulders'],
  }
  s.checkins = [
    {
      id: 'first',
      date: today,
      createdAt: Date.parse(`${today}T12:00:00Z`),
      review: {
        status: 'ready',
        views: { front: { usable: true }, side: { usable: true }, back: { usable: true } },
        observations: [
          { area: 'shoulders', observation: 'A cue.', uncertainty: 'Pose.', evidenceViews: ['front'] },
        ],
        suggestedFocus: [{ area: 'shoulders', reason: 'Balance.' }],
      },
    },
  ]
  const ctx = planningContext(s, {
    today,
    now: Date.parse(`${today}T12:00:00Z`),
    profile: profileOf(s),
    readiness: readinessOf(s, today),
  })
  assert.deepEqual(ctx.photoEvidence, [])
  assert.equal(ctx.focusSource, null)
})
