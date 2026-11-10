// From a strength belief to a weight and rep count someone can actually do.
//
// Load exercises: work backwards from the (slightly conservative) estimated
// max to the reps each available weight allows at the target reps-in-reserve,
// then pick the weight with double progression: stay at the current weight
// while reps climb through the range, move up only when the next real weight
// is comfortably inside the range (or the current one would pass the top), and
// move down only when the range can't be reached. Big equipment jumps add reps
// first. Bodyweight exercises progress in reps within a range.
import {
  BEGINNER_MIN_REPS,
  BODYWEIGHT_RANGE,
  CONSERVATISM,
  EXTRA_REPS_BEFORE_JUMP,
  JUMP,
  MAX_REP_INCREASE_BODYWEIGHT,
  REP_RANGES,
  TARGET_RIR,
} from './config.js'
import { fatigueFactor } from './model.js'
import { clamp, fractionAt, isNum, repsAtFraction } from './math.js'

/** Reps in reserve to aim for today. */
export function targetRir({ experience, easy = false, highEffort = false, returning = false } = {}) {
  let rir = TARGET_RIR[experience] ?? TARGET_RIR['Starting out']
  if (easy) rir += TARGET_RIR.easyBonus
  else if (returning) rir += TARGET_RIR.returningBonus
  else if (highEffort && experience === 'Experienced') rir += TARGET_RIR.challengingBonus
  return clamp(rir, TARGET_RIR.min, TARGET_RIR.max)
}

/** The rep range for an exercise: a saved routine's own reps win. */
export function repRange({ goal, experience, meta, mode, fixedReps } = {}) {
  const role = meta?.role || 'accessory'
  if (isNum(fixedReps) && fixedReps >= 1) {
    const reps = Math.round(clamp(fixedReps, 1, 50))
    return [reps, reps]
  }
  if (mode === 'reps') return BODYWEIGHT_RANGE[role] || BODYWEIGHT_RANGE.default
  const table = REP_RANGES[goal] || REP_RANGES['General fitness']
  let [lo, hi] = table[role] || table.accessory
  if ((experience === 'Starting out' || !experience) && lo < BEGINNER_MIN_REPS) {
    lo = BEGINNER_MIN_REPS
    hi = Math.max(hi, lo + 2)
  }
  return [lo, hi]
}

/** Fatigue at the middle planned set, so a plan is right on average across its sets. */
function plannedFactor({ sets = 1, rir, before = [], mode }) {
  const middle = Math.floor((Math.max(1, sets) - 1) / 2)
  return fatigueFactor([...before, ...new Array(middle).fill(rir)], mode)
}

const codeFor = ({ weight, reps, ref, last }) => {
  if (!last) return 'first'
  if (isNum(ref) && isNum(weight)) {
    if (weight > ref + 1e-6) return 'load-up'
    if (weight < ref - 1e-6) return 'load-down'
  }
  if (reps > last.reps) return 'reps-up'
  if (reps < last.reps) return 'reps-down'
  return 'hold'
}

/**
 * @param {object} belief  output of beliefAt (load mode)
 * @param {object} args
 *   range [lo, hi], rir, sets, grid (loads.js), last { weight, reps, failed },
 *   current (weight to stay near in a live workout), before (RIRs of earlier
 *   sets today), transfer (belief borrowed from a related exercise),
 *   noIncrease, allowBigDrop
 */
export function prescribeLoad(belief, { range, rir, sets = 3, grid, last = null, current = null, before = [], transfer = false, noIncrease = false, allowBigDrop = false, lighterDay = false, floor = null, cautiousLevel = null, plannedA = null, externalOf = null, roomy = false }) {
  const [lo, hi] = range
  const sdCap = transfer ? CONSERVATISM.transferSdCap : CONSERVATISM.sdCap
  const sd = clamp(belief.sd, CONSERVATISM.sdFloor, sdCap)
  const kappa = transfer ? CONSERVATISM.transferWeight : CONSERVATISM.weight
  const k = belief.k
  // Fatigue at the middle planned set: from the shared muscle model when the
  // caller has it, otherwise the simple per-exercise estimate.
  const a = isNum(plannedA) ? plannedA : plannedFactor({ sets, rir, before, mode: 'load' })
  // Caution guards increases only. Repeating or easing off uses the best
  // estimate, so uncertainty never pushes a weight down by itself.
  // A caller may soften caution (when bodyweight is most of the load, a
  // small strength margin would otherwise strip most of the added weight).
  const E = Math.exp(isNum(cautiousLevel) ? Math.max(cautiousLevel, belief.level - kappa * sd) : belief.level - kappa * sd) * a
  const Emean = Math.exp(belief.level) * a
  const repsAtCautious = (w) => repsAtFraction(w / E, k) - rir
  const repsAtMean = (w) => repsAtFraction(w / Emean, k) - rir
  // The weight to stay near: today's planned weight, or last time's top weight.
  const anchor = isNum(current) && current > 0 ? current : isNum(last?.weight) && last.weight > 0 ? last.weight : null
  const ref = anchor === null ? null : grid.has(anchor) ? anchor : grid.atMost(anchor)
  const wHi = Emean * fractionAt(Math.max(1, lo + rir - 4), k)
  const wLo = E * fractionAt(hi + rir + EXTRA_REPS_BEFORE_JUMP + 6, k)
  // Above the reference (or with no reference) a weight must be earned with
  // the cautious estimate; at or below it, the best estimate decides.
  const repsAt = (w) => (ref === null || w > ref + 1e-6 || transfer ? repsAtCautious(w) : repsAtMean(w))
  const pool = new Set(grid.between(wLo, wHi))
  if (ref !== null) {
    pool.add(ref)
    for (const dir of [1, -1]) {
      const n = grid.next(ref, dir)
      if (n !== null) pool.add(n)
    }
  }
  if (!pool.size) pool.add(grid.atMost(wHi))
  // The added weight itself must not jump either (a goblet squat's bell is a
  // small part of the load moved, so a 10% rise in total could double it).
  const extRatio = (w) => {
    if (!externalOf) return w / ref
    const base = externalOf(ref)
    return base > 1e-9 ? externalOf(w) / base : 1
  }
  // Someone who just said they could do many more reps may take a bigger step.
  const freeLimit = roomy ? JUMP.roomy : JUMP.free
  const extLimit = roomy ? JUMP.roomyExternal : JUMP.smallestStepMax
  const allowed = (w) => {
    if (ref === null) return true
    if ((noIncrease || lighterDay) && w > ref + 1e-6) return false
    const ratio = w / ref
    if (ratio < JUMP.bigDropFloor - 1e-9 && !allowBigDrop) return false
    if (ratio <= 1 + freeLimit + 1e-9 && (w <= ref + 1e-6 || extRatio(w) <= 1 + extLimit + 1e-9)) return true
    const smallest = grid.next(ref, 1)
    if (smallest !== null && Math.abs(w - smallest) < 1e-6)
      return roomy || ratio <= 1 + JUMP.smallestStepMax + 1e-9 || (belief.sd < JUMP.confidentSd && repsAt(w) >= lo + 1)
    return false
  }
  const options = [...pool].filter((w) => isNum(w) && w > 0 && allowed(w)).sort((x, y) => x - y)
  if (ref !== null && !options.some((w) => Math.abs(w - ref) < 1e-6)) options.push(ref)
  options.sort((x, y) => x - y)
  // The current weight stays unless the range is clearly out of reach (a rep
  // short is fine); other weights must reach the bottom of the range. On a
  // lighter day (easy, or returning after a break) the reps stay in range and
  // the weight comes down instead.
  const floorReps = lighterDay ? Math.ceil((lo + hi) / 2) : lo
  const grace = lighterDay ? 0.2 : 1
  const inRange = (w) => repsAt(w) >= floorReps - (ref !== null && Math.abs(w - ref) < 1e-6 ? grace : 0.2)
  let weight
  if (ref !== null && inRange(ref) && !lighterDay) {
    // Double progression: stay until the current weight passes the top of the
    // range or the next weight is comfortably inside it.
    const readyAtRef = repsAt(ref) > hi + 0.5
    const heavier = options.filter((w) => w > ref + 1e-6 && inRange(w) && (readyAtRef || repsAt(w) >= lo + 1))
    weight = heavier.length ? heavier.at(-1) : ref
  } else {
    const fits = options.filter(inRange)
    weight = fits.length ? fits.at(-1) : options[0]
  }
  const heavierExists = options.some((w) => w > weight + 1e-6) || grid.next(weight, 1) !== null
  const blocked = !options.some((w) => w > weight + 1e-6 && inRange(w))
  const atTop = blocked && (heavierExists || weight >= grid.max - 1e-6)
  const topReps = atTop && !lighterDay ? hi + EXTRA_REPS_BEFORE_JUMP : hi
  const capacity = repsAt(weight)
  let reps = clamp(Math.floor(capacity + 0.3), 1, Math.min(topReps, 50))
  if (noIncrease && isNum(last?.reps) && isNum(last?.weight) && Math.abs(weight - last.weight) < 1e-6) reps = Math.min(reps, last.reps)
  // Never ask for fewer reps than were just done comfortably at this weight.
  if (floor && isNum(floor.weight) && Math.abs(weight - floor.weight) < 1e-6 && isNum(floor.reps))
    reps = Math.max(reps, Math.min(floor.reps, topReps))
  const flags = []
  // Staying at the current weight allows a rep of grace before it counts as short.
  const shortBy = ref !== null && Math.abs(weight - ref) < 1e-6 ? grace : 0.2
  if (capacity < lo - shortBy) flags.push(weight <= grid.min + 1e-6 ? 'lightest-is-heavy' : 'below-range')
  if (reps > hi) flags.push('more-reps-before-jump')
  // Outgrown means no heavier weight exists here, not just a step limit.
  if (atTop && grid.next(weight, 1) === null && capacity > topReps + 0.5) flags.push('outgrown')
  if (transfer) flags.push('estimated-start')
  const predictedRir = Math.max(0, repsAtFraction(weight / (Math.exp(belief.level) * a), k) - reps)
  return {
    weight,
    reps,
    code: codeFor({ weight, reps, ref, last }),
    flags,
    predictedRir: Math.round(predictedRir * 10) / 10,
    reference: ref,
  }
}

/**
 * A load grid seen in effective-load terms (what is actually moved), so the
 * same weight choice works for barbells, per-hand dumbbells with bodyweight
 * (a goblet squat moves the bell plus ~77% of bodyweight) and assisted
 * machines (more assistance = less load).
 */
export function mappedGrid(grid, toEff, toLogged, decreasing = false) {
  const ends = [toEff(grid.min), toEff(grid.max)].filter(isNum)
  const min = Math.min(...ends)
  const max = Math.max(...ends)
  const list = (a, b) => {
    const la = toLogged(a)
    const lb = toLogged(b)
    if (!isNum(la) || !isNum(lb)) return []
    return grid
      .between(Math.min(la, lb), Math.max(la, lb))
      .map(toEff)
      .filter((v) => isNum(v) && v > 0)
      .sort((x, y) => x - y)
  }
  return {
    min,
    max,
    listed: grid.listed,
    between: (a, b) => list(Math.min(a, b), Math.max(a, b)),
    has: (e) => isNum(toLogged(e)) && grid.has(toLogged(e)),
    next(e, dir) {
      const n = grid.next(toLogged(e), decreasing ? -dir : dir)
      return n === null || !isNum(toEff(n)) || toEff(n) <= 0 ? null : toEff(n)
    },
    atMost(e) {
      if (!isNum(e)) return null
      const fits = list(min, e)
      return fits.length ? fits.at(-1) : min
    },
  }
}

/**
 * Reps for a fixed load (bodyweight exercises): capacity from the estimated
 * max in effective load, never more than three reps up from last time.
 */
export function prescribeAtLoad(belief, { load, range, rir, sets = 3, before = [], last = null, current = null, noIncrease = false, transfer = false, floor = null, plannedA = null, roomy = false }) {
  const [lo, hi] = range
  const sd = clamp(belief.sd, CONSERVATISM.sdFloor, transfer ? CONSERVATISM.transferSdCap : CONSERVATISM.sdCap)
  const kappa = transfer ? CONSERVATISM.transferWeight : CONSERVATISM.weight
  const a = isNum(plannedA) ? plannedA : plannedFactor({ sets, rir, before, mode: 'load' })
  const cautious = repsAtFraction(load / (Math.exp(belief.level - kappa * sd) * a), belief.k) - rir
  const mean = repsAtFraction(load / (Math.exp(belief.level) * a), belief.k) - rir
  // Repeating what was done uses the best estimate; adding reps is earned.
  const ref = isNum(current) && current > 0 ? current : isNum(last?.reps) ? last.reps : null
  const capacity = ref !== null && Math.floor(mean + 0.3) <= ref ? mean : cautious
  let reps = clamp(Math.floor(capacity + 0.3), 1, hi + EXTRA_REPS_BEFORE_JUMP)
  // Reps rise by a few at a time, or by half when "8 or more" were left.
  if (ref !== null) reps = Math.min(reps, roomy ? Math.max(ref + MAX_REP_INCREASE_BODYWEIGHT, Math.round(ref * 1.5)) : ref + MAX_REP_INCREASE_BODYWEIGHT)
  if (noIncrease && isNum(last?.reps)) reps = Math.min(reps, last.reps)
  // Never fewer reps than were just done comfortably (even past the range).
  if (floor && isNum(floor.reps)) reps = Math.max(reps, Math.min(floor.reps, 50))
  const flags = []
  if (mean < lo - 0.2) flags.push('below-range')
  if (mean > hi + EXTRA_REPS_BEFORE_JUMP + 0.5) flags.push('outgrown')
  if (transfer) flags.push('estimated-start')
  return {
    weight: null,
    reps,
    code: transfer ? 'estimated-start' : codeFor({ reps, last }),
    flags,
    predictedRir: Math.max(0, Math.round((mean + rir - reps) * 10) / 10),
    reference: ref,
  }
}

/** Bodyweight or band: reps only. */
export function prescribeReps(belief, { range, rir, sets = 3, last = null, current = null, before = [], noIncrease = false }) {
  const [lo, hi] = range
  const sd = clamp(belief.sd, CONSERVATISM.sdFloor, CONSERVATISM.sdCap)
  const a = plannedFactor({ sets, rir, before, mode: 'reps' })
  const capacity = Math.exp(belief.level - CONSERVATISM.weight * sd) * a - rir
  let reps = clamp(Math.floor(capacity + 0.3), 1, hi + EXTRA_REPS_BEFORE_JUMP)
  const ref = isNum(current) && current > 0 ? current : isNum(last?.reps) ? last.reps : null
  if (isNum(ref)) reps = Math.min(reps, ref + MAX_REP_INCREASE_BODYWEIGHT)
  if (noIncrease && isNum(last?.reps)) reps = Math.min(reps, last.reps)
  const flags = []
  if (capacity < lo - 0.2) flags.push('below-range')
  if (capacity > hi + EXTRA_REPS_BEFORE_JUMP + 0.5) flags.push('outgrown')
  return { weight: null, reps, code: codeFor({ reps, last }), flags, predictedRir: Math.max(0, Math.round((capacity + rir - reps) * 10) / 10), reference: ref }
}
