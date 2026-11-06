// The canonical exercise catalog: explicit metadata for every built-in
// exercise, validated once at load. Exercises with missing or unreviewed
// essentials are browse-only: they can be picked by hand but are never
// recommended automatically. Custom exercises have no metadata and are
// therefore browse-only too.
import {
  CATALOG_VERSION,
  CAPABILITIES,
  JOINT_ACTIONS,
  KINDS,
  LOAD_CONVENTIONS,
  MUSCLE_AREA,
  PATTERN_REGION,
  POSITIONS,
  ROLES,
} from './vocabulary.js'
import { CORE_METADATA } from './core-metadata.js'
import { IMPORTED } from './imported.js'
import { IMPORT_MANIFEST } from './import-manifest.js'

export { CATALOG_VERSION }

const list = (value) => (value ? String(value).split(/\s+/).filter(Boolean) : [])
const LATERALITY = ['bi', 'uni', 'alt', 'alt-total', 'hold-switch']
const ESSENTIAL = ['p', 'pat', 'fam', 'j', 'eq', 'pos', 'lat', 'sp', 'no', 'im', 'lv', 'k', 'load', 'role']

function parseEquipment(code) {
  // 'db+bench' -> [['db'], ['bench']]; 'db|kb' -> [['db', 'kb']]
  if (!code) return []
  return code.split('+').map((group) => group.split('|').filter(Boolean))
}

function setupSeconds(equipment, override) {
  if (Number.isFinite(override)) return override
  const flat = equipment.flat()
  if (flat.includes('bb')) return flat.includes('rack') ? 60 : 45
  if (flat.some((c) => ['machine', 'hack', 'belt', 'pendulum'].includes(c))) return 30
  if (flat.includes('landmine')) return 40
  if (flat.includes('trx')) return 30
  if (flat.includes('cable')) return 25
  if (flat.includes('anchor')) return 30
  if (flat.some((c) => ['db', 'kb', 'band', 'loop', 'ball', 'slider', 'wheel', 'step'].includes(c)))
    return flat.includes('bench') || flat.includes('incline') ? 25 : 15
  if (flat.includes('bench')) return 15
  return 5
}

// Coarse equipment class: changing class between exercises costs transition time.
export function equipmentClass(meta) {
  const flat = meta.equipment.flat()
  if (flat.includes('bb')) return 'barbell'
  if (flat.some((c) => ['machine', 'hack', 'belt', 'pendulum'].includes(c))) return 'machine'
  if (flat.includes('cable')) return 'cable'
  if (flat.some((c) => ['db', 'kb'].includes(c))) return 'free-weight'
  if (flat.some((c) => ['band', 'loop', 'anchor', 'trx'].includes(c))) return 'band'
  return flat.length ? 'other' : 'bodyweight'
}

export function validateRaw(id, raw) {
  const issues = []
  for (const key of ESSENTIAL)
    if ((raw[key] === undefined || raw[key] === null) && !(key === 'p' && raw.areas)) issues.push(`missing ${key}`)
  for (const m of [...list(raw.p), ...list(raw.s), ...list(raw.st)])
    if (!MUSCLE_AREA[m]) issues.push(`unknown muscle ${m}`)
  for (const j of list(raw.j)) if (!JOINT_ACTIONS[j]) issues.push(`unknown joint action ${j}`)
  for (const c of parseEquipment(raw.eq).flat()) if (!CAPABILITIES[c]) issues.push(`unknown capability ${c}`)
  if (raw.pos && !POSITIONS.includes(raw.pos)) issues.push(`unknown position ${raw.pos}`)
  if (raw.lat && !LATERALITY.includes(raw.lat)) issues.push(`unknown laterality ${raw.lat}`)
  if (raw.load && !LOAD_CONVENTIONS[raw.load]) issues.push(`unknown load convention ${raw.load}`)
  if (raw.role && !ROLES.includes(raw.role)) issues.push(`unknown role ${raw.role}`)
  if (raw.pat && !PATTERN_REGION[raw.pat]) issues.push(`unknown pattern ${raw.pat}`)
  for (const k of String(raw.k || '')) if (!KINDS[k]) issues.push(`unknown kind ${k}`)
  if (!['s', 'o'].includes(raw.sp)) issues.push('space must be s or o')
  if (!['q', 'm', 'l'].includes(raw.no)) issues.push('noise must be q, m or l')
  if (![0, 1, 2].includes(raw.im)) issues.push('impact must be 0, 1 or 2')
  if (![0, 1, 2].includes(raw.lv)) issues.push('level must be 0, 1 or 2')
  if (!raw.areas && !list(raw.p).length) issues.push('no primary muscle')
  return issues
}

function expand(id, raw, { image }) {
  const issues = validateRaw(id, raw)
  const primary = list(raw.p)
  const secondary = list(raw.s)
  const stabilizers = list(raw.st)
  const equipment = parseEquipment(raw.eq)
  const areas = raw.areas
    ? list(raw.areas)
    : [...new Set([...primary, ...secondary].map((m) => MUSCLE_AREA[m]).filter(Boolean))]
  const kinds = [...String(raw.k || '')].map((k) => KINDS[k]).filter(Boolean)
  return {
    id,
    primary,
    secondary,
    stabilizers,
    areas,
    pattern: raw.pat,
    region: PATTERN_REGION[raw.pat] || null,
    family: raw.fam,
    joints: list(raw.j),
    equipment,
    support: list(raw.sup),
    position: raw.pos,
    laterality: raw.lat,
    // Reps logged per side double the work time of a set.
    perSide: ['uni', 'alt'].includes(raw.lat),
    space: raw.sp === 'o' ? 'open' : 'small',
    noise: { q: 'quiet', m: 'moderate', l: 'loud' }[raw.no],
    impact: raw.im,
    level: raw.lv,
    kinds,
    load: raw.load,
    role: raw.role,
    staple: Boolean(raw.staple),
    tempo: Number.isFinite(raw.tempo) ? raw.tempo : 3,
    setupSec: setupSeconds(equipment, raw.setup),
    variationOf: raw.var || null,
    image,
    reviewed: issues.length === 0,
    issues,
  }
}

const META = {}
for (const [id, raw] of Object.entries(CORE_METADATA)) META[id] = expand(id, raw, { image: true })
for (const def of IMPORTED) META[def.id] = expand(def.id, def.meta, { image: false })
for (const meta of Object.values(META)) meta.equipmentClass = equipmentClass(meta)

// Aliases: legacy names that differ from the canonical name stay searchable.
const ALIASES = {}
for (const row of IMPORT_MANIFEST) {
  ;(ALIASES[row.id] ||= new Set()).add(row.name)
}

/** Definitions (name, cues, logging) for the imported exercises. */
export const IMPORTED_EXERCISES = IMPORTED.map(({ id, name, muscle, type, weighted, cues }) => ({
  id,
  name,
  muscle,
  type,
  weighted,
  cues,
}))

export function aliasesOf(id, name = '') {
  return [...(ALIASES[id] || [])].filter((a) => a.toLowerCase() !== name.toLowerCase())
}

/** Canonical metadata for a built-in exercise, or null (custom or unknown). */
export function metaOf(id) {
  return META[id] || null
}
export function allMeta() {
  return Object.values(META)
}

/** True only for reviewed built-ins of this session kind; unknown never means allowed. */
export function plannable(id, kind = 'strength') {
  const meta = META[id]
  return Boolean(meta && meta.reviewed && meta.kinds.includes(kind))
}

/**
 * How much two exercises overlap as movements, 0..1. Same ID 1; same family
 * 0.8; same pattern 0.45 + 0.3 × joint-action overlap; otherwise joint-action
 * overlap scaled down. Muscle overlap is accounted separately (engine/load.js).
 */
export function movementSimilarity(a, b) {
  if (!a || !b) return 0
  if (a.id === b.id) return 1
  const shared = a.joints.filter((j) => b.joints.includes(j)).length
  const union = new Set([...a.joints, ...b.joints]).size || 1
  const jaccard = shared / union
  if (a.family === b.family) return 0.8
  if (a.pattern === b.pattern) return 0.45 + 0.3 * jaccard
  return 0.4 * jaccard
}

/** Counts for the source-to-canonical import report (docs/EXERCISE_CATALOG_IMPORT.md). */
export function importReport(existingIds) {
  const byRelation = (r) => IMPORT_MANIFEST.filter((row) => row.relation === r)
  const importedIds = new Set(IMPORTED.map((d) => d.id))
  const variations = IMPORTED.filter((d) => d.meta.var)
  const mappedExisting = new Set(byRelation('existing').map((r) => r.id))
  return {
    sourceRecords: IMPORT_MANIFEST.length,
    toRetainedInkIds: byRelation('existing').length,
    retainedInkIdsMatched: mappedExisting.size,
    synonymsOfImported: byRelation('synonym').length,
    newDefinitions: importedIds.size,
    meaningfulVariations: variations.length,
    newMovements: importedIds.size - variations.length,
    inkOnlyRetained: existingIds.filter((id) => !mappedExisting.has(id)).length,
    finalUnique: existingIds.length + importedIds.size,
  }
}
