// Weights someone can actually load, so a plan never asks for 17.3 lb.
//
// Listed dumbbells at a place are used exactly. Otherwise a standard set is
// assumed: a normal dumbbell rack, a bar plus pairs of plates (never below the
// empty bar), or a machine stack's usual steps. Any weight the person has
// logged for this exercise before is always available too, so unusual
// equipment is learned from use rather than overridden.
import { clamp, isNum } from './math.js'

const round = (v) => Math.round(v * 1000) / 1000

function rack(unit) {
  if (unit === 'kg') {
    const out = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    for (let v = 12.5; v <= 80; v += 2.5) out.push(v)
    return out
  }
  const out = []
  for (let v = 5; v <= 150; v += 5) out.push(v)
  return out
}

const STEP = {
  lb: { bar: 5, landmine: 5, stack: 5, plate: 5, other: 5 },
  kg: { bar: 2.5, landmine: 2.5, stack: 2.5, plate: 2.5, other: 2.5 },
}
const BAR = { lb: 45, kg: 20 }
const MAX = { lb: { bar: 1000, landmine: 500, stack: 600, plate: 2500, other: 1000 }, kg: { bar: 450, landmine: 230, stack: 270, plate: 1100, other: 450 } }

/**
 * @param {object} args
 *   load: catalog load convention ('hand' | 'one' | 'bar' | 'landmine' | 'stack' | 'plate' | undefined)
 *   unit: 'lb' | 'kg'
 *   sizes: dumbbells listed for this place (per hand), if any
 *   used: weights this person has logged for this exercise (already in `unit`)
 */
export function loadGrid({ load, unit = 'lb', sizes = [], used = [] } = {}) {
  const u = unit === 'kg' ? 'kg' : 'lb'
  const dumbbell = load === 'hand' || load === 'one'
  const listed = dumbbell ? [...new Set(sizes.filter((v) => isNum(v) && v > 0))].sort((a, b) => a - b) : []
  // Logged weights keep full precision (a converted 9.5 lb is 4.309… kg) so
  // they always match themselves. A "barbell" lighter than a technique bar is
  // a logging slip (plates only), not equipment to plan with.
  const lightestBar = u === 'kg' ? 7 : 15
  const known = []
  for (const v of used) {
    if (!isNum(v) || v <= 0 || (load === 'bar' && v < lightestBar)) continue
    if (!known.some((k) => Math.abs(k - v) < 1e-6)) known.push(v)
  }
  let base
  let step = null
  let floor
  let ceiling
  if (listed.length) {
    base = listed
    floor = listed[0]
    ceiling = listed.at(-1)
  } else if (dumbbell) {
    base = rack(u)
    floor = base[0]
    ceiling = base.at(-1)
  } else {
    const kind = STEP[u][load] ? load : 'other'
    step = STEP[u][kind]
    floor = kind === 'bar' ? BAR[u] : step
    ceiling = MAX[u][kind]
    base = null
  }
  // Logged weights stay available (a lighter technique bar, an odd dumbbell),
  // but never past the listed set: a listed place means exactly those weights.
  const extra = listed.length ? [] : known.filter((v) => v > 0)
  const lo = Math.min(floor, ...(extra.length ? extra : [floor]))
  const hi = Math.max(ceiling, ...(extra.length ? extra : [ceiling]))

  /** Every achievable weight in [from, to], ascending. */
  function between(from, to) {
    const a = clamp(Math.min(from, to), lo, hi)
    const b = clamp(Math.max(from, to), lo, hi)
    let out
    if (base) out = base.filter((v) => v >= a - 1e-9 && v <= b + 1e-9)
    else {
      out = []
      const start = Math.ceil((a - floor) / step - 1e-9)
      const end = Math.floor((b - floor) / step + 1e-9)
      // A wide window still stays small: at most 400 steps are listed.
      for (let i = Math.max(0, start); i <= end && out.length < 400; i++) out.push(round(floor + i * step))
    }
    for (const v of extra) if (v >= a - 1e-9 && v <= b + 1e-9) out.push(v)
    return [...new Set(out)].sort((x, y) => x - y)
  }
  const has = (w) => between(w, w).some((v) => Math.abs(v - w) < 1e-6)
  /** The nearest achievable weight strictly above (dir > 0) or below (dir < 0) `w`. */
  function next(w, dir) {
    if (dir > 0) return between(w + 1e-6, hi).find((v) => v > w + 1e-6) ?? null
    return between(lo, w - 1e-6).reverse().find((v) => v < w - 1e-6) ?? null
  }
  /** The heaviest achievable weight at or below `w` (or the lightest one). */
  function atMost(w) {
    if (!isNum(w)) return null
    return between(lo, w).reverse()[0] ?? lo
  }
  return { min: lo, max: hi, listed: listed.length > 0, between, has, next, atMost }
}
