import { convertWeight } from './units.js'
import { findRecords, isAssisted, totals } from './workout.js'
import { metaOf } from './catalog/index.js'
import { MIN_REST } from './engine/config.js'

// Rest when an older record didn't save its own: what plans use for the role.
const restFor = (exId) => {
  const role = metaOf(exId)?.role
  return role === 'compound' ? 90 : Math.max(60, MIN_REST[role] ?? 60)
}
import { correctedOutcome } from './engine/ledger.js'
import { SET_LIMITS } from './set-entry.js'

// A daily recommendation is ephemeral. Repeat the actual logged session instead.
export function routineFromWorkout(workout, unit = workout.unit) {
  return {
    id: `repeat-${workout.id}`,
    name: workout.name,
    kind: workout.kind === 'manual' ? 'routine' : workout.kind,
    sport: workout.sport,
    focus: workout.focus,
    location: workout.location,
    placeName: workout.placeName,
    requestedMinutes: workout.requestedMinutes,
    // Working sets only: the warm-up is added again when the workout starts.
    items: workout.exercises
      .map((e) => ({ e, work: e.sets.filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done')) }))
      .filter(({ work }) => work.length)
      .map(({ e, work }) => {
        const loads = work.map((s) => s.weight).filter((w) => Number.isFinite(w) && w >= 0)
        // The top working set: the heaviest load, or the least assistance.
        const load = !e.weighted || !loads.length ? null : isAssisted(e.exId) ? Math.min(...loads) : Math.max(...loads)
        const top = work.find((s) => s.weight === load) || work[0]
        return {
          exId: e.exId,
          sets: work.length,
          reps: top.targetReps ?? top.reps,
          sec: top.targetSec ?? top.sec,
          weight: load === null ? null : convertWeight(load, workout.unit || unit, unit),
          restSec: Number.isFinite(e.restSec) ? e.restSec : restFor(e.exId),
          ...(e.unilateral ? { unilateral: true } : {}),
        }
      }),
  }
}

export function correctWorkout(workout, { date, note, exercises }, today) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date > today ||
    Number.isNaN(Date.parse(`${date}T12:00:00`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error('Choose a valid date on or before today.')
  const cleaned = exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => {
      const reps = Number(s.reps),
        sec = Number(s.sec),
        weight = Number(s.weight)
      if (
        e.type === 'time'
          ? !Number.isFinite(sec) || sec <= 0 || sec > SET_LIMITS.sec
          : !Number.isInteger(reps) || reps <= 0 || reps > SET_LIMITS.reps
      )
        throw new Error('Enter a positive duration or whole number of reps for every set.')
      if (e.weighted && (!Number.isFinite(weight) || weight < 0 || weight > SET_LIMITS.weight))
        throw new Error('Enter a valid weight for every weighted set.')
      return {
        ...s,
        reps: e.type === 'time' ? null : reps,
        sec: e.type === 'time' ? sec : null,
        weight: e.weighted ? weight : null,
      }
    }),
  }))
  const outcome = correctedOutcome(workout, cleaned)
  const unfinished = outcome.exercises.filter((e) => e.status !== 'complete' && e.planned > e.doneWork).map((e) => ({
    ...(workout.unfinished || []).find((u) => u.exId === e.exId),
    exId: e.exId,
    reason: e.reason || 'unknown',
  }))
  return {
    ...workout,
    date,
    note: note.trim(),
    exercises: cleaned,
    outcome,
    unfinished,
    totals: totals(cleaned),
    editedAt: Date.now(),
  }
}

export function rebuildRecords(workouts) {
  const ordered = [...workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startedAt || 0) - (b.startedAt || 0),
  )
  return ordered.map((w, i) => ({
    ...w,
    records: w.sample
      ? w.records
      : findRecords(
          {
            ...w,
            exercises: w.exercises.map((e) => ({
              ...e,
              sets: e.sets.map((s) => ({ ...s, status: 'done' })),
            })),
          },
          ordered.slice(0, i),
        ),
  }))
}
