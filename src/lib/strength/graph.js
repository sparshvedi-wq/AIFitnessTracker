// The strength graph: one model of a person's strength shared by every
// exercise, so what is learned on one lift informs every related lift.
//
// State (all in log space, one Kalman filter):
//   θ[m]  strength of each muscle relative to the library's reference lifter.
//         Muscles start correlated: a general strength factor, a regional
//         factor (push, pull, shoulders, lower, core) and a muscle's own part.
//   b[r]  expected improvement per fully trained session, per region.
//   d     today's form, shared by every exercise in one session.
//   δ[e]  this person's own ratio for exercise e versus what its muscles
//         predict (technique, leverages, how the library ratio fits them).
//   ω[e@place]  a machine or cable at a particular place (stacks differ).
//   κ[e]  rep endurance for exercise e (how many reps a share of max allows).
//
// An exercise's predicted one-rep max (in effective load: logged weight ×
// sides + the share of bodyweight moved) is
//   log E = log(reference load) + Σ share[m]·θ[m] + δ[e] + ω[e@place] + d
//           + log(available strength after fatigue)
// so a bench press informs a dumbbell bench through shared muscles and the
// library's 0.8 ratio, a triceps pushdown through the triceps, and push-ups
// through the share of bodyweight they move. Each exercise keeps its own
// offset, which quickly takes over once it has its own history.
//
// Between sessions: muscles that were trained move up by their region's
// improvement rate (in proportion to the hard sets they got), untrained
// muscles slowly detrain after ten days, beliefs widen with time, a new
// exercise's own offset can move fast while it is being learned, and an
// exercise that keeps beating (or missing) its predictions speeds up.
import { metaOf } from '../catalog/index.js'
import { findExercise } from '../exercises.js'
import { realHistory, recordTime } from '../engine/ledger.js'
import { convertWeight } from '../units.js'
import {
  DAY_SD,
  FEEL_RIR,
  FIRST_SESSION_PRIOR,
  IMPLICIT,
  LOAD_CEILING_LB,
  MAX_MODEL_REPS,
  OUTLIER,
  TREND_PRIOR,
  reserveFor,
} from './config.js'
import {
  MUSCLES,
  MUSCLE_REGION,
  REF_BODYWEIGHT_KG,
  REGIONS,
  effectiveLoad,
  exerciseProfile,
  similarity,
} from './library.js'
import { clamp, enduranceSensitivity, formulaSd, fractionAt, isNum, repSensitivity } from './math.js'
import { addSetFatigue, availability, decayFatigue, emptyFatigue, fatigueRir, setStimulus, setTimes } from './recovery.js'

const DAY = 86400000
const SKIP_KINDS = ['sport', 'recovery']
// Short focus sessions are easy by design: they tire muscles but are not
// evidence of what someone can lift.
const FATIGUE_ONLY = ['pump']
const FEELS = ['easy', 'good', 'hard', 'failed']
const LB_PER_KG = 1 / 0.45359237

export const GRAPH = {
  generalSd: 0.3,
  regionSd: 0.15,
  muscleSd: 0.15,
  levelMean: { 'Starting out': -0.35, 'Some experience': 0, Experienced: 0.25 },
  // Someone new to training is further from the reference lifter in the
  // upper body than in the legs and trunk, which daily life already loads
  // (untrained squat and deadlift strength sits near 80% of a first-year
  // lifter's in total load moved; pressing nearer 65%).
  levelByRegion: { 'Starting out': { push: -0.42, pull: -0.38, shoulders: -0.42, lower: -0.2, core: -0.2 } },
  trendSd: 0.006,
  trendPerSession: 0.003,
  trendDamping: 0.85,
  placeSd: 0.12,
  enduranceSd: 0.15,
  enduranceDrift: 0.01,
  enduranceLimits: [20, 42],
  skill: { base: 0.008, early: 0.03, scale: 4 },
  streakBump: 0.025,
  stimulusRef: 3,
  detrain: { graceDays: 10, perWeek: 0.012, max: 0.12 },
  perDay: 0.003,
  transferSdMax: 0.3,
  // Once several lifts are known (a starting-point session, or a few
  // workouts), a new exercise is also planned from a looser relative, with
  // a wider safety margin: lighter than ideal is one "easy" tap from right.
  wideTransfer: { sdMax: 0.5, score: 0.3, minExercises: 3, sdCap: 0.35 },
  bodyweightSd: { logged: 0.02, unknown: 0.15 },
  sdLimits: { muscle: 0.6, trend: 0.02, offset: 0.6, endurance: 0.25 },
}

// ── State ────────────────────────────────────────────────────────────────

function newState() {
  return { names: [], index: new Map(), x: [], P: [] }
}

function addVar(S, name, mean, variance, cov = []) {
  const i = S.x.length
  S.names.push(name)
  S.index.set(name, i)
  S.x.push(mean)
  for (const row of S.P) row.push(0)
  S.P.push(new Array(i + 1).fill(0))
  S.P[i][i] = variance
  for (const [j, c] of cov) {
    S.P[i][j] = c
    S.P[j][i] = c
  }
  return i
}

function cloneState(S) {
  return { names: [...S.names], index: new Map(S.index), x: [...S.x], P: S.P.map((r) => [...r]) }
}

const muscleIdx = (S, m) => S.index.get(`θ:${m}`)
const trendIdx = (S, r) => S.index.get(`b:${r}`)

function initialState(experience) {
  const S = newState()
  const base = GRAPH.levelMean[experience] ?? GRAPH.levelMean['Starting out']
  const byRegion = GRAPH.levelByRegion[experience in GRAPH.levelMean ? experience : 'Starting out'] || {}
  const g2 = GRAPH.generalSd ** 2
  const r2 = GRAPH.regionSd ** 2
  const u2 = GRAPH.muscleSd ** 2
  for (const m of MUSCLES) {
    const cov = []
    for (const other of MUSCLES) {
      const j = muscleIdx(S, other)
      if (j === undefined) continue
      cov.push([j, g2 + (MUSCLE_REGION[other] === MUSCLE_REGION[m] ? r2 : 0)])
    }
    addVar(S, `θ:${m}`, byRegion[MUSCLE_REGION[m]] ?? base, g2 + r2 + u2, cov)
  }
  const b0 = TREND_PRIOR[experience] ?? TREND_PRIOR['Starting out']
  for (const r of REGIONS) addVar(S, `b:${r}`, b0, GRAPH.trendSd ** 2)
  addVar(S, 'd', 0, DAY_SD ** 2)
  return S
}

/** Sparse scalar Kalman update, Joseph form (valid for a masked gain). */
function update(S, Hs, innovation, r, mask = null) {
  const n = S.x.length
  const v = new Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    const row = S.P[i]
    for (const [j, h] of Hs) s += row[j] * h
    v[i] = s
  }
  let HPH = 0
  for (const [j, h] of Hs) HPH += h * v[j]
  const Sv = HPH + r
  if (!(Sv > 1e-12) || !isNum(innovation)) return false
  const K = new Array(n)
  for (let i = 0; i < n; i++) K[i] = mask && !mask(S.names[i]) ? 0 : v[i] / Sv
  for (let i = 0; i < n; i++) S.x[i] += K[i] * innovation
  for (let i = 0; i < n; i++) {
    const Ki = K[i]
    const vi = v[i]
    const row = S.P[i]
    for (let j = 0; j < n; j++) row[j] += -Ki * v[j] - vi * K[j] + Sv * Ki * K[j]
  }
  return true
}

/** x ← x + E x + u ; P ← (I+E) P (I+E)ᵀ + Q, with E holding one entry per row. */
function linearStep(S, E, u, q) {
  const n = S.x.length
  const x0 = S.x
  const P0 = S.P
  const x = [...x0]
  for (const [i, [k, c]] of E) x[i] += c * x0[k]
  for (const [i, a] of u) x[i] += a
  const P = P0.map((r) => [...r])
  for (const [i, [k, c]] of E) {
    const src = P0[k]
    for (let j = 0; j < n; j++) {
      const add = c * src[j]
      P[i][j] += add
      P[j][i] += add
    }
  }
  for (const [i, [k, c]] of E) for (const [j, [l, c2]] of E) P[i][j] += c * c2 * P0[k][l]
  for (const [i, a] of q) P[i][i] += a
  S.x = x
  S.P = P
}

/** Keeps the covariance usable after many steps (symmetry, bounds, finite). */
function repair(S) {
  const n = S.x.length
  for (let i = 0; i < n; i++) {
    const name = S.names[i]
    const cap =
      (name.startsWith('θ:') ? GRAPH.sdLimits.muscle : name.startsWith('b:') ? GRAPH.sdLimits.trend : name.startsWith('κ:') ? GRAPH.sdLimits.endurance : GRAPH.sdLimits.offset) ** 2
    if (!isNum(S.P[i][i]) || S.P[i][i] < 1e-10) S.P[i][i] = 1e-10
    if (S.P[i][i] > cap) {
      const f = Math.sqrt(cap / S.P[i][i])
      for (let j = 0; j < n; j++) {
        S.P[i][j] *= f
        S.P[j][i] *= f
      }
      S.P[i][i] = cap
    }
    if (!isNum(S.x[i])) throw new Error(`strength graph state ${name} is not finite`)
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let c = (S.P[i][j] + S.P[j][i]) / 2
      const lim = 0.999 * Math.sqrt(S.P[i][i] * S.P[j][j])
      if (!isNum(c)) c = 0
      c = clamp(c, -lim, lim)
      S.P[i][j] = c
      S.P[j][i] = c
    }
  for (const r of REGIONS) {
    const i = trendIdx(S, r)
    S.x[i] = clamp(S.x[i], -0.03, 0.04)
  }
  for (const name of S.names)
    if (name.startsWith('κ:')) {
      const i = S.index.get(name)
      S.x[i] = clamp(S.x[i], Math.log(GRAPH.enduranceLimits[0]), Math.log(GRAPH.enduranceLimits[1]))
    }
}

// ── Exercises in the state ───────────────────────────────────────────────

const placeKey = (exId, place) => `ω:${exId}@${place || 'unknown'}`

function ensureExercise(G, profile, place) {
  const S = G.S
  if (!S.index.has(`δ:${profile.id}`)) {
    addVar(S, `δ:${profile.id}`, 0, profile.ratioSd ** 2)
    addVar(S, `κ:${profile.id}`, Math.log(profile.endurance), GRAPH.enduranceSd ** 2)
  }
  if (profile.machine && !S.index.has(placeKey(profile.id, place))) addVar(S, placeKey(profile.id, place), 0, GRAPH.placeSd ** 2)
}

function referenceLoad(profile, unit) {
  return Math.log(profile.normKg * (unit === 'lb' ? LB_PER_KG : 1))
}

// Muscles always sit first in the state, in MUSCLES order.
const ROWS = new WeakMap()
function muscleRows(profile) {
  let rows = ROWS.get(profile)
  if (!rows) {
    rows = Object.entries(profile.muscles).map(([m, share]) => [MUSCLES.indexOf(m), share])
    ROWS.set(profile, rows)
  }
  return rows
}

/** Predicted mean and the sparse row of the observation for an exercise. */
function level(G, profile, place, { day = true } = {}) {
  const S = G.S
  const Hs = []
  let mean = referenceLoad(profile, G.unit)
  let extraVar = 0
  for (const row of muscleRows(profile)) {
    mean += row[1] * S.x[row[0]]
    Hs.push(row)
  }
  const di = S.index.get(`δ:${profile.id}`)
  if (di !== undefined) {
    mean += S.x[di]
    Hs.push([di, 1])
  } else extraVar += profile.ratioSd ** 2
  if (profile.machine) {
    const wi = S.index.get(placeKey(profile.id, place))
    if (wi !== undefined) {
      mean += S.x[wi]
      Hs.push([wi, 1])
    } else extraVar += GRAPH.placeSd ** 2
  }
  if (day) {
    const i = S.index.get('d')
    mean += S.x[i]
    Hs.push([i, 1])
  }
  return { mean, Hs, extraVar }
}

function quad(S, Hs) {
  let s = 0
  for (let a = 0; a < Hs.length; a++) {
    const row = S.P[Hs[a][0]]
    let inner = 0
    for (let b = 0; b < Hs.length; b++) inner += Hs[b][1] * row[Hs[b][0]]
    s += Hs[a][1] * inner
  }
  return s
}

function enduranceOf(G, profile) {
  const i = G.S.index.get(`κ:${profile.id}`)
  return i === undefined ? profile.endurance : Math.exp(G.S.x[i])
}

// ── Evidence from a record ──────────────────────────────────────────────

function bodyweightAt(metrics, date, unit) {
  let best = null
  for (const [d, m] of Object.entries(metrics || {})) {
    if (!m || m.sampleWeight || !isNum(m.weight) || m.weight <= 0) continue
    if (date && d > date) continue
    if (!best || d > best.date) best = { date: d, weight: m.weight }
  }
  if (best) return { value: best.weight, known: true }
  return { value: unit === 'lb' ? REF_BODYWEIGHT_KG * LB_PER_KG : REF_BODYWEIGHT_KG, known: false }
}

const tableFor = (experience) => (experience === 'Starting out' || !experience ? FEEL_RIR.beginner : FEEL_RIR.experienced)

function ceilingFor(meta, unit) {
  const lb = LOAD_CEILING_LB[meta?.load] ?? LOAD_CEILING_LB.other
  return unit === 'kg' ? lb * 0.45359237 : lb
}

/**
 * How far a record's clock times sit from its calendar date. A workout logged
 * later with an earlier date (the summary's date picker) keeps the times it
 * was entered at; without this its sets would land "today" in the fatigue
 * model and every later set would stop recovering.
 */
function timeShift(record) {
  const raw = isNum(record.endedAt) ? record.endedAt : record.startedAt
  if (!record.date || !isNum(raw)) return 0
  const at = recordTime(record)
  return isNum(at) ? at - raw : 0
}

/**
 * Walks a record set by set: fatigue at each set, the observations each
 * tied exercise gives, the training stimulus per muscle, and every set's
 * outcome for the summary. `live` reads only sets marked done.
 */
function recordEvidence(G, record, { live = false, skip = () => false } = {}) {
  const unit = G.unit
  const fromUnit = record.unit || unit
  const bw = live ? G.bodyweight : bodyweightAt(G.metrics, record.date, unit)
  const effort = isNum(record.effort) ? record.effort : null
  const entries = []
  for (const e of [...(record.exercises || []), ...(record.attemptOnly || []), ...(record.priorAttempts || [])]) {
    if (!e?.exId) continue
    const profile = exerciseProfile(e.exId, findExercise(e.exId, G.customExercises))
    if (!profile) continue
    const sets = (Array.isArray(e.sets) ? e.sets : []).filter((s) => s && (live ? s.status === 'done' : !s.status || s.status === 'done'))
    // Sets still tire muscles even when their numbers no longer count.
    entries.push({ e, profile, sets, ignore: skip(e.exId) })
  }
  const total = entries.reduce((n, x) => n + x.sets.length, 0)
  const shift = timeShift(record)
  const times = (setTimes(record, Math.max(1, total)) || []).map((v) => v + shift)
  let t = 0
  const byKey = new Map()
  const stimulus = {}
  for (const { e, profile, sets, ignore } of entries) {
    const tied = !ignore && profile.tie && ['load', 'bodyweight', 'assist'].includes(profile.mode)
    const meta = metaOf(e.exId)
    const ceiling = ceilingFor(meta, unit)
    const start = Number.isInteger(e.calibratedFrom) && e.calibratedFrom > 0 ? e.calibratedFrom : 0
    const group = (place) => {
      const key = JSON.stringify([e.exId, place])
      if (!byKey.has(key)) byKey.set(key, { exId: e.exId, profile, place, observations: [], sets: [], rejected: [] })
      return byKey.get(key)
    }
    let workIndex = 0
    const attempts = (Array.isArray(e.attempts) ? e.attempts : []).filter((a) => a && Number.isInteger(a.setIndex) && a.setIndex >= start)
    const pushAttempts = (index, final) => {
      if (!tied) return
      for (const a of attempts) {
        if (final ? a.setIndex < index : a.setIndex !== index) continue
        const w = convertWeight(Number(a.weight), a.unit || fromUnit, unit)
        if (!(isNum(w) && w >= 0 && w <= ceiling)) continue
        const L = effectiveLoad(profile, w, bw.value)
        if (!(L > 0)) continue
        // With `reps`: at most that many were possible (too heavy for the
        // planned reps). Without: not even one.
        const most = isNum(a.reps) && a.reps >= 1 ? Math.min(MAX_MODEL_REPS, Math.round(a.reps)) : 0
        const bound = most ? IMPLICIT.tooHeavyForReps : IMPLICIT.tooHeavy
        group(a.location ?? e.location ?? record.location).observations.push({ kind: 'upper', reps: most, rir: bound.atMost, sd: bound.sd, L, a: availability(G.fatigue, profile), explicit: true, source: 'too-heavy', setIndex: a.setIndex, bwKnown: bw.known, bwShare: (profile.bw * bw.value) / L, ...(a.test ? { test: 'missed' } : {}) })
      }
    }
    for (const s of sets) {
      // The time the set was logged, when saved; otherwise spread over the session.
      const out = group(s.location ?? e.location ?? record.location)
      const loggedAt = isNum(s.at) ? s.at + shift : isNum(s.doneAt) ? s.doneAt + shift : null
      const at = loggedAt ?? times[Math.min(t, times.length - 1)] ?? recordTime(record)
      t++
      G.fatigue = decayFatigue(G.fatigue, at)
      const warmup = s.kind === 'warmup'
      const rir = fatigueRir(s, { experience: G.experience, effort })
      if (warmup) {
        G.fatigue = addSetFatigue(G.fatigue, profile, { rir, warmup: true, at })
        continue
      }
      const index = workIndex++
      pushAttempts(index, false)
      const avail = availability(G.fatigue, profile)
      G.fatigue = addSetFatigue(G.fatigue, profile, { rir, at })
      for (const [m, v] of Object.entries(setStimulus(profile, rir))) stimulus[m] = (stimulus[m] || 0) + v
      if (index < start || !tied) continue
      const reps = Number(s.reps)
      const logged = profile.mode === 'bodyweight' ? 0 : convertWeight(Number(s.weight), fromUnit, unit)
      const usable =
        isNum(reps) && reps >= 1 && reps <= MAX_MODEL_REPS && isNum(logged) && logged >= 0 && logged <= ceiling && (profile.mode !== 'load' || logged > 0)
      const L = usable ? effectiveLoad(profile, logged, bw.value) : NaN
      if (!usable || !(L > 0)) {
        out.rejected.push({ setIndex: index, reason: 'unusable', reps: s.reps, weight: s.weight })
        continue
      }
      const feel = FEELS.includes(s.feel) ? s.feel : null
      const target = Number(s.targetReps)
      const missed = !feel && isNum(target) && target > 0 && reps < target
      const exceeded = !feel && isNum(target) && target > 0 && reps > target
      const base = { reps: Math.round(reps), L, a: avail, setIndex: index, bwKnown: bw.known, bwShare: (profile.bw * bw.value) / L, logged, manual: Boolean(s.manual), ...(s.test ? { test: s.test } : {}) }
      out.sets.push({ ...base, feel, missed })
      const table = tableFor(G.experience)
      if (feel) {
        // An answer with how many more were possible is a real number, not a guess.
        const reserve = reserveFor(feel, s.reserve)
        if (reserve) {
          out.observations.push({ ...base, kind: 'two', rir: reserve.mean, sd: reserve.sd, source: feel, explicit: true, reserve: s.reserve })
          if (isNum(reserve.atLeast)) out.observations.push({ ...base, kind: 'lower', rir: reserve.atLeast, sd: 0.5, source: feel, explicit: true, reserve: s.reserve })
        } else {
          out.observations.push({ ...base, kind: 'two', rir: table[feel].mean, sd: table[feel].sd, source: feel, explicit: true })
          if (feel === 'easy') out.observations.push({ ...base, kind: 'lower', rir: table.easy.atLeast, sd: 0.5, source: 'easy', explicit: true })
          // In the workout, "failed" is also a limit for today: not one more
          // rep was possible at this load, like "too heavy" (held exactly).
          if (feel === 'failed' && live) out.observations.push({ ...base, kind: 'upper', rir: 0, sd: table.failed.sd, source: 'failed', explicit: true })
        }
      } else if (missed) out.observations.push({ ...base, kind: 'two', rir: IMPLICIT.missed.mean, sd: IMPLICIT.missed.sd, source: 'missed' })
      else if (exceeded) {
        out.observations.push({ ...base, kind: 'two', rir: IMPLICIT.exceeded.mean, sd: IMPLICIT.exceeded.sd, source: 'exceeded' })
        out.observations.push({ ...base, kind: 'lower', rir: 0, sd: IMPLICIT.completed.sd, source: 'completed' })
      } else {
        const easySession = effort === 1
        out.observations.push({
          ...base,
          kind: 'lower',
          rir: easySession ? IMPLICIT.easySession.atLeast : IMPLICIT.completed.atLeast,
          sd: easySession ? IMPLICIT.easySession.sd : IMPLICIT.completed.sd,
          source: 'completed',
        })
        if (effort >= 4) out.observations.push({ ...base, kind: 'upper', rir: IMPLICIT.veryHardSession.atMost, sd: IMPLICIT.veryHardSession.sd, source: 'very-hard-session' })
      }
    }
    pushAttempts(workIndex, true)
  }
  return { byKey, stimulus, bodyweight: bw }
}

// ── Updating with evidence ──────────────────────────────────────────────

function geometry(G, ob, profile, place) {
  const k = enduranceOf(G, profile)
  const R = Math.max(1, ob.reps + ob.rir)
  const { mean, Hs, extraVar } = level(G, profile, place)
  const h = mean + Math.log(fractionAt(R, k)) + Math.log(ob.a)
  const ki = G.S.index.get(`κ:${profile.id}`)
  const H = ki === undefined ? Hs : [...Hs, [ki, enduranceSensitivity(R, k)]]
  const bwSd = ob.bwKnown ? GRAPH.bodyweightSd.logged : GRAPH.bodyweightSd.unknown
  const r = formulaSd(R) ** 2 + (ob.sd * repSensitivity(R, k)) ** 2 + (bwSd * (ob.bwShare || 0)) ** 2 + extraVar
  return { y: Math.log(ob.L), h, H, r }
}

/**
 * Applies one exercise's evidence from one session.
 * @param live judging today's own form: endurance and trends are not taught,
 *   and deliberate "can't lift it" / "did these reps" become hard limits.
 * @param firstSession first time this exercise is seen: unanswered sets are
 *   read as stopping with typical reps in reserve (a prior, not data).
 */
function applyExercise(G, key, evidence, { live = false, firstSession = false } = {}) {
  const S = G.S
  const { profile, place } = evidence
  let observations = evidence.observations
  if (firstSession)
    observations = observations.flatMap((o) =>
      o.source === 'completed' ? [o, { ...o, kind: 'two', rir: FIRST_SESSION_PRIOR.rir, sd: FIRST_SESSION_PRIOR.rirSd, source: 'first-session' }] : [o],
    )
  const rejected = []
  // Screens: a set wildly unlike the same exercise's other sets today, or
  // (once the exercise is well known) wildly unlike what was expected.
  const pred = level(G, profile, place)
  const predVar = quad(S, pred.Hs) + pred.extraVar
  const established = Math.sqrt(predVar) < OUTLIER.establishedSd
  const implied = new Map()
  for (const o of observations) {
    if (o.kind === 'upper') continue
    const g = geometry(G, o, profile, place)
    implied.set(o, g.y - g.h)
  }
  const values = [...implied.values()].sort((a, b) => a - b)
  const median = values.length ? values[Math.floor((values.length - 1) / 2)] : 0
  const far = Math.log(OUTLIER.rejectRatio)
  const keep = []
  for (const o of observations) {
    const g = geometry(G, o, profile, place)
    const s = Math.sqrt(quad(S, g.H) + g.r + (live ? 0 : DAY_SD ** 2))
    const z = (g.y - g.h) / s
    const contradicts = o.kind === 'two' ? Math.abs(z) : o.kind === 'lower' ? z : -z
    const v = implied.get(o)
    const odd =
      (implied.size >= 3 && v !== undefined && Math.abs(v - median) > far) ||
      (implied.size === 2 && v !== undefined && values[1] - values[0] > far && v === values[1])
    if ((established && !o.explicit && contradicts > OUTLIER.rejectZ && Math.abs(g.y - g.h) > Math.log(1.5)) || (odd && !o.explicit)) {
      rejected.push({ setIndex: o.setIndex, reason: 'unusual', reps: o.reps, weight: o.logged })
      continue
    }
    // Robust weighting softens surprising evidence, but in a live workout a
    // deliberate answer ("failed", "too heavy", "easy") is a fact about
    // today: softening it would let an old, conflicting estimate outvote
    // what just happened (and could even raise a weight after a failure).
    const trusted = live && o.explicit
    keep.push({ o, soft: !trusted && contradicts > OUTLIER.softZ ? contradicts / OUTLIER.softZ : 1 })
  }
  const mask = live
    ? (name) => name.startsWith('θ:') || name.startsWith('δ:') || name.startsWith('ω:') || name === 'd'
    : null
  const boundMask = (name) => !name.startsWith('κ:') && (!live || mask(name))
  // Answers: one combined, precision-weighted observation for this exercise.
  const two = keep.filter((k) => k.o.kind === 'two')
  let innovation = null
  if (two.length) {
    let wSum = 0
    let nu = 0
    const H = new Map()
    for (const { o, soft } of two) {
      const g = geometry(G, o, profile, place)
      const w = 1 / (g.r * soft * soft)
      wSum += w
      nu += w * (g.y - g.h)
      for (const [i, h] of g.H) H.set(i, (H.get(i) || 0) + w * h)
    }
    const Hs = [...H].map(([i, h]) => [i, h / wSum])
    const r = 1 / wSum
    innovation = { value: nu / wSum, sd: Math.sqrt(quad(S, Hs) + r) }
    update(S, Hs, nu / wSum, r, mask)
  }
  // One-sided evidence acts only when the belief contradicts it.
  for (const [kind, side] of [['lower', 1], ['upper', -1]]) {
    let worst = null
    for (const { o, soft } of keep.filter((k) => k.o.kind === kind)) {
      const g = geometry(G, o, profile, place)
      const violation = side > 0 ? g.y - g.h : g.h - g.y
      if (violation > 0 && (!worst || violation > worst.violation)) worst = { o, g, violation, r: g.r * soft * soft }
    }
    if (!worst) continue
    update(S, worst.g.H, worst.g.y - worst.g.h, worst.r, boundMask)
    // Something the person told us ("too heavy", "8 or more left") is a limit,
    // not a hint. In the workout it holds exactly; once saved it holds within
    // a normal day-to-day difference, so the next session agrees with what
    // the workout already did instead of seeming to forget the answer.
    if (worst.o.explicit) {
      const g = geometry(G, worst.o, profile, place)
      const slack = live ? 0 : DAY_SD
      const still = (side > 0 ? g.y - g.h : g.h - g.y) - slack
      if (still > 0) {
        const n = S.x.length
        const v = new Array(n).fill(0)
        for (let i = 0; i < n; i++) if (boundMask(S.names[i])) v[i] = g.H.reduce((t, [j, h]) => t + h * S.P[i][j], 0)
        const HPH = g.H.reduce((t, [j, h]) => t + h * v[j], 0)
        if (HPH > 1e-12) for (let i = 0; i < n; i++) S.x[i] += (v[i] / HPH) * side * still * 1.0001
      }
    }
  }
  return { rejected, innovation }
}

// ── Time ─────────────────────────────────────────────────────────────────

/** Moves the graph to `at`: training effects, detraining, widening, a fresh day. */
function advance(G, at, { trainedKeys = [] } = {}) {
  const S = G.S
  const first = G.lastAt === -Infinity
  const gapDays = first ? 0 : Math.max(0, (at - G.lastAt) / DAY)
  const newSession = first || gapDays >= 0.5
  const E = new Map()
  const u = new Map()
  const q = new Map()
  if (newSession && !first) {
    // Training effect of the stimulus since the last update.
    for (const m of MUSCLES) {
      const stim = G.pendingStimulus[m] || 0
      if (stim <= 0) continue
      const coef = Math.min(1, stim / GRAPH.stimulusRef)
      E.set(muscleIdx(S, m), [trendIdx(S, MUSCLE_REGION[m]), coef])
    }
    G.pendingStimulus = {}
    const b0 = TREND_PRIOR[G.experience] ?? TREND_PRIOR['Starting out']
    for (const r of REGIONS) {
      const i = trendIdx(S, r)
      E.set(i, [i, GRAPH.trendDamping - 1])
      u.set(i, (1 - GRAPH.trendDamping) * b0)
      q.set(i, GRAPH.trendPerSession ** 2)
    }
  }
  if (gapDays > 0) {
    for (const m of MUSCLES) {
      const i = muscleIdx(S, m)
      let variance = GRAPH.perDay ** 2 * gapDays
      // Detraining: muscles left alone past the grace period slowly lose strength.
      const last = G.muscleLast[m]
      if (isNum(last)) {
        const from = Math.max(G.lastAt, last + GRAPH.detrain.graceDays * DAY)
        const days = (at - from) / DAY
        if (days > 0) {
          const already = G.detrained[m] || 0
          const loss = Math.min(GRAPH.detrain.max - already, (GRAPH.detrain.perWeek * days) / 7)
          if (loss > 0) {
            u.set(i, (u.get(i) || 0) - loss)
            variance += (loss / 2) ** 2
            G.detrained[m] = already + loss
          }
        }
      }
      q.set(i, (q.get(i) || 0) + variance)
    }
  }
  // An exercise being learned can move faster than its muscles; one that
  // keeps beating its predictions is given room to catch up.
  for (const key of trainedKeys) {
    const di = S.index.get(`δ:${key}`)
    if (di === undefined) continue
    const info = G.exercises.get(key)
    const n = info?.n || 0
    const streak = info?.streak?.count || 0
    const sd = GRAPH.skill.base + GRAPH.skill.early * Math.exp(-n / GRAPH.skill.scale) + GRAPH.streakBump * Math.min(4, streak)
    q.set(di, (q.get(di) || 0) + sd ** 2)
    const ki = S.index.get(`κ:${key}`)
    if (ki !== undefined) q.set(ki, (q.get(ki) || 0) + GRAPH.enduranceDrift ** 2)
  }
  if (E.size || u.size || q.size) linearStep(S, E, u, q)
  if (newSession) {
    // A new day: yesterday's form says nothing about today's.
    const di = S.index.get('d')
    for (let j = 0; j < S.x.length; j++) {
      S.P[di][j] = 0
      S.P[j][di] = 0
    }
    S.x[di] = 0
    S.P[di][di] = DAY_SD ** 2
  }
  G.lastAt = Math.max(G.lastAt, at)
}

// ── Building from history ───────────────────────────────────────────────

function anchorsFrom(learning, now) {
  const out = []
  for (const e of Array.isArray(learning?.events) ? learning.events : []) {
    if (e?.kind !== 'anchor' || typeof e.exId !== 'string' || !isNum(e.at) || (isNum(now) && e.at > now)) continue
    out.push(e)
  }
  return out.sort((a, b) => a.at - b.at)
}

/** Forgets what was learned about one exercise (keeps the muscles). */
function resetExercise(G, exId) {
  const S = G.S
  for (const name of [`δ:${exId}`, `κ:${exId}`, ...S.names.filter((n) => n.startsWith(`ω:${exId}@`))]) {
    const i = S.index.get(name)
    if (i === undefined) continue
    const profile = exerciseProfile(exId)
    for (let j = 0; j < S.x.length; j++) {
      S.P[i][j] = 0
      S.P[j][i] = 0
    }
    if (name.startsWith('δ:')) {
      S.x[i] = 0
      S.P[i][i] = profile.ratioSd ** 2
    } else if (name.startsWith('κ:')) {
      S.x[i] = Math.log(profile.endurance)
      S.P[i][i] = GRAPH.enduranceSd ** 2
    } else {
      S.x[i] = 0
      S.P[i][i] = GRAPH.placeSd ** 2
    }
  }
  G.exercises.delete(exId)
}

function summarise(G, exId, evidence, at, record, rejected, innovation, levelAfter = null) {
  const prev = G.exercises.get(exId) || { n: 0, used: [], streak: { sign: 0, count: 0 } }
  const accepted = evidence.sets.filter((s) => !rejected.some((r) => r.setIndex === s.setIndex))
  const used = [...prev.used]
  for (const s of accepted) if (evidence.profile.mode !== 'bodyweight' && !used.some((u) => Math.abs(u - s.logged) < 1e-6)) used.push(s.logged)
  let last = prev.last || null
  // A test set that did not go well still teaches the estimate, but it is
  // not "what was done last time": the sets after it went back to the usual
  // weight, and that is where the next plan starts.
  const missedTest = accepted.some((s) => s.test === 'missed') || evidence.observations.some((o) => o.test === 'missed')
  const counted = missedTest && accepted.some((s) => s.test !== 'missed') ? accepted.filter((s) => s.test !== 'missed') : accepted
  if (accepted.length) {
    // The hardest set: the most effective load (for assistance, the least help).
    const topL = Math.max(...counted.map((s) => s.L))
    const atTop = counted.filter((s) => Math.abs(s.L - topL) < 1e-6)
    const top = atTop[0].logged
    const failed = evidence.observations.some((o) => ['failed', 'too-heavy', 'missed'].includes(o.source) && o.test !== 'missed')
    last = {
      at,
      date: record.date,
      workoutId: record.id,
      weight: evidence.profile.mode === 'bodyweight' ? null : top,
      reps: Math.max(...atTop.map((s) => s.reps)),
      minReps: Math.min(...atTop.map((s) => s.reps)),
      failed,
      hard: atTop.some((s) => s.feel === 'hard' || s.feel === 'failed' || s.missed),
      // Said they could do many more: the next step may be bigger.
      roomy: evidence.observations.some((o) => o.reserve >= 5),
      place: evidence.place || null,
    }
    // Clean: at least two working sets, all at the top weight, nothing hard,
    // missed or failed, in a session not reported as very hard. `steady`
    // counts clean sessions in a row that never went backwards (the same
    // weight and reps, or more).
    const clean =
      !missedTest &&
      accepted.length >= 2 &&
      atTop.length === accepted.length &&
      !last.failed &&
      !last.hard &&
      !evidence.observations.some((o) => o.source === 'very-hard-session')
    const before = prev.last
    // Heavier is harder, except on assisted machines where less help is.
    const harder = (a, b) => (evidence.profile.mode === 'assist' ? a < b - 1e-6 : a > b + 1e-6)
    const heldOrMore =
      before &&
      before.steady > 0 &&
      (last.weight === null
        ? before.weight === null && last.minReps >= before.minReps
        : isNum(before.weight) &&
          (harder(last.weight, before.weight) || (Math.abs(before.weight - last.weight) < 1e-6 && last.minReps >= before.minReps)))
    last.steady = clean ? (heldOrMore ? before.steady + 1 : 1) : 0
  }
  let streak = prev.streak || { sign: 0, count: 0 }
  if (innovation && innovation.sd > 0) {
    const z = innovation.value / innovation.sd
    if (Math.abs(z) > 1) streak = Math.sign(z) === streak.sign ? { sign: streak.sign, count: streak.count + 1 } : { sign: Math.sign(z), count: 1 }
    else streak = { sign: 0, count: 0 }
  }
  // Stalled: the last two sessions were hard or failed and the estimate has
  // not moved up over them. One lighter session resets it.
  // The session after a stall was flagged is the lighter one: it resets the
  // count, so two more tough sessions are needed before another deload.
  const entry = { tough: Boolean(last?.hard || last?.failed) && accepted.length > 0, level: levelAfter }
  const recent = prev.stalled && accepted.length ? [entry] : [...(prev.recent || []), entry].slice(-3)
  const twoTough = recent.length >= 2 && recent.slice(-2).every((r) => r.tough)
  const baseline = recent.length >= 3 ? recent[0].level : prev.levelBefore
  const flat = isNum(levelAfter) && isNum(baseline) && levelAfter <= baseline + 0.01
  const stalled = twoTough && flat
  G.exercises.set(exId, {
    n: prev.n + (accepted.length ? 1 : 0),
    used,
    last,
    lastAt: accepted.length ? at : prev.lastAt,
    streak,
    stalled,
    recent,
    levelBefore: prev.levelBefore ?? levelAfter,
  })
  for (const r of rejected) G.rejected.push({ ...r, exId, workoutId: record.id, date: record.date })
}

function applyRecord(G, record, { live = false, skip } = {}) {
  const at = recordTime(record)
  if (!live && FATIGUE_ONLY.includes(record.kind)) {
    recordEvidence(G, record, { skip: () => true })
    return
  }
  const { byKey, stimulus } = recordEvidence(G, record, { live, skip })
  for (const ev of byKey.values()) {
    const exId = ev.exId
    if (!ev.profile.tie || !ev.observations.length) {
      for (const r of ev.rejected) G.rejected.push({ ...r, exId, workoutId: record.id, date: record.date })
      continue
    }
    ensureExercise(G, ev.profile, ev.place)
  }
  if (!live) advance(G, isNum(record.startedAt) ? Math.min(record.startedAt + timeShift(record), at) : at, { trainedKeys: [...new Set([...byKey.values()].map((ev) => ev.exId))] })
  for (const ev of byKey.values()) {
    const exId = ev.exId
    if (!ev.profile.tie || !ev.observations.length) continue
    const firstSession = !G.exercises.get(exId)?.n
    const { rejected, innovation } = applyExercise(G, exId, ev, { live, firstSession })
    const levelAfter = level(G, ev.profile, ev.place, { day: false }).mean
    if (!live) summarise(G, exId, ev, at, record, [...ev.rejected, ...rejected], innovation, levelAfter)
    else {
      // Today's own sets count as having seen the exercise.
      G.liveSeen.add(exId)
      for (const r of rejected) G.rejected.push({ ...r, exId, live: true })
    }
  }
  if (!live) {
    for (const [m, v] of Object.entries(stimulus)) {
      G.pendingStimulus[m] = (G.pendingStimulus[m] || 0) + v
      if (v >= 0.5) {
        G.muscleLast[m] = at
        G.detrained[m] = 0
      }
    }
    G.lastAt = Math.max(G.lastAt, at)
  }
  repair(G.S)
}

function applyAnchor(G, anchor) {
  const profile = exerciseProfile(anchor.exId)
  if (!profile?.tie || !['load', 'bodyweight', 'assist'].includes(profile.mode)) return
  resetExercise(G, anchor.exId)
  if (anchor.reps === undefined) return
  advance(G, anchor.at, { trainedKeys: [] })
  ensureExercise(G, profile, anchor.place || null)
  const unit = G.unit
  const bw = bodyweightAt(G.metrics, null, unit)
  const logged = profile.mode === 'bodyweight' ? 0 : convertWeight(Number(anchor.weight), anchor.unit || unit, unit)
  const L = effectiveLoad(profile, logged, bw.value)
  if (!(L > 0) || !(Number(anchor.reps) >= 1)) return
  const ob = { kind: 'two', reps: Number(anchor.reps), rir: 2, sd: 1, L, a: availability(decayFatigue(G.fatigue, anchor.at), profile), explicit: true, source: 'anchor', bwKnown: bw.known, bwShare: (profile.bw * bw.value) / L, logged }
  const g = geometry(G, ob, profile, anchor.place || null)
  // The person's own numbers: firm for this exercise, gentle on the muscles.
  // Numbers given as a starting point ("I know my numbers") describe the
  // person, not one lift, so they inform the muscles and every related lift.
  const mask = anchor.scope === 'baseline' ? null : (name) => name === `δ:${anchor.exId}` || name.startsWith(`ω:${anchor.exId}@`)
  update(G.S, g.H, g.y - g.h, g.r, mask)
  const prev = G.exercises.get(anchor.exId)
  G.exercises.set(anchor.exId, {
    n: 1,
    used: profile.mode === 'bodyweight' ? [] : [logged],
    last: { at: anchor.at, weight: profile.mode === 'bodyweight' ? null : logged, reps: Number(anchor.reps), minReps: Number(anchor.reps), failed: false, hard: false, anchored: true },
    lastAt: anchor.at,
    streak: prev?.streak || { sign: 0, count: 0 },
  })
  repair(G.S)
}

/**
 * Builds the strength graph from saved history (oldest first). Anchors from
 * "set my working weight" restart that exercise from the stated numbers.
 */
/** The saved records the graph learns from, oldest first. */
export function graphRecords(workouts, today, now) {
  return realHistory(workouts, today).filter(
    (w) => w && !SKIP_KINDS.includes(w.kind) && isNum(recordTime(w)) && (!isNum(now) || recordTime(w) <= now),
  )
}

/**
 * Extends a built graph with newer records (after a workout is saved) instead
 * of rebuilding everything. Returns null when that would not be exact: a
 * record earlier than what was already learned, or an anchor in between.
 */
export function extendGraph(G, records, { learning = null, now } = {}) {
  if (!records.length) return G
  const lastTime = G.lastRecordAt ?? -Infinity
  if (records.some((r) => recordTime(r) < lastTime)) return null
  if (anchorsFrom(learning, now).some((a) => a.at > lastTime)) return null
  const C = {
    ...G,
    S: cloneState(G.S),
    exercises: new Map(G.exercises),
    pendingStimulus: { ...G.pendingStimulus },
    muscleLast: { ...G.muscleLast },
    detrained: { ...G.detrained },
    rejected: [...G.rejected],
    liveSeen: new Set(),
  }
  for (const record of records) {
    applyRecord(C, record)
    C.lastRecordAt = Math.max(C.lastRecordAt ?? -Infinity, recordTime(record))
  }
  return C
}

export function buildGraph({ workouts = [], learning = null, unit = 'lb', today, now, experience, metrics = {}, customExercises = [] } = {}) {
  const G = {
    S: initialState(experience),
    unit,
    experience,
    metrics,
    customExercises,
    lastAt: -Infinity,
    fatigue: emptyFatigue(0),
    pendingStimulus: {},
    muscleLast: {},
    detrained: {},
    exercises: new Map(),
    rejected: [],
    liveSeen: new Set(),
    bodyweight: bodyweightAt(metrics, today, unit),
  }
  const records = graphRecords(workouts, today, now)
  const anchors = anchorsFrom(learning, now)
  // Evidence before an exercise's latest anchor no longer counts.
  const anchorAt = new Map(anchors.map((a) => [a.exId, a.at]))
  let ai = 0
  for (const record of records) {
    const at = recordTime(record)
    while (ai < anchors.length && anchors[ai].at <= at) applyAnchor(G, anchors[ai++])
    applyRecord(G, record, { skip: (exId) => anchorAt.has(exId) && at <= anchorAt.get(exId) })
    G.lastRecordAt = Math.max(G.lastRecordAt ?? -Infinity, at)
  }
  while (ai < anchors.length) applyAnchor(G, anchors[ai++])
  // Later anchors must not be re-applied on top of an extension.
  G.lastRecordAt = Math.max(G.lastRecordAt ?? -Infinity, ...anchors.map((a) => a.at))
  return G
}

/** A copy of the graph moved to `at`, with today's live sets applied. */
export function graphAt(G, at, live = null) {
  const C = {
    ...G,
    S: cloneState(G.S),
    exercises: new Map(G.exercises),
    pendingStimulus: { ...G.pendingStimulus },
    muscleLast: { ...G.muscleLast },
    detrained: { ...G.detrained },
    rejected: [...G.rejected],
    liveSeen: new Set(),
  }
  if (isNum(at)) {
    advance(C, at, { trainedKeys: [] })
    repair(C.S)
    C.fatigue = decayFatigue(C.fatigue, at)
  }
  if (live) {
    applyRecord(C, live, { live: true })
    if (isNum(at)) C.fatigue = decayFatigue(C.fatigue, at)
  }
  return C
}

/** The live session as a record the graph can read. */
export function liveRecord(session, now) {
  if (!session) return null
  return {
    id: `live-${session.id}`,
    date: null,
    startedAt: session.startedAt || now,
    endedAt: now,
    unit: session.unit,
    location: session.location,
    effort: null,
    exercises: session.exercises,
  }
}

/**
 * What the graph predicts for an exercise at the graph's time.
 * @returns null if the exercise isn't tied, else { level (log one-rep max in
 *   effective load), sd, k, seen, avail, bodyweight, support, info }
 */
export function predictExercise(G, exId, { place = null, def = null, live = false } = {}) {
  const profile = exerciseProfile(exId, def || findExercise(exId, G.customExercises))
  if (!profile?.tie || !['load', 'bodyweight', 'assist'].includes(profile.mode)) return null
  const { mean, Hs, extraVar } = level(G, profile, place, { day: live })
  const variance = quad(G.S, Hs) + extraVar
  const avail = availability(G.fatigue, profile)
  const info = G.exercises.get(exId) || null
  const seen = (G.S.index.has(`δ:${exId}`) && Boolean(info?.n)) || G.liveSeen.has(exId)
  // The closest exercise this person has actually done, for explanations.
  let support = null
  if (!seen) {
    for (const [other, data] of G.exercises) {
      if (other === exId || !data.n) continue
      const sim = similarityScore(exId, other)
      if (!support || sim > support.score) support = { exId: other, score: sim }
    }
  }
  return {
    profile,
    level: mean + Math.log(avail),
    sd: Math.sqrt(Math.max(variance, 1e-8)),
    k: enduranceOf(G, profile),
    seen,
    avail,
    bodyweight: G.bodyweight,
    support,
    info,
  }
}

const similarityScore = (a, b) => similarity(a, b).score

/**
 * How each body area compares with the rest of this person, from the lifts
 * they have actually done.
 *
 * Each lift's estimated max is compared with the library's reference for it
 * (and with what is usual at the person's stage: someone new to training
 * normally has stronger legs than arms). The person's overall level is the
 * precision-weighted average of those; a lift's deviation from it says
 * whether that lift is high or low *for them*. An area's figure is the
 * average deviation of the lifts that mainly train it.
 *
 * How much a deviation means depends on the lift: barbell and dumbbell
 * ratios are tight, machines differ a lot between gyms, so the spread of
 * each lift's ratio (plus the place spread for machines) is carried into
 * the area's spread. More different lifts for an area make it firmer.
 * @returns [{ id, diff (log scale), sd, lifts: [exId], machinesOnly }]
 */
export function areaBalance(G, areaIds) {
  const S = G.S
  const prior = initialState(G.experience)
  const done = [...G.exercises].filter(([, info]) => info?.n).map(([id, info]) => [id, info.last?.place || null])
  for (const id of G.liveSeen) if (!done.some(([d]) => d === id)) done.push([id, null])
  const lifts = []
  for (const [id, place] of done) {
    const profile = exerciseProfile(id, findExercise(id, G.customExercises))
    if (!profile?.tie || !['load', 'bodyweight', 'assist'].includes(profile.mode)) continue
    const now = level(G, profile, place, { day: false })
    let usual = referenceLoad(profile, G.unit)
    for (const [i, share] of muscleRows(profile)) usual += share * prior.x[i]
    const variance = profile.ratioSd ** 2 + (profile.machine ? GRAPH.placeSd ** 2 : 0) + quad(S, now.Hs) + now.extraVar
    lifts.push({ id, profile, value: now.mean - usual, variance })
  }
  if (!lifts.length) return areaIds.map((id) => ({ id, diff: 0, sd: Infinity, lifts: [], machinesOnly: false }))
  const total = lifts.reduce((n, l) => n + 1 / l.variance, 0)
  const overall = lifts.reduce((n, l) => n + l.value / l.variance, 0) / total
  return areaIds.map((id) => {
    const mine = lifts.filter((l) => (l.profile.areas[id] || 0) >= BALANCE_SHARE)
    if (!mine.length) return { id, diff: 0, sd: Infinity, lifts: [], machinesOnly: false }
    const weights = mine.map((l) => (l.profile.areas[id] || 0) / l.variance)
    const sum = weights.reduce((n, w) => n + w, 0)
    const diff = mine.reduce((n, l, i) => n + weights[i] * (l.value - overall), 0) / sum
    const variance = mine.reduce((n, l, i) => n + weights[i] ** 2 * l.variance, 0) / sum ** 2
    return { id, diff, sd: Math.sqrt(variance), lifts: mine.map((l) => l.id), machinesOnly: mine.every((l) => l.profile.machine) }
  })
}
// A lift speaks for an area when at least this share of its work is there.
const BALANCE_SHARE = 0.3

/** Relative strength per muscle (1 = the reference lifter) with spread. */
export function muscleStrengths(G) {
  return Object.fromEntries(
    MUSCLES.map((m) => {
      const i = muscleIdx(G.S, m)
      return [m, { relative: Math.exp(G.S.x[i]), sd: Math.sqrt(G.S.P[i][i]) }]
    }),
  )
}
