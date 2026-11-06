import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { GOALS, profileOf, buildDailyPlan } from '../src/lib/planner.js'
import { onboardingScene } from '../src/lib/onboarding-art.js'
import { shouldShowOnboardingResponse } from '../src/lib/onboarding.js'
import { photoReviewSlides, conciseSummary } from '../src/lib/photo-review.js'

test('weight goal survives save/restore and keeps plan constraints; teen profiles use general fitness', () => {
  assert.ok(GOALS.includes('Lose weight'))
  const state = defaultState()
  state.settings.training = {
    ...state.settings.training,
    goal: 'Lose weight',
    ageGroup: '18+',
    location: 'on-the-go',
    minutes: 15,
  }
  const restored = normalizeState(JSON.parse(JSON.stringify(state)))
  assert.equal(profileOf(restored).goal, 'Lose weight')
  const plan = buildDailyPlan(restored, {
    today: '2026-11-06',
    now: new Date('2026-11-06T12:00:00Z').getTime(),
    minutes: 15,
    location: 'on-the-go',
  })
  assert.ok(plan.items.length > 0)
  assert.ok(plan.estimatedSeconds <= 15 * 60)
  restored.settings.training.ageGroup = '13-17'
  assert.equal(profileOf(restored).goal, 'General fitness')
})
test('goals and locations have distinct scenes and answer pages never repeat the preceding pose', () => {
  const p = {
    ...defaultState().settings.training,
    sports: ['tennis'],
    equipment: ['Dumbbells'],
    avoidMuscles: ['Legs'],
  }
  assert.equal(
    new Set(
      ['Build muscle', 'Get stronger', 'Lose weight', 'General fitness'].map((goal) =>
        onboardingScene('goal', { ...p, goal }),
      ),
    ).size,
    4,
  )
  assert.equal(
    new Set(['gym', 'home', 'on-the-go'].map((location) => onboardingScene('location', { ...p, location })))
      .size,
    3,
  )
  assert.notEqual(
    onboardingScene('sports', { ...p, sports: [] }),
    onboardingScene('sports', { ...p, sports: [] }, true),
  )
  for (const step of [
    'goal',
    'experience',
    'sports',
    'sport-choice',
    'priority',
    'equipment',
    'home-loads',
    'time',
    'rhythm',
    'comfort',
  ])
    if (shouldShowOnboardingResponse(step, p))
      assert.notEqual(onboardingScene(step, p), onboardingScene(step, p, true), step)
})
test('review slides preserve evidence and uncertainty without inventing measurements or findings', () => {
  assert.deepEqual(photoReviewSlides(null), [])
  const review = {
    summary: 'A starting point.',
    observations: [
      {
        area: 'shoulders',
        observation: 'Possible difference.',
        uncertainty: 'Pose may explain it.',
        evidenceViews: ['front'],
      },
    ],
    suggestedFocus: [{ area: 'shoulders', reason: 'Balanced training.' }],
  }
  const slides = photoReviewSlides(review)
  assert.deepEqual(
    slides.map((s) => s.kind),
    ['overview', 'finding', 'plan'],
  )
  assert.deepEqual(slides[1].evidenceViews, ['front'])
  assert.equal(slides[1].uncertainty, review.observations[0].uncertainty)
  assert.deepEqual(slides[2].focus, review.suggestedFocus)
  assert.equal(photoReviewSlides({ summary: 'No specific finding.' }).length, 2)
  assert.equal(conciseSummary('Short summary.'), 'Short summary.')
})
