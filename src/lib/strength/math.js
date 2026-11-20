// Numerics for the strength model: the rep–load curve and a small Kalman
// filter (time steps and linear updates in Joseph form, which keep the
// covariance symmetric and positive under rounding).
import { FORMULA_SD } from './config.js'

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ── Rep–load curve ───────────────────────────────────────────────────────

/** Share of a one-rep max that can be lifted for `reps` reps to failure. */
export function fractionAt(reps, k) {
  const r = clamp(reps, 1, 60)
  return 1 / (1 + (r - 1) / k)
}

/** Reps to failure at a share of a one-rep max (below 1 means not even one rep). */
export function repsAtFraction(fraction, k) {
  const f = clamp(fraction, 1e-3, 10)
  return 1 + k * (1 / f - 1)
}

/** d log f / d log k at `reps`: how much the endurance belief matters there. */
export const enduranceSensitivity = (reps, k) => (clamp(reps, 1, 60) - 1) / (k + clamp(reps, 1, 60) - 1)

/** d log f / d reps at `reps` (negative): converts rep uncertainty to load uncertainty. */
export const repSensitivity = (reps, k) => -1 / (k + clamp(reps, 1, 60) - 1)

/** How far the curve itself may be off at this many reps (log scale). */
export function formulaSd(reps) {
  return Math.min(FORMULA_SD.max, FORMULA_SD.base + FORMULA_SD.perRepAbove6 * Math.max(0, reps - 6))
}

// ── Small dense matrices (n ≤ 3) ─────────────────────────────────────────

export const zeros = (n) => Array.from({ length: n }, () => new Array(n).fill(0))
export const diag = (values) => values.map((v, i) => values.map((_, j) => (i === j ? v : 0)))
const mulVec = (M, v) => M.map((row) => row.reduce((s, x, j) => s + x * v[j], 0))
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

export function symmetrize(P) {
  const n = P.length
  const out = zeros(n)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i][j] = (P[i][j] + P[j][i]) / 2
  return out
}

/** Keeps a covariance usable: symmetric, finite, with bounded positive variances. */
export function sanitizeCov(P, maxSd) {
  const n = P.length
  const S = symmetrize(P)
  for (let i = 0; i < n; i++) {
    const cap = maxSd[i] ** 2
    if (!isNum(S[i][i]) || S[i][i] < 1e-10) S[i][i] = 1e-10
    if (S[i][i] > cap) {
      // Scale the row and column so correlations are kept.
      const f = Math.sqrt(cap / S[i][i])
      for (let j = 0; j < n; j++) {
        S[i][j] *= f
        S[j][i] *= f
      }
      S[i][i] = cap
    }
  }
  // Correlations must stay inside (−1, 1).
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const lim = 0.999 * Math.sqrt(S[i][i] * S[j][j])
      if (!isNum(S[i][j])) S[i][j] = 0
      S[i][j] = clamp(S[i][j], -lim, lim)
    }
  return S
}

/**
 * Linear Kalman update for y = H·x + noise(r), in Joseph form, which keeps
 * the covariance symmetric and positive under rounding — for any gain, so a
 * `mask` can hold chosen states fixed (0 = this state may not change).
 * @returns {{ x: number[], P: number[][], innovation: number, S: number }}
 */
export function kalmanUpdate(x, P, H, innovation, r, mask = null) {
  const PH = mulVec(P, H)
  const S = dot(H, PH) + r
  const K = PH.map((v, i) => (mask && !mask[i] ? 0 : v / S))
  const n = x.length
  const nx = x.map((v, i) => v + K[i] * innovation)
  // (I − K H) P (I − K H)ᵀ + K r Kᵀ
  const A = zeros(n)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i][j] = (i === j ? 1 : 0) - K[i] * H[j]
  const AP = A.map((row) => P[0].map((_, j) => row.reduce((s, a, k) => s + a * P[k][j], 0)))
  const nP = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) nP[i][j] = AP[i].reduce((s, v, k) => s + v * A[j][k], 0) + K[i] * r * K[j]
  return { x: nx, P: symmetrize(nP), innovation, S }
}

/** x ← F x + u;  P ← F P Fᵀ + Q (Q diagonal variances). */
export function predictStep(x, P, F, u, q) {
  const n = x.length
  const nx = mulVec(F, x).map((v, i) => v + (u[i] || 0))
  const FP = F.map((row) => P[0].map((_, j) => row.reduce((s, a, k) => s + a * P[k][j], 0)))
  const nP = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) nP[i][j] = FP[i].reduce((s, v, k) => s + v * F[j][k], 0) + (i === j ? q[i] || 0 : 0)
  return { x: nx, P: symmetrize(nP) }
}
