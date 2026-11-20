import test from 'node:test'
import assert from 'node:assert/strict'
import { readManualBaseline, manualEntryOf, hasStartingProfile } from '../src/lib/starting-profile.js'
import { defaultState } from '../src/lib/storage.js'
import { buildDailyPlan, checkinSchedule } from '../src/lib/planner.js'
import { historyTimeline } from '../src/lib/history-insights.js'
import { onboardingSteps } from '../src/lib/onboarding.js'

test('a manual starting profile requires height and weight and stores canonical units', () => {
  assert.equal(readManualBaseline({}).valid, false)
  const result = readManualBaseline({
    heightUnit: 'ft',
    feet: '5',
    inches: '11',
    weightUnit: 'lb',
    weight: '180',
    muscleEstimate: 'Not sure',
    focusAreas: ['arms', 'arms', 'unknown'],
  })
  assert.ok(result.valid)
  assert.ok(Math.abs(result.value.heightCm - 180.34) < 0.001)
  assert.ok(Math.abs(result.value.weightKg - 81.6466) < 0.001)
  assert.deepEqual(result.value.focusAreas, ['arms'])
  for (const patch of [
    { feet: '5.5' },
    { inches: '12' },
    { weight: '-1' },
    { weight: 'Infinity' },
    { weightUnit: 'stone' },
    { heightUnit: 'yards' },
  ])
    assert.equal(
      readManualBaseline({
        heightUnit: 'ft',
        feet: '5',
        inches: '11',
        weightUnit: 'lb',
        weight: '180',
        ...patch,
      }).valid,
      false,
    )
  assert.ok(readManualBaseline(manualEntryOf(result.value, 'kg')).valid)
})

test('finishing setup requires a real three-view baseline or a valid manual alternative', () => {
  assert.equal(hasStartingProfile({}, []), false)
  assert.equal(hasStartingProfile({ baselineMode: 'manual', manualBaseline: { heightCm: 175 } }, []), false)
  assert.equal(
    hasStartingProfile({ baselineMode: 'manual', manualBaseline: { heightCm: 175, weightKg: 70 } }, []),
    true,
  )
  const photo = { id: 'c', photoCount: 3 }
  assert.ok(hasStartingProfile({ baselineMode: 'photos', baselinePhotoId: 'c' }, [photo]))
  assert.equal(hasStartingProfile({ baselinePhotoId: 'missing' }, [photo]), false)
  assert.equal(hasStartingProfile({ baselineMode: 'photos' }, [{ ...photo, photoCount: 2 }]), false)
  assert.ok(
    onboardingSteps({ ...defaultState().settings.training, baselineMode: 'manual' }).includes('manual'),
  )
})

test('test photos never pass as a real starting profile or affect real photo cadence and training', () => {
  const s = defaultState(),
    today = '2026-10-28'
  const fixture = {
    id: 'test',
    date: today,
    createdAt: 1,
    photoCount: 3,
    synthetic: true,
    sample: true,
    review: { status: 'ready' },
  }
  s.checkins = [fixture]
  s.settings.training = {
    ...s.settings.training,
    baselineMode: 'test',
    focusCheckinId: 'test',
    confirmedFocus: ['arms'],
  }
  assert.equal(hasStartingProfile(s.settings.training, s.checkins), false)
  assert.equal(hasStartingProfile(s.settings.training, s.checkins, true), true)
  assert.equal(
    hasStartingProfile({ ...s.settings.training, baselineMode: 'photos' }, s.checkins, true),
    false,
  )
  assert.equal(checkinSchedule(s, today).latest, undefined)
  assert.equal(historyTimeline(s, today).photos, 0)
  const plan = buildDailyPlan(s, { today })
  s.checkins = []
  assert.deepEqual(plan.items, buildDailyPlan(s, { today }).items)
})

test('manual focus changes exercise priority while muscle estimates never decide strength or loads', () => {
  const s = defaultState(),
    today = '2026-10-28'
  s.settings.training.baselineMode = 'manual'
  s.settings.training.manualBaseline = {
    heightCm: 175,
    weightKg: 70,
    muscleEstimate: 'Little muscle',
    focusAreas: ['arms'],
  }
  const focused = buildDailyPlan(s, { today })
  assert.ok(focused.items.some((i) => i.note.includes('chosen focus')))
  s.settings.training.manualBaseline.muscleEstimate = 'Well developed'
  assert.deepEqual(buildDailyPlan(s, { today }).items, focused.items)
})
