// Deterministic randomness. The same seed always gives the same draws, so a
// recommendation can be reproduced exactly from its inputs and seed.

/** FNV-1a 32-bit hash of a string. */
export function hashString(text) {
  let h = 0x811c9dc5
  const s = String(text)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a small, well-distributed 32-bit generator. Returns () => [0, 1). */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(next) {
  // Box–Muller; avoid log(0).
  const u = Math.max(next(), 1e-12)
  const v = next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function gamma(shape, next) {
  // Marsaglia–Tsang; shape < 1 uses the boost identity.
  if (shape < 1) return gamma(shape + 1, next) * Math.pow(Math.max(next(), 1e-12), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (let i = 0; i < 64; i++) {
    let x
    let v
    do {
      x = normal(next)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = next()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(Math.max(u, 1e-12)) < 0.5 * x * x + d * (1 - v + Math.log(v)))
      return d * v
  }
  return shape // practically unreachable; return the mean
}

/** One draw from Beta(alpha, beta) using the given generator. */
export function sampleBeta(alpha, beta, next) {
  const x = gamma(alpha, next)
  const y = gamma(beta, next)
  return x + y > 0 ? x / (x + y) : alpha / (alpha + beta)
}

/** A stable tiebreak in [0, 1) for an item under a seed; never array order. */
export const tiebreak = (seed, id) => hashString(`${seed}::${id}`) / 4294967296
