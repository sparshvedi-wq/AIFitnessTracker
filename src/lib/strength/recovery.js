// Fatigue and recovery per muscle, shared by every exercise that uses it.
//
// Each working set leaves fatigue on the muscles it trained, in proportion
// to their share of the work and to how close the set was to failure:
//   acute    fades within the hour (why set 3 is harder than set 1, and why
//            triceps pushdowns before a bench press cost bench reps)
//   residual fades over a day or two, faster for small muscles and slower
//            for large, eccentric-heavy ones (RECOVERY_HALF_LIFE_HOURS)
// An exercise's available strength is reduced by the fatigue of the muscles
// it needs, weighted by their share, with extra weight on the most fatigued
// muscle it relies on (a tired weak link limits a compound lift).
//
// The same state says how recovered each muscle is, which planning uses to
// prefer fresh areas, and how much each muscle was stimulated per session,
// which the strength model uses to decide where training should pay off.
import { FEEL_RIR } from './config.js'
import { MUSCLES, RECOVERY_HALF_LIFE_HOURS } from './library.js'
import { clamp, isNum } from './math.js'

export const FATIGUE_MODEL = {
  acutePerSet: 0.035, // decrement on a fully used muscle from one set to failure
  residualPerSet: 0.016, // the part that lingers into the next days
  rirDecay: 0.35, // further from failure → much less fatigue
  acuteHalfLifeMinutes: 25,
  muscleCap: 0.2, // most a muscle's fatigue can reduce its strength
  residualCap: 0.12,
  weakLinkWeight: 0.5, // blend of average fatigue and the most fatigued muscle used
  secondsPerSet: 150, // typical set + rest, to place logged sets in time
}
// Stimulus: a set taken within ~3 reps of failure counts fully.
const STIMULUS = (rir) => (rir <= 3 ? 1 : rir <= 5 ? 0.5 : 0.2)

const HOUR = 3600000
const N = MUSCLES.length
const INDEX = new Map(MUSCLES.map((m, i) => [m, i]))
const RES_DECAY = MUSCLES.map((m) => Math.LN2 / (RECOVERY_HALF_LIFE_HOURS[m] || 24))
const ACUTE_DECAY = Math.LN2 / (FATIGUE_MODEL.acuteHalfLifeMinutes / 60)

// Fatigue is two fixed-size arrays indexed like MUSCLES (fast to copy).
export function emptyFatigue(at = 0) {
  return { at, acute: new Float64Array(N), residual: new Float64Array(N) }
}

/** Fatigue state moved forward to `at` (exponential recovery). */
export function decayFatigue(state, at) {
  if (!isNum(at) || at <= state.at) return state
  const hours = (at - state.at) / HOUR
  const acute = new Float64Array(N)
  const residual = new Float64Array(N)
  const a = Math.exp(-ACUTE_DECAY * hours)
  for (let i = 0; i < N; i++) {
    const v = state.acute[i]
    if (v > 1e-6) acute[i] = v * a
    const r = state.residual[i]
    if (r > 1e-6) residual[i] = r * Math.exp(-RES_DECAY[i] * hours)
  }
  return { at, acute, residual }
}

const INVOLVEMENT = new WeakMap()
const ROWS = new WeakMap()
/** Each muscle's involvement in an exercise relative to its prime mover (0–1). */
export function involvementOf(profile) {
  if (!profile) return {}
  if (INVOLVEMENT.has(profile)) return INVOLVEMENT.get(profile)
  const entries = Object.entries(profile.muscles || {})
  const top = entries.length ? Math.max(...entries.map(([, s]) => s)) : 1
  const out = Object.fromEntries(entries.map(([m, s]) => [m, s / top]))
  INVOLVEMENT.set(profile, out)
  return out
}
// [muscle index, share, involvement] per exercise, cached.
function rowsOf(profile) {
  let rows = ROWS.get(profile)
  if (!rows) {
    const inv = involvementOf(profile)
    rows = Object.entries(profile.muscles || {})
      .filter(([m]) => INDEX.has(m))
      .map(([m, share]) => [INDEX.get(m), share, inv[m]])
    ROWS.set(profile, rows)
  }
  return rows
}

/** Adds one working set's fatigue (rir: reps left; warm-ups count lightly). */
export function addSetFatigue(state, profile, { rir = 2, warmup = false, at = state.at } = {}) {
  const s = decayFatigue(state, at)
  const r = warmup ? Math.max(rir, 6) : Math.max(0, rir)
  const scale = Math.exp(-FATIGUE_MODEL.rirDecay * r)
  const acute = Float64Array.from(s.acute)
  const residual = Float64Array.from(s.residual)
  // The prime mover takes a full set of fatigue; helpers in proportion.
  if (profile)
    for (const [i, , involvement] of rowsOf(profile)) {
      acute[i] = Math.min(FATIGUE_MODEL.muscleCap, acute[i] + involvement * FATIGUE_MODEL.acutePerSet * scale)
      residual[i] = Math.min(FATIGUE_MODEL.residualCap, residual[i] + involvement * FATIGUE_MODEL.residualPerSet * scale)
    }
  return { at: s.at, acute, residual }
}

/** Fatigue level (0–cap) of one muscle. */
export function muscleFatigue(state, m) {
  const i = INDEX.get(m)
  return i === undefined ? 0 : Math.min(FATIGUE_MODEL.muscleCap, state.acute[i] + state.residual[i])
}

/**
 * Share of fresh strength available for an exercise right now (≤ 1).
 * Average fatigue of the muscles it uses, blended with its most fatigued
 * important muscle.
 */
export function availability(state, profile) {
  if (!profile) return 1
  const rows = rowsOf(profile)
  if (!rows.length) return 1
  let average = 0
  let link = 0
  for (const [i, share, involvement] of rows) {
    const f = Math.min(FATIGUE_MODEL.muscleCap, state.acute[i] + state.residual[i])
    average += share * f
    if (involvement * f > link) link = involvement * f
  }
  const w = FATIGUE_MODEL.weakLinkWeight
  return clamp(1 - ((1 - w) * average + w * link), 1 - FATIGUE_MODEL.muscleCap, 1)
}

/** How recovered each muscle is from earlier days (1 = fully fresh). */
export function readiness(state) {
  return Object.fromEntries(MUSCLES.map((m, i) => [m, 1 - state.residual[i] / FATIGUE_MODEL.residualCap]))
}

/** Reps left for fatigue purposes, from a one-tap answer or the session's effort. */
export function fatigueRir(set, { experience, effort } = {}) {
  const table = experience === 'Starting out' || !experience ? FEEL_RIR.beginner : FEEL_RIR.experienced
  if (set?.feel === 'easy' && [3, 5, 8].includes(set.reserve)) return set.reserve === 8 ? 9 : set.reserve
  if (set?.feel && table[set.feel]) return table[set.feel].mean
  const target = Number(set?.targetReps)
  const reps = Number(set?.reps)
  if (isNum(target) && isNum(reps) && reps < target) return 0.5
  return { 1: 3.5, 2: 2.5, 3: 2, 4: 1, 5: 1 }[effort] ?? 2
}

/** Training stimulus per muscle for one set. */
export function setStimulus(profile, rir, warmup = false) {
  if (warmup) return {}
  const k = STIMULUS(rir)
  // Fractional sets: a helper muscle gets part of a set's stimulus.
  return Object.fromEntries(Object.entries(involvementOf(profile)).map(([m, v]) => [m, v * k]))
}

/**
 * Places a record's working sets in time: sets run in order from the start,
 * spread over the logged duration (or a typical pace when unknown).
 */
export function setTimes(record, count) {
  const end = isNum(record.endedAt) ? record.endedAt : null
  const start = isNum(record.startedAt) ? record.startedAt : end !== null ? end - count * FATIGUE_MODEL.secondsPerSet * 1000 : null
  if (start === null) return null
  const span = end !== null && end > start ? end - start : count * FATIGUE_MODEL.secondsPerSet * 1000
  const step = count > 1 ? Math.min(span / count, 10 * 60000) : 0
  return Array.from({ length: count }, (_, i) => start + i * step)
}
