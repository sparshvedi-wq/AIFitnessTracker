// Targets from genuinely comparable logged performance.
//
// Only completed working sets of the same exercise count (warm-ups never do).
// Weights are converted to the current unit with full precision. Each loading
// convention is respected: dumbbell loads are per hand and never summed,
// barbell loads are bar plus plates, and for assisted machines less assistance
// is the harder, "progressed" direction. Missing data is never treated as
// evidence of improvement, and easy or returning days never increase targets.
import { LOAD_STEP } from '../catalog/vocabulary.js'
import { convertWeight } from '../units.js'
import { RULES } from './config.js'
import { realHistory, recordTime, recordOutcome } from './ledger.js'

const SKIP_KINDS = ['sport', 'pump', 'recovery']

/** Comparable past sessions of one exercise, oldest first. */
export function comparableSessions(workouts, exId, { unit, today, type, weighted, index } = {}) {
  const out = []
  const records = index ? index.get(exId) || [] : realHistory(workouts, today)
  for (const w of records) {
    if (SKIP_KINDS.includes(w.kind)) continue
    const sets = (w.exercises || [])
      .filter((e) => e.exId === exId && (!type || !e.type || e.type === type))
      .flatMap((e) => e.sets || [])
      .filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done'))
      .map((s) => ({
        reps: Number.isFinite(s.reps) ? s.reps : null,
        sec: Number.isFinite(s.sec) ? s.sec : null,
        weight:
          weighted && Number.isFinite(s.weight) ? convertWeight(s.weight, w.unit || unit, unit) : null,
        targetReps: Number.isFinite(s.targetReps) ? s.targetReps : null,
        targetSec: Number.isFinite(s.targetSec) ? s.targetSec : null,
      }))
      // A set that doesn't match the exercise's logging mode is not comparable.
      .filter((s) => (type === 'time' ? s.sec > 0 : s.reps > 0))
      .filter((s) => !weighted || (s.weight !== null && s.weight >= 0))
    if (sets.length) {
      const outcomes = recordOutcome(w).exercises.filter((e) => e.exId === exId)
      out.push({ workoutId: w.id, date: w.date, at: recordTime(w), unit, sets,
        incomplete: outcomes.some((e) => e.doneWork < e.planned) })
    }
  }
  return out
}

/** Records grouped by exercise ID, so each exercise scans only its own history. */
export function historyIndex(workouts, today) {
  const index = new Map()
  for (const w of realHistory(workouts, today)) {
    if (SKIP_KINDS.includes(w.kind)) continue
    for (const id of new Set((w.exercises || []).map((e) => e.exId))) {
      if (!index.has(id)) index.set(id, [])
      index.get(id).push(w)
    }
  }
  return index
}

const e1rm = (weight, reps) => (weight > 0 && reps > 0 ? weight * (1 + Math.min(reps, 12) / 30) : 0)

/** A single comparable performance number per session, in the "better is higher" direction. */
export function sessionScore(session, meta, type) {
  if (type === 'time') return Math.max(...session.sets.map((s) => s.sec || 0))
  if (meta?.load === 'assist')
    // Less assistance at the same reps is better; compare by assistance-reduced reps.
    return Math.max(...session.sets.map((s) => (s.reps || 0) - (s.weight || 0) / 10))
  if (session.sets.some((s) => s.weight > 0)) return Math.max(...session.sets.map((s) => e1rm(s.weight, s.reps)))
  return Math.max(...session.sets.map((s) => s.reps || 0))
}

/**
 * Direction over the last comparable sessions. Fewer than three is "unknown":
 * too little to call it progress or a plateau.
 */
export function progressionTrend(sessions, meta, type) {
  const recent = sessions.slice(-4)
  if (recent.length < 3) return { direction: 'unknown', sessions: sessions.length }
  const scores = recent.map((s) => sessionScore(s, meta, type))
  const first = scores[0]
  const last = scores.at(-1)
  const change = first ? (last - first) / Math.abs(first) : 0
  return {
    direction: change > 0.03 ? 'up' : change < -0.05 ? 'down' : 'flat',
    change,
    sessions: sessions.length,
  }
}

function roundLoad(weight, load, unit) {
  const step = load === 'hand' || load === 'one' ? (unit === 'kg' ? 0.5 : 2.5) : unit === 'kg' ? 1.25 : 2.5
  return Math.round(weight / step) * step
}

/** The next load up (or down) from listed sizes, or by the convention's step. */
export function stepLoad(weight, direction, { load, unit, sizes = [] }) {
  if (sizes.length && (load === 'hand' || load === 'one')) {
    const next =
      direction > 0
        ? sizes.find((v) => v > weight + 1e-6)
        : [...sizes].reverse().find((v) => v < weight - 1e-6)
    return next ?? null
  }
  const step = (LOAD_STEP[load] || LOAD_STEP.bar)[unit === 'kg' ? 'kg' : 'lb']
  return Math.max(0, roundLoad(weight + direction * step, load, unit))
}

export function fitToSizes(weight, sizes = []) {
  if (!sizes.length || !(weight > 0)) return weight
  return [...sizes].reverse().find((v) => v <= weight + 1e-6) ?? sizes[0]
}

/**
 * Target for one planned item.
 * @param {object} args
 *   meta, def, item ({ reps|sec }), sessions (comparableSessions), unit,
 *   sizes (listed dumbbell sizes at this place), easy, awayDays,
 *   comfort ('ok'|'some'|...), effortAnswer ('easy'|'right'|'hard'|null)
 * @returns {{ reps, sec, weight, up, code, facts, rule }}
 */
export function planTarget(args) {
  const result = rawTarget(args)
  const { meta, sizes = [] } = args
  // Free weights must match a size this place actually has.
  if (result.weight > 0 && sizes.length && ['hand', 'one'].includes(meta?.load)) {
    const fitted = fitToSizes(result.weight, sizes)
    if (fitted !== result.weight) {
      // A lighter dumbbell than last time is not an increase, whatever the reps.
      const previous = result.facts?.from ?? result.facts?.weight ?? 0
      return {
        ...result,
        weight: fitted,
        up: result.up && fitted >= previous,
        code: fitted < previous ? 'fitted-to-available' : result.code,
        facts: { ...result.facts, fittedTo: fitted },
      }
    }
  }
  return result
}

function rawTarget({ meta, def, item, sessions, unit, sizes = [], easy, awayDays = 0, comfort, effortAnswer }) {
  const base = { reps: item.reps ?? null, sec: item.sec ?? null, weight: item.weight ?? null, rule: RULES.progression }
  const last = sessions.at(-1)
  if (!last) return { ...base, up: false, code: 'no-history', facts: {} }
  const load = meta?.load
  const capped = def.type === 'time' ? 90 : meta?.role === 'compound' ? 15 : 20
  const mixedLoads = def.weighted && new Set(last.sets.map((s) => s.weight)).size > 1
  const hold = easy || awayDays >= 7 || comfort === 'some' || effortAnswer === 'hard' || last.incomplete || mixedLoads
  const holdCode = easy ? 'easy-day' : awayDays >= 7 ? 'returning' : comfort === 'some' ? 'comfort-hold' : effortAnswer === 'hard' ? 'felt-hard' : last.incomplete ? 'unfinished-dose' : 'mixed-loads'

  if (def.type === 'time') {
    const goal = item.sec || Math.max(...last.sets.map((s) => s.targetSec || s.sec || 0))
    const held = last.sets.every((s) => s.sec >= (s.targetSec ?? goal))
    if (hold) return { ...base, sec: Math.min(goal, Math.max(...last.sets.map((s) => s.sec))), up: false, code: holdCode, facts: {} }
    if (held && goal > 0 && goal + 5 <= capped)
      return { ...base, sec: goal + 5, up: true, code: 'held-every-set', facts: { from: goal, to: goal + 5 } }
    return { ...base, sec: goal || base.sec, up: false, code: held ? 'at-cap' : 'repeat-target', facts: {} }
  }

  const targetReps = item.reps || Math.max(...last.sets.map((s) => s.targetReps || s.reps || 0))
  const hitAll = last.sets.every((s) => s.reps >= (s.targetReps ?? targetReps))
  const loaded = def.weighted && load !== 'band' && load !== 'bw'

  if (!loaded) {
    if (hold) return { ...base, reps: Math.min(targetReps, Math.max(...last.sets.map((s) => s.reps))), up: false, code: holdCode, facts: {} }
    const best = Math.max(...last.sets.map((s) => s.reps))
    if (hitAll && best + 1 <= capped)
      return { ...base, reps: Math.max(targetReps, best) + 1, up: true, code: 'hit-every-rep', facts: { reps: best } }
    return { ...base, reps: targetReps, up: false, code: hitAll ? 'at-cap' : 'repeat-target', facts: {} }
  }

  const weights = last.sets.map((s) => s.weight || 0)
  if (load === 'assist') {
    // Assistance: the lowest setting used is the hardest. Less assistance = progress.
    const current = Math.min(...weights.filter((w) => w >= 0))
    if (hold || !hitAll)
      return { ...base, reps: targetReps, weight: current, up: false, code: hold ? holdCode : 'repeat-target', facts: { assistance: current } }
    const next = stepLoad(current, -1, { load, unit })
    return { ...base, reps: targetReps, weight: next, up: next < current, code: 'less-assistance', facts: { from: current, to: next } }
  }

  const lastWeight = Math.max(0, ...weights)
  if (lastWeight <= 0) return { ...base, up: false, code: 'no-load-logged', facts: {} }
  if (hold) {
    // Easier days and returns re-establish a comfortable load; they never add.
    const factor = easy ? 0.9 : awayDays >= 42 ? 0.7 : awayDays >= 21 ? 0.8 : awayDays >= 7 ? 0.9 : 1
    const reduced = factor < 1 ? fitToSizes(roundLoad(lastWeight * factor, load, unit), sizes) : lastWeight
    return { ...base, reps: targetReps, weight: reduced, up: false, code: holdCode, facts: { from: lastWeight, factor } }
  }
  // Two comparable sessions in a row clearly short of target at the same load: a little lighter.
  const previous = sessions.at(-2)
  const missedBy = (s) => s.sets.reduce((n, x) => n + Math.max(0, (x.targetReps ?? targetReps) - x.reps), 0)
  if (
    previous &&
    !hitAll &&
    Math.max(...previous.sets.map((s) => s.weight || 0)) === lastWeight &&
    missedBy(last) >= 2 &&
    missedBy(previous) >= 2
  ) {
    const lighter = stepLoad(lastWeight, -1, { load, unit, sizes })
    if (lighter && lighter > 0)
      return { ...base, reps: targetReps, weight: lighter, up: false, code: 'missed-twice', facts: { from: lastWeight, to: lighter } }
  }
  if (!hitAll) return { ...base, reps: targetReps, weight: lastWeight, up: false, code: 'repeat-target', facts: { weight: lastWeight } }
  const listed = sizes.length > 0 && (load === 'hand' || load === 'one')
  const next = stepLoad(lastWeight, 1, { load, unit, sizes })
  // The next listed dumbbell can be missing or a big jump; add a rep instead.
  if (next === null || (listed && next > lastWeight * 1.2)) {
    const best = Math.max(...last.sets.map((s) => s.reps))
    if (best + 1 <= targetReps + 4)
      return { ...base, reps: best + 1, weight: lastWeight, up: true, code: 'more-reps-before-jump', facts: { weight: lastWeight, next } }
    return { ...base, reps: targetReps, weight: lastWeight, up: false, code: 'next-size-missing', facts: { weight: lastWeight } }
  }
  return { ...base, reps: targetReps, weight: next, up: true, code: 'load-up', facts: { from: lastWeight, to: next } }
}
