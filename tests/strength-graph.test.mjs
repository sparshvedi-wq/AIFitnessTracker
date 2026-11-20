// The exercise library, the shared fatigue model and the strength graph that
// ties every exercise together: invariants, the situations people actually
// hit, incremental updates, and simulated lifters whose true strength (per
// muscle, per exercise, per rep curve) the app never sees.
import test from 'node:test'
import assert from 'node:assert/strict'
import { allMeta } from '../src/lib/catalog/index.js'
import { findExercise } from '../src/lib/exercises.js'
import { rng } from '../src/lib/engine/rng.js'
import { buildDailyPlan } from '../src/lib/planner.js'
import { makeUser } from './helpers/engine-sim.mjs'
import {
  ANCHORS,
  MUSCLES,
  RECOVERY_HALF_LIFE_HOURS,
  effectiveLoad,
  exerciseProfile,
  loggedFor,
  relatedExercises,
  similarity,
  tiedExercises,
} from '../src/lib/strength/library.js'
import { addSetFatigue, availability, decayFatigue, emptyFatigue, readiness } from '../src/lib/strength/recovery.js'
import { buildGraph, extendGraph, graphRecords } from '../src/lib/strength/graph.js'
import { strengthFailures, strengthGraphFor, strengthSummary, strengthTarget } from '../src/lib/strength/index.js'
import { liveContext, logShortSet, recordFeel } from '../src/lib/strength/session.js'
import { buildSession, completeSet, currentSet, finish, toWorkoutRecord, updateSet } from '../src/lib/workout.js'
import { repsAtFraction } from '../src/lib/strength/math.js'

const DAY = 86400000
const at = (date, hour = 18, minute = 0) => new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime()
const day = (i) => new Date(Date.UTC(2026, 8, 1) + i * DAY).toISOString().slice(0, 10)
const s = (reps, weight, extra = {}) => ({ kind: 'work', reps, weight, targetReps: reps, ...extra })
const rec = (i, exercises, extra = {}) => ({
  id: `r${i}-${exercises.map((e) => e[0]).join('+')}`,
  date: day(i),
  startedAt: at(day(i)),
  endedAt: at(day(i)) + 3600000,
  unit: 'lb',
  kind: 'adaptive',
  location: 'gym',
  exercises: exercises.map(([exId, sets]) => ({ exId, name: exId, type: findExercise(exId).type, weighted: findExercise(exId).weighted, sets })),
  ...extra,
})
const sessions = (exId, n, sets, start = 0, gap = 2) => Array.from({ length: n }, (_, k) => rec(start + k * gap, [[exId, sets]]))
const base = { unit: 'lb', goal: 'Build muscle', experience: 'Some experience', sets: 3, place: 'gym' }
const target = (exId, workouts, date, extra = {}) => strengthTarget({ ...base, exId, workouts, today: date, now: at(date, 7), ...extra })

// ── The library ──────────────────────────────────────────────────────────

const strengthIds = allMeta().filter((m) => m.kinds.includes('strength') || m.kinds.includes('seated')).map((m) => m.id)

test('every exercise has a complete, consistent library entry', () => {
  for (const id of strengthIds) {
    const p = exerciseProfile(id)
    assert.ok(p, id)
    const total = Object.values(p.muscles).reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(total - 1) < 1e-9, `${id}: shares sum to ${total}`)
    for (const [m, v] of Object.entries(p.muscles)) {
      assert.ok(MUSCLES.includes(m), `${id}: unknown muscle ${m}`)
      assert.ok(v > 0 && v <= 1, `${id}: share ${v}`)
    }
    assert.ok(p.endurance >= 20 && p.endurance <= 42)
    if (['load', 'bodyweight', 'assist'].includes(p.mode) && p.role !== 'control') {
      assert.ok(p.anchor && ANCHORS[p.anchor], `${id}: needs a reference lift`)
      assert.ok(p.normKg > 0 && p.ratio > 0 && p.ratioSd > 0 && p.ratioSd <= 0.5, `${id}: ratio`)
    }
    if (p.mode === 'bodyweight') assert.ok(p.bw > 0 && p.bw <= 1.2, `${id}: bodyweight share`)
  }
  // A reference lift always counts bodyweight the way its reference value does.
  for (const [id, a] of Object.entries(ANCHORS)) assert.equal(exerciseProfile(id).bw, a.bw || 0, id)
  assert.ok(tiedExercises().length >= 150, 'most exercises are tied together')
})

test('the research-based numbers are where they should be', () => {
  // Push-ups move about 64% of bodyweight, on the knees about 49% (Ebben 2011).
  assert.equal(exerciseProfile('push-up').bw, 0.64)
  assert.equal(exerciseProfile('kneeling-push-up').bw, 0.49)
  // A bodyweight squat moves about 77% of bodyweight.
  assert.equal(exerciseProfile('bodyweight-squat').bw, 0.77)
  // Dumbbell bench ≈ 80% of barbell bench in total (≈ 40% per hand); per-hand counts twice.
  assert.equal(exerciseProfile('db-bench').ratio, 0.8)
  assert.equal(exerciseProfile('db-bench').ext, 2)
  assert.equal(exerciseProfile('biceps-curl').ext, 1, 'one arm at a time counts once')
  // The bench press loads the chest most, then triceps, then front delts.
  const bench = exerciseProfile('bench-press').muscles
  assert.ok(bench.chest > bench.triceps && bench.triceps >= bench['front-delts'])
  // Inclines shift work to the front delts; close grips to the triceps.
  assert.ok(exerciseProfile('incline-bench-press').muscles['front-delts'] > bench['front-delts'])
  assert.ok(exerciseProfile('close-grip-bench').muscles.triceps > bench.triceps)
  // Small muscles recover faster than large lower-body ones.
  assert.ok(RECOVERY_HALF_LIFE_HOURS.biceps < RECOVERY_HALF_LIFE_HOURS.quads)
  assert.ok(RECOVERY_HALF_LIFE_HOURS['side-delts'] < RECOVERY_HALF_LIFE_HOURS.hamstrings)
})

test('effective load converts both ways for every load convention', () => {
  for (const id of ['bench-press', 'db-bench', 'goblet-squat', 'back-squat', 'assisted-pull-up', 'biceps-curl', 'push-up']) {
    const p = exerciseProfile(id)
    for (const w of [0, 12.5, 40, 135]) {
      const eff = effectiveLoad(p, w, 170)
      const back = loggedFor(p, eff, 170)
      if (p.mode !== 'bodyweight') assert.ok(Math.abs(back - w) < 1e-9, `${id} ${w}`)
    }
  }
  // Assistance makes the load lighter.
  const a = exerciseProfile('assisted-pull-up')
  assert.ok(effectiveLoad(a, 40, 180) < effectiveLoad(a, 20, 180))
})

test('similarity ties exercises far beyond the same family', () => {
  for (const [a, b] of [['bench-press', 'db-bench'], ['lateral-raise', 'machine-lateral-raise'], ['pull-up', 'lat-pulldown']]) {
    assert.equal(similarity(a, b).score, similarity(b, a).score, 'symmetric')
    assert.ok(similarity(a, b).score > 0.75, `${a}~${b}`)
  }
  // Across families: a dip and a close-grip bench share the triceps.
  assert.ok(similarity('dip', 'close-grip-bench').muscles > 0.6)
  // Unrelated work stays apart.
  assert.ok(similarity('bench-press', 'leg-curl' in {} ? 'leg-curl' : 'seated-leg-curl').score < 0.2)
  const related = relatedExercises('lateral-raise').map((r) => r.id)
  assert.ok(related.includes('machine-lateral-raise') && related.includes('cable-lateral-raise'))
})

// ── Fatigue and recovery ────────────────────────────────────────────────

test('fatigue builds on the muscles used and fades at each muscle’s own pace', () => {
  const bench = exerciseProfile('bench-press')
  const pushdown = exerciseProfile('triceps-pushdown')
  const curl = exerciseProfile('biceps-curl')
  let f = emptyFatigue(at(day(0)))
  for (let i = 0; i < 3; i++) f = addSetFatigue(f, pushdown, { rir: 0, at: at(day(0)) + i * 150000 })
  // Pre-exhausting the triceps costs bench strength, not curl strength.
  assert.ok(availability(f, bench) < 0.99)
  assert.equal(availability(f, curl), 1)
  // A set to failure tires more than one with reps to spare.
  const hard = addSetFatigue(emptyFatigue(0), bench, { rir: 0 })
  const easy = addSetFatigue(emptyFatigue(0), bench, { rir: 4 })
  assert.ok(availability(hard, bench) < availability(easy, bench))
  // Acute fatigue fades within the hour; residual over days.
  const later = decayFatigue(hard, 2 * 3600000)
  const nextDay = decayFatigue(hard, 30 * 3600000)
  assert.ok(availability(later, bench) > availability(hard, bench))
  assert.ok(availability(nextDay, bench) > availability(later, bench))
  assert.ok(readiness(nextDay).chest > readiness(later).chest)
})

test('a hard session yesterday makes today a little lighter; three days later it is gone', () => {
  const history = [
    ...sessions('bench-press', 5, [s(8, 185, { feel: 'good' }), s(8, 185), s(8, 185)]),
    rec(20, [['bench-press', [s(8, 185, { feel: 'hard' }), s(8, 185, { feel: 'hard' }), s(8, 185, { feel: 'hard' }), s(8, 185, { feel: 'hard' })]]]),
  ]
  const tomorrow = target('bench-press', history, day(21))
  const later = target('bench-press', history, day(24))
  const load = (p) => p.weight * (1 + p.reps / 30)
  assert.ok(load(tomorrow) < load(later), `${tomorrow.weight}×${tomorrow.reps} then ${later.weight}×${later.reps}`)
  assert.ok(tomorrow.facts.readiness < later.facts.readiness)
})

// ── Ties between exercises ──────────────────────────────────────────────

test('a related exercise you have never done starts from what you have done', () => {
  const bench = sessions('bench-press', 4, [s(8, 185, { feel: 'good' }), s(8, 185), s(8, 185)])
  const db = target('db-bench', bench, day(10))
  assert.equal(db.code, 'estimated-start')
  assert.equal(db.facts.sourceId, 'bench-press')
  // About 40% of bench per hand, carefully lower for a first try.
  assert.ok(db.weight >= 45 && db.weight <= 80, `${db.weight}`)
  const incline = target('incline-bench-press', bench, day(10))
  assert.ok(incline.weight < 185 && incline.weight >= 95, `${incline.weight}`)
  // Push-ups are far too easy for this person: flagged so a harder version is picked.
  assert.ok(target('push-up', bench, day(10)).flags.includes('outgrown'))
  // Unrelated movements still ask.
  assert.equal(target('leg-extension', bench, day(10)).weight, null)
})

test('the user’s cases: machine vs dumbbell raises, shared muscles, a failing helper muscle', () => {
  const raises = sessions('lateral-raise', 4, [s(12, 20, { feel: 'good' }), s(12, 20), s(12, 20)])
  // A machine raise differs by brand: not guessed blindly, but asked with sensible choices.
  const machine = target('machine-lateral-raise', raises, day(10))
  assert.equal(machine.weight, null)
  // A close variant is planned from it.
  assert.equal(target('db-scaption', raises, day(10)).code, 'estimated-start')
  // Getting stronger on one exercise lifts its relatives too.
  const old = sessions('db-floor-press', 3, [s(10, 45, { feel: 'good' }), s(10, 45)])
  const stronger = [...old, ...[50, 55, 60, 65, 70].map((w, k) => rec(8 + k * 2, [['db-bench', [s(10, w, { feel: 'easy' }), s(10, w), s(10, w)]]]))]
  // (Early gains on a new lift are partly skill specific to it, so the transfer
  // is real but partial, and a related lift's own history still counts most.)
  const est = (w) => strengthSummary({ ...base, exId: 'db-floor-press', workouts: w, today: day(20), now: at(day(20), 7) }).oneRepMax
  assert.ok(est(stronger) > est(old) * 1.02, `${est(old)} → ${est(stronger)}`)
  assert.ok(target('db-floor-press', stronger, day(20)).weight >= target('db-floor-press', old, day(20)).weight)
  // A failing triceps exercise nudges pressing only as much as the triceps limit it.
  const bench = sessions('bench-press', 4, [s(8, 185, { feel: 'good' }), s(8, 185), s(8, 185)])
  const withTriceps = [...bench, rec(9, [['triceps-pushdown', [s(6, 60, { feel: 'failed' }), s(5, 60, { feel: 'failed' })]]])]
  const b1 = target('bench-press', bench, day(12))
  const b2 = target('bench-press', withTriceps, day(12))
  assert.ok(b2.weight * (1 + b2.reps / 30) <= b1.weight * (1 + b1.reps / 30))
  assert.ok(b2.weight >= b1.weight - 10, 'a well-known lift is not thrown off by one helper session')
})

test('fast progress is followed, never planned below what was just done', () => {
  const history = [50, 55, 60, 65, 70].map((w, k) => rec(k * 2, [['db-bench', [s(10, w, { feel: 'easy' }), s(10, w), s(10, w)]]]))
  const p = target('db-bench', history, day(10))
  assert.ok(p.weight >= 70)
  assert.ok(p.weight > 70 || p.reps >= 10, `${p.weight}×${p.reps}`)
})

test('bodyweight, assisted and loaded versions of a movement inform each other', () => {
  const metrics = { [day(0)]: { weight: 180 } }
  const pullups = sessions('pull-up', 4, [s(8, null, { feel: 'good' }), s(8, null), s(7, null)])
  const pulldown = target('lat-pulldown', pullups, day(10), { metrics })
  assert.equal(pulldown.code, 'estimated-start')
  assert.ok(pulldown.weight >= 80 && pulldown.weight <= 160, `${pulldown.weight}`)
  const assisted = target('assisted-pull-up', pullups, day(10), { metrics })
  assert.ok(assisted.weight >= 0 && assisted.weight <= 60, `${assisted.weight}`)
  // Goblet squats inform a back squat carefully (bodyweight counted on both).
  const goblet = sessions('goblet-squat', 4, [s(12, 50, { feel: 'good' }), s(12, 50), s(12, 50)])
  const squat = target('back-squat', goblet, day(10), { metrics })
  assert.ok(squat.weight >= 45 && squat.weight <= 135, `${squat.weight}`)
})

test('machines are learned per place; dumbbells and barbells are the same everywhere', () => {
  const gymA = sessions('lat-pulldown', 4, [s(10, 120, { feel: 'good' }), s(10, 120), s(10, 120)]).map((r) => ({ ...r, location: 'gym-a' }))
  const atA = target('lat-pulldown', gymA, day(10), { place: 'gym-a' })
  const atB = target('lat-pulldown', gymA, day(10), { place: 'gym-b' })
  assert.ok(atA.weight >= 115)
  assert.ok(atB.weight < atA.weight || atB.reps < atA.reps, 'a new machine starts more carefully')
  const db = sessions('db-bench', 4, [s(10, 50, { feel: 'good' }), s(10, 50)]).map((r) => ({ ...r, location: 'gym-a' }))
  assert.equal(target('db-bench', db, day(10), { place: 'gym-a' }).weight, target('db-bench', db, day(10), { place: 'home' }).weight)
})

test('the strength summary explains where an estimate came from', () => {
  const bench = sessions('bench-press', 4, [s(8, 185, { feel: 'good' }), s(8, 185), s(8, 185)])
  const own = strengthSummary({ ...base, exId: 'bench-press', workouts: bench, today: day(10), now: at(day(10)) })
  assert.equal(own.source, 'own')
  assert.ok(own.oneRepMax > 185)
  assert.equal(own.muscles[0].muscle, 'chest')
  const borrowed = strengthSummary({ ...base, exId: 'db-bench', workouts: bench, today: day(10), now: at(day(10)) })
  assert.equal(borrowed.source, findExercise('bench-press').name)
})

// ── Incremental updates ─────────────────────────────────────────────────

test('adding a workout extends the graph exactly as a full rebuild would', () => {
  const ids = ['bench-press', 'db-row', 'goblet-squat', 'lateral-raise', 'push-up', 'lat-pulldown']
  const history = Array.from({ length: 40 }, (_, k) => rec(k * 2, ids.slice(k % 3, (k % 3) + 3).map((id) => [id, [s(10, findExercise(id).weighted ? 40 + (k % 5) * 5 : null, k % 2 ? {} : { feel: 'good' }), s(9, findExercise(id).weighted ? 40 + (k % 5) * 5 : null)]])))
  const args = { unit: 'lb', experience: 'Some experience', today: day(100), now: at(day(100)) }
  const first = buildGraph({ ...args, workouts: history.slice(0, 30) })
  const extended = extendGraph(first, graphRecords(history, args.today, args.now).slice(30), { now: args.now })
  const full = buildGraph({ ...args, workouts: history })
  for (const name of full.S.names) {
    const i = full.S.index.get(name)
    const j = extended.S.index.get(name)
    assert.ok(Math.abs(full.S.x[i] - extended.S.x[j]) < 1e-12, name)
  }
  // A backdated workout cannot be appended: it forces a full rebuild.
  assert.equal(extendGraph(full, [rec(1, [['bench-press', [s(8, 100)]]])], { now: args.now }), null)
  // The cached path gives the same answer as building from scratch.
  const cached = strengthGraphFor({ ...args, workouts: history }).G
  assert.ok(Math.abs(cached.S.x[0] - full.S.x[0]) < 1e-12)
})

// ── Planning ─────────────────────────────────────────────────────────────

test('a dumbbell-only beginner at home still gets back rows (a gentle step up)', () => {
  const state = makeUser({ goal: 'General fitness', experience: 'Starting out', location: 'home', equipment: ['Dumbbells'], homeDumbbells: [10, 15, 20, 25], minutes: 30 })
  let rows = 0
  for (let i = 0; i < 6; i++) {
    const plan = buildDailyPlan(state, { today: day(i * 2), now: at(day(i * 2), 9) })
    const row = plan.items.find((it) => ['pull-h', 'pull-v'].includes(exerciseProfile(it.exId)?.pattern))
    if (row) {
      rows++
      const codes = plan.decision.items.find((d) => d.exId === row.exId).codes
      assert.ok(codes.includes('step-up'), 'marked as a step up')
      assert.match(row.note, /step up/)
    }
  }
  assert.ok(rows >= 1, 'rows appear in the rotation')
})

test('planning prefers muscles that have recovered', () => {
  const state = makeUser({ goal: 'Build muscle', experience: 'Some experience', location: 'gym', minutes: 45 })
  state.workouts = [rec(9, [['bench-press', [s(8, 185, { feel: 'hard' }), s(8, 185, { feel: 'hard' }), s(7, 185, { feel: 'failed' })]], ['db-incline-press', [s(10, 60, { feel: 'hard' }), s(9, 60, { feel: 'failed' })]], ['dip', [s(8, null, { feel: 'hard' }), s(7, null, { feel: 'failed' })]]])]
  const plan = buildDailyPlan(state, { today: day(10), now: at(day(10), 9) })
  const pressing = plan.items.filter((it) => (exerciseProfile(it.exId)?.muscles.chest || 0) > 0.3)
  assert.ok(pressing.length <= 1, `chest work the day after a hard chest session: ${pressing.map((p) => p.exId)}`)
})

// ── Simulated lifters ────────────────────────────────────────────────────

const POOLS = {
  gym: ['bench-press', 'db-bench', 'incline-bench-press', 'machine-chest-press', 'lat-pulldown', 'cable-row', 'db-row', 'back-squat', 'goblet-squat', 'leg-press', 'rdl', 'db-rdl', 'lateral-raise', 'machine-lateral-raise', 'triceps-pushdown', 'biceps-curl', 'ohp', 'db-overhead-press', 'pull-up', 'push-up'],
}

/** A person with a hidden truth: muscle strengths, exercise quirks, rep curves. */
function person(seed) {
  const random = rng(`lifter-${seed}`)
  const gauss = () => Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random())
  const general = 0.25 * gauss()
  const theta = Object.fromEntries(MUSCLES.map((m) => [m, general + 0.15 * gauss()]))
  const quirks = {}
  const endurance = {}
  for (const id of POOLS.gym) {
    const p = exerciseProfile(id)
    quirks[id] = 0.6 * p.ratioSd * gauss()
    endurance[id] = p.endurance * Math.exp(0.1 * gauss())
  }
  return { random, theta, quirks, endurance, bw: 70 + 15 * gauss(), growth: 0.004 + 0.002 * random() }
}

function trueMax(who, id, unit) {
  const p = exerciseProfile(id)
  let level = Math.log(p.normKg * (unit === 'lb' ? 2.2046226 : 1))
  for (const [m, share] of Object.entries(p.muscles)) level += share * who.theta[m]
  return Math.exp(level + who.quirks[id])
}

/**
 * One workout through the real app flow: the plan's numbers, each set done
 * as the hidden truth allows, the one-tap answers, and the app re-planning
 * the rest of the workout after each answer.
 */
function liveWorkout(who, history, date, ids, { metrics, bwLb, stats, exposures }) {
  const now = at(date, 18)
  const items = []
  const plans = new Map()
  for (const id of ids) {
    const p = exerciseProfile(id)
    const plan = target(id, history, date, { metrics, experience: 'Some experience' })
    plans.set(id, plan)
    let weight = plan?.weight
    // Asked for a first weight: this person picks a cautious ~60% of their max.
    if (p.mode !== 'bodyweight' && !Number.isFinite(weight))
      weight = Math.max(p.mode === 'assist' ? 0 : 5, Math.round(loggedFor(p, trueMax(who, id, 'lb') * 0.6, bwLb) / 5) * 5)
    items.push({ exId: id, sets: 3, reps: plan?.reps ?? 10, weight: p.mode === 'bodyweight' ? undefined : weight, restSec: 60, repRange: plan?.range, targetRir: plan?.rir })
  }
  let session = buildSession({ id: `live-${date}`, lockedTargets: true, items }, { now, unit: 'lb' })
  session = { ...session, location: 'gym', phase: 'work', startedAt: now }
  const ctx = (n) => liveContext({ workouts: history, learning: null, metrics, unit: 'lb', now: n, today: date, goal: 'Build muscle', experience: 'Some experience', readiness: {}, sizes: [] })
  let t = now
  let guard = 0
  while (session.cursor && session.phase !== 'done' && guard++ < 60) {
    t += 150000
    const { ex, set } = currentSet(session)
    if (set.kind === 'warmup') {
      session = completeSet(session, t)
      continue
    }
    const p = exerciseProfile(ex.exId)
    const doneBefore = ex.sets.filter((x) => x.kind !== 'warmup' && x.status === 'done').length
    const eff = p.mode === 'bodyweight' ? p.bw * bwLb : effectiveLoad(p, set.weight, bwLb)
    const capacity = Math.floor(repsAtFraction(eff / (trueMax(who, ex.exId, 'lb') * (1 - 0.02 * doneBefore)), who.endurance[ex.exId]))
    const plan = plans.get(ex.exId)
    const failedSet = capacity < set.reps
    const reps = Math.max(1, Math.min(set.reps, capacity))
    const rir = capacity - reps
    const n = exposures.get(ex.exId) || 0
    stats.sets++
    if (failedSet) stats.failed++
    if (n === 0) {
      stats.firstSets++
      if (failedSet) stats.firstFailed++
    } else if (!failedSet && plan && Number.isFinite(plan.weight ?? (p.mode === 'bodyweight' ? 0 : NaN)) && !(plan.flags || []).includes('outgrown')) {
      stats.rirError += Math.abs(rir - (ex.targetRir ?? 2))
      stats.rirCount++
    }
    const c = session.cursor
    if (failedSet) {
      session = logShortSet(session, reps, ctx(t), t)
      continue
    }
    session = completeSet(updateSet(session, { reps }), t)
    // Answers on the first and last set (what the app asks for).
    const lastSet = !ex.sets.some((x, i) => x.kind !== 'warmup' && x.status === 'todo' && i !== c.set)
    if (doneBefore === 0 || lastSet) {
      const feel = rir >= 4 ? 'easy' : rir <= 1 ? 'hard' : 'good'
      const reserve = feel === 'easy' ? (rir >= 7 ? 8 : rir >= 5 ? 5 : 3) : undefined
      session = recordFeel(session, c, feel, ctx(t), reserve)
    }
  }
  for (const id of ids) {
    exposures.set(id, (exposures.get(id) || 0) + 1)
    const p = exerciseProfile(id)
    for (const m of Object.keys(p.muscles)) who.theta[m] += who.growth * (p.muscles[m] > 0.2 ? 1 : 0.3)
  }
  const record = toWorkoutRecord({ ...finish(session, t), startedAt: now }, history, { now: t, effort: 2 })
  return { ...record, date }
}

test('simulated lifters through the live app: few failed sets, safe first tries, plans near the target effort', () => {
  const stats = { sets: 0, failed: 0, firstSets: 0, firstFailed: 0, rirError: 0, rirCount: 0 }
  const failuresBefore = strengthFailures()
  for (let seed = 0; seed < 8; seed++) {
    const who = person(seed)
    const bwLb = who.bw * 2.2046226
    const metrics = { [day(0)]: { weight: Math.round(bwLb) } }
    const exposures = new Map()
    let history = []
    for (let session = 0; session < 30; session++) {
      const date = day(session * 2)
      const ids = [...new Set([0, 1, 2, 3].map((k) => POOLS.gym[(session * 3 + k * 5 + seed) % POOLS.gym.length]))]
      history = [...history, liveWorkout(who, history, date, ids, { metrics, bwLb, stats, exposures })]
    }
  }
  const { sets, failed, firstSets, firstFailed, rirError, rirCount } = stats
  console.log(`simulated: ${failed}/${sets} sets short, first tries ${firstFailed}/${firstSets}, mean |reps in reserve − target| ${(rirError / rirCount).toFixed(2)} over ${rirCount} sets`)
  assert.equal(strengthFailures(), failuresBefore, 'no internal fallbacks')
  assert.ok(failed / sets < 0.1, `sets short of the plan ${failed}/${sets}`)
  assert.ok(firstFailed / Math.max(1, firstSets) < 0.2, `first-try sets short ${firstFailed}/${firstSets}`)
  assert.ok(rirError / rirCount < 2.5, `average distance from the target reps in reserve ${(rirError / rirCount).toFixed(2)}`)
})

test('just tapping Done never inflates the shared model: growth follows the training prior', () => {
  const history = sessions('lat-pulldown', 20, [s(10, 100), s(10, 100), s(10, 100)])
  const est = (n, date) => strengthSummary({ ...base, exId: 'lat-pulldown', workouts: history.slice(0, n), today: date, now: at(date, 20) }).oneRepMax
  const growth = est(20, day(38)) / est(1, day(0))
  assert.ok(growth >= 1 && growth < 1.15, `growth ${growth}`)
})

test('a stalled lift gets one lighter reset session, then builds again', () => {
  const steady = sessions('bench-press', 4, [s(8, 185, { feel: 'good' }), s(8, 185), s(8, 185)])
  const grinding = [
    ...steady,
    rec(8, [['bench-press', [s(6, 190, { feel: 'failed', targetReps: 8 }), s(5, 190, { feel: 'failed', targetReps: 8 })]]]),
    rec(10, [['bench-press', [s(5, 190, { feel: 'failed', targetReps: 8 }), s(5, 190, { feel: 'failed', targetReps: 8 })]]]),
  ]
  const reset = target('bench-press', grinding, day(12))
  assert.equal(reset.code, 'deload')
  assert.ok(reset.weight < 190)
  // A comfortable reset clears it.
  const after = [...grinding, rec(12, [['bench-press', [s(reset.reps, reset.weight, { feel: 'good' }), s(reset.reps, reset.weight), s(reset.reps, reset.weight)]]])]
  assert.notEqual(target('bench-press', after, day(14)).code, 'deload')
})

test('switching pounds and kilograms keeps the same real plan', async () => {
  const { convertStateUnits } = await import('../src/lib/units.js')
  const state = makeUser({ goal: 'Build muscle', experience: 'Some experience' })
  state.workouts = [
    ...sessions('bench-press', 4, [s(8, 185, { feel: 'good' }), s(8, 185), s(8, 185)]),
    ...sessions('goblet-squat', 3, [s(12, 50, { feel: 'good' }), s(12, 50)], 1),
  ]
  state.metrics = { [day(0)]: { weight: 180 } }
  const kg = convertStateUnits(state, 'kg')
  const args = (st, exId) => ({ ...base, exId, unit: st.settings.weightUnit, workouts: st.workouts, metrics: st.metrics, today: day(10), now: at(day(10), 7) })
  for (const exId of ['bench-press', 'goblet-squat', 'db-bench', 'back-squat']) {
    const lb = strengthTarget(args(state, exId))
    const metric = strengthTarget(args(kg, exId))
    if (lb.weight === null) {
      assert.equal(metric.weight, null)
      continue
    }
    // Same effort: a kilogram rack steps differently, so a lighter dumbbell
    // may come with more reps. Compare weight × reps on the same scale.
    const effort = (w, r, toKg) => w * toKg * (1 + r / 30)
    const ratio = effort(lb.weight, lb.reps, 0.4536) / effort(metric.weight, metric.reps, 1)
    assert.ok(ratio > 0.9 && ratio < 1.1, `${exId}: ${lb.weight} lb × ${lb.reps} vs ${metric.weight} kg × ${metric.reps}`)
  }
})
