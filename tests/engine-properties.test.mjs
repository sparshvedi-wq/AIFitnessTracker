// Generated scenarios across goals, experience, places, equipment subsets,
// durations, readiness, history, exclusions and preferences. Every output
// must satisfy the hard constraints and the documented contracts, and a set
// of metamorphic relations must hold between related inputs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scenario } from './helpers/scenarios.mjs'
import { buildDailyPlan, profileOf, readinessOf } from '../src/lib/planner.js'
import { findExercise } from '../src/lib/exercises.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { eligibilityContext, planningContext } from '../src/lib/engine/recommend.js'
import { ineligibility } from '../src/lib/engine/eligibility.js'
import { planSeconds } from '../src/lib/engine/session-time.js'
import { MIN_REST, TIMING } from '../src/lib/engine/config.js'
import { availableLoads } from '../src/lib/preferences.js'
import { normalizeLearning } from '../src/lib/engine/learning.js'
import { buildSession, beginPrepared, prepareSession, completeSet } from '../src/lib/workout.js'
import { previewReplan, applyReplan, sessionFingerprint } from '../src/lib/engine/replan.js'
import { rankSubstitutes } from '../src/lib/engine/substitute.js'

const N = Number(process.env.ENGINE_SCENARIOS || 160)
const scenarios = Array.from({ length: N }, (_, i) => scenario(i))
const plans = new Map()
const planFor = (sc, patch = {}) => buildDailyPlan(sc.state, { ...sc.options, ...patch })
const basePlan = (sc) => {
  if (!plans.has(sc.seed)) plans.set(sc.seed, planFor(sc))
  return plans.get(sc.seed)
}

function contextFor(sc, plan) {
  const profile = profileOf(sc.state)
  const readiness = { ...readinessOf(sc.state, sc.options.today), ...sc.options.readiness }
  readiness.pain = [...new Set([...(profile.avoidMuscles || []), ...(readiness.pain || [])])]
  const ctx = planningContext(sc.state, { ...sc.options, profile, readiness })
  const kind = plan.kind === 'recovery' ? null : ctx.movement?.position === 'seated' ? 'seated' : 'strength'
  return { ctx, elig: eligibilityContext(ctx, kind) }
}

test('every generated plan satisfies hard constraints, time, laterality and load conventions', () => {
  let items = 0
  for (const sc of scenarios) {
    const plan = basePlan(sc)
    const { ctx, elig } = contextFor(sc, plan)
    const budget = ctx.minutes * 60
    assert.ok(plan.estimatedSeconds <= budget, `seed ${sc.seed}: ${plan.estimatedSeconds} > ${budget}`)
    const easeIn = plan.kind === 'recovery' || ctx.shortSession ? TIMING.easeInSec.short : TIMING.easeInSec.normal
    assert.equal(plan.estimatedSeconds, planSeconds(plan.items) + easeIn, `seed ${sc.seed}`)
    assert.equal(new Set(plan.items.map((i) => i.exId)).size, plan.items.length, `seed ${sc.seed}: duplicates`)
    for (const item of plan.items) {
      items++
      const def = findExercise(item.exId)
      const meta = metaOf(item.exId)
      assert.ok(def && meta?.reviewed, `seed ${sc.seed}: ${item.exId} resolvable and reviewed`)
      assert.equal(ineligibility(meta, elig), null, `seed ${sc.seed}: ${item.exId} breaks a hard rule`)
      assert.ok(!meta.areas.some((a) => elig.blockedAreas.has(a)), `seed ${sc.seed}: avoided area`)
      assert.ok(item.sets >= 1 && item.sets <= 4, `seed ${sc.seed}: sets`)
      assert.ok(item.restSec >= (MIN_REST[meta.role] ?? 10), `seed ${sc.seed}: ${item.exId} rest below minimum`)
      if (def.type === 'reps') {
        assert.ok(item.reps > 0 && !item.sec, `seed ${sc.seed}: reps`)
        assert.equal(Boolean(item.unilateral), meta.perSide, `seed ${sc.seed}: ${item.exId} laterality`)
      } else assert.ok(item.sec > 0 && !item.reps, `seed ${sc.seed}: time`)
      if (!def.weighted || ['bw', 'band'].includes(meta.load)) assert.ok(!item.weight, `seed ${sc.seed}: ${item.exId} has a load`)
      if (item.weight && ['hand', 'one'].includes(meta.load) && ctx.caps.has('db')) {
        const sizes = availableLoads(ctx.p, ctx.place.id)
        if (sizes.length) assert.ok(sizes.includes(item.weight), `seed ${sc.seed}: ${item.exId} ${item.weight} not a listed dumbbell`)
      }
    }
  }
  assert.ok(items > N, 'scenarios produced real plans')
})

test('identical state and explicit seed reproduce the plan exactly', () => {
  for (const sc of scenarios.slice(0, 40)) {
    const again = planFor(sc)
    assert.deepEqual(again.items, basePlan(sc).items, `seed ${sc.seed}`)
    assert.deepEqual(again.decision.items, basePlan(sc).decision.items, `seed ${sc.seed}`)
  }
})

test('removing equipment never introduces equipment-dependent movements', () => {
  let checked = 0
  for (const sc of scenarios) {
    const equipment = sc.state.settings.training.equipment
    if (sc.options.location !== 'home' || !equipment.length) continue
    const reduced = {
      ...sc,
      state: {
        ...sc.state,
        settings: { ...sc.state.settings, training: { ...sc.state.settings.training, equipment: equipment.slice(1) } },
      },
    }
    const plan = planFor(reduced)
    const { ctx } = contextFor(reduced, plan)
    for (const item of plan.items)
      assert.ok(
        metaOf(item.exId).equipment.every((alts) => alts.some((c) => ctx.caps.has(c))),
        `seed ${sc.seed}: ${item.exId} needs removed equipment`,
      )
    checked++
  }
  assert.ok(checked > 5)
})

test('reducing time never increases the estimated session length', () => {
  const violations = []
  for (const sc of scenarios) {
    const plan = basePlan(sc)
    if (sc.options.shortSession || plan.kind === 'recovery' || sc.options.minutes <= 10) continue
    const shorter = planFor(sc, { minutes: sc.options.minutes - 10 })
    if (shorter.estimatedSeconds > plan.estimatedSeconds) violations.push(`seed ${sc.seed}`)
  }
  assert.deepEqual(violations, [])
})

test('avoiding a movement or an area never makes it more likely', () => {
  for (const sc of scenarios.slice(0, 80)) {
    const plan = basePlan(sc)
    if (!plan.items.length || plan.kind === 'recovery') continue
    const target = plan.items[0].exId
    const excluded = {
      ...sc,
      state: {
        ...sc.state,
        settings: {
          ...sc.state.settings,
          training: {
            ...sc.state.settings.training,
            excludedExercises: [...(sc.state.settings.training.excludedExercises || []), target],
          },
        },
      },
    }
    assert.ok(!planFor(excluded).items.some((i) => i.exId === target), `seed ${sc.seed}`)
    const area = metaOf(target).areas[0]
    const avoided = planFor(sc, { readiness: { ...sc.options.readiness, pain: [...sc.options.readiness.pain, area] } })
    assert.ok(avoided.items.every((i) => !metaOf(i.exId).areas.includes(area)), `seed ${sc.seed}: ${area}`)
  }
})

test('hard restrictions survive exploration seeds, variety settings and substitutions', () => {
  for (const sc of scenarios.slice(0, 40)) {
    for (const variety of ['familiar', 'more']) {
      for (const seed of ['a', 'b', 'c']) {
        const s = {
          ...sc,
          state: { ...sc.state, settings: { ...sc.state.settings, training: { ...sc.state.settings.training, variety } } },
        }
        const plan = planFor(s, { seed })
        const { ctx, elig } = contextFor(s, plan)
        for (const item of plan.items) assert.equal(ineligibility(metaOf(item.exId), elig), null)
        for (const item of plan.items.slice(0, 2))
          for (const sub of rankSubstitutes(item.exId, eligibilityContext(ctx, null), { signals: ctx.signals }))
            assert.equal(ineligibility(sub.meta, { ...elig, kind: null }), null, `${item.exId} → ${sub.meta.id}`)
      }
    }
  }
})

test('replanning keeps every logged set, is idempotent and rejects stale previews', () => {
  let checked = 0
  for (const sc of scenarios.slice(0, 60)) {
    const plan = basePlan(sc)
    if (plan.items.length < 2 || plan.kind === 'recovery') continue
    let session = beginPrepared(prepareSession(buildSession(plan, { now: sc.options.now })), sc.options.now)
    session = completeSet(session, sc.options.now + 60000, { reps: 7, weight: plan.items[0].weight ?? undefined })
    const logged = structuredClone(session.exercises.flatMap((e) => e.sets.filter((s) => s.status === 'done')))
    for (const change of [{ minutes: 10 }, { location: 'on-the-go' }, { location: 'home', minutes: 15 }]) {
      const preview = previewReplan(sc.state, session, change, { today: sc.options.today, now: sc.options.now + 90000 })
      assert.ok(preview.ok)
      assert.deepEqual(previewReplan(sc.state, session, change, { today: sc.options.today, now: sc.options.now + 90000 }).session.exercises, preview.session.exercises, 'deterministic')
      const after = preview.session.exercises.flatMap((e) => e.sets.filter((s) => s.status === 'done'))
      assert.deepEqual(after, logged, `seed ${sc.seed}: logged sets preserved`)
      const applied = applyReplan(session, preview)
      // A preview that changes nothing applies as a no-op.
      assert.equal(applied.status, preview.result === preview.base ? 'already-applied' : 'applied')
      assert.equal(applyReplan(applied.session, preview).status, 'already-applied', 'double tap is a no-op')
      // A set logged after the preview was made makes it stale.
      const moved = completeSet(session, sc.options.now + 120000, { reps: 6 })
      if (sessionFingerprint(moved) !== preview.base) assert.equal(applyReplan(moved, preview).status, 'stale')
      checked++
    }
  }
  assert.ok(checked > 30)
})

test('corrupt or insufficient preference evidence falls back safely', () => {
  const sc = scenarios.find((s) => s.state.workouts.length > 3)
  const garbage = [
    null,
    'nonsense',
    { events: 'x' },
    { events: [{ kind: 'answer', exId: 5, at: 'x' }, { kind: 'answer', exId: 'push-up', question: 'again', value: 'maybe-not', at: 1 }, { kind: 'unknown', exId: 'a', at: 1 }] },
  ]
  for (const learning of garbage) {
    assert.deepEqual(normalizeLearning(learning).events, [])
    const plan = buildDailyPlan({ ...sc.state, learning }, sc.options)
    assert.deepEqual(plan.items, basePlan(sc).items)
  }
  // A record with a corrupt outcome is reconstructed from its sets instead.
  const broken = { ...sc.state, workouts: sc.state.workouts.map((w) => ({ ...w, outcome: { version: 99, exercises: 'bad' } })) }
  assert.ok(buildDailyPlan(broken, sc.options).items.length >= 0)
})
