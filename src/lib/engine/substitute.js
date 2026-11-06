// Finding a suitable alternative for one exercise: same hard rules as daily
// plans, ranked by movement similarity first, then by what this person has
// accepted before, then by simplicity. A short list stays varied so it does
// not offer four near-identical options.
import { allMeta, metaOf, movementSimilarity } from '../catalog/index.js'
import { MUSCLE_AREA } from '../catalog/vocabulary.js'
import { findExercise } from '../exercises.js'
import { ineligibility } from './eligibility.js'

const primaryAreas = (meta) => new Set(meta.primary.map((m) => MUSCLE_AREA[m]))

export function relevance(current, meta, currentDef) {
  if (!current) {
    // A custom exercise: the same display muscle is the only safe link.
    return findExercise(meta.id)?.muscle === currentDef?.muscle ? 0.5 : 0
  }
  const sim = movementSimilarity(current, meta)
  const a = primaryAreas(current)
  const sharesPrimary = [...primaryAreas(meta)].some((x) => a.has(x))
  if (meta.family === current.family) return sim
  if (meta.pattern === current.pattern && sharesPrimary) return sim
  if (sharesPrimary && sim >= 0.3) return sim * 0.8
  return 0
}

/**
 * @param currentId  exercise being replaced
 * @param elig       eligibility context (engine/eligibility.js)
 * @param options    { signals, exclude: Set, limit, kind, currentDef }
 */
export function rankSubstitutes(currentId, elig, { signals = new Map(), exclude = new Set(), limit = 4, currentDef } = {}) {
  const current = metaOf(currentId)
  const def = currentDef || findExercise(currentId)
  const kind = current ? (current.kinds.includes('strength') ? 'strength' : current.kinds[0]) : 'strength'
  const isolation = current?.role === 'isolation'
  const ranked = []
  for (const meta of allMeta()) {
    if (meta.id === currentId || exclude.has(meta.id)) continue
    if (ineligibility(meta, { ...elig, kind })) continue
    const rel = relevance(current, meta, def)
    if (rel <= 0) continue
    const other = findExercise(meta.id)
    // An isolation exercise is only swapped for one aimed at the same muscle.
    if (isolation && other.muscle !== def.muscle) continue
    const s = signals.get(meta.id)
    const rank =
      3 * rel +
      (s ? 0.8 * s.enjoyment.score + 0.4 * Math.min(2, s.chosenAsSubstituteHere) - 0.4 * Math.min(2, s.substitutedAwayHere) : 0) +
      (s?.comfort.status === 'some' ? -0.8 : 0) +
      (meta.staple ? 0.5 : 0) +
      0.2 * Math.min(1, (s?.completions || 0) / 3) -
      meta.setupSec / 240 -
      meta.level * 0.1
    ranked.push({ meta, def: other, rank })
  }
  ranked.sort((a, b) => b.rank - a.rank || a.meta.id.localeCompare(b.meta.id))
  // Keep the list varied: at most two options per equipment class.
  const out = []
  const perClass = {}
  for (const r of ranked) {
    if ((perClass[r.meta.equipmentClass] || 0) >= 2) continue
    perClass[r.meta.equipmentClass] = (perClass[r.meta.equipmentClass] || 0) + 1
    out.push(r)
    if (out.length >= limit) break
  }
  return out
}
