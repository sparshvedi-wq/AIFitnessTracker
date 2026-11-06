// Choosing a set of exercises: a bounded beam search over combinations,
// with a greedy baseline kept for comparison (scripts/engine-evaluation.mjs).
//
// The objective adds each exercise's score, rewards covering areas that still
// need work, and subtracts overlap between exercises in the same session and
// equipment changes. Constraints: one exercise per movement pattern and
// family, one per display muscle, a bounded number of exploratory picks,
// upper and lower body both present in two-exercise sessions when possible,
// and the whole session (one set each) within the time budget.
import { MUSCLE_AREA } from '../catalog/vocabulary.js'
import { SELECTION, TIMING } from './config.js'
import { areaShares, pairOverlap } from './scoring.js'
import { planSeconds } from './session-time.js'
import { tiebreak } from './rng.js'

const UPPER = new Set(['push', 'pull', 'arms'])
const regionOf = (meta) => (meta.region === 'lower' ? 'lower' : UPPER.has(meta.region) ? 'upper' : 'other')

// Pairwise overlap is symmetric and reused across many beam states.
const PAIRS = new Map()
function overlapOf(a, b) {
  const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
  let v = PAIRS.get(key)
  if (v === undefined) {
    v = pairOverlap(a, b)
    PAIRS.set(key, v)
  }
  return v
}

/**
 * Objective, computed incrementally: adding one candidate to a state adds its
 * score, its new area coverage weighted by need, and subtracts its overlap
 * with what is already chosen and any new equipment class.
 */
function extend(state, c, ctx, overlapWith = (x) => overlapOf(x.meta, c.meta)) {
  const covered = { ...state.covered }
  let coverageGain = 0
  for (const [a, share] of Object.entries(areaShares(c.meta))) {
    const before = covered[a] || 0
    const after = Math.min(1, before + share * 1.5)
    covered[a] = after
    coverageGain += (after - before) * (ctx.needs[a] ?? 0)
  }
  let overlap = 0
  for (const x of state.chosen) overlap += overlapWith(x)
  const classes = state.classes.includes(c.meta.equipmentClass)
    ? state.classes
    : [...state.classes, c.meta.equipmentClass]
  let focusGain = 0
  let direct = state.direct
  if (ctx.focusAreas?.size)
    for (const a of primaryAreas(c.meta))
      if (ctx.focusAreas.has(a) && !direct.includes(a)) {
        direct = [...direct, a]
        focusGain += SELECTION.focusBonus
      }
  return {
    chosen: [...state.chosen, c],
    covered,
    classes,
    direct,
    mask: state.mask + 2 ** c.index,
    value:
      state.value +
      c.score +
      SELECTION.coverageBonus * coverageGain -
      SELECTION.sessionOverlapPenalty * overlap -
      (classes.length > state.classes.length && state.classes.length ? 0.15 : 0) +
      focusGain,
  }
}
const EMPTY = { chosen: [], covered: {}, classes: [], direct: [], value: 0, mask: 0 }

function fits(chosen, candidate, ctx) {
  if (chosen.some((c) => c.meta.id === candidate.meta.id)) return false
  if (chosen.filter((c) => c.meta.pattern === candidate.meta.pattern).length >= SELECTION.maxPerPattern) return false
  if (chosen.some((c) => c.meta.family === candidate.meta.family)) return false
  // No broad area is the main target of more than two exercises.
  const areas = primaryAreas(candidate.meta)
  if (areas.some((a) => chosen.filter((c) => primaryAreas(c.meta).includes(a)).length >= 2)) return false
  if (chosen.some((c) => c.def.muscle === candidate.def.muscle && c.meta.role !== 'compound' && candidate.meta.role !== 'compound'))
    return false
  if (candidate.sample.exploratory && candidate.explorable) {
    const explore = chosen.filter((c) => c.sample.exploratory && c.explorable).length
    if (explore >= ctx.maxExplore) return false
  }
  return planSeconds([...chosen, candidate].map((c) => c.item)) + ctx.easeIn <= ctx.budget
}

// In a two-exercise session, keep upper and lower body when both are possible.
function balanced(chosen, pool) {
  if (chosen.length !== 2) return true
  const regions = new Set(chosen.map((c) => regionOf(c.meta)))
  const has = (r) => pool.some((c) => regionOf(c.meta) === r)
  return !(has('upper') && has('lower')) || (regions.has('upper') && regions.has('lower'))
}

const PRIMARY = new WeakMap()
function primaryAreas(meta) {
  if (!PRIMARY.has(meta)) PRIMARY.set(meta, [...new Set(meta.primary.map((m) => MUSCLE_AREA[m]))])
  return PRIMARY.get(meta)
}

const order = (seed) => (a, b) => b.score - a.score || tiebreak(seed, a.meta.id) - tiebreak(seed, b.meta.id)

/** Greedy baseline: take the best-scoring candidate that still fits, in order. */
export function selectGreedy(candidates, ctx) {
  const pool = [...candidates].sort(order(ctx.seed)).slice(0, SELECTION.candidatePool)
  const chosen = []
  for (const c of pool) {
    if (chosen.length >= ctx.maxItems) break
    if (!fits(chosen, c, ctx)) continue
    if (chosen.length === 1 && ctx.maxItems === 2) {
      const next = [...chosen, c]
      if (!balanced(next, pool)) continue
    }
    chosen.push(c)
  }
  return chosen
}

/** Beam search over combinations; returns the best feasible set found. */
export function selectBeam(candidates, ctx) {
  // Up to 40 candidates: a subset fits exactly in a number used as a bit mask.
  const pool = [...candidates]
    .sort(order(ctx.seed))
    .slice(0, SELECTION.candidatePool)
    .map((c, index) => ({ ...c, index }))
  const matrix = pool.map((a) => pool.map((b) => (a === b ? 0 : overlapOf(a.meta, b.meta))))
  let beam = [EMPTY]
  let best = { ...EMPTY, value: -Infinity }
  for (let depth = 0; depth < ctx.maxItems; depth++) {
    const next = []
    const seen = new Set()
    for (const state of beam) {
      for (const c of pool) {
        const mask = state.mask + 2 ** c.index
        if (state.mask % 2 ** (c.index + 1) >= 2 ** c.index || seen.has(mask)) continue
        if (!fits(state.chosen, c, ctx)) continue
        seen.add(mask)
        next.push(extend(state, c, ctx, (x) => matrix[x.index][c.index]))
      }
    }
    if (!next.length) break
    // Ties break on the subset itself, so the result never depends on array order.
    next.sort((a, b) => b.value - a.value || a.mask - b.mask)
    beam = next.slice(0, SELECTION.beamWidth)
    for (const state of beam) {
      if (state.chosen.length < ctx.minItems || !balanced(state.chosen, pool)) continue
      if (state.value > best.value) best = state
    }
  }
  // If nothing meets the minimum count, keep the best smaller feasible set.
  if (!best.chosen.length && beam[0]?.chosen.length) best = beam[0]
  // A bounded search can prune the greedy path. Keep that feasible baseline
  // as a fallback rather than knowingly returning a worse objective.
  const greedy = selectGreedy(candidates, ctx)
  if ((greedy.length >= ctx.minItems || best.chosen.length < ctx.minItems) && selectionValue(greedy, ctx) > best.value)
    return greedy
  return best.chosen
}

/** The objective of a finished selection (for evaluation and tests). */
export function selectionValue(chosen, ctx) {
  return chosen.reduce((state, c, i) => extend(state, { ...c, index: i }, ctx), EMPTY).value
}

export const EASE_IN = TIMING.easeInSec
export { MUSCLE_AREA }
