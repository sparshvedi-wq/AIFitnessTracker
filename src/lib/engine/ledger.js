// What actually happened in a saved session, exercise by exercise.
//
// A finished session is information, not a queue. For each exercise the
// ledger separates completed working sets, warm-ups, partial work, exercises
// never reached, and exercises deliberately skipped, with the stated reason if
// one was given. A missing reason stays "unknown"; nothing is invented.

export const OUTCOME_VERSION = 1

// Reasons people can give, normalised into the classes the engine adapts to.
const REASON_CLASS = {
  time: 'time',
  pain: 'discomfort',
  discomfort: 'discomfort',
  soreness: 'soreness',
  unwell: 'unwell',
  dislike: 'dislike',
  equipment: 'equipment',
  'changed-plan': 'unknown',
  other: 'unknown',
  unknown: 'unknown',
}
export const normalizeReason = (reason) => REASON_CLASS[reason] || 'unknown'

export const STRENGTH_KINDS = (kind) => !['sport', 'recovery', 'pump'].includes(kind)

const isWork = (s) => s.kind !== 'warmup'
const isDone = (s) => !s.status || s.status === 'done'

/**
 * Builds the outcome from a live session (with planned and unfinished sets).
 * Used when the session is saved; stored on the record as `outcome`.
 */
export function outcomeFromSession(session) {
  const stop = session.finishReason ? normalizeReason(session.finishReason) : 'unknown'
  return {
    version: OUTCOME_VERSION,
    stopReason: stop,
    exercises: session.exercises.map((e) => {
      const work = e.sets.filter(isWork)
      const doneWork = work.filter((s) => s.status === 'done').length
      const doneWarmup = e.sets.filter((s) => !isWork(s) && s.status === 'done').length
      const skippedSets = work.filter((s) => s.status === 'skipped').length
      // Work the app removed (for example after a place change) was not skipped by the person.
      const deliberate = Boolean(e.skipReason) && !e.removedBy
      const status =
        doneWork === work.length && work.length > 0
          ? 'complete'
          : doneWork > 0
            ? 'partial'
            : deliberate && skippedSets
              ? 'skipped'
              : 'not-reached'
      return {
        exId: e.exId,
        planned: work.length,
        doneWork,
        doneWarmup,
        status,
        // A partial or unreached exercise inherits the stop reason; a skipped
        // one keeps its own. Complete work has no reason.
        reason:
          status === 'complete'
            ? null
            : e.skipReason
              ? normalizeReason(e.skipReason)
              : session.kind === 'manual'
                ? null
                : stop,
        deliberate,
        ...(e.swappedFrom ? { swappedFrom: e.swappedFrom } : {}),
        ...(e.retry ? { retry: true } : {}),
      }
    }),
  }
}

/**
 * The outcome of any saved record. Records saved before the ledger existed are
 * reconstructed conservatively from their completed sets and `unfinished` list.
 */
export function recordOutcome(record) {
  if (validOutcome(record.outcome)) return record.outcome
  const stop = record.finishReason ? normalizeReason(record.finishReason) : 'unknown'
  const done = new Map()
  for (const e of record.exercises || []) {
    const entry = done.get(e.exId) || { doneWork: 0, doneWarmup: 0 }
    for (const s of e.sets || []) {
      if (!isDone(s)) continue
      if (isWork(s)) entry.doneWork++
      else entry.doneWarmup++
    }
    done.set(e.exId, entry)
  }
  const unfinished = new Map((record.unfinished || []).map((u) => [u.exId, u]))
  const ids = [...new Set([...done.keys(), ...unfinished.keys()])]
  return {
    version: OUTCOME_VERSION,
    derived: true,
    stopReason: stop,
    exercises: ids.map((exId) => {
      const d = done.get(exId) || { doneWork: 0, doneWarmup: 0 }
      const u = unfinished.get(exId)
      const reason = u ? normalizeReason(u.reason) : null
      // Old records cannot tell a skip from the session ending; a reason that
      // differs from the stop reason must have been given for this exercise.
      const deliberate = Boolean(u && u.reason && u.reason !== record.finishReason && u.reason !== 'other')
      return {
        exId,
        planned: null,
        doneWork: d.doneWork,
        doneWarmup: d.doneWarmup,
        status: !u ? 'complete' : d.doneWork ? 'partial' : deliberate ? 'skipped' : 'not-reached',
        reason: u ? reason : null,
        deliberate,
      }
    }),
  }
}

function validOutcome(outcome) {
  return outcome?.version === OUTCOME_VERSION && Array.isArray(outcome.exercises) &&
    outcome.exercises.every((e) => e && typeof e.exId === 'string' &&
      ['complete', 'partial', 'skipped', 'not-reached'].includes(e.status) &&
      Number.isInteger(e.doneWork) && e.doneWork >= 0 &&
      Number.isInteger(e.doneWarmup) && e.doneWarmup >= 0 &&
      (e.planned === null || (Number.isInteger(e.planned) && e.planned >= e.doneWork)))
}

// History edits change the evidence consumed by planning and preference learning.
// Retain known unfinished intent, but rebuild completion counts from the edited log.
export function correctedOutcome(record, exercises) {
  const previous = recordOutcome(record)
  const logged = new Map()
  for (const e of exercises) {
    const counts = logged.get(e.exId) || { doneWork: 0, doneWarmup: 0 }
    for (const s of e.sets || []) {
      if (!isDone(s)) continue
      if (isWork(s)) counts.doneWork++
      else counts.doneWarmup++
    }
    logged.set(e.exId, counts)
  }
  const before = new Map(previous.exercises.map((e) => [e.exId, e]))
  const ids = new Set([...logged.keys(), ...previous.exercises.filter((e) => e.status !== 'complete').map((e) => e.exId)])
  return {
    ...previous,
    derived: true,
    exercises: [...ids].map((exId) => {
      const old = before.get(exId)
      const counts = logged.get(exId) || { doneWork: 0, doneWarmup: 0 }
      const planned = Math.max(counts.doneWork, old?.planned ?? counts.doneWork + (old && old.status !== 'complete' ? 1 : 0))
      const status = planned > 0 && counts.doneWork >= planned ? 'complete' : counts.doneWork ? 'partial' : old?.deliberate ? 'skipped' : 'not-reached'
      return { ...old, exId, ...counts, planned, status, reason: status === 'complete' ? null : old?.reason || previous.stopReason || 'unknown', deliberate: Boolean(old?.deliberate) }
    }),
  }
}

/** Milliseconds timestamp for when a record's work happened. */
export function recordTime(record) {
  const timestamp = Number.isFinite(record.endedAt) ? record.endedAt : record.startedAt
  if (!Number.isFinite(timestamp)) return Date.parse(`${record.date}T12:00:00`)
  const localDay = (value) => {
    const d = new Date(value)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // Keep genuine overnight sessions intact. A manually chosen/edited calendar
  // date otherwise wins over the time at which the log was entered.
  if (!record.date || record.date === localDay(timestamp) || (Number.isFinite(record.startedAt) && record.date === localDay(record.startedAt))) return timestamp
  const chosen = new Date(`${record.date}T12:00:00`)
  if (!Number.isFinite(chosen.getTime())) return timestamp
  const time = new Date(timestamp)
  chosen.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds())
  return chosen.getTime()
}

/** Saved, real (non-sample) records on or before `today`, oldest first, de-duplicated by id. */
export function realHistory(workouts = [], today) {
  return computeHistory(workouts, today)
}
function computeHistory(workouts, today) {
  const seen = new Set()
  return workouts
    .filter((w) => w && !w.sample && (!today || w.date <= today))
    .filter((w) => (seen.has(w.id) ? false : seen.add(w.id)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || recordTime(a) - recordTime(b))
}
