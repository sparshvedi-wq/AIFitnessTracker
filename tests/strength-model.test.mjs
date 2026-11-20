// The adaptive strength model (src/lib/strength): the math, every kind of
// evidence, typo handling, equipment, manual fixes, the live workout layer,
// a fuzz test over hostile histories and a simulated lifter.
import test from 'node:test'
import assert from 'node:assert/strict'
import { findExercise } from '../src/lib/exercises.js'
import { metaOf } from '../src/lib/catalog/index.js'
import { rng } from '../src/lib/engine/rng.js'
import { anchorEvent, normalizeLearning, withLearningEvent } from '../src/lib/engine/learning.js'
import { buildSession, completeSet, toWorkoutRecord, updateSet } from '../src/lib/workout.js'
import { correctWorkout } from '../src/lib/workout-history.js'
import { fractionAt, repsAtFraction, kalmanUpdate, predictStep, diag } from '../src/lib/strength/math.js'
import { loadGrid } from '../src/lib/strength/loads.js'
import { exerciseBelief, beliefAt } from '../src/lib/strength/model.js'
import { strengthTarget, strengthFailures, strengthSummary, strengthGraphFor } from '../src/lib/strength/index.js'
import { exerciseProfile } from '../src/lib/strength/library.js'
import {
  adaptExercise,
  feelPrompt,
  liveContext,
  logShortSet,
  markTooHeavy,
  recordFeel,
  setWorkingWeight,
} from '../src/lib/strength/session.js'
import { JUMP, EXTRA_REPS_BEFORE_JUMP } from '../src/lib/strength/config.js'

const DAY = 86400000
const at = (date, hour = 18, minute = 0) => new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`).getTime()
const day = (i) => new Date(Date.UTC(2026, 8, 1) + i * DAY).toISOString().slice(0, 10)
const rec = (id, date, exId, sets, extra = {}) => {
  const def = findExercise(exId)
  return {
    id,
    date,
    startedAt: at(date),
    endedAt: at(date) + 3600000,
    unit: 'lb',
    kind: 'adaptive',
    exercises: [{ exId, name: def.name, type: def.type, weighted: def.weighted, sets }],
    ...extra,
  }
}
const s = (reps, weight, extra = {}) => ({ kind: 'work', reps, weight, targetReps: reps, ...extra })
const base = { unit: 'lb', goal: 'Build muscle', experience: 'Some experience', sets: 3 }
const target = (exId, workouts, date, extra = {}) =>
  strengthTarget({ ...base, exId, workouts, today: date, now: at(date, 7), ...extra })
// A history of identical sessions every other day.
const repeated = (exId, n, sets, extra = {}) => Array.from({ length: n }, (_, i) => rec(`${exId}-${i}`, day(i * 2), exId, sets, extra))

// ── Math ─────────────────────────────────────────────────────────────────

test('the rep–load curve is monotone and exactly invertible', () => {
  for (const k of [18, 28, 32, 48]) {
    assert.equal(fractionAt(1, k), 1)
    let prev = 2
    for (let r = 1; r <= 40; r++) {
      const f = fractionAt(r, k)
      assert.ok(f < prev && f > 0, `decreasing at ${r}`)
      prev = f
      assert.ok(Math.abs(repsAtFraction(f, k) - r) < 1e-9, `inverse at ${r}`)
    }
  }
  // Near Epley at ten reps (about 75% of a max).
  assert.ok(Math.abs(fractionAt(10, 29) - 0.763) < 0.01)
})

test('Kalman steps keep the covariance symmetric and positive under many updates', () => {
  const random = rng('kalman')
  let x = [Math.log(100), 0.005, Math.log(29)]
  let P = diag([0.04, 0.0001, 0.02])
  for (let i = 0; i < 3000; i++) {
    ;({ x, P } = predictStep(x, P, [[1, 1, 0], [0, 0.85, 0], [0, 0, 1]], [0, 0.001, 0], [1e-4, 1e-5, 0]))
    const H = [1, 0, random() * 0.4]
    ;({ x, P } = kalmanUpdate(x, P, H, (random() - 0.5) * 0.2, 0.001 + random() * 0.01))
    for (let a = 0; a < 3; a++) {
      assert.ok(P[a][a] > 0 && Number.isFinite(P[a][a]))
      for (let b = 0; b < 3; b++) assert.ok(Math.abs(P[a][b] - P[b][a]) < 1e-12)
    }
    assert.ok(P[0][0] * P[1][1] - P[0][1] ** 2 > -1e-15, 'positive 2×2 minor')
  }
})

// ── Equipment ────────────────────────────────────────────────────────────

test('load grids only offer weights that can be loaded', () => {
  const listed = loadGrid({ load: 'hand', unit: 'lb', sizes: [25, 10, 15, 10], used: [27.5] })
  assert.deepEqual(listed.between(0, 100), [10, 15, 25], 'listed dumbbells exactly, logged extras ignored')
  assert.equal(listed.next(15, 1), 25)
  assert.equal(listed.next(25, 1), null)
  assert.equal(listed.atMost(12), 10)
  const bar = loadGrid({ load: 'bar', unit: 'lb' })
  assert.equal(bar.min, 45, 'never below the empty bar')
  assert.ok(bar.between(0, 100).every((w) => w >= 45 && (w - 45) % 5 === 0))
  const barKg = loadGrid({ load: 'bar', unit: 'kg' })
  assert.equal(barKg.min, 20)
  assert.ok(barKg.between(20, 40).every((w) => Math.abs(((w - 20) / 2.5) % 1) < 1e-9))
  const rack = loadGrid({ load: 'hand', unit: 'lb', used: [17.5] })
  assert.ok(rack.has(17.5), 'a weight logged before stays available')
  assert.ok(rack.has(20) && !rack.has(21))
  const stack = loadGrid({ load: 'stack', unit: 'lb' })
  assert.equal(stack.next(40, 1), 45)
})

// ── Evidence ─────────────────────────────────────────────────────────────

test('just tapping Done never ratchets the estimate: progress follows the experience prior', () => {
  const history = repeated('lat-pulldown', 20, [s(10, 100), s(10, 100), s(10, 100)])
  const first = exerciseBelief({ workouts: history.slice(0, 1), exId: 'lat-pulldown', def: findExercise('lat-pulldown'), unit: 'lb', today: day(40), now: at(day(0), 20), experience: 'Some experience' })
  const last = exerciseBelief({ workouts: history, exId: 'lat-pulldown', def: findExercise('lat-pulldown'), unit: 'lb', today: day(40), now: at(day(40)), experience: 'Some experience' })
  const growth = Math.exp(beliefAt(last, at(day(38), 20)).level - beliefAt(first, at(day(0), 20)).level)
  // 19 sessions at the 0.5%/session prior is about +10%; the old ratchet gave far more.
  assert.ok(growth > 1.02 && growth < 1.13, `growth ${growth}`)
})

test('answers move the next plan in the direction they say', () => {
  const plan = (feel) => target('db-bench', repeated('db-bench', 4, [s(10, 50, { feel }), s(10, 50, { feel }), s(10, 50, { feel })]), day(9))
  const easy = plan('easy')
  const good = plan('good')
  const hard = plan('hard')
  const load = (p) => p.weight * (1 + p.reps / 30)
  assert.ok(load(easy) > load(good), `easy ${easy.weight}x${easy.reps} vs good ${good.weight}x${good.reps}`)
  // Whole reps can tie; the reps-in-reserve the plan expects still moves.
  assert.ok(load(good) >= load(hard), `good vs hard ${hard.weight}x${hard.reps}`)
  assert.ok(good.predictedRir > hard.predictedRir || load(good) > load(hard), `${good.predictedRir} vs ${hard.predictedRir}`)
})

test('a failed set lowers the next plan into a doable range', () => {
  const p = target('biceps-curl', [rec('a', day(0), 'biceps-curl', [s(7, 20, { feel: 'failed', targetReps: 10 })])], day(2))
  assert.ok(p.weight < 20, `${p.weight}`)
  assert.ok(p.reps >= p.range[0] && p.reps <= p.range[1] + EXTRA_REPS_BEFORE_JUMP)
  assert.equal(p.code, 'load-down')
})

test('fewer reps than planned without an answer counts as close to failure', () => {
  const hit = target('db-bench', repeated('db-bench', 3, [s(10, 50), s(10, 50), s(10, 50)]), day(7))
  const missed = target('db-bench', repeated('db-bench', 3, [s(10, 50), s(8, 50, { targetReps: 10 }), s(7, 50, { targetReps: 10 })]), day(7))
  assert.ok(missed.weight * (1 + missed.reps / 30) < hit.weight * (1 + hit.reps / 30))
})

test('"too heavy to start" attempts pull the estimate below that weight', () => {
  const history = [
    ...repeated('db-bench', 3, [s(10, 40), s(10, 40), s(10, 40)]),
    rec('x', day(6), 'db-bench', [s(10, 40)], {}),
  ]
  history[3].exercises[0].attempts = [{ weight: 60, setIndex: 1, unit: 'lb' }]
  const summary = strengthSummary({ ...base, exId: 'db-bench', workouts: history, today: day(8), now: at(day(8)) })
  assert.ok(summary.oneRepMax < 60, `${summary.oneRepMax}`)
})

test('typos are set aside and reported, never trusted', () => {
  const clean = repeated('db-bench', 6, [s(10, 40, { feel: 'good' }), s(10, 40), s(10, 40)])
  const tenX = [...clean, rec('typo', day(12), 'db-bench', [s(10, 400), s(10, 40), s(10, 40)])]
  const twoX = [...clean, rec('typo2', day(12), 'db-bench', [s(10, 140), s(10, 40), s(10, 40)])]
  const a = target('db-bench', clean, day(14))
  for (const history of [tenX, twoX]) {
    const b = target('db-bench', history, day(14))
    assert.equal(b.weight, a.weight, 'the plan is unchanged')
    const summary = strengthSummary({ ...base, exId: 'db-bench', workouts: history, today: day(14), now: at(day(14)) })
    assert.ok(summary.rejected.length >= 1, 'the odd set is reported so it can be fixed')
  }
  // Garbage values never break anything.
  const junk = [...clean, rec('junk', day(12), 'db-bench', [s('ten', 40), s(10, -5), s(NaN, 40), s(10, Infinity), s(0, 40), { kind: 'work' }, null])]
  const c = target('db-bench', junk, day(14))
  assert.equal(c.weight, a.weight)
})

test('kilograms and pounds describe the same strength', () => {
  const lb = repeated('db-bench', 4, [s(10, 44.092452, { feel: 'good' }), s(10, 44.092452)])
  const kg = repeated('db-bench', 4, [s(10, 20, { feel: 'good' }), s(10, 20)], { unit: 'kg' })
  const a = strengthSummary({ ...base, exId: 'db-bench', workouts: lb, today: day(9), now: at(day(9)) })
  const b = strengthSummary({ ...base, exId: 'db-bench', workouts: kg, today: day(9), now: at(day(9)) })
  assert.ok(Math.abs(a.oneRepMax - b.oneRepMax) < 0.2)
  const inKg = strengthSummary({ ...base, unit: 'kg', exId: 'db-bench', workouts: lb, today: day(9), now: at(day(9)) })
  assert.ok(Math.abs(inKg.oneRepMax * 2.20462 - a.oneRepMax) < 0.3)
})

// ── Equipment-aware plans ───────────────────────────────────────────────

test('listed dumbbells are respected and a big jump earns reps first', () => {
  const history = repeated('lateral-raise', 3, [s(15, 10, { feel: 'easy' }), s(15, 10, { feel: 'easy' })])
  const p = target('lateral-raise', history, day(7), { sizes: [5, 10, 20] })
  assert.ok([5, 10, 20].includes(p.weight))
  // 10 → 20 is +100%: only if the person can really do the range there.
  if (p.weight === 20) assert.ok(p.reps >= p.range[0])
  else assert.ok(p.reps <= p.range[1] + EXTRA_REPS_BEFORE_JUMP)
})

test('barbell plans never go below the bar and use plate steps', () => {
  const history = repeated('bench-press', 3, [s(8, 45, { feel: 'failed' }), s(6, 45, { feel: 'failed' })])
  const p = target('bench-press', history, day(7))
  assert.ok(p.weight >= 45 && (p.weight - 45) % 5 === 0)
  assert.ok(p.flags.includes('lightest-is-heavy') || p.reps >= p.range[0])
})

test('increases stay within the jump limits and holds never increase', () => {
  const history = repeated('lat-pulldown', 4, [s(12, 100, { feel: 'easy' }), s(12, 100, { feel: 'easy' }), s(12, 100, { feel: 'easy' })])
  const p = target('lat-pulldown', history, day(9))
  const grid = loadGrid({ load: 'stack', unit: 'lb' })
  const smallest = grid.next(100, 1)
  assert.ok(p.weight <= 100 * (1 + JUMP.free) + 1e-9 || p.weight === smallest)
  const held = target('lat-pulldown', history, day(9), { noIncrease: true })
  assert.ok(held.weight <= 100 && held.reps <= 12)
})

test('returning after a month eases off: lighter weight, reps in range', () => {
  const history = repeated('db-bench', 4, [s(10, 50), s(10, 50), s(10, 50)])
  const p = target('db-bench', history, day(40), { returning: true })
  assert.ok(p.weight < 50)
  assert.ok(p.reps >= p.range[0] && p.reps <= p.range[1])
})

test('bodyweight exercises progress gently in reps and say when they are outgrown', () => {
  const history = repeated('push-up', 3, [s(12, null, { feel: 'good' }), s(11, null)])
  const p = target('push-up', history, day(7))
  assert.equal(p.weight, null)
  assert.ok(p.reps <= 12 + 3)
  const strong = repeated('push-up', 3, [s(30, null, { feel: 'easy' })])
  assert.ok(target('push-up', strong, day(7)).flags.includes('outgrown'))
})

test('a new exercise starts from a careful guess borrowed from a close relative', () => {
  const history = repeated('db-bench', 4, [s(10, 50, { feel: 'good' }), s(10, 50), s(10, 50)])
  const own = target('db-bench', history, day(9))
  const guess = target('db-floor-press', history, day(9))
  assert.equal(guess.code, 'estimated-start')
  assert.ok(guess.weight > 0 && guess.weight < own.weight, `${guess.weight} vs ${own.weight}`)
  assert.equal(target('lateral-raise', history, day(9)).weight, null, 'unrelated exercises still ask')
})

test('timed exercises stay on their simple rules; assisted machines are modelled', () => {
  assert.equal(target('plank', [], day(1)), null)
  const assisted = target('assisted-pull-up', [], day(1))
  assert.equal(assisted.mode, 'assist')
  assert.equal(assisted.weight, null, 'no evidence yet: ask for a starting setting')
})

// ── Manual fixes ─────────────────────────────────────────────────────────

test('"set my working weight" replaces what was learned, and can be undone by setting again', () => {
  const history = repeated('db-bench', 5, [s(10, 50, { feel: 'good' }), s(10, 50), s(10, 50)])
  const learning = withLearningEvent(null, anchorEvent({ exId: 'db-bench', at: at(day(10), 6), weight: 30, reps: 10, unit: 'lb' }))
  const p = target('db-bench', history, day(10), { learning })
  assert.ok(p.weight >= 25 && p.weight <= 35, `${p.weight}`)
  const recalibrate = withLearningEvent(null, anchorEvent({ exId: 'db-bench', at: at(day(10), 6) }))
  assert.equal(target('db-bench', history, day(10), { learning: recalibrate }).code, 'no-history')
  // Later sessions after the anchor are learned from again.
  const after = [...history, ...repeated('db-bench', 1, [s(10, 30), s(10, 30)]).map((r) => ({ ...r, id: 'late', date: day(11), startedAt: at(day(11)), endedAt: at(day(11)) + 1 }))]
  assert.equal(target('db-bench', after, day(12), { learning }).facts.from, 30)
})

test('saved anchors are validated and broken numbers are dropped', () => {
  const learning = normalizeLearning({
    events: [
      { kind: 'anchor', exId: 'db-bench', at: 1, weight: 30, reps: 10, unit: 'lb' },
      { kind: 'anchor', exId: 'db-bench', at: 2, weight: -3, reps: 10, unit: 'lb' },
      { kind: 'anchor', exId: 'db-bench', at: 3, weight: 30, reps: 0, unit: 'lb' },
      { kind: 'anchor', exId: 'db-bench', at: 4, weight: 30, reps: 8, unit: 'stone' },
      { kind: 'anchor', exId: 'push-up', at: 5, reps: 12 },
      { kind: 'anchor', exId: 'db-row', at: 6 },
    ],
  })
  assert.deepEqual(
    learning.events.map((e) => [e.exId, e.weight ?? null, e.reps ?? null]),
    [['db-bench', 30, 10], ['push-up', null, 12], ['db-row', null, null]],
  )
})

test('editing a past workout corrects the estimate', () => {
  const history = repeated('db-bench', 4, [s(10, 50, { feel: 'good' }), s(10, 50)])
  const before = target('db-bench', history, day(9))
  const fixed = correctWorkout(history[3], { date: history[3].date, note: '', exercises: history[3].exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, weight: 30 })) })) }, day(9))
  const after = target('db-bench', [...history.slice(0, 3), fixed], day(9))
  assert.notDeepEqual([after.weight, after.reps], [before.weight, before.reps])
})

// ── Determinism and fuzzing ─────────────────────────────────────────────

const FUZZ_IDS = ['db-bench', 'biceps-curl', 'bench-press', 'lat-pulldown', 'push-up', 'goblet-squat', 'leg-press', 'lateral-raise', 'band-row', 'triceps-pushdown']
const FEELS = ['easy', 'good', 'hard', 'failed', undefined, undefined, 'nonsense']
function hostileHistory(seed) {
  const random = rng(`hostile-${seed}`)
  const pick = (list) => list[Math.floor(random() * list.length)]
  const out = []
  let t = 0
  for (let i = 0; i < 2 + Math.floor(random() * 25); i++) {
    t += Math.floor(random() * 20)
    const exId = pick(FUZZ_IDS)
    const def = findExercise(exId)
    const sets = Array.from({ length: Math.floor(random() * 6) }, () => {
      const roll = random()
      const weight = !def.weighted ? null : roll < 0.03 ? pick([NaN, -10, 0, 99999, '25', null]) : Math.round((5 + random() * 150) * 2) / 2
      const reps = roll > 0.97 ? pick([0, -1, 1.5, 500, NaN, '8']) : 1 + Math.floor(random() * 25)
      return { kind: random() < 0.1 ? 'warmup' : 'work', reps, weight, targetReps: random() < 0.8 ? 8 + Math.floor(random() * 6) : undefined, feel: pick(FEELS), status: random() < 0.05 ? 'skipped' : undefined }
    })
    const r = rec(`h${seed}-${i}`, day(t), exId, sets, { unit: random() < 0.15 ? 'kg' : 'lb', effort: pick([1, 2, 3, 4, null, 'x']) })
    if (random() < 0.1) r.exercises[0].attempts = [{ weight: pick([20, 400, NaN, null]), setIndex: Math.floor(random() * 4) }]
    if (random() < 0.05) r.exercises[0].calibratedFrom = Math.floor(random() * 3)
    out.push(r)
  }
  return { out, end: t + 1 + Math.floor(random() * 60), random }
}

test('fuzz: hostile histories always give sane, bounded, deterministic plans', () => {
  const failuresBefore = strengthFailures()
  const N = Number(process.env.STRENGTH_FUZZ || 400)
  let planned = 0
  for (let seed = 0; seed < N; seed++) {
    const { out, end, random } = hostileHistory(seed)
    const sizes = random() < 0.3 ? [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] : []
    for (const exId of FUZZ_IDS) {
      const args = { exId, workouts: out, today: day(end), unit: random() < 0.2 ? 'kg' : 'lb', sizes, easy: random() < 0.2, returning: random() < 0.1, experience: ['Starting out', 'Some experience', 'Experienced'][seed % 3], goal: ['Build muscle', 'Get stronger', 'Lose weight', 'General fitness'][seed % 4] }
      const p = target(exId, out, day(end), args)
      const again = target(exId, [...out].reverse(), day(end), args)
      assert.deepEqual(again, p, `seed ${seed} ${exId}: order of saved records must not matter`)
      if (!p) continue
      planned++
      assert.ok(Number.isInteger(p.reps) && p.reps >= 1 && p.reps <= 60, `seed ${seed} ${exId} reps ${p.reps}`)
      const meta = metaOf(exId)
      if (findExercise(exId).weighted && p.weight !== null) {
        assert.ok(Number.isFinite(p.weight) && p.weight > 0, `seed ${seed} ${exId} weight ${p.weight}`)
        if (sizes.length && ['hand', 'one'].includes(meta.load)) assert.ok(sizes.includes(p.weight), `seed ${seed} ${exId}: ${p.weight} not listed`)
        // The person's own logged weights are always loadable (an EZ bar, odd plates).
        const tied = exerciseProfile(exId)?.tie
        const used = tied
          ? strengthGraphFor({ ...base, ...args, workouts: out, now: at(day(end), 7) }).G.exercises.get(exId)?.used || []
          : exerciseBelief({ workouts: out, exId, def: findExercise(exId), meta, unit: args.unit, today: day(end), now: at(day(end), 7), experience: args.experience })?.used || []
        const logged = (w) => used.some((u) => Math.abs(u - w) < 1e-6)
        if (meta.load === "bar") assert.ok(p.weight >= (args.unit === "kg" ? 7 : 15) - 1e-9 && (p.weight >= (args.unit === "kg" ? 20 : 45) - 1e-9 || logged(p.weight)), `seed ${seed}: ${p.weight} below the bar`)
        if (!sizes.length || !['hand', 'one'].includes(meta.load)) {
          const grid = loadGrid({ load: meta.load, unit: args.unit, used })
          assert.ok(grid.has(p.weight), `seed ${seed} ${exId}: ${p.weight} is not a loadable weight`)
        }
        const from = p.facts?.from
        if (Number.isFinite(from) && from > 0 && p.weight > from + 1e-6) {
          const grid = loadGrid({ load: meta.load, unit: args.unit, sizes: ['hand', 'one'].includes(meta.load) ? sizes : [], used })
          const smallest = grid.next(grid.has(from) ? from : grid.atMost(from), 1)
          // Allowed: a small step, the next loadable weight, or the lightest weight there is.
          // At most +10% (+25% of the added weight when bodyweight carries most of the
          // load), unless it is the very next loadable weight or the lightest there is.
          const limit = exerciseProfile(exId)?.bw > 0 ? JUMP.smallestStepMax : JUMP.free
          const ok = p.weight <= from * (1 + limit) + 1e-6 || Math.abs(p.weight - smallest) < 1e-6 || Math.abs(p.weight - grid.min) < 1e-6
          assert.ok(ok, `seed ${seed} ${exId}: jump ${from} → ${p.weight} (next loadable ${smallest}; used ${used.join(', ')})`)
        }
      } else assert.equal(p.weight, null)
    }
  }
  assert.ok(planned > N, 'the fuzz produced real plans')
  assert.equal(strengthFailures(), failuresBefore, 'the model never fell back because of an internal error')
})

// ── A simulated lifter ───────────────────────────────────────────────────

test('a simulated lifter converges: few failed sets, steady progress, no sawtooth', () => {
  for (const [exId, start, experience] of [['bench-press', 150, 'Some experience'], ['db-bench', 55, 'Starting out'], ['lat-pulldown', 120, 'Experienced']]) {
    let true1rm = start
    const history = []
    let failures = 0
    let plans = 0
    let biggestJump = 0
    let lastWeight = null
    for (let i = 0; i < 36; i++) {
      const date = day(i * 2)
      const p = target(exId, history, date, { experience, goal: 'Get stronger' }) || { weight: null, reps: 8 }
      const weight = p.weight ?? Math.round((true1rm * 0.6) / 5) * 5
      if (lastWeight) biggestJump = Math.max(biggestJump, weight / lastWeight - 1)
      lastWeight = weight
      // What this person can really do today at that weight (to failure), with set fatigue.
      const sets = []
      for (let j = 0; j < 3; j++) {
        const capacity = Math.floor(repsAtFraction(weight / (true1rm * (1 - 0.015 * j)), 29))
        const reps = Math.min(p.reps, capacity)
        const rir = capacity - reps
        const feel = reps < p.reps ? 'failed' : j === 0 || j === 2 ? (rir >= 4 ? 'easy' : rir <= 1 ? 'hard' : 'good') : undefined
        if (reps < p.reps) failures++
        sets.push(s(Math.max(1, reps), weight, { targetReps: p.reps, feel }))
      }
      plans++
      history.push(rec(`${exId}-${i}`, date, exId, sets))
      true1rm *= 1.006
    }
    assert.ok(failures / (plans * 3) < 0.12, `${exId}: ${failures} failed sets of ${plans * 3}`)
    assert.ok(biggestJump <= 0.26, `${exId}: biggest jump ${biggestJump}`)
    const final = strengthSummary({ ...base, experience, exId, workouts: history, today: day(80), now: at(day(72), 7) })
    const truth = start * 1.006 ** 36
    assert.ok(Math.abs(final.oneRepMax / truth - 1) < 0.12, `${exId}: estimate ${final.oneRepMax} vs true ${truth.toFixed(1)}`)
  }
})

// ── The live workout ────────────────────────────────────────────────────

function liveSession(exId, sets = 3, weight = 50, reps = 10) {
  const session = buildSession({ id: 'r', lockedTargets: true, items: [{ exId, sets, reps, weight, restSec: 60, repRange: [8, 12], targetRir: 2 }] }, { now: at(day(20), 17) })
  return { ...session, phase: 'work', startedAt: at(day(20), 17), cursor: { ex: 0, set: session.exercises[0].sets[0].kind === 'warmup' ? 1 : 0 } }
}
const ctxFor = (workouts = [], extra = {}) => liveContext({ workouts, learning: null, unit: 'lb', now: at(day(20), 17, 30), today: day(20), goal: 'Build muscle', experience: 'Some experience', readiness: {}, sizes: [], ...extra })
const workSets = (session) => session.exercises[0].sets.filter((x) => x.kind !== 'warmup')

test('live: a hard first set lightens what is left; an easy one adds; good keeps it', () => {
  const history = repeated('db-bench', 4, [s(10, 50, { feel: 'good' }), s(10, 50), s(10, 50)])
  const ctx = ctxFor(history)
  const logged = completeSet(liveSession('db-bench'), at(day(20), 17, 40))
  const c = logged.lastLogged
  assert.deepEqual(feelPrompt(logged), c, 'asks after the first set')
  const load = (x) => x.weight * (1 + x.reps / 30)
  const nextOf = (session) => workSets(session).find((x) => x.status === 'todo')
  const hard = recordFeel(logged, c, 'hard', ctx)
  const easy = recordFeel(logged, c, 'easy', ctx)
  const good = recordFeel(logged, c, 'good', ctx)
  assert.ok(load(nextOf(hard)) < load(nextOf(logged)), 'hard lightens')
  assert.ok(load(nextOf(easy)) > load(nextOf(logged)), 'easy adds')
  assert.equal(load(nextOf(good)), load(nextOf(logged)), 'good keeps the plan')
  assert.equal(workSets(hard)[0].feel, 'hard', 'the answer is kept on the set')
  assert.ok(hard.exercises[0].adjusted.text)
  // Middle sets are not asked about unless something changed.
  const second = completeSet(good, at(day(20), 17, 45))
  assert.equal(feelPrompt(second), null)
})

test('live: "I couldn\'t finish" logs the real reps as a failed set and lightens the rest', () => {
  const ctx = ctxFor(repeated('db-bench', 3, [s(10, 50), s(10, 50)]))
  const next = logShortSet(liveSession('db-bench'), 6, ctx, at(day(20), 17, 40))
  const [first, ...rest] = workSets(next)
  assert.equal(first.status, 'done')
  assert.equal(first.reps, 6)
  assert.equal(first.feel, 'failed')
  assert.ok(rest.every((x) => x.weight * (1 + x.reps / 30) < 50 * (1 + 10 / 30)))
  const record = toWorkoutRecord({ ...next, startedAt: at(day(20), 17) }, [], { now: at(day(20), 18) })
  assert.equal(record.exercises[0].sets.find((x) => x.kind === 'work').feel, 'failed', 'saved with the record')
})

test('live: "too heavy to start" lightens the current set, with or without history', () => {
  for (const history of [[], repeated('db-bench', 3, [s(10, 50), s(10, 50)])]) {
    const session = liveSession('db-bench', 3, 50)
    const next = markTooHeavy(session, ctxFor(history), at(day(20), 17, 35))
    const current = next.exercises[0].sets[next.cursor.set]
    assert.equal(current.status, 'todo')
    assert.ok(current.weight < 50, `${current.weight}`)
    assert.equal(next.exercises[0].attempts.length, 1)
    const record = toWorkoutRecord({ ...completeSet(next, at(day(20), 17, 50)), startedAt: at(day(20), 17) }, [], { now: at(day(20), 18) })
    assert.equal(record.exercises[0].attempts[0].weight, 50, 'the attempt is saved as evidence')
  }
})

test('live: "too heavy" is a hard limit for today, even after contradicting sets', () => {
  // A first-time exercise: 25 × 10 felt hard, 25 × 5 failed, then 20 was too heavy to lift.
  let session = liveSession('db-row', 4, 25, 10)
  const ctx = ctxFor([])
  session = recordFeel(completeSet(session, at(day(20), 17, 31)), { ex: 0, set: session.cursor.set }, 'hard', ctx)
  session = logShortSet(session, 5, ctx, at(day(20), 17, 33))
  session = { ...session, phase: 'work', cursor: { ex: 0, set: session.exercises[0].sets.findIndex((x) => x.status === 'todo') } }
  session = { ...session, exercises: [{ ...session.exercises[0], sets: session.exercises[0].sets.map((x) => (x.status === 'todo' ? { ...x, weight: 20 } : x)) }] }
  const next = markTooHeavy(session, ctx, at(day(20), 17, 35))
  const current = next.exercises[0].sets[next.cursor.set]
  assert.ok(current.weight < 20, `${current.weight}`)
  // At most what a max below 20 allows at that weight, with reps in reserve.
  const ceiling = Math.floor(repsAtFraction(current.weight / 20, 28))
  assert.ok(current.reps <= ceiling, `${current.weight} × ${current.reps} (no more than ${ceiling} possible)`)
})

test('live: contradicting sets never teach a wild rep endurance (the case found in the app)', () => {
  // Exactly what happened in a manual run: 25 × 10 "hard", 25 × 5 failed,
  // then 20 too heavy. The old model answered 15 × 15 by inflating endurance.
  const ex = {
    key: 'k', exId: 'db-row', name: 'One-arm dumbbell row', type: 'reps', weighted: true, unilateral: true, repRange: [8, 12], targetRir: 2, restSec: 60,
    sets: [
      { targetReps: 10, reps: 10, weight: 25, status: 'done', kind: 'work', manual: true, feel: 'hard' },
      { targetReps: 8, targetWeight: 25, reps: 5, weight: 25, status: 'done', kind: 'work', feel: 'failed' },
      { targetReps: 11, targetWeight: 20, reps: 11, weight: 20, status: 'todo', kind: 'work' },
    ],
  }
  const session = { id: 's', kind: 'adaptive', unit: 'lb', exercises: [ex], cursor: { ex: 0, set: 2 }, phase: 'work' }
  const next = markTooHeavy(session, ctxFor([]), at(day(20), 17, 35))
  const current = next.exercises[0].sets[2]
  assert.ok(current.weight < 20)
  assert.ok(current.reps <= Math.floor(repsAtFraction(current.weight / 20, 28)), `${current.weight} × ${current.reps}`)
  // And saved, that session leaves endurance inside its limits.
  const record = { ...toWorkoutRecord({ ...completeSet(next, at(day(20), 17, 40)), startedAt: at(day(20), 17) }, [], { now: at(day(20), 18) }), date: day(20) }
  const belief = exerciseBelief({ workouts: [record], exId: 'db-row', def: findExercise('db-row'), unit: 'lb', today: day(21), now: at(day(21)), experience: 'Some experience' })
  const k = beliefAt(belief, at(day(21))).k
  assert.ok(k >= 24 && k <= 34, `endurance ${k}`)
})

test('live: numbers someone typed are never overwritten, and they get asked how it felt', () => {
  const ctx = ctxFor(repeated('db-bench', 3, [s(10, 50), s(10, 50)]))
  let session = liveSession('db-bench')
  // Typed numbers for set 2 (the app marks typed sets as manual).
  const second = session.exercises[0].sets.findIndex((x, i) => x.kind !== 'warmup' && i > session.cursor.set)
  session = { ...session, exercises: [{ ...session.exercises[0], sets: session.exercises[0].sets.map((x, i) => (i === second ? { ...x, weight: 55, reps: 9, manual: true } : x)) }] }
  const logged = completeSet(session, at(day(20), 17, 40))
  const hard = recordFeel(logged, logged.lastLogged, 'hard', ctx)
  assert.deepEqual([hard.exercises[0].sets[second].weight, hard.exercises[0].sets[second].reps], [55, 9])
  const typedNow = completeSet(updateSet(hard, { weight: 45, manual: true }), at(day(20), 17, 50))
  assert.ok(feelPrompt(typedNow), 'a typed set is followed by the comfort question')
})

test('live: "set my working weight" saves a valid anchor and uses exactly those numbers next', () => {
  const ctx = ctxFor(repeated('db-bench', 3, [s(10, 50), s(10, 50)]))
  const session = completeSet(liveSession('db-bench'), at(day(20), 17, 40))
  const { session: next, event } = setWorkingWeight(session, 0, { weight: 30, reps: 12 }, ctx, at(day(20), 17, 45))
  assert.equal(normalizeLearning({ events: [event] }).events.length, 1)
  assert.equal(next.exercises[0].calibratedFrom, 1)
  const todo = workSets(next).filter((x) => x.status === 'todo')
  assert.ok(todo.every((x) => x.weight === 30 && x.reps === 12), todo.map((x) => `${x.weight}×${x.reps}`).join())
  // A later "easy" never lowers the stated numbers. (Open item: it should
  // also raise them within the same workout; today it can stay at 30 × 12.)
  const learning = withLearningEvent(null, event)
  const logged = completeSet(next, at(day(20), 17, 50))
  const easy = recordFeel(logged, logged.lastLogged, 'easy', { ...ctx, learning, now: at(day(20), 17, 51) })
  const after = workSets(easy).find((x) => x.status === 'todo')
  assert.ok(after.weight * (1 + after.reps / 30) >= 30 * (1 + 12 / 30), `${after.weight}×${after.reps}`)
  const cleared = setWorkingWeight(session, 0, {}, ctx, at(day(20), 17, 45))
  assert.ok(workSets(cleared.session).filter((x) => x.status === 'todo').every((x) => x.weight === null), 'recalibrate asks for a weight again')
})

test('live: plain Done taps leave the plan alone', () => {
  const ctx = ctxFor(repeated('db-bench', 4, [s(10, 50, { feel: 'good' }), s(10, 50)]))
  const session = liveSession('db-bench')
  const logged = completeSet(session, at(day(20), 17, 40))
  const adapted = adaptExercise(logged, 0, ctx, { reason: 'logged' })
  assert.equal(adapted, logged)
})

test('routines get model weights but keep their own rep count', () => {
  const history = repeated('db-bench', 4, [s(8, 50, { feel: 'easy' }), s(8, 50, { feel: 'easy' })])
  const session = buildSession(
    { id: 'mine', items: [{ exId: 'db-bench', sets: 3, reps: 8, restSec: 90 }] },
    { workouts: history, now: at(day(9)), dumbbellWeights: [40, 45, 50, 55, 60], strength: { goal: 'Build muscle', experience: 'Some experience', today: day(9) } },
  )
  const work = session.exercises[0].sets.filter((x) => x.kind === 'work')
  assert.ok([40, 45, 50, 55, 60].includes(work[0].weight))
  assert.ok(work[0].reps >= 8 && work[0].reps <= 8 + EXTRA_REPS_BEFORE_JUMP)
  assert.deepEqual(session.exercises[0].repRange, [8, 8])
})
