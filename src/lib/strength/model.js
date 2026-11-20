// A per-exercise belief about strength, learned from logged sets.
//
// Load exercises (dumbbells, barbells, machines) track three things:
//   level      log of the estimated one-rep max
//   trend      expected change per session (reverts toward an experience prior)
//   endurance  log of the personal rep–load curve parameter k
// Bodyweight and band exercises track the log of reps-to-failure and a trend.
//
// Each session is one update. Sets from the same day share that day's form, so
// they are combined before updating; earlier sets' fatigue is removed from
// later sets; answers become reps-in-reserve with honest uncertainty; and
// one-sided evidence ("did all the reps", "couldn't lift it") corrects the
// belief only when the belief contradicts it, so silence never drifts an
// estimate. Sets that disagree wildly with an established belief are set aside
// as likely typos and reported, never silently trusted. The whole belief is
// rebuilt from saved history every time, so editing or deleting a workout
// corrects it.
import { metaOf } from '../catalog/index.js'
import { convertWeight } from '../units.js'
import { realHistory, recordTime } from '../engine/ledger.js'
import {
  ANCHOR_SD,
  DAY_SD,
  DETRAINING,
  ENDURANCE,
  ENDURANCE_DEFAULT,
  ENDURANCE_LIMITS,
  ENDURANCE_PRIOR_SD,
  FATIGUE,
  FEEL_RIR,
  FIRST_SESSION_PRIOR,
  IMPLICIT,
  LOAD_CEILING_LB,
  MAX_MODEL_REPS,
  NEW_EXERCISE_SD,
  OUTLIER,
  PROCESS,
  REP_FATIGUE_SCALE,
  SD_LIMITS,
  TREND_DAMPING,
  TREND_LIMITS,
  TREND_PRIOR,
  TREND_PRIOR_REPS,
  TREND_PRIOR_SD,
  reserveFor,
} from './config.js'
import {
  clamp,
  diag,
  enduranceSensitivity,
  formulaSd,
  fractionAt,
  isNum,
  kalmanUpdate,
  predictStep,
  repSensitivity,
  sanitizeCov,
} from './math.js'

const DAY = 86400000
const SKIP_KINDS = ['sport', 'pump', 'recovery']
export const FEELS = ['easy', 'good', 'hard', 'failed']

/** 'load' (weight and reps), 'reps' (bodyweight or band) or null (timed, assisted). */
export function strengthMode(def, meta = metaOf(def?.id)) {
  if (!def || def.type !== 'reps') return null
  if (def.weighted) return meta?.load === 'assist' ? null : 'load'
  return 'reps'
}

export function enduranceFor(meta) {
  return ENDURANCE[meta?.role] ?? ENDURANCE_DEFAULT
}

/** Expected improvement per session before anything is learned. */
export function trendPriorFor(mode, experience) {
  const table = mode === 'load' ? TREND_PRIOR : TREND_PRIOR_REPS
  return table[experience] ?? table['Starting out']
}

const beginnerLevel = (experience) => experience === 'Starting out' || !experience
const feelTable = (experience) => (beginnerLevel(experience) ? FEEL_RIR.beginner : FEEL_RIR.experienced)

/** A typical reps-in-reserve for a set, used only to estimate its fatigue. */
export function typicalRir(feel, experience, missed) {
  if (FEELS.includes(feel)) return feelTable(experience)[feel].mean
  return missed ? 0.5 : 2
}
const fatigueStep = (rir) => FATIGUE.perSet * Math.exp(-FATIGUE.decay * Math.max(0, rir))

/** Remaining capacity after `rirs` earlier working sets (1 = fresh). */
export function fatigueFactor(rirs, mode) {
  const F = Math.min(FATIGUE.cap, rirs.reduce((s, r) => s + fatigueStep(r), 0))
  return mode === 'reps' ? Math.max(0.5, 1 - REP_FATIGUE_SCALE * F) : 1 - F
}

function ceilingFor(meta, unit) {
  const lb = LOAD_CEILING_LB[meta?.load] ?? LOAD_CEILING_LB.other
  return unit === 'kg' ? lb * 0.45359237 : lb
}

/**
 * Working sets of one exercise in a record (or live session), as evidence.
 * @returns {{ observations: object[], sets: object[], rejected: object[] }}
 */
export function sessionObservations(record, exId, { unit, mode, experience, meta, live = false } = {}) {
  const observations = []
  const rejected = []
  const sets = []
  const effort = isNum(record.effort) ? record.effort : null
  const fromUnit = record.unit || unit
  const ceiling = ceilingFor(meta, unit)
  const table = feelTable(experience)
  const rirsSoFar = []
  for (const e of [...(record.exercises || []), ...(record.attemptOnly || [])]) {
    if (e?.exId !== exId) continue
    // Sets before a mid-workout "set my working weight" no longer count.
    const start = Number.isInteger(e.calibratedFrom) && e.calibratedFrom > 0 ? e.calibratedFrom : 0
    const attempts = (Array.isArray(e.attempts) ? e.attempts : []).filter(
      (a) => a && Number.isInteger(a.setIndex) && a.setIndex >= start,
    )
    // "Too heavy to start": not one clean rep at that load, before set `index`.
    const attemptsAt = (index, final = false) => {
      for (const a of attempts) {
        if (final ? a.setIndex < index : a.setIndex !== index) continue
        const w = mode === 'load' ? convertWeight(Number(a.weight), a.unit || fromUnit, unit) : null
        if (mode === 'load' && !(isNum(w) && w > 0 && w <= ceiling)) continue
        const most = isNum(a.reps) && a.reps >= 1 ? Math.min(MAX_MODEL_REPS, Math.round(a.reps)) : 0
        const bound = most ? IMPLICIT.tooHeavyForReps : IMPLICIT.tooHeavy
        observations.push({
          kind: 'upper',
          reps: most,
          rir: bound.atMost,
          sd: bound.sd,
          weight: w,
          a: fatigueFactor(rirsSoFar, mode),
          setIndex: a.setIndex,
          source: 'too-heavy',
          explicit: true,
        })
      }
    }
    let workIndex = 0
    const raw = Array.isArray(e.sets) ? e.sets : []
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i]
      if (!s || s.kind === 'warmup') continue
      if (live ? s.status !== 'done' : s.status && s.status !== 'done') continue
      const thisIndex = workIndex++
      attemptsAt(thisIndex)
      if (thisIndex < start) continue
      const reps = Number(s.reps)
      const weight = mode === 'load' ? convertWeight(Number(s.weight), fromUnit, unit) : null
      const feel = FEELS.includes(s.feel) ? s.feel : null
      const target = Number(s.targetReps)
      const missed = !feel && isNum(target) && target > 0 && isNum(reps) && reps < target
      const exceeded = !feel && isNum(target) && target > 0 && isNum(reps) && reps > target
      const usable =
        isNum(reps) &&
        reps >= 1 &&
        reps <= (mode === 'load' ? MAX_MODEL_REPS : 200) &&
        (mode !== 'load' || (isNum(weight) && weight > 0 && weight <= ceiling))
      const rirGuess = typicalRir(feel, experience, missed)
      if (!usable) {
        rejected.push({ setIndex: thisIndex, reason: 'unusable', reps: s.reps, weight: s.weight })
        rirsSoFar.push(rirGuess)
        continue
      }
      const a = fatigueFactor(rirsSoFar, mode)
      const base = { reps: Math.round(reps), weight, a, setIndex: thisIndex, manual: Boolean(s.manual) }
      sets.push({ ...base, feel })
      if (feel) {
        const reserve = reserveFor(feel, s.reserve)
        if (reserve) {
          observations.push({ ...base, kind: 'two', rir: reserve.mean, sd: reserve.sd, source: feel, explicit: true })
          if (isNum(reserve.atLeast)) observations.push({ ...base, kind: 'lower', rir: reserve.atLeast, sd: 0.5, source: feel, explicit: true })
        } else {
          observations.push({ ...base, kind: 'two', rir: table[feel].mean, sd: table[feel].sd, source: feel, explicit: true })
          if (feel === 'easy') observations.push({ ...base, kind: 'lower', rir: table.easy.atLeast, sd: 0.5, source: 'easy', explicit: true })
          // In the workout, "failed" is also a limit for today (see graph.js).
          if (feel === 'failed' && live) observations.push({ ...base, kind: 'upper', rir: 0, sd: table.failed.sd, source: 'failed', explicit: true })
        }
      } else if (missed) observations.push({ ...base, kind: 'two', rir: IMPLICIT.missed.mean, sd: IMPLICIT.missed.sd, source: 'missed' })
      else if (exceeded) {
        observations.push({ ...base, kind: 'two', rir: IMPLICIT.exceeded.mean, sd: IMPLICIT.exceeded.sd, source: 'exceeded' })
        observations.push({ ...base, kind: 'lower', rir: IMPLICIT.completed.atLeast, sd: IMPLICIT.completed.sd, source: 'completed' })
      } else {
        const easySession = effort === 1
        observations.push({
          ...base,
          kind: 'lower',
          rir: easySession ? IMPLICIT.easySession.atLeast : IMPLICIT.completed.atLeast,
          sd: easySession ? IMPLICIT.easySession.sd : IMPLICIT.completed.sd,
          source: 'completed',
        })
        if (effort >= 4)
          observations.push({ ...base, kind: 'upper', rir: IMPLICIT.veryHardSession.atMost, sd: IMPLICIT.veryHardSession.sd, source: 'very-hard-session' })
      }
      rirsSoFar.push(rirGuess)
    }
    // Attempts on a set that was never completed (for example the current one).
    attemptsAt(workIndex, true)
  }
  return { observations, sets, rejected }
}

// ── Observation geometry ────────────────────────────────────────────────

/** Predicted value, Jacobian row and noise variance of one observation. */
function geometry(o, x, mode) {
  if (mode === 'load') {
    const k = Math.exp(x[2])
    const R = Math.max(1, o.reps + o.rir)
    const y = Math.log(o.weight)
    const h = x[0] + Math.log(fractionAt(R, k)) + Math.log(o.a)
    const H = [1, 0, enduranceSensitivity(R, k)]
    const r = formulaSd(R) ** 2 + (o.sd * repSensitivity(R, k)) ** 2
    return { y, h, H, r }
  }
  const R = Math.max(0.5, o.reps + o.rir)
  const y = Math.log(R)
  const h = x[0] + Math.log(o.a)
  return { y, h, H: [1, 0], r: 0.03 ** 2 + (o.sd / R) ** 2 }
}

const limitsFor = (mode) => (mode === 'load' ? [SD_LIMITS.level, SD_LIMITS.trend, SD_LIMITS.endurance] : [SD_LIMITS.level, SD_LIMITS.trend])

function settle(state) {
  const x = [...state.x]
  if (!isNum(x[0])) throw new Error('strength level is not finite')
  x[1] = clamp(isNum(x[1]) ? x[1] : 0, TREND_LIMITS[0], TREND_LIMITS[1])
  if (state.mode === 'load') x[2] = clamp(isNum(x[2]) ? x[2] : Math.log(ENDURANCE_DEFAULT), Math.log(ENDURANCE_LIMITS[0]), Math.log(ENDURANCE_LIMITS[1]))
  return { ...state, x, P: sanitizeCov(state.P, limitsFor(state.mode)) }
}

/** Implied level from one observation, given the current endurance belief. */
function impliedLevel(o, x, mode) {
  const g = geometry(o, x, mode)
  return x[0] + (g.y - g.h)
}

/**
 * A fresh belief centred on a first session, before that session is applied.
 * Unanswered sets are assumed to stop with typical reps in reserve; the spread
 * comes from how uncertain that assumption is, and the level is correlated
 * with the endurance belief exactly as the rep–load curve implies.
 */
export function initialState({ mode, observations, meta, trendPrior, at }) {
  const k = enduranceFor(meta)
  const x0 = mode === 'load' ? [0, trendPrior, Math.log(k)] : [0, trendPrior]
  // Answers (two-sided evidence) are applied right after, so the prior around
  // them stays wide. With only unanswered sets, the typical-RIR prior is all
  // there is, and its own uncertainty sets the spread.
  const answered = observations.filter((o) => o.kind === 'two')
  const source = answered.length
    ? answered
    : observations
        .filter((o) => o.kind === 'lower' && o.source === 'completed')
        .map((o) => ({ ...o, rir: Math.max(o.rir, FIRST_SESSION_PRIOR.rir), sd: FIRST_SESSION_PRIOR.rirSd }))
  const centred = source.map((o) => ({ o, level: impliedLevel(o, x0, mode) })).sort((a, b) => a.level - b.level)
  if (!centred.length) return null
  const { o, level } = centred[Math.floor((centred.length - 1) / 2)]
  x0[0] = level
  const g = geometry(o, x0, mode)
  const levelVar = answered.length ? NEW_EXERCISE_SD ** 2 : g.r + FIRST_SESSION_PRIOR.extraSd ** 2
  if (mode === 'load') {
    // level = y − log f(R; k) − log a, so ∂level/∂log k = −H_k.
    const hk = g.H[2]
    const kVar = ENDURANCE_PRIOR_SD ** 2
    const P = [
      [levelVar + hk * hk * kVar, 0, -hk * kVar],
      [0, TREND_PRIOR_SD ** 2, 0],
      [-hk * kVar, 0, kVar],
    ]
    return { mode, x: x0, P, lastAt: at, trendPrior, sessions: 0 }
  }
  return { mode, x: x0, P: diag([levelVar, (2 * TREND_PRIOR_SD) ** 2]), lastAt: at, trendPrior, sessions: 0 }
}

/** Moves a belief forward in time to `at`. */
export function advance(state, at) {
  const gapDays = Math.max(0, (at - state.lastAt) / DAY)
  const newSession = gapDays >= 0.5
  const n = state.x.length
  const phi = newSession ? TREND_DAMPING : 1
  const F = n === 3 ? [[1, newSession ? 1 : 0, 0], [0, phi, 0], [0, 0, 1]] : [[1, newSession ? 1 : 0], [0, phi]]
  const u = new Array(n).fill(0)
  u[1] = newSession ? (1 - TREND_DAMPING) * state.trendPrior : 0
  let detrain = 0
  if (gapDays > DETRAINING.graceDays) {
    detrain = Math.min(DETRAINING.max, (DETRAINING.perWeek * (gapDays - DETRAINING.graceDays)) / 7)
    u[0] -= detrain
  }
  const q = new Array(n).fill(0)
  q[0] = PROCESS.perDay ** 2 * gapDays + (newSession ? PROCESS.perSession ** 2 : 0) + (detrain / 2) ** 2
  q[1] = newSession ? PROCESS.trendPerSession ** 2 : 0
  // Endurance drifts a little each session, so an odd stretch can be unlearned.
  if (n === 3) q[2] = newSession ? PROCESS.endurancePerSession ** 2 : 0
  let { x, P } = predictStep(state.x, state.P, F, u, q)
  // After a long break, past momentum says little about what comes next.
  if (gapDays > DETRAINING.trendResetDays) x = x.map((v, i) => (i === 1 ? Math.min(v, state.trendPrior) * 0.5 : v))
  return settle({ ...state, x, P, lastAt: Math.max(state.lastAt, at) })
}

/**
 * Applies one session's observations.
 * @param dayVar variance shared by the whole day (0 when estimating today's form itself)
 */
export function applySession(state, observations, { dayVar = DAY_SD ** 2 } = {}) {
  const mode = state.mode
  let { x, P } = state
  const rejected = []
  const live = dayVar === 0
  // What each kind of evidence may teach: rep endurance only from answered
  // sets in saved history; a live workout only changes today's level.
  const answersMask = live ? [1, 0, 0].slice(0, x.length) : null
  const boundsMask = live ? [1, 0, 0].slice(0, x.length) : [1, 1, 0].slice(0, x.length)
  const established = Math.sqrt(P[0][0]) < OUTLIER.establishedSd
  // Within-session screen: a set wildly unlike the session's own median is a
  // typo. With only two sets, the heavier-looking one is set aside (safer).
  const levelOf = new Map(observations.filter((o) => o.kind !== 'upper').map((o) => [o, impliedLevel(o, x, mode)]))
  const implied = [...levelOf.values()].sort((a, b) => a - b)
  const median = implied.length ? implied[Math.floor((implied.length - 1) / 2)] : null
  const far = Math.log(OUTLIER.rejectRatio)
  const suspicious = (o) => {
    if (!levelOf.has(o)) return false
    const v = levelOf.get(o)
    if (implied.length >= 3) return Math.abs(v - median) > far
    if (implied.length === 2) return implied[1] - implied[0] > far && v === implied[1]
    return false
  }
  const keep = []
  for (const o of observations) {
    const g = geometry(o, x, mode)
    const S = g.H.reduce((s, hi, i) => s + hi * g.H.reduce((t, hj, j) => t + hj * P[i][j], 0), 0) + g.r + dayVar
    const z = (g.y - g.h) / Math.sqrt(S)
    const ratio = Math.abs(g.y - g.h)
    // Only the side a bound actually constrains can contradict the belief.
    const contradicts = o.kind === 'two' ? Math.abs(z) : o.kind === 'lower' ? z : -z
    // A deliberate tap (an answer, "couldn't finish", "too heavy") is never a typo.
    if (established && !o.explicit && contradicts > OUTLIER.rejectZ && ratio > Math.log(1.5)) {
      rejected.push({ setIndex: o.setIndex, reason: 'unusual', weight: o.weight, reps: o.reps })
      continue
    }
    if (suspicious(o)) {
      rejected.push({ setIndex: o.setIndex, reason: 'unusual', weight: o.weight, reps: o.reps })
      continue
    }
    // In a live workout (no day-to-day spread) a deliberate answer is a fact
    // about today and is not softened (see graph.js applyExercise).
    const trusted = live && o.explicit
    keep.push({ o, softZ: !trusted && contradicts > OUTLIER.softZ ? contradicts / OUTLIER.softZ : 1 })
  }

  // Two-sided answers: one combined, precision-weighted observation per day.
  const two = keep.filter((k) => k.o.kind === 'two')
  if (two.length) {
    let wSum = 0
    let nu = 0
    const H = new Array(x.length).fill(0)
    for (const { o, softZ } of two) {
      const g = geometry(o, x, mode)
      const w = 1 / (g.r * softZ * softZ)
      wSum += w
      nu += w * (g.y - g.h)
      g.H.forEach((v, i) => (H[i] += w * v))
    }
    const result = kalmanUpdate(x, P, H.map((v) => v / wSum), nu / wSum, 1 / wSum + dayVar, answersMask)
    x = result.x
    P = result.P
  }
  // One-sided evidence ("at least", "at most") acts only when the belief
  // contradicts it, as a measurement at the bound: the correction grows
  // smoothly from zero with the size of the contradiction. Applying bounds that
  // already hold would make silence slowly ratchet estimates in one direction.
  for (const [kind, side] of [['lower', 1], ['upper', -1]]) {
    let worst = null
    for (const { o, softZ } of keep.filter((k) => k.o.kind === kind)) {
      const g = geometry(o, x, mode)
      const violation = side > 0 ? g.y - g.h : g.h - g.y
      if (violation > 0 && (!worst || violation > worst.violation)) worst = { o, g, violation, r: g.r * softZ * softZ + dayVar }
    }
    if (!worst) continue
    const result = kalmanUpdate(x, P, worst.g.H, worst.g.y - worst.g.h, worst.r, boundsMask)
    x = result.x
    P = result.P
    // Judging today's own form (no day-to-day spread), a deliberate "I can't
    // lift this" or "I did these reps" is a fact about today: if the belief
    // still contradicts it, move it exactly onto the limit, along the
    // directions the belief is least sure of.
    if (dayVar === 0 && worst.o.explicit) {
      const g = geometry(worst.o, x, mode)
      const still = side > 0 ? g.y - g.h : g.h - g.y
      if (still > 0) {
        const PH = g.H.map((_, i) => (boundsMask[i] ? g.H.reduce((t, hj, j) => t + hj * P[i][j], 0) : 0))
        const HPH = g.H.reduce((t, hi, i) => t + hi * PH[i], 0)
        if (HPH > 1e-12) x = x.map((v, i) => v + (PH[i] / HPH) * (g.y - g.h) * 1.0001)
      }
    }
  }
  const next = settle({ ...state, x, P, sessions: state.sessions + (keep.length ? 1 : 0) })
  return { state: next, rejected }
}

function anchorFor(learning, exId, now) {
  const events = Array.isArray(learning?.events) ? learning.events : []
  let anchor = null
  for (const e of events) {
    if (e?.kind !== 'anchor' || e.exId !== exId || !isNum(e.at) || e.at > now) continue
    if (!anchor || e.at >= anchor.at) anchor = e
  }
  return anchor
}

function stateFromAnchor(anchor, { mode, meta, unit, trendPrior }) {
  const weight = convertWeight(Number(anchor.weight), anchor.unit || unit, unit)
  const reps = Number(anchor.reps)
  if (!isNum(reps) || reps < 1) return null
  if (mode === 'load' && !(isNum(weight) && weight > 0 && weight <= ceilingFor(meta, unit))) return null
  const k = enduranceFor(meta)
  const rir = 2
  const x =
    mode === 'load'
      ? [Math.log(weight) - Math.log(fractionAt(reps + rir, k)), trendPrior, Math.log(k)]
      : [Math.log(reps + rir), trendPrior]
  const P = diag(mode === 'load' ? [ANCHOR_SD ** 2, TREND_PRIOR_SD ** 2, ENDURANCE_PRIOR_SD ** 2] : [ANCHOR_SD ** 2, (2 * TREND_PRIOR_SD) ** 2])
  return { mode, x, P, lastAt: anchor.at, trendPrior, sessions: 0, anchored: true }
}

/**
 * Rebuilds the belief for one exercise from saved history.
 * @param {object} args
 *   workouts, exId, def, meta, unit, today, now, experience, learning,
 *   records (optional pre-filtered records that include exId)
 * @returns null when there is no usable evidence, otherwise
 *   { mode, state, last, used, rejected, sessions, anchored }
 */
export function exerciseBelief({ workouts = [], records, exId, def, meta = metaOf(exId), unit = 'lb', today, now, experience, learning } = {}) {
  const mode = strengthMode(def, meta)
  if (!mode) return null
  const trendPrior = trendPriorFor(mode, experience)
  const anchor = anchorFor(learning, exId, now ?? Infinity)
  let state = null
  // An anchor with numbers starts from them; without numbers it means "start learning again".
  if (anchor && anchor.reps != null) state = stateFromAnchor(anchor, { mode, meta, unit, trendPrior })
  const history = (records || realHistory(workouts, today)).filter(
    (w) => w && !w.sample && !SKIP_KINDS.includes(w.kind) && (!isNum(now) || recordTime(w) <= now) && (!anchor || recordTime(w) > anchor.at),
  )
  const rejected = []
  const used = new Set()
  let last = null
  for (const record of history) {
    const at = recordTime(record)
    if (!isNum(at)) continue
    const { observations, sets, rejected: unusable } = sessionObservations(record, exId, { unit, mode, experience, meta })
    for (const r of unusable) rejected.push({ ...r, workoutId: record.id, date: record.date })
    if (!observations.length) continue
    if (!state) {
      state = initialState({ mode, observations, meta, trendPrior, at })
      if (!state) continue
    } else state = advance(state, at)
    const result = applySession(state, observations)
    state = result.state
    for (const r of result.rejected) rejected.push({ ...r, workoutId: record.id, date: record.date })
    const accepted = sets.filter((s) => !result.rejected.some((r) => r.setIndex === s.setIndex))
    if (accepted.length) {
      for (const s of accepted) if (mode === 'load') used.add(s.weight)
      const top = mode === 'load' ? Math.max(...accepted.map((s) => s.weight)) : null
      const atTop = mode === 'load' ? accepted.filter((s) => Math.abs(s.weight - top) < 1e-6) : accepted
      last = { at, date: record.date, workoutId: record.id, weight: top, reps: Math.max(...atTop.map((s) => s.reps)), failed: accepted.some((s) => s.feel === 'failed') || observations.some((o) => o.source === 'too-heavy' || o.source === 'missed') }
    }
  }
  if (!state) return null
  return { mode, state, last, used: [...used], rejected, anchored: Boolean(state.anchored && !last), anchorAt: anchor?.at ?? null }
}

/** Summary numbers of a belief at time `at` (after moving it forward). */
export function beliefAt(belief, at) {
  const state = isNum(at) && at > belief.state.lastAt ? advance(belief.state, at) : belief.state
  const sd = Math.sqrt(state.P[0][0])
  const k = belief.mode === 'load' ? Math.exp(state.x[2]) : null
  return {
    mode: belief.mode,
    state,
    level: state.x[0],
    sd,
    trend: state.x[1],
    k,
    oneRepMax: belief.mode === 'load' ? Math.exp(state.x[0]) : null,
    maxReps: belief.mode === 'reps' ? Math.exp(state.x[0]) : null,
    confidence: sd < 0.05 ? 'settled' : sd < 0.1 ? 'learning' : 'calibrating',
  }
}
