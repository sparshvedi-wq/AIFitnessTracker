import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import {
  onboardingSteps,
  onboardingStage,
  chapterFills,
  chapterRecap,
  nextOnboardingStep,
  onboardingResponse,
  shouldShowOnboardingResponse,
  restoredOnboardingResponse,
  ONBOARDING_VERSION,
} from '../src/lib/onboarding.js'
import { ONBOARDING_ART, onboardingScene } from '../src/lib/onboarding-art.js'

test('onboarding chapters stay ordered across optional branches', () => {
  const base = defaultState().settings.training
  for (const location of ['gym', 'home', 'on-the-go'])
    for (const hasHomeSetup of [false, true])
      for (const sports of [[], ['tennis', 'soccer']])
        for (const equipment of [[], ['Dumbbells', 'Bench']])
          for (const baselineMode of ['photos', 'manual']) {
            const p = { ...base, location, hasHomeSetup, sports, equipment, baselineMode }
            const steps = onboardingSteps(p)
            assert.equal(steps[1], 'goal')
            // Chapters only ever move forward, whatever branches an answer adds.
            assert.ok(
              steps.every((s, i) => !i || onboardingStage(s).index >= onboardingStage(steps[i - 1]).index),
            )
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
  assert.equal(onboardingResponse('goal', p)[0], 'Let’s get stronger.')
  // A recap follows the last question of a chapter, not every answer.
  assert.equal(shouldShowOnboardingResponse('goal', p), false)
  assert.equal(shouldShowOnboardingResponse('about', p), true)
  assert.equal(shouldShowOnboardingResponse('sports', p), false)
  assert.equal(shouldShowOnboardingResponse('sports', { ...p, wantsSport: true }), false)
  assert.equal(restoredOnboardingResponse({ step: 'about', responseFor: 'about' }, p), 'about')
  for (const draft of [undefined, null, {}, { responseFor: 'about' }])
    assert.equal(restoredOnboardingResponse(draft, p), null)
  assert.equal(restoredOnboardingResponse({ step: 'about', responseFor: 'time' }, p), null)
  assert.equal(restoredOnboardingResponse({ step: 'goal', responseFor: 'goal' }, p), null)
  assert.equal(restoredOnboardingResponse({ step: 'home-loads', responseFor: 'home-loads' }, p), null)
  const state = normalizeState({
    settings: { training: { ...p, onboardingDraft: { step: 'about', responseFor: 'about', profile: p } } },
  })
  assert.equal(state.settings.training.onboardingDraft.responseFor, 'about')
})

test('each chapter ends with one recap built from the person’s own answers', () => {
  const base = {
    ...defaultState().settings.training,
    goal: 'Get stronger',
    experience: 'Starting out',
    minutes: 45,
  }
  // About you: the goal, by name when one was given.
  const about = chapterRecap('about', { ...base, name: 'Sam Lee' })
  assert.equal(about.chapter, 'About you')
  assert.equal(about.title, 'Let’s get stronger, Sam.')
  assert.deepEqual(about.lines, [
    onboardingResponse('goal', base)[1],
    onboardingResponse('experience', base)[1],
  ])
  assert.equal(chapterRecap('about', base).title, 'Let’s get stronger.')
  // No sport: nothing to recap. With a sport: after the last sport question only.
  assert.equal(chapterRecap('sports', base), null)
  const plays = { ...base, wantsSport: true, sports: ['tennis'], sportPriority: 'sport' }
  assert.equal(chapterRecap('sport-choice', plays), null)
  assert.equal(chapterRecap('priority', plays).title, 'Sport comes first.')
  // Setup: whichever question comes last for this person's places.
  assert.equal(chapterRecap('location', base), null)
  assert.match(chapterRecap('home', base).lines.join(' '), /Gym sessions can use any equipment/)
  const home = { ...base, location: 'home', hasHomeSetup: true, equipment: ['Dumbbells', 'Bench'] }
  assert.equal(chapterRecap('equipment', home), null)
  const setup = chapterRecap('home-loads', home)
  assert.match(setup.lines.join(' '), /Home plans use dumbbells, bench\./)
  assert.equal(setup.lines.at(-1), onboardingResponse('location', home)[1])
  assert.ok(chapterRecap('movement', { ...base, location: 'on-the-go' }))
  // Your day: the actual time, and that it can change.
  const dayLines = chapterRecap('comfort', { ...base, goalMode: 'flexible' }).lines
  assert.match(dayLines[0], /^45 minutes\. Change the time/)
  assert.match(chapterRecap('comfort', { ...base, flexibleTime: true }).lines[0], /^You choose the time/)
  assert.equal(chapterRecap('time', base), null)
  // The last chapter ends with the plan, not a recap.
  for (const step of ['photos', 'manual', 'review'])
    assert.equal(chapterRecap(step, { ...base, baselineMode: 'manual' }), null)
  // Never more than three lines, none empty.
  for (const [step, p] of [
    ['about', base],
    ['priority', plays],
    ['home-loads', home],
    ['comfort', base],
  ]) {
    const recap = chapterRecap(step, p)
    assert.ok(
      recap.lines.length >= 2 && recap.lines.length <= 3 && recap.lines.every((l) => l && l.length < 90),
      step,
    )
  }
})

test('the five chapter segments fill in order and never run backwards', () => {
  for (const p of [
    defaultState().settings.training,
    {
      ...defaultState().settings.training,
      wantsSport: true,
      sports: ['tennis'],
      location: 'home',
      hasHomeSetup: true,
      equipment: ['Dumbbells'],
      baselineMode: 'manual',
    },
  ]) {
    const steps = onboardingSteps(p).filter((s) => s !== 'welcome')
    let before = -1
    for (const step of steps) {
      const fills = chapterFills(step, p)
      assert.equal(fills.length, 5)
      const here = onboardingStage(step).index
      assert.ok(
        fills.slice(0, here).every((f) => f === 1) && fills.slice(here + 1).every((f) => f === 0),
        step,
      )
      assert.ok(fills[here] > 0 && fills[here] <= 1, step)
      const total = fills.reduce((n, f) => n + f, 0)
      assert.ok(total > before, `${step}: ${total} after ${before}`)
      before = total
      // The recap completes the chapter.
      if (shouldShowOnboardingResponse(step, p)) assert.equal(chapterFills(step, p, true)[here], 1)
    }
    assert.deepEqual(chapterFills('review', p), [1, 1, 1, 1, 1])
  }
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
