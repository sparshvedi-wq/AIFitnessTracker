import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { buildDailyPlan, profileOf, readinessOf } from '../src/lib/planner.js'
import { planningContext } from '../src/lib/engine/recommend.js'
import { photoFocusEvidence } from '../src/lib/engine/photo-focus.js'
import { PHOTO_FOCUS } from '../src/lib/engine/config.js'
import { addDays } from '../src/lib/date.js'

const today = '2026-11-06'
const profile = { ageGroup: '18+', focusCheckinId: 'first', confirmedFocus: ['shoulders'] }
const photo = (id, date, areas = ['shoulders'], patch = {}) => ({
  id,
  date,
  createdAt: Date.parse(`${date}T12:00:00Z`),
  review: {
    status: 'ready',
    views: Object.fromEntries(['front', 'side', 'back'].map((a) => [a, { usable: true }])),
    observations: areas.map((area) => ({
      area,
      observation: 'A visible cue.',
      uncertainty: 'Pose can affect the outline.',
      evidenceViews: ['front', 'back'],
    })),
    suggestedFocus: areas.map((area) => ({ area, reason: 'A balanced emphasis.' })),
  },
  ...patch,
})

test('photo influence starts small, is capped after a spaced follow-up, and never mutates evidence', () => {
  const first = photo('first', addDays(today, -14))
  const initial = photoFocusEvidence([first], profile, today)[0]
  assert.equal(initial.rankWeight, PHOTO_FOCUS.initialRank)
  assert.equal(initial.targetBoost, 0.05)
  const repeated = [first, photo('next', today)]
  const saved = structuredClone(repeated)
  const followup = photoFocusEvidence(repeated, profile, today)[0]
  assert.equal(followup.followup, true)
  assert.equal(followup.targetBoost, 0.1)
  assert.equal(followup.rankWeight, PHOTO_FOCUS.followupRank)
  assert.equal(
    photoFocusEvidence(repeated, { ...profile, focusCheckinId: 'next' }, today)[0].followup,
    true,
    'approving the new check-in must retain the earlier review for reassessment',
  )
  assert.deepEqual(repeated, saved)
  for (let i = 1; i < 14; i++) repeated.push(photo(`extra${i}`, addDays(today, -i)))
  assert.ok(photoFocusEvidence(repeated, profile, today)[0].targetBoost <= 0.1)
  assert.ok(photoFocusEvidence(repeated, profile, today)[0].rankWeight < 1)
})

test('a newer differing or empty review retires the old emphasis without silently selecting another area', () => {
  const first = photo('first', addDays(today, -14))
  for (const areas of [[], ['back']])
    assert.deepEqual(photoFocusEvidence([first, photo('new', today, areas)], profile, today), [])
  const unsupported = photo('new', today)
  unsupported.review.observations = []
  assert.deepEqual(photoFocusEvidence([first, unsupported], profile, today), [])
  const rows = [first, photo('changed', addDays(today, -7), []), photo('new', today)]
  assert.equal(photoFocusEvidence(rows, profile, today)[0].followup, false)
})

test('same-day repeats do not reinforce a cue, and stale evidence fades to zero on calendar days', () => {
  const first = photo('first', today)
  assert.equal(photoFocusEvidence([first, photo('repeat', today)], profile, today)[0].followup, false)
  const nextDay = photo('next', addDays(today, 1))
  assert.equal(photoFocusEvidence([first, nextDay], profile, nextDay.date)[0].followup, false)
  assert.equal(photoFocusEvidence([first], profile, addDays(today, 28))[0].targetBoost, 0.025)
  assert.deepEqual(photoFocusEvidence([first], profile, addDays(today, 42)), [])
})

test('sample, future, unusable and malformed data cannot reinforce or introduce a photo priority', () => {
  const first = photo('first', addDays(today, -14))
  for (const patch of [{ synthetic: true }, { sample: true }, { review: { demo: true, status: 'ready' } }])
    assert.deepEqual(photoFocusEvidence([{ ...first, ...patch }], profile, today), [])
  assert.deepEqual(photoFocusEvidence([first], { ...profile, ageGroup: '13-17' }, today), [])
  assert.deepEqual(photoFocusEvidence([first], { ...profile, focusCheckinId: 'missing' }, today), [])
  const future = photo('future', addDays(today, 1), [])
  assert.equal(photoFocusEvidence([first, future], profile, today)[0].checkinId, 'first')
  const malformed = photo('bad', today)
  malformed.review.observations = [null, { area: 'shoulders', evidenceViews: 'front' }]
  assert.deepEqual(photoFocusEvidence([first, malformed], profile, today), [])
  for (const badDate of ['no date', '2026-02-30', '2026-13-10'])
    assert.deepEqual(photoFocusEvidence([{ ...first, date: badDate }], profile, today), [])
  assert.deepEqual(
    photoFocusEvidence([first], { ...profile, confirmedFocus: ['constructor', '__proto__'] }, today),
    [],
  )
  const unusable = photo('bad', today)
  unusable.review.views.front.usable = false
  assert.equal(photoFocusEvidence([first, unusable], profile, today)[0].checkinId, 'first')
})

test('the real planner scales photo scoring and selection, keeps dose constraints, and pauses it on recovery days', () => {
  const s = defaultState()
  s.settings.training = {
    ...s.settings.training,
    ...profile,
    goal: 'Build muscle',
    experience: 'Experienced',
    weakerSide: 'left',
  }
  s.checkins = [photo('first', today)]
  const options = { today, now: Date.parse(`${today}T12:00:00Z`), minutes: 30, seed: 42, trace: true }
  const context = (extra = {}) =>
    planningContext(s, {
      ...options,
      profile: profileOf(s),
      readiness: { ...readinessOf(s, today), ...extra },
    })
  const ctx = context()
  assert.equal(ctx.focusStrength.Shoulders, 0.25)
  assert.equal(ctx.focusTargetBoost.Shoulders, 0.05)
  const plan = buildDailyPlan(s, options)
  assert.ok(plan.decision.trace.some((c) => c.features.focus > 0))
  assert.ok(plan.decision.trace.every((c) => (c.features.focus || 0) <= 0.25))
  assert.ok(plan.estimatedSeconds <= 1800)
  assert.ok(plan.items.every((i) => i.sets <= 3 && !i.sideExtra))
  const base = buildDailyPlan(s, { ...options, profile: { confirmedFocus: [] } })
  for (const item of plan.items) {
    const same = base.items.find((i) => i.exId === item.exId)
    if (same)
      for (const key of ['weight', 'reps', 'restSec', 'sideExtra']) assert.deepEqual(item[key], same[key])
  }
  assert.deepEqual(context({ energy: 'low' }).photoEvidence, [])
  assert.deepEqual(context({ sore: ['Shoulders'] }).photoEvidence, [])
  assert.deepEqual(context({ pain: ['Shoulders'] }).photoEvidence, [])
  s.settings.training.baselineMode = 'manual'
  s.settings.training.manualBaseline = { focusAreas: ['shoulders'] }
  assert.equal(context().focusStrength.Shoulders, 1, 'an explicit preference retains its priority')
  s.settings.display.metricLight = true
  assert.equal(context().focusAreas.size, 0)
})
