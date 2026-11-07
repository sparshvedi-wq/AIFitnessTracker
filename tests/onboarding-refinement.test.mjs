import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { buildDailyPlan } from '../src/lib/planner.js'
import { nextOnboardingStep, onboardingSteps } from '../src/lib/onboarding.js'
import { physiqueChoice, physiqueOptions } from '../src/lib/physique-preferences.js'
import { manualEntryOf, readManualBaseline } from '../src/lib/starting-profile.js'
import { noteFocusSuggestions } from '../src/lib/profile-notes.js'
import { photoReviewSlides } from '../src/lib/photo-review.js'

test('physique preference follows goal, survives restore and never changes training prescription', () => {
  const state = defaultState(),
    profile = state.settings.training
  assert.deepEqual(onboardingSteps(profile).slice(1, 4), ['goal', 'physique', 'experience'])
  assert.equal(nextOnboardingStep('goal', profile, 'goal'), 'physique')
  assert.equal(nextOnboardingStep('physique', profile, 'goal'), 'review')
  const before = buildDailyPlan(state, { today: '2026-11-06', seed: 5 })
  for (const goal of ['Build muscle', 'Get stronger', 'Lose weight', 'General fitness']) {
    const choices = physiqueOptions(goal)
    assert.equal(choices.length, 3)
    assert.equal(new Set(choices.map((c) => c.id)).size, 3)
  }
  profile.idealPhysique = { goal: profile.goal, id: 'athletic' }
  const restored = normalizeState(JSON.parse(JSON.stringify(state)))
  assert.equal(physiqueChoice(restored.settings.training), 'athletic')
  assert.equal(physiqueChoice({ ...profile, goal: 'Get stronger' }), null)
  assert.equal(physiqueChoice({ ...profile, idealPhysique: null }), null)
  assert.deepEqual(buildDailyPlan(restored, { today: '2026-11-06', seed: 5 }).items, before.items)
})

test('profile notes remain text; area suggestions require an explicit focus choice', () => {
  const entry = { height: '175', weight: '70', notes: 'My shoulders look uneven.', focusAreas: [] }
  const baseline = readManualBaseline(entry).value
  assert.equal(baseline.notes, entry.notes)
  assert.deepEqual(baseline.focusAreas, [])
  assert.deepEqual(noteFocusSuggestions(baseline.notes), ['shoulders'])
  assert.deepEqual(noteFocusSuggestions('My back and arms are priorities.'), ['back', 'arms'])
  for (const note of [
    'Avoid shoulders',
    'I don’t want arm focus',
    'Shoulder injury',
    'My shoulder hurts',
    'Back pain',
  ])
    assert.deepEqual(noteFocusSuggestions(note), [])
  assert.equal(readManualBaseline({ ...entry, notes: 'a'.repeat(1000) }).value.notes.length, 600)
  assert.equal(readManualBaseline({ ...entry, notes: { text: 'bad data' } }).value.notes, '')
  const state = defaultState()
  state.settings.training.manualBaseline = baseline
  const restored = normalizeState(JSON.parse(JSON.stringify(state)))
  assert.equal(manualEntryOf(restored.settings.training.manualBaseline).notes, entry.notes)
})

test('shorter review copy keeps the original evidence and does not invent a smaller side', () => {
  const input = {
    area: 'shoulders',
    observation: 'The relaxed shoulder outline looks slightly different between sides.',
    uncertainty: 'Pose may explain it.',
    evidenceViews: ['front', 'back'],
  }
  const review = { observations: [input], suggestedFocus: [] }
  const slides = photoReviewSlides(review)
  assert.equal(slides[1].observation, 'Your shoulders may look slightly uneven.')
  assert.equal(slides[1].uncertainty, input.uncertainty)
  assert.deepEqual(slides[1].evidenceViews, input.evidenceViews)
  assert.equal(slides.at(-1).kind, 'checkins')
  assert.equal(input.observation, 'The relaxed shoulder outline looks slightly different between sides.')
  const exact = { ...input, observation: 'No clear difference is visible.' }
  assert.equal(photoReviewSlides({ observations: [exact] })[1].observation, exact.observation)
  const sample = photoReviewSlides({ ...review, demo: true, suggestedFocus: [{ area: 'shoulders' }] })[1]
  assert.equal(sample.observation, 'Your shoulders look uneven.')
  assert.equal(sample.uncertainty, input.uncertainty)
  assert.match(sample.trainingResponse, /Add this focus.*small shoulder emphasis/)
  assert.doesNotMatch(slides[1].trainingResponse, /small shoulder emphasis/)
  // A saved real reading cannot gain confidence merely from a copy edit.
  const uncertain = { ...input, observation: 'Your shoulders may look slightly uneven.' }
  assert.equal(photoReviewSlides({ observations: [uncertain] })[1].observation, uncertain.observation)
})
