import visuals from './exercise-visuals.json' with { type: 'json' }

// Only exercises with a real M1 demonstration get a picture; others show their name.
export function exerciseThumb(exId) {
  if (!exId || !visuals[exId]) return null
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  return `${base}exercise-guides/${exId}.png`
}

// Up to `limit` exercises from a plan that have a demonstration, in plan order.
export function planThumbs(items = [], limit = 3) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    if (seen.has(it.exId)) continue
    seen.add(it.exId)
    const src = exerciseThumb(it.exId)
    if (src) out.push({ exId: it.exId, src })
    if (out.length >= limit) break
  }
  return out
}
