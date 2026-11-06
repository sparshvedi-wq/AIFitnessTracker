import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import {
  onboardingSteps,
  onboardingProgress,
  nextOnboardingStep,
  onboardingResponse,
  shouldShowOnboardingResponse,
  restoredOnboardingResponse,
  ONBOARDING_VERSION,
} from '../src/lib/onboarding.js'
import { ONBOARDING_ART, onboardingScene } from '../src/lib/onboarding-art.js'

test('onboarding progress starts after the first answer and stays ordered across optional branches', () => {
  const base = defaultState().settings.training
  for (const location of ['gym', 'home', 'on-the-go'])
    for (const hasHomeSetup of [false, true])
      for (const sports of [[], ['tennis', 'soccer']])
        for (const equipment of [[], ['Dumbbells', 'Bench']])
          for (const baselineMode of ['photos', 'manual']) {
            const p = { ...base, location, hasHomeSetup, sports, equipment, baselineMode }
            const steps = onboardingSteps(p)
            assert.equal(steps[1], 'goal')
            assert.equal(onboardingProgress('goal'), 0)
            assert.equal(onboardingProgress('experience'), 8)
            assert.equal(onboardingProgress('review'), 100)
            assert.ok(steps.every((s, i) => !i || onboardingProgress(s) >= onboardingProgress(steps[i - 1])))
            assert.equal(
              steps.includes('home-loads'),
              Boolean((location === 'home' || hasHomeSetup) && equipment.includes('Dumbbells')),
            )
          }
})

test('home equipment and weight sizes are separate, including editing a setup from the recap', () => {
  const p = { ...defaultState().settings.training, hasHomeSetup: true, equipment: ['Dumbbells'] }
  assert.equal(nextOnboardingStep('equipment', p, 'location'), 'home-loads')
  assert.equal(nextOnboardingStep('home-loads', p, 'location'), 'review')
  assert.equal(shouldShowOnboardingResponse('equipment', p), false)
  assert.equal(shouldShowOnboardingResponse('home-loads', p), true)
  assert.equal(nextOnboardingStep('equipment', { ...p, equipment: [] }, 'location'), 'review')
})

test('responses use actual choices and restored replies cannot point to a different or unavailable question', () => {
  const p = { ...defaultState().settings.training, minutes: 45, goal: 'Get stronger' }
  assert.equal(onboardingResponse('time', p)[0], '45 minutes.')
  assert.equal(onboardingResponse('goal', p)[0], 'Get stronger.')
  assert.equal(shouldShowOnboardingResponse('about', p), false)
  assert.equal(shouldShowOnboardingResponse('sports', p), true)
  assert.equal(shouldShowOnboardingResponse('sports', { ...p, wantsSport: true }), false)
  assert.equal(restoredOnboardingResponse({ step: 'goal', responseFor: 'goal' }, p), 'goal')
  assert.equal(restoredOnboardingResponse({ step: 'goal', responseFor: 'time' }, p), null)
  assert.equal(restoredOnboardingResponse({ step: 'home-loads', responseFor: 'home-loads' }, p), null)
  const state = normalizeState({
    settings: { training: { ...p, onboardingDraft: { step: 'goal', responseFor: 'goal', profile: p } } },
  })
  assert.equal(state.settings.training.onboardingDraft.responseFor, 'goal')
})

test('every onboarding scene resolves to a packaged asset, with sensible no-sport and bodyweight responses', () => {
  const base = {
    ...defaultState().settings.training,
    hasHomeSetup: true,
    equipment: ['Dumbbells'],
    sports: ['tennis'],
    baselineMode: 'manual',
  }
  for (const step of [...onboardingSteps(base), 'movement'])
    assert.ok(ONBOARDING_ART[onboardingScene(step, base)])
  assert.equal(onboardingScene('sports', { sports: [] }, true), 'rhythm')
  assert.equal(onboardingScene('equipment', { equipment: [] }, true), 'time')
  const manifest = JSON.parse(readFileSync(new URL('../docs/onboarding/mannequin-art.json', import.meta.url)))
  for (const row of manifest.records) {
    const file = readFileSync(new URL(`../public/onboarding/${row.file}`, import.meta.url))
    assert.equal(createHash('sha256').update(file).digest('hex'), row.sha256)
  }
  for (const path of Object.values(ONBOARDING_ART))
    assert.ok(manifest.records.some((r) => path.endsWith(r.file)))
})

test('system appearance is the default without changing saved appearance or forcing completed users through setup', () => {
  assert.equal(defaultState().settings.theme, 'system')
  const old = normalizeState({
    settings: { theme: 'light', training: { completed: true, onboardingVersion: ONBOARDING_VERSION } },
  })
  assert.equal(old.settings.theme, 'light')
  assert.equal(old.settings.training.completed, true)
  assert.equal(old.settings.training.onboardingVersion, ONBOARDING_VERSION)
})
