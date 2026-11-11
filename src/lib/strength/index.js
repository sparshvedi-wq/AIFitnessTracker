// Public entry points of the adaptive strength model.
//
// strengthTarget()  the weight and reps for one exercise in a plan
// strengthSummary() what the model believes about one exercise, and why
// strengthGraphFor() the shared strength graph for a person (cached)
// todayReadiness()  how recovered each muscle is right now
//
// Exercises tied together by the library (src/lib/strength/library.js) use
// the shared strength graph (graph.js): everything learned on one exercise
// informs every related one. Band work, untied drills and custom exercises
// keep the single-exercise model (model.js).
//
// Everything is pure and deterministic. If anything unexpected happens inside
// the model, these return null and callers keep their simple fallback rules:
// a plan is never blocked and never shows a non-number.
import { metaOf } from '../catalog/index.js'
import { findExercise } from '../exercises.js'
import { realHistory } from '../engine/ledger.js'
import { EXTRA_REPS_BEFORE_JUMP, JUMP, STEADY_SESSIONS_BEFORE_STEP, STRENGTH_VERSION } from './config.js'
import { GRAPH, buildGraph, extendGraph, graphAt, graphRecords, liveRecord, muscleStrengths, predictExercise } from './graph.js'
import { effectiveLoad, exerciseProfile, loggedFor, relatedExercises } from './library.js'
import { loadGrid } from './loads.js'
import { fractionAt, isNum, repsAtFraction } from './math.js'
import { beliefAt, exerciseBelief, strengthMode } from './model.js'
import { mappedGrid, prescribeAtLoad, prescribeLoad, prescribeReps, repRange, targetRir } from './prescribe.js'
import { addSetFatigue, availability, involvementOf, readiness, withActivityFatigue } from './recovery.js'

export { STRENGTH_VERSION } from './config.js'
export { strengthMode } from './model.js'
export { repRange, targetRir } from './prescribe.js'

let failures = 0
/** How many times the model fell back because of an internal problem (tests assert 0). */
export const strengthFailures = () => failures

const TIED = ['load', 'bodyweight', 'assist']

// ── Caching ──────────────────────────────────────────────────────────────
// A person's graph is rebuilt only when their history, learning, unit,
// experience or bodyweight changes.
const GRAPHS = new WeakMap()
const NO_METRICS = {}
function graphKey(args) {
  const events = Array.isArray(args.learning?.events) ? args.learning.events : []
  // Every anchor's numbers are part of the key: changing one rebuilds.
  const anchors = events
    .filter((e) => e?.kind === 'anchor')
    .map((e) => [e.exId, e.at, e.weight, e.reps, e.unit].join(':'))
    .join(',')
  return [args.unit, args.experience, args.today, Math.floor((args.now || 0) / 60000), anchors].join('|')
}

/** The shared strength graph built from saved history (memoised). */
export function strengthGraphFor(args) {
  const workouts = Array.isArray(args.workouts) ? args.workouts : []
  const metrics = args.metrics || NO_METRICS
  let byMetrics = GRAPHS.get(workouts)
  if (!byMetrics) GRAPHS.set(workouts, (byMetrics = new WeakMap()))
  let byKey = byMetrics.get(metrics)
  if (!byKey) byMetrics.set(metrics, (byKey = new Map()))
  const key = graphKey(args)
  if (!byKey.has(key)) {
    if (byKey.size > 8) byKey.clear()
    byKey.set(key, { G: incrementalBuild(args, workouts, metrics), at: new Map() })
  }
  return byKey.get(key)
}

// The last full build per setup, so saving one workout only adds that workout.
let LAST = null
function incrementalBuild(args, workouts, metrics) {
  const records = graphRecords(workouts, args.today, args.now)
  const setup = [args.unit, args.experience, graphKey({ ...args, today: '', now: 0 })].join('|')
  if (
    LAST &&
    LAST.setup === setup &&
    LAST.metrics === metrics &&
    LAST.custom === (args.customExercises || NO_CUSTOM) &&
    records.length >= LAST.records.length &&
    LAST.records.every((r, i) => records[i] === r)
  ) {
    const G = extendGraph(LAST.G, records.slice(LAST.records.length), { learning: args.learning, now: args.now })
    if (G) {
      LAST = { ...LAST, G, records }
      return G
    }
  }
  const G = buildGraph({
    workouts,
    learning: args.learning,
    unit: args.unit,
    today: args.today,
    now: args.now,
    experience: args.experience,
    metrics,
    customExercises: args.customExercises || [],
  })
  LAST = { setup, metrics, custom: args.customExercises || NO_CUSTOM, G, records }
  return G
}
const NO_CUSTOM = []

// Sport and activities already done (sport-schedule.js pastActivityLoad)
// add fatigue to the muscles they used.
const activitiesOf = (args) => (Array.isArray(args.activities) ? args.activities : [])
function withActivities(C, args) {
  const activities = activitiesOf(args)
  return activities.length ? { ...C, fatigue: withActivityFatigue(C.fatigue, activities, args.now) } : C
}

/** The graph moved to `now` (and, in a workout, with today's sets applied). */
function graphNow(args) {
  const entry = strengthGraphFor(args)
  if (args.live) return withActivities(graphAt(entry.G, args.now, liveRecord(args.live, args.now)), args)
  const key = `${args.now}|${activitiesOf(args).map((a) => `${a.at}:${a.sets}:${(a.areas || []).join('+')}`).join(',')}`
  if (!entry.at.has(key)) {
    if (entry.at.size > 8) entry.at.clear()
    entry.at.set(key, withActivities(graphAt(entry.G, args.now), args))
  }
  return entry.at.get(key)
}

/**
 * Does this exercise rely on any of these muscles (as a main mover, at least
 * half as involved as its prime mover)?
 */
export function trainsAny(exId, muscles, def = null) {
  if (!muscles || !(muscles.size ?? muscles.length)) return false
  const set = muscles instanceof Set ? muscles : new Set(muscles)
  const profile = exerciseProfile(exId, def || findExercise(exId))
  if (!profile) return false
  return Object.entries(involvementOf(profile)).some(([m, v]) => v >= 0.5 && set.has(m))
}

/**
 * A weight the equipment can actually hold, at or below `weight` (or the
 * lightest one). Used where a simple rule scales a load, so the result is
 * always something you can set up: plates, a stack step or a listed dumbbell.
 */
export function snapLoad({ exId, weight, unit = 'lb', sizes = [], used = [] }) {
  if (!isNum(weight) || weight <= 0) return weight ?? null
  const meta = metaOf(exId)
  if (meta?.load === 'assist') {
    const step = unit === 'kg' ? 2.5 : 5
    return Math.max(0, Math.round(weight / step) * step)
  }
  const grid = loadGrid({ load: meta?.load, unit, sizes: ['hand', 'one'].includes(meta?.load) ? sizes : [], used })
  return grid.atMost(weight)
}

// ── The single-exercise model (bands, drills, custom exercises) ──────────

function recordsIndex(workouts, today, cache) {
  const key = `index|${today}`
  if (cache.has(key)) return cache.get(key)
  const index = new Map()
  for (const w of realHistory(workouts, today)) {
    for (const id of new Set((w.exercises || []).map((e) => e?.exId))) {
      if (!id) continue
      if (!index.has(id)) index.set(id, [])
      index.get(id).push(w)
    }
  }
  cache.set(key, index)
  return index
}

function beliefFor(args, exId, cache) {
  const key = `belief|${exId}|${args.unit}|${args.now}|${args.experience}`
  if (cache.has(key)) return cache.get(key)
  const index = recordsIndex(args.workouts || [], args.today, cache)
  const def = exId === args.exId && args.def ? args.def : findExercise(exId, args.customExercises)
  const belief = exerciseBelief({
    records: index.get(exId) || [],
    exId,
    def,
    meta: metaOf(exId),
    unit: args.unit,
    today: args.today,
    now: args.now,
    experience: args.experience,
    learning: args.learning,
  })
  cache.set(key, belief)
  return belief
}

function singleTarget(args, def, meta, mode, cache) {
  const range = repRange({ goal: args.goal, experience: args.experience, meta, mode, fixedReps: args.fixedReps })
  const rir = targetRir(args)
  const belief = beliefFor({ ...args, def }, args.exId, cache)
  const sets = Math.max(1, args.sets || 3)
  const base = { mode, range, rir, rule: STRENGTH_VERSION }
  if (!belief) {
    if (mode !== 'load') return null
    return { ...base, weight: null, reps: Math.round((range[0] + range[1]) / 2), code: 'no-history', up: false, flags: [], facts: {}, confidence: 'none' }
  }
  const est = beliefAt(belief, args.now)
  const last = belief.last
  const common = {
    range,
    rir,
    sets,
    last,
    noIncrease: Boolean(args.noIncrease),
    allowBigDrop: Boolean(last?.failed || args.returning),
    lighterDay: Boolean(args.easy || args.returning),
  }
  const p =
    mode === 'load'
      ? prescribeLoad(est, { ...common, grid: loadGrid({ load: meta?.load, unit: args.unit, sizes: args.sizes || [], used: belief.used }) })
      : prescribeReps(est, common)
  return {
    ...base,
    ...p,
    up: p.code === 'load-up' || p.code === 'reps-up',
    facts: { from: last?.weight ?? null, to: p.weight, lastReps: last?.reps ?? null, reps: p.reps, estimate: mode === 'load' ? round(est.oneRepMax) : round(est.maxReps) },
    confidence: est.confidence,
  }
}

// ── The shared graph ─────────────────────────────────────────────────────

/** A grid holding exactly one weight ("keep my weight, adjust the reps"). */
function fixedGrid(w) {
  return {
    min: w,
    max: w,
    listed: true,
    between: (a, b) => (w >= Math.min(a, b) - 1e-9 && w <= Math.max(a, b) + 1e-9 ? [w] : []),
    has: (v) => Math.abs(v - w) < 1e-6,
    next: () => null,
    atMost: () => w,
  }
}

/** The graph for a workout in progress: history plus today's sets so far. */
export function liveStrengthGraph(args, session) {
  const entry = strengthGraphFor(args)
  return withActivities(graphAt(entry.G, args.now, liveRecord(session, args.now)), args)
}

/** Assistance settings on an assisted machine: none, then stack steps. */
function assistGrid(unit, bodyweightLoad) {
  const step = unit === 'kg' ? 2.5 : 5
  const values = [0]
  for (let v = step; v <= Math.max(step, bodyweightLoad * 0.9); v += step) values.push(Math.round(v * 1000) / 1000)
  const between = (a, b) => values.filter((v) => v >= Math.min(a, b) - 1e-9 && v <= Math.max(a, b) + 1e-9)
  return {
    min: 0,
    max: values.at(-1),
    listed: true,
    between,
    has: (w) => values.some((v) => Math.abs(v - w) < 1e-6),
    next: (w, dir) => (dir > 0 ? values.find((v) => v > w + 1e-6) : [...values].reverse().find((v) => v < w - 1e-6)) ?? null,
    atMost: (w) => [...values].reverse().find((v) => v <= w + 1e-9) ?? 0,
  }
}

const confidenceOf = (sd) => (sd < 0.05 ? 'settled' : sd < 0.1 ? 'learning' : 'calibrating')

/** A few sensible first weights from a weak estimate (for the weight picker). */
function smartChoices(pred, grid, toLogged, range) {
  if (!pred || !isNum(pred.level)) return null
  const mid = Math.round((range[0] + range[1]) / 2)
  const out = []
  for (const rir of [5, 4, 3, 2]) {
    const E = Math.exp(pred.level - 0.5 * Math.min(pred.sd, 0.3))
    const eff = E / (1 + (mid + rir - 1) / pred.k)
    const w = toLogged(grid.atMost(eff))
    if (isNum(w) && w > 0 && !out.some((v) => Math.abs(v - w) < 1e-6)) out.push(Math.round(w * 100) / 100)
  }
  return out.length >= 2 ? out.sort((a, b) => a - b).slice(0, 4) : null
}

function graphTarget(args, def, profile) {
  const G = args.graph || graphNow(args)
  const pred = predictExercise(G, args.exId, { place: args.place, def, live: Boolean(args.live || args.graph) })
  if (!pred) return null
  const mode = profile.mode
  const meta = metaOf(args.exId)
  // A live workout keeps the rep range and reps-in-reserve the plan started with.
  const range =
    Array.isArray(args.range) && args.range.length === 2
      ? args.range
      : repRange({ goal: args.goal, experience: args.experience, meta, mode: mode === 'bodyweight' ? 'reps' : 'load', fixedReps: args.fixedReps })
  const rir = isNum(args.rir) ? args.rir : targetRir(args)
  const sets = Math.max(1, args.sets || 3)
  const base = { mode: mode === 'bodyweight' ? 'reps' : mode, range, rir, rule: STRENGTH_VERSION }
  const bw = pred.bodyweight.value
  const info = pred.info
  const last = info?.last || null
  const belief = { level: pred.level, sd: pred.sd, k: pred.k }
  const supportName = pred.support ? findExercise(pred.support.exId)?.name || pred.support.exId : null
  // A never-done exercise is planned only from a close, well-known relative.
  const transferable = !pred.seen && pred.sd <= GRAPH.transferSdMax && pred.support && pred.support.score >= 0.5
  // A stalled lift gets one lighter session to reset before pushing again.
  const deload = Boolean(pred.seen && info?.stalled && !args.live && !args.graph)
  const lighterDay = Boolean(args.easy || args.returning || deload)
  const fresh = pred.avail >= 0.97
  // Planning (not mid-workout) on a normal day, after clean repeats of the
  // same numbers: see STEADY_SESSIONS_BEFORE_STEP.
  const steadyHold = Boolean(pred.seen && !args.live && !args.graph && !lighterDay && fresh && !args.fixedReps && last && last.steady >= 1)
  const steadyStep = steadyHold && !args.noIncrease && last.steady >= STEADY_SESSIONS_BEFORE_STEP
  // "Easy, I could do 5+ more" (last time, or earlier today) allows a bigger step.
  const liveSets = args.live?.exercises?.filter((e) => e.exId === args.exId).flatMap((e) => e.sets || []) || []
  const roomy = Boolean(args.roomy || last?.roomy || liveSets.some((x) => x.status === 'done' && x.feel === 'easy' && x.reserve >= 5))
  // Tiredness at the middle planned set, from the same muscle model that
  // reads past sets (relative to now, which the prediction already includes).
  let planned = G.fatigue
  const extra = isNum(args.extraSets) ? args.extraSets : Math.floor((sets - 1) / 2)
  for (let i = 0; i < extra; i++) planned = addSetFatigue(planned, profile, { rir, at: planned.at })
  const plannedA = availability(planned, profile) / Math.max(pred.avail, 1e-6)
  const facts = {
    estimate: null,
    from: null,
    to: null,
    lastReps: last?.reps ?? null,
    source: pred.seen ? 'own' : transferable ? supportName : null,
    sourceId: pred.seen ? args.exId : transferable ? pred.support.exId : null,
    readiness: Math.round(pred.avail * 1000) / 1000,
  }

  if (mode === 'bodyweight') {
    const L = profile.bw * bw
    if (!pred.seen && !transferable) return null
    const p = prescribeAtLoad(belief, {
      load: L,
      range,
      rir,
      sets,
      plannedA,
      last,
      current: isNum(args.current) ? args.current : null,
      noIncrease: Boolean(args.noIncrease),
      roomy,
      transfer: !pred.seen,
      floor: !args.noFloor && pred.seen && last && !last.failed && !last.hard && !lighterDay && fresh ? { reps: last.minReps } : null,
    })
    // The same reps done cleanly session after session: ask for one more.
    if (steadyStep && !isNum(args.current) && p.reps <= last.minReps && last.minReps < range[1] + EXTRA_REPS_BEFORE_JUMP) {
      p.reps = last.minReps + 1
      p.code = 'reps-up'
      p.predictedRir = Math.max(0, p.predictedRir - 1)
    }
    return check({
      ...base,
      ...p,
      ...(deload ? { code: 'deload' } : {}),
      up: p.code === 'reps-up',
      facts: { ...facts, reps: p.reps, estimate: Math.round(repsAtFraction(L / Math.exp(pred.level), pred.k)) },
      confidence: confidenceOf(pred.sd),
    })
  }

  const loggedGrid = isNum(args.fixedWeight)
    ? fixedGrid(args.fixedWeight)
    : mode === 'assist'
      ? assistGrid(args.unit, profile.bw * bw)
      : loadGrid({ load: meta?.load, unit: args.unit, sizes: args.sizes || [], used: [...(info?.used || []), ...(isNum(args.current) && args.current > 0 ? [args.current] : [])] })
  const toEff = (w) => effectiveLoad(profile, w, bw)
  const toLogged = (e) => loggedFor(profile, e, bw)
  const grid = mappedGrid(loggedGrid, toEff, toLogged, mode === 'assist')
  if (!(grid.max > 0)) return null

  if (!pred.seen && !transferable) {
    return {
      ...base,
      weight: null,
      reps: args.fixedReps ? range[0] : Math.round((range[0] + range[1]) / 2),
      code: 'no-history',
      up: false,
      flags: [],
      facts,
      confidence: 'none',
      choices: pred.support ? smartChoices(pred, grid, toLogged, range) : null,
    }
  }
  // Last time's top set, compared at today's bodyweight, at the same place for machines.
  const samePlace = !profile.machine || !last?.place || !args.place || last.place === args.place
  const lastEff = last && isNum(last.weight) && samePlace ? toEff(last.weight) : null
  const lastForPlan = lastEff !== null ? { ...last, weight: lastEff } : null
  // When bodyweight is a big part of the load, caution trims at most a
  // quarter of the added weight rather than most of it.
  let cautiousLevel = null
  if (profile.bw > 0 && mode === 'load') {
    const mid = Math.round((range[0] + range[1]) / 2)
    const f = fractionAt(mid + rir, pred.k)
    const effMean = Math.exp(pred.level) * f
    const bwPart = profile.bw * bw
    if (effMean > bwPart) cautiousLevel = Math.log((bwPart + 0.75 * (effMean - bwPart)) / f)
  }
  const p = prescribeLoad(belief, {
    range,
    rir,
    sets,
    grid,
    cautiousLevel,
    plannedA,
    externalOf: mode === 'load' && profile.bw > 0 ? toLogged : null,
    last: lastForPlan,
    current: isNum(args.current) ? toEff(args.current) : null,
    roomy,
    transfer: !pred.seen,
    noIncrease: Boolean(args.noIncrease),
    allowBigDrop: Boolean(last?.failed || args.returning || args.allowBigDrop),
    lighterDay,
    floor: !args.noFloor && lastForPlan && !last.failed && !last.hard && !lighterDay && fresh ? { weight: lastEff, reps: last.minReps } : null,
  })
  // A weight just done cleanly, every set, is not taken away on a normal
  // day: the estimate may still doubt it, but the person has shown it.
  if (steadyHold && samePlace && lastEff !== null && !isNum(args.current) && !isNum(args.fixedWeight) && p.weight < lastEff - 1e-6 && grid.has(lastEff)) {
    p.weight = lastEff
    p.reps = Math.min(last.minReps, range[1] + EXTRA_REPS_BEFORE_JUMP)
    p.code = 'hold'
    p.flags = p.flags.filter((f) => f !== 'below-range' && f !== 'lightest-is-heavy')
    p.predictedRir = 0
  }
  // The same weight and reps done cleanly session after session, and the
  // model would simply repeat them: step once. One more rep while there is
  // room in the range (a few past it when the next weight is a big jump),
  // otherwise the next weight at the reps the best estimate gives it.
  if (steadyStep && samePlace && lastEff !== null && !isNum(args.current) && !isNum(args.fixedWeight) && Math.abs(p.weight - lastEff) < 1e-6 && p.reps <= last.minReps) {
    const next = grid.next(lastEff, 1)
    const stepOk =
      next !== null &&
      next / lastEff <= 1 + JUMP.smallestStepMax + 1e-9 &&
      (!(profile.bw > 0) || toLogged(next) / Math.max(toLogged(lastEff), 1e-9) <= 1 + JUMP.smallestStepMax + 1e-9)
    const top = stepOk ? range[1] : range[1] + EXTRA_REPS_BEFORE_JUMP
    if (last.minReps < top) {
      p.reps = last.minReps + 1
      p.code = 'reps-up'
      p.predictedRir = Math.max(0, p.predictedRir - 1)
    } else if (stepOk) {
      const capacity = repsAtFraction(next / (Math.exp(pred.level) * plannedA), pred.k)
      p.weight = next
      p.reps = Math.min(range[1], Math.max(range[0], Math.floor(capacity - rir + 0.3)))
      p.code = 'load-up'
      p.predictedRir = Math.max(0, Math.round((capacity - p.reps) * 10) / 10)
      p.flags = p.flags.filter((f) => f !== 'more-reps-before-jump')
    }
  }
  // Back to the logged number, snapped to the exact grid value it came from.
  const rawWeight = toLogged(p.weight)
  const weight = loggedGrid.between(rawWeight - 1e-6, rawWeight + 1e-6)[0] ?? rawWeight
  if (!(weight >= 0) || (mode === 'load' && !(weight > 0))) return null
  const code = !pred.seen ? 'estimated-start' : deload ? 'deload' : p.code
  const fromLogged = last && isNum(last.weight) ? last.weight : null
  return check({
    ...base,
    ...p,
    weight,
    code,
    // For assistance, less is harder: a step down in assistance is a step up.
    up: !pred.seen ? false : p.code === 'load-up' || p.code === 'reps-up',
    facts: { ...facts, from: fromLogged, to: weight, reps: p.reps, estimate: round(toLogged(Math.exp(pred.level))) },
    confidence: pred.seen ? confidenceOf(pred.sd) : 'calibrating',
  })
}

/**
 * @param {object} args
 *   exId, def?, meta?, workouts, learning, metrics, unit, today, now,
 *   goal, experience, easy, highEffort, returning, place,
 *   sizes (listed dumbbells here), sets (planned), fixedReps (a routine's reps),
 *   noIncrease (hold: discomfort or "felt hard"), live (the workout in
 *   progress), cache (Map, optional), customExercises
 * @returns null when the model does not apply, otherwise
 *   { mode, weight, reps, range, rir, code, up, flags, facts, rule, confidence, choices? }
 */
export function strengthTarget(args) {
  try {
    const cache = args.cache || new Map()
    const def = args.def || findExercise(args.exId, args.customExercises)
    const meta = args.meta || metaOf(args.exId)
    const profile = meta ? exerciseProfile(args.exId, def) : null
    if (profile?.tie && TIED.includes(profile.mode)) {
      const fromGraph = graphTarget(args, def, profile)
      if (fromGraph || profile.mode === 'bodyweight') return fromGraph
    }
    const mode = strengthMode(def, meta)
    if (!mode) return null
    return check(singleTarget(args, def, meta, mode, cache))
  } catch {
    failures++
    return null
  }
}

const round = (v) => (isNum(v) ? Math.round(v * 10) / 10 : null)

/** Last line of defence: anything not a sane number makes the model step aside. */
function check(result) {
  if (!result) return result
  const okReps = Number.isInteger(result.reps) && result.reps >= 1 && result.reps <= 60
  const okWeight =
    result.mode === 'reps' ||
    result.weight === null ||
    (isNum(result.weight) && (result.weight > 0 || (result.mode === 'assist' && result.weight >= 0)))
  if (!okReps || !okWeight) throw new Error('strength target out of bounds')
  return result
}

/** A short, plain note for a planned exercise, or null. */
export function strengthNote(target, unit = 'lb') {
  if (!target) return null
  const flags = target.flags || []
  if (target.code === 'estimated-start')
    return target.facts?.source
      ? `A careful first guess from your ${target.facts.source.toLowerCase()}. Change it if it feels off.`
      : 'A careful first guess from a similar exercise. Change it if it feels off.'
  if (target.code === 'deload') return 'A lighter session to reset after some tough ones. You’ll come back stronger.'
  if (flags.includes('lightest-is-heavy')) return 'Even the lightest weight is heavy for now. Do the reps you can, or swap.'
  if (flags.includes('outgrown'))
    return target.mode === 'reps' ? 'This is getting easy. A harder version will keep you progressing.' : 'You’ve outgrown the weights here. Add weight if you can.'
  if (flags.includes('below-range') && target.mode === 'reps') return 'Hard for now. An easier version builds up to it.'
  if (flags.includes('more-reps-before-jump')) return 'A few more reps before the next weight up.'
  if (target.code === 'load-up')
    return target.mode === 'assist' ? 'A little less assistance: you’re getting stronger.' : `Up to ${fmt(target.weight)} ${unit}: you’re ready for the next weight.`
  if (target.code === 'reps-up') return 'One step up in reps from last time.'
  if (target.code === 'load-down') return 'A little lighter, based on your last sets.'
  if (target.code === 'reps-down') return 'Fewer reps today, based on how it’s been going.'
  if ((target.facts?.readiness ?? 1) < 0.95) return 'Slightly lighter: these muscles are still recovering.'
  return null
}
const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100))

/**
 * What the model believes about one exercise right now, and why.
 * @returns null or { mode, oneRepMax, maxReps, confidence, last, rejected,
 *   anchored, source, muscles, related, readiness }
 */
export function strengthSummary(args) {
  try {
    const cache = args.cache || new Map()
    const def = args.def || findExercise(args.exId, args.customExercises)
    const meta = metaOf(args.exId)
    const profile = meta ? exerciseProfile(args.exId, def) : null
    const library = profile
      ? {
          muscles: Object.entries(profile.muscles)
            .sort((a, b) => b[1] - a[1])
            .map(([m, share]) => ({ muscle: m, share: Math.round(share * 100) })),
          related: relatedExercises(args.exId, { limit: 4 }).map((r) => ({ id: r.id, score: r.score })),
        }
      : { muscles: [], related: [] }
    if (profile?.tie && TIED.includes(profile.mode)) {
      const G = graphNow(args)
      const pred = predictExercise(G, args.exId, { place: args.place, def })
      if (!pred) return null
      const bw = pred.bodyweight.value
      const est = Math.exp(pred.level - Math.log(pred.avail))
      const own = pred.seen
      const rejected = G.rejected.filter((r) => r.exId === args.exId && (r.reason === 'unusual' || (r.reason === 'unusable' && r.weight != null)))
      if (!own && !pred.support) return { mode: profile.mode, oneRepMax: null, maxReps: null, confidence: 'none', last: null, rejected, anchored: false, source: null, ...library, readiness: pred.avail }
      return {
        mode: profile.mode === 'bodyweight' ? 'reps' : profile.mode,
        oneRepMax: profile.mode === 'bodyweight' ? null : round(loggedFor(profile, est, bw)),
        maxReps: profile.mode === 'bodyweight' ? round(repsAtFraction((profile.bw * bw) / est, pred.k)) : null,
        confidence: own ? confidenceOf(pred.sd) : 'calibrating',
        last: pred.info?.last || null,
        rejected,
        anchored: Boolean(pred.info?.last?.anchored),
        source: own ? 'own' : findExercise(pred.support.exId)?.name || pred.support.exId,
        ...library,
        readiness: Math.round(pred.avail * 1000) / 1000,
      }
    }
    if (!strengthMode(def, meta)) return null
    const belief = beliefFor({ ...args, def }, args.exId, cache)
    if (!belief) return null
    const est = beliefAt(belief, args.now)
    return {
      mode: belief.mode,
      oneRepMax: round(est.oneRepMax),
      maxReps: round(est.maxReps),
      confidence: est.confidence,
      last: belief.last,
      // Sets that were set aside (implausible or unreadable numbers), so they can be fixed.
      rejected: belief.rejected.filter((r) => r.reason === 'unusual' || (r.reason === 'unusable' && r.weight != null)),
      anchored: belief.anchored,
      source: 'own',
      ...library,
      readiness: 1,
    }
  } catch {
    failures++
    return null
  }
}

/**
 * Has this person trained long and consistently enough to move up a level?
 * A suggestion only; the person decides. Roughly: 16+ strength sessions over
 * 6+ weeks for "Some experience", 72+ over 6+ months for "Experienced".
 */
export function experienceSuggestion({ workouts = [], experience, today } = {}) {
  const days = realHistory(workouts, today)
    .filter((w) => !['sport', 'pump', 'recovery'].includes(w.kind) && (w.exercises || []).some((e) => (e.sets || []).some((x) => x.kind !== 'warmup')))
    .map((w) => w.date)
  const sessions = new Set(days).size
  if (sessions < 2) return null
  const weeks = (Date.parse(`${days.at(-1)}T12:00:00`) - Date.parse(`${days[0]}T12:00:00`)) / (7 * 86400000)
  if ((experience === 'Starting out' || !experience) && sessions >= 16 && weeks >= 6) return 'Some experience'
  if (experience === 'Some experience' && sessions >= 72 && weeks >= 26) return 'Experienced'
  return null
}

/** How recovered each muscle is right now (1 = fresh), and relative strengths. */
export function todayReadiness(args) {
  try {
    const G = graphNow(args)
    return { readiness: readiness(G.fatigue), strengths: muscleStrengths(G) }
  } catch {
    failures++
    return null
  }
}

/** Available strength right now for one exercise (1 = fully fresh). */
export function exerciseReadiness(args, exId) {
  try {
    const G = graphNow(args)
    const profile = exerciseProfile(exId)
    return profile ? availability(G.fatigue, profile) : 1
  } catch {
    failures++
    return 1
  }
}
