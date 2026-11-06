import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import visuals from '../src/lib/exercise-visuals.json' with { type: 'json' }
import { exerciseThumb, planThumbs } from '../src/lib/exercise-thumbs.js'
import { ONBOARDING_ART, planScene } from '../src/lib/onboarding-art.js'
import { onboardingResponse } from '../src/lib/onboarding.js'
import { defaultState } from '../src/lib/storage.js'

test('exercise thumbnails only use real demonstrations that ship with the app', () => {
  const ids = Object.keys(visuals)
  assert.ok(ids.length > 0)
  for (const id of ids) {
    const src = exerciseThumb(id)
    assert.equal(src, `/exercise-guides/${id}.png`)
    assert.ok(existsSync(new URL(`../public${src}`, import.meta.url)), `missing guide for ${id}`)
  }
  assert.equal(exerciseThumb('not-a-real-exercise'), null)
  assert.equal(exerciseThumb(undefined), null)
})

test('a plan preview shows each demonstrated exercise once, in plan order, up to the limit', () => {
  const [a, b, c, d] = Object.keys(visuals)
  const items = [{ exId: 'no-demo' }, { exId: a }, { exId: a }, { exId: b }, { exId: c }, { exId: d }]
  assert.deepEqual(
    planThumbs(items, 3).map((t) => t.exId),
    [a, b, c],
  )
  assert.deepEqual(planThumbs([{ exId: 'no-demo' }]), [])
  assert.deepEqual(planThumbs(), [])
})

test('the training card scene follows the session and goal, never an unpackaged asset', () => {
  assert.equal(planScene({ kind: 'recovery' }, 'Build muscle'), 'movement')
  assert.equal(planScene({ mode: 'movement' }, 'Get stronger'), 'movement')
  assert.equal(planScene({ kind: 'sport' }, 'Build muscle'), 'sports')
  assert.equal(planScene({ kind: 'adaptive' }, 'Get stronger'), 'strength')
  assert.equal(planScene({ kind: 'adaptive' }, 'General fitness'), 'rhythm')
  for (const goal of ['Build muscle', 'Get stronger', 'Lose weight', 'General fitness', undefined])
    for (const kind of ['adaptive', 'recovery', 'sport', 'pump'])
      assert.ok(ONBOARDING_ART[planScene({ kind }, goal)])
})

test('goal reactions say what happens next instead of repeating the chosen label', () => {
  const base = defaultState().settings.training
  for (const [goal, label] of [
    ['Build muscle', 'Build muscle'],
    ['Get stronger', 'Get stronger'],
    ['Lose weight', 'Lose weight'],
    ['General fitness', 'Feel fitter'],
  ]) {
    const [title, copy] = onboardingResponse('goal', { ...base, goal })
    assert.notEqual(title.replace(/\.$/, ''), label)
    assert.ok(copy.length > 0)
  }
})
