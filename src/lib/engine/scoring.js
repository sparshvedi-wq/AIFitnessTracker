// Transparent, normalized features for each eligible exercise.
//
// Every feature is scaled to a known range before weighting (config.WEIGHTS),
// kept separate in the result, and reported in the decision record. Hard
// restrictions are applied earlier (eligibility.js); nothing here can make an
// excluded exercise eligible. Comfort, enjoyment, benefit and cost are never
// divided into a single invented ratio.
import { movementSimilarity, metaOf } from '../catalog/index.js'
import { MUSCLE_AREA } from '../catalog/vocabulary.js'
import { EXPLORATION, LEARNING, SPORT_PRIORITY_SCALE, WEIGHTS } from './config.js'
import { rng, sampleBeta } from './rng.js'

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

// How well a role and loading type serves each goal (0..1).
const GOAL_FIT = {
  'Lose weight': { compoundLoaded: 0.85, compoundBody: 0.9, accessory: 0.7, isolation: 0.5, control: 0.5 },
  'Get stronger': { compoundLoaded: 0.85, compoundBody: 0.55, accessory: 0.5, isolation: 0.3, control: 0.25 },
  'Build muscle': { compoundLoaded: 0.95, compoundBody: 0.75, accessory: 0.8, isolation: 0.7, control: 0.3 },
  'General fitness': {
    compoundLoaded: 0.85,
    compoundBody: 0.9,
    accessory: 0.7,
    isolation: 0.5,
    control: 0.5,
  },
  'Sport performance': {
    compoundLoaded: 0.85,
    compoundBody: 0.8,
    accessory: 0.65,
    isolation: 0.35,
    control: 0.5,
  },
}
export function goalFit(meta, goal) {
  const table = GOAL_FIT[goal] || GOAL_FIT['General fitness']
  const loaded = !['bw', 'band'].includes(meta.load)
  let v =
    meta.role === 'compound'
      ? loaded
        ? table.compoundLoaded
        : table.compoundBody
      : (table[meta.role] ?? table.control)
  // Barbell lifts suit strength goals best, then plate-loaded and stack machines.
  if (goal === 'Get stronger' && meta.role === 'compound')
    v += { bar: 0.15, landmine: 0.05, plate: 0.05, stack: 0 }[meta.load] ?? -0.05
  if (goal === 'Sport performance' && (meta.perSide || meta.family === 'core-anti-rotation')) v += 0.1
  return clamp(v)
}

const SHARES = new WeakMap()
/** Primary/secondary share of each broad area for one exercise (sums to 1). */
export function areaShares(meta) {
  if (SHARES.has(meta)) return SHARES.get(meta)
  const result = computeShares(meta)
  SHARES.set(meta, result)
  return result
}
function computeShares(meta) {
  const shares = {}
  for (const m of meta.primary) shares[MUSCLE_AREA[m]] = Math.max(shares[MUSCLE_AREA[m]] || 0, 1)
  for (const m of meta.secondary) shares[MUSCLE_AREA[m]] = Math.max(shares[MUSCLE_AREA[m]] || 0, 0.5)
  if (!meta.primary.length) for (const a of meta.areas) shares[a] = 0.5
  const total = Object.values(shares).reduce((a, b) => a + b, 0) || 1
  return Object.fromEntries(Object.entries(shares).map(([a, s]) => [a, s / total]))
}

/**
 * @param meta     candidate metadata
 * @param ctx      planning context from recommend.js
 * @returns {{ features: Record<string, number>, score: number, sample: object }}
 */
export function scoreCandidate(meta, ctx) {
  const f = {}
  const shares = areaShares(meta)
  const signal = ctx.signals.get(meta.id)
  f.goal = goalFit(meta, ctx.goal)
  f.need = clamp(Object.entries(shares).reduce((n, [a, s]) => n + s * (ctx.needs[a] ?? 0), 0))
  const primaryAreas = [...new Set(meta.primary.map((m) => MUSCLE_AREA[m]))]
  const focusStrength = (a) => ctx.focusStrength?.[a] ?? (ctx.focusAreas.has(a) ? 1 : 0)
  f.focus = Math.max(
    0,
    ...primaryAreas.map(focusStrength),
    ...Object.keys(shares).map((a) => 0.4 * focusStrength(a)),
  )
  f.sport =
    ctx.sportAreas.size && primaryAreas.some((a) => ctx.sportAreas.has(a))
      ? (SPORT_PRIORITY_SCALE[ctx.sportPriority] ?? 0.5)
      : 0
  if (ctx.preparationAreas.size && primaryAreas.some((a) => ctx.preparationAreas.has(a)))
    f.sport = Math.max(f.sport, 0.6)
  // Areas to keep fresh around a planned sport event: a strong soft penalty.
  f.eventProtect = primaryAreas.some((a) => ctx.protectedAreas.has(a)) ? 1 : 0

  // Unfinished work from earlier sessions, reassessed now.
  f.rollover = 0
  for (const c of ctx.rollover) {
    const v = c.exId === meta.id ? c.priority : c.family && c.family === meta.family ? 0.7 * c.priority : 0
    if (v > f.rollover) {
      f.rollover = clamp(v)
      f.rolloverSource = c.source
    }
  }

  // What this person has told us, or shown repeatedly.
  f.preference = signal ? signal.enjoyment.score : 0
  // Choosing the same substitute at this place more than once is strong evidence.
  if (signal?.chosenAsSubstituteHere >= 1.5) f.preference = clamp(f.preference + 0.6, -1, 1)
  else if (signal?.chosenAsSubstituteHere >= 0.75) f.preference = clamp(f.preference + 0.25, -1, 1)
  // Counts fade with time, so "more than once" is judged on the faded total.
  if (signal?.substitutedAwayHere >= 1.5) f.preference = clamp(f.preference - 0.4, -1, 1)
  else if (signal?.substitutedAwayHere >= 0.75) f.preference = clamp(f.preference - 0.2, -1, 1)
  f.comfort = signal?.comfort.status === 'some' ? -0.6 : 0
  // Discomfort reported for a close sibling (same family and position) is a mild caution only.
  const siblingConcern = ctx.siblingDiscomfort.get(`${meta.family}|${meta.position}`)
  if (siblingConcern && siblingConcern !== meta.id) f.comfort -= LEARNING.siblingShare.discomfort
  f.confidence = signal?.difficulty === 'hard' && ctx.easy ? -0.5 : 0
  const trend = ctx.trends.get(meta.id)
  f.progression = trend ? { up: 1, flat: 0.3, down: -0.2, unknown: 0 }[trend.direction] : 0
  const completions = signal?.completions || 0
  f.familiarity =
    clamp(Math.log2(1 + completions) / 3) *
    (ctx.variety === 'familiar' ? 1.6 : ctx.variety === 'more' ? 0.4 : 1)
  f.staple = meta.staple ? 1 : 0
  f.setup = -clamp(meta.setupSec / 120) - (signal?.setup.awkwardHere ? 1 : 0)
  f.replacement = ctx.preferredReplacements.has(meta.id) ? 1 : 0
  // Use what the place offers: listed home equipment, or the gym's stations.
  f.placeAffinity =
    ctx.placeType === 'equipment'
      ? meta.equipment.length
        ? 1
        : 0
      : ctx.placeType === 'gym'
        ? ['barbell', 'machine', 'cable'].includes(meta.equipmentClass) || meta.position === 'bench'
          ? 1
          : meta.equipment.length
            ? 0.5
            : 0
        : 0

  // Overlap with recent completed work, kept as three separate features.
  const capacity = ctx.capacity
  f.muscleOverlap = clamp(
    Object.entries(shares).reduce(
      (n, [a, s]) => n + s * Math.min(1.5, (ctx.exposure.area[a]?.recent || 0) / capacity),
      0,
    ) / 1.5,
  )
  const familyRecent = ctx.exposure.family[meta.family]?.recent || 0
  const ownRecent = ctx.exposure.exercise[meta.id]?.recent || 0
  f.similarRepeat = clamp((familyRecent - ownRecent) / 4)
  // The same exercise again soon: two recent working sets already count fully.
  f.exactRepeat = clamp(ownRecent / 2)
  // The same movement pattern again soon (any exercise), beyond this family.
  f.patternRepeat = clamp(((ctx.exposure.pattern[meta.pattern]?.recent || 0) - familyRecent) / 4)
  // Repeating the same exercise, or a close variant, later the same day.
  const dayStart = ctx.dayStart
  f.sameDay =
    (ctx.exposure.exercise[meta.id]?.lastAt || 0) >= dayStart
      ? 1
      : (ctx.exposure.family[meta.family]?.lastAt || 0) >= dayStart
        ? 0.5
        : 0
  // Repeating a main lift a couple of days later is useful practice for strength goals.
  const lastAt = ctx.exposure.exercise[meta.id]?.lastAt || 0
  const hoursSince = lastAt ? (ctx.now - lastAt) / 3600000 : Infinity
  f.practice =
    ctx.goal === 'Get stronger' &&
    meta.role === 'compound' &&
    ctx.level >= 1 &&
    hoursSince >= 44 &&
    hoursSince <= 120
      ? 1
      : 0

  const w = WEIGHTS
  let score =
    w.goal * f.goal +
    w.need * f.need +
    w.focus * f.focus +
    w.sport * f.sport -
    2.5 * f.eventProtect +
    w.rollover * f.rollover +
    w.preference * f.preference +
    w.comfort * f.comfort +
    w.confidence * f.confidence +
    w.progression * f.progression +
    w.familiarity * f.familiarity +
    w.staple * f.staple +
    w.setup * f.setup +
    w.replacement * f.replacement +
    w.placeAffinity * f.placeAffinity -
    w.muscleOverlap * f.muscleOverlap -
    w.similarRepeat * f.similarRepeat -
    w.patternRepeat * f.patternRepeat -
    w.exactRepeat * f.exactRepeat * (f.practice ? 0.4 : 1) -
    w.sameDay * f.sameDay +
    0.4 * f.practice

  // Bounded, uncertainty-aware exploration on "accepted as planned".
  const sample = explorationSample(meta, signal, ctx)
  score += WEIGHTS.preference * sample.adjustment
  return { features: f, score, sample }
}

/**
 * Thompson-style sample of the acceptance posterior. Exploration only shifts
 * the score within families where learning could change future choices, never
 * on easy days, and never for people who prefer familiar exercises.
 */
export function explorationSample(meta, signal, ctx) {
  const [a0, b0] = EXPLORATION.prior
  const alpha = a0 + (signal?.acceptance.accepted || 0)
  const beta = b0 + (signal?.acceptance.rejected || 0)
  const mean = alpha / (alpha + beta)
  // Trying a variant only counts as exploration when this person already has a
  // familiar exercise in the same family; for a newcomer the default staple is
  // simply the starting point.
  const familiar = ctx.familiarFamilies.has(meta.family)
  const exploratory = familiar && (signal?.completions || 0) < EXPLORATION.exploratoryBelow
  const open =
    familiar &&
    ctx.exploration !== 'off' &&
    ctx.variety !== 'familiar' &&
    !ctx.easy &&
    ctx.familiesToLearn.has(meta.family)
  if (!open || ctx.strategy === 'greedy')
    return { mean, value: mean, adjustment: 0, exploratory, alpha, beta }
  if (ctx.strategy === 'ucb') {
    // Deterministic optimism: a bonus proportional to the posterior's spread,
    // for rarely tried options only.
    const sd = Math.sqrt((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)))
    const adjustment = exploratory ? EXPLORATION.sampleWeight * sd : 0
    return { mean, value: mean + adjustment, adjustment, exploratory, alpha, beta }
  }
  if (ctx.strategy === 'epsilon') {
    const draw = rng(`${ctx.seed}|eps|${meta.id}`)()
    const adjustment = exploratory && draw < 0.1 ? 0.5 : 0
    return { mean, value: mean + adjustment, adjustment, exploratory, alpha, beta }
  }
  const value = sampleBeta(alpha, beta, rng(`${ctx.seed}|ts|${meta.id}`))
  return { mean, value, adjustment: EXPLORATION.sampleWeight * (value - mean), exploratory, alpha, beta }
}

/**
 * Families where trying an alternative could change future suggestions: no
 * member is yet settled (familiar and well received, explicitly liked, or a
 * substitute chosen here more than once). A family where the usual choice
 * was skipped or swapped away stays open until something else settles it.
 */
export function familiesToLearn(eligible, signals) {
  const settled = new Set()
  for (const meta of eligible) {
    const s = signals.get(meta.id)
    if (!s) continue
    const accepted = s.acceptance.accepted
    const rejected = s.acceptance.rejected
    // Settled: a familiar, well-received choice, an explicit "yes", or a
    // substitute the person has chosen here more than once.
    if (
      (s.completions >= 3 && s.enjoyment.score >= 0 && accepted / Math.max(1, accepted + rejected) >= 0.6) ||
      s.enjoyment.explicit === 'yes' ||
      s.chosenAsSubstituteHere >= 1.5
    )
      settled.add(meta.family)
  }
  const out = new Set()
  for (const meta of eligible) if (!settled.has(meta.family)) out.add(meta.family)
  return out
}

/** Pairwise overlap inside one session: movement similarity plus shared primary areas. */
export function pairOverlap(a, b) {
  const sim = movementSimilarity(a, b)
  const pa = new Set(a.primary.map((m) => MUSCLE_AREA[m]))
  const pb = new Set(b.primary.map((m) => MUSCLE_AREA[m]))
  const shared = [...pa].filter((x) => pb.has(x)).length
  const union = new Set([...pa, ...pb]).size || 1
  return sim + 0.5 * (shared / union)
}

export { metaOf }
