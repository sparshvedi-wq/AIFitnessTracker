// Every question says what Tally does with the answer, the restart loop only
// shows for people who said plans fall apart, and each act 1 demo runs the
// real planner without touching saved data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { editableStep, nextOnboardingStep, onboardingSteps } from '../src/lib/onboarding.js'
import { FALLOUT_OPTIONS, PLAN_STUDY, QUESTION_COPY, falloutStep } from '../src/lib/onboarding-questions.js'
import {
  STORY_STEPS,
  energyDemo,
  firstSession,
  goalMuscles,
  guideDemo,
  placesDemo,
  recentDemo,
  swapDemo,
  warmupDemo,
} from '../src/lib/onboarding-story.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { equipmentSatisfied, placeCapabilities } from '../src/lib/engine/eligibility.js'
import { resolvePlace } from '../src/lib/places.js'

const clock = { today: '2026-11-16', now: new Date('2026-11-16T12:00:00').getTime() }

test('every question in the flow is either a story or says why it is asked', () => {
  const p = {
    ...defaultState().settings.training,
    onboardingProblem: 'often',
    onboardingBarriers: ['unsure'],
    wantsSport: true,
    sports: ['tennis'],
    hasHomeSetup: true,
    equipment: ['Dumbbells'],
    location: 'on-the-go',
  }
  for (const baselineMode of ['photos', 'manual']) {
    for (const step of onboardingSteps({ ...p, baselineMode })) {
      if (STORY_STEPS.includes(step) || step.endsWith('-demo') || ['review', 'photos'].includes(step)) continue
      const copy = QUESTION_COPY[step]
      assert.ok(copy, step)
      const [question, why] = copy
      assert.ok(question.endsWith('?') || step === 'manual', step)
      assert.ok(why && why.length <= 70, `${step}: ${why}`)
    }
  }
})

test('the restart loop follows only an answer that plans fall apart', () => {
  const base = defaultState().settings.training
  for (const answer of ['often', 'some']) {
    const p = { ...base, onboardingProblem: answer }
    assert.equal(nextOnboardingStep('problem', p), 'fallout')
    assert.equal(nextOnboardingStep('fallout', p), 'loop-demo')
    assert.equal(nextOnboardingStep('loop-demo', p), 'solution-demo')
  }
  for (const answer of ['no', 'new', undefined])
    assert.equal(nextOnboardingStep('problem', { ...base, onboardingProblem: answer }), 'solution-demo')
  assert.equal(editableStep('fallout'), false)
  // Their answer becomes one stop of the loop, and every answer has one.
  for (const [id] of FALLOUT_OPTIONS) assert.notEqual(falloutStep(id), 'Fall behind')
  assert.equal(new Set(FALLOUT_OPTIONS.map(([id]) => falloutStep(id))).size, FALLOUT_OPTIONS.length)
})

test('the research screen quotes one study, and its figures stay in range', () => {
  assert.ok(PLAN_STUDY.planned > PLAN_STUDY.others * 2, 'the lede says more than twice as likely')
  assert.ok(PLAN_STUDY.planned <= 100 && PLAN_STUDY.others > 0)
  assert.match(PLAN_STUDY.source, /2002/)
})

test('act 1 demos run the real planner for every place, within the equipment there', () => {
  const state = defaultState()
  const before = structuredClone(state)
  for (const location of ['gym', 'home', 'on-the-go']) {
    const p = { ...state.settings.training, location, sports: ['tennis'] }
    assert.ok(goalMuscles(state, p, clock).length >= 2, location)
    const places = placesDemo(state, p, clock)
    assert.equal(places[0].id, location)
    assert.equal(new Set(places.map((x) => x.id)).size, places.length)
    for (const place of places) {
      assert.ok(place.moves.length, `${location} ${place.id}`)
      for (const m of place.moves)
        assert.ok(equipmentSatisfied(metaOf(m.exId), placeCapabilities(resolvePlace(p, place.id))), m.exId)
    }
    const swap = swapDemo(state, p, clock)
    assert.ok(swap && swap.from.exId !== swap.to.exId && swap.from.muscle === swap.to.muscle, location)
    const guide = guideDemo(state, p, clock)
    assert.ok(guide.name && guide.cue, location)
    const recent = recentDemo(state, p, clock)
    assert.equal(recent.chest.length, 3)
    assert.ok(recent.chest[0] < recent.chest[2], 'chest recovers over the days')
    assert.equal(recent.chestToday, false, 'the day after a chest session, chest rests')
    const warm = warmupDemo(p)
    assert.ok(warm[5].length && warm[15].length >= warm[5].length)
    const usual = energyDemo(state, p, clock)
    const sore = energyDemo(state, p, { ...clock, energy: 'low', sore: 'Legs' })
    assert.ok(usual.some((m) => m.muscle === 'Legs') && !sore.some((m) => m.muscle === 'Legs'))
    assert.ok(firstSession(state, p, clock).moves.length)
  }
  assert.deepEqual(state, before)
})
