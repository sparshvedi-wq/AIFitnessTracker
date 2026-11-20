// Unfinished work as optional planning candidates, never as debt.
//
// An exercise left unfinished becomes a candidate only when the reason makes
// it useful to revisit (ran out of time; reason unknown; equipment missing at
// that place). Discomfort, soreness, feeling unwell and preferring something
// else never roll over; they adapt comfort, readiness or preference instead.
//
// Each candidate is reassessed every time a plan is made, against everything
// completed since. An offer is not completion: a missed offer reduces priority,
// and a bounded number of offers prevents debt. Comparable completed work
// satisfies the original dose. Carried variants never create a second debt.
import { metaOf } from '../catalog/index.js'
import { MUSCLE_AREA } from '../catalog/vocabulary.js'
import {
  CONTRIBUTION,
  ROLLOVER_HALF_LIFE_DAYS,
  ROLLOVER_MAX_AGE_DAYS,
  ROLLOVER_MAX_OFFERS,
  ROLLOVER_REASON_WEIGHT,
  ROLLOVER_SATISFIED_SHARE,
} from './config.js'
import { realHistory, recordOutcome, recordTime } from './ledger.js'

const DAY = 86400000
const PLANNED_KINDS = ['adaptive', 'routine', 'pump', undefined, null]

function primaryAreaDose(meta, sets) {
  const dose = {}
  if (!meta) return dose
  for (const area of new Set(meta.primary.map((m) => MUSCLE_AREA[m]))) dose[area] = CONTRIBUTION.primary * sets
  return dose
}

/**
 * @returns {{ active: Candidate[], closed: Array<Candidate & { closedBy: string }> }}
 *   Candidate: { source, exId, family, reason, missedSets, at, workoutId, priority, ageDays }
 */
export function rolloverCandidates(workouts, { now, today, place = null } = {}) {
  const history = realHistory(workouts, today).filter((w) => recordTime(w) <= now)
  const active = []
  const closed = []
  for (let i = 0; i < history.length; i++) {
    const record = history[i]
    if (!PLANNED_KINDS.includes(record.kind)) continue
    const at = recordTime(record)
    const ageDays = (now - at) / DAY
    if (ageDays < 0 || ageDays > ROLLOVER_MAX_AGE_DAYS) continue
    const carried = new Set(
      (record.planning?.carriedFrom || []).map((source) => String(source).split(':').slice(1).join(':')),
    )
    const outcome = recordOutcome(record)
    for (const o of outcome.exercises) {
      if (!['partial', 'not-reached', 'skipped'].includes(o.status)) continue
      const reason = o.reason || 'unknown'
      let weight = ROLLOVER_REASON_WEIGHT[reason] || 0
      // Equipment missing at that place only matters if today is somewhere else.
      if (reason === 'equipment' && place && record.location === place) weight = 0
      const meta = metaOf(o.exId)
      const wasCarried =
        [...carried].some((id) => id === o.exId || (meta && metaOf(id)?.family === meta.family)) ||
        (record.unfinished || []).some((u) => u.exId === o.exId && u.carried)
      if (!weight || wasCarried) continue
      if (!meta) continue
      const candidate = {
        source: `${record.id}:${o.exId}`,
        exId: o.exId,
        family: meta?.family || null,
        reason,
        missedSets: Math.max(1, (o.planned ?? o.doneWork + 1) - o.doneWork),
        at,
        workoutId: record.id,
        ageDays,
        priority: weight * Math.pow(0.5, ageDays / ROLLOVER_HALF_LIFE_DAYS),
      }
      const later = history.slice(i + 1).filter((w) => recordTime(w) > at)
      const offers = later.filter((w) => (w.planning?.carriedFrom || []).includes(candidate.source))
      const declined = offers.some((w) => recordOutcome(w).exercises.some((e) =>
        (e.exId === candidate.exId || metaOf(e.exId)?.family === candidate.family) &&
        ['discomfort', 'soreness', 'unwell', 'dislike'].includes(e.reason),
      ))
      const progress = closure(candidate, meta, later)
      const closedBy = declined ? 'declined' : progress.closedBy || (offers.length >= ROLLOVER_MAX_OFFERS ? 'offer-limit' : null)
      candidate.offers = offers.length
      candidate.remainingSets = Math.max(0, candidate.missedSets - progress.equivalentSets)
      candidate.priority *= Math.pow(0.5, offers.length) * candidate.remainingSets / candidate.missedSets
      if (closedBy) closed.push({ ...candidate, closedBy })
      else active.push(candidate)
    }
  }
  // One candidate per family (the strongest); older duplicates are closed.
  const byFamily = new Map()
  for (const c of active.sort((a, b) => b.priority - a.priority || a.source.localeCompare(b.source))) {
    const key = c.family || c.exId
    if (byFamily.has(key)) closed.push({ ...c, closedBy: 'superseded' })
    else byFamily.set(key, c)
  }
  return { active: [...byFamily.values()], closed }
}

function closure(candidate, meta, later) {
  const missed = primaryAreaDose(meta, candidate.missedSets)
  const covered = {}
  let equivalentSets = 0
  let sameExercise = false
  for (const w of later) {
    for (const e of w.exercises || []) {
      const done = (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done')).length
      if (!done) continue
      const other = metaOf(e.exId)
      if (e.exId === candidate.exId || (meta && other && other.family === meta.family)) {
        equivalentSets += done
        sameExercise ||= e.exId === candidate.exId
      }
      if (other)
        for (const area of new Set(other.primary.map((m) => MUSCLE_AREA[m])))
          covered[area] = (covered[area] || 0) + CONTRIBUTION.primary * done
    }
  }
  const areas = Object.keys(missed)
  if (equivalentSets >= candidate.missedSets * ROLLOVER_SATISFIED_SHARE)
    return { closedBy: sameExercise ? 'same-exercise' : 'same-family', equivalentSets }
  if (
    areas.length &&
    areas.every((area) => (covered[area] || 0) >= ROLLOVER_SATISFIED_SHARE * missed[area])
  )
    return { closedBy: 'covered', equivalentSets }
  return { closedBy: null, equivalentSets }
}

/** Compatibility wrapper for the previous planner's API. */
export function carryCandidates(workouts, today, now = Date.parse(`${today}T23:59:00`)) {
  return rolloverCandidates(workouts, { today, now }).active.filter((c) => c.reason === 'time')
}
