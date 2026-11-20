// Hard constraints. An exercise that fails any of these is never recommended
// automatically, whatever its benefit, and no score can outweigh it.
// Unknown metadata never means allowed.
import { allMeta } from '../catalog/index.js'
import { GYM_CAPABILITIES, capabilitiesFor } from '../catalog/vocabulary.js'
import { movementAllowed } from '../movement-preferences.js'

export const EXPERIENCE_LEVEL = { 'Starting out': 0, 'Some experience': 1, Experienced: 2 }

/** Capabilities a place offers. A gym has a configured full set plus any listed extras. */
export function placeCapabilities(place) {
  if (!place) return new Set()
  if (place.type === 'gym') return new Set([...GYM_CAPABILITIES, ...capabilitiesFor(place.equipment || [])])
  if (place.type === 'space') return new Set()
  return new Set(capabilitiesFor(place.equipment || []))
}

/** Environment supports: a wall to lean on; a stable seat (bench or chair). */
export function placeSupports(place, movement) {
  const supports = new Set()
  if (!movement || movement.wall !== false) supports.add('wall')
  if (place?.type !== 'space' || movement?.position === 'seated') supports.add('seat')
  return supports
}

export const equipmentSatisfied = (meta, caps) =>
  meta.equipment.every((alternatives) => alternatives.some((c) => caps.has(c)))

/**
 * @param meta canonical metadata
 * @param ctx  { kind, caps, supports, movement, quiet, level, excluded: Set,
 *               blockedAreas: Set, signals: Map, replaced: Set }
 * @returns {string|null} the first failing rule code, or null if eligible
 */
export function ineligibility(meta, ctx) {
  if (!meta || !meta.reviewed) return 'unreviewed'
  if (ctx.kind && !meta.kinds.includes(ctx.kind)) return 'kind'
  if (ctx.excluded?.has(meta.id)) return 'excluded'
  if (!equipmentSatisfied(meta, ctx.caps)) return 'equipment'
  if (meta.support.some((s) => !ctx.supports.has(s))) return 'support'
  if (ctx.movement && !movementAllowed(meta.id, ctx.movement)) return 'space-or-position'
  if (ctx.quiet && (meta.impact >= 2 || meta.noise === 'loud')) return 'quiet'
  if (meta.level > (ctx.level ?? 0)) return 'experience'
  if (meta.areas.some((a) => ctx.blockedAreas?.has(a))) return 'avoided-area'
  const signal = ctx.signals?.get(meta.id)
  if (signal?.comfort.restricted) return 'reported-discomfort'
  if (signal?.explicitDislike) return 'explicit-dislike'
  if (ctx.replaced?.has(meta.id)) return 'replaced'
  return null
}

/** Every built-in exercise with its eligibility verdict for this context. */
export function screenCatalog(ctx) {
  const eligible = []
  const excluded = {}
  for (const meta of allMeta()) {
    const code = ineligibility(meta, ctx)
    if (code) excluded[code] = (excluded[code] || 0) + 1
    else eligible.push(meta)
  }
  return { eligible, excluded }
}
