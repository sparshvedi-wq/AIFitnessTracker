import { convertWeight } from './units.js'
import { findRecords, totals } from './workout.js'

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
    items: workout.exercises
      .filter((e) => e.sets.length)
      .map((e) => ({
        exId: e.exId,
        sets: e.sets.length,
        reps: e.sets[0].reps,
        sec: e.sets[0].sec,
        weight: e.weighted ? convertWeight(e.sets[0].weight || 0, workout.unit || unit, unit) : null,
        restSec: e.restSec ?? 60,
      })),
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
          ? !Number.isFinite(sec) || sec <= 0 || sec > 86400
          : !Number.isInteger(reps) || reps <= 0 || reps > 10000
      )
        throw new Error('Enter a positive duration or whole number of reps for every set.')
      if (e.weighted && (!Number.isFinite(weight) || weight < 0 || weight > 10000))
        throw new Error('Enter a valid weight for every weighted set.')
      return {
        ...s,
        reps: e.type === 'time' ? null : reps,
        sec: e.type === 'time' ? sec : null,
        weight: e.weighted ? weight : null,
      }
    }),
  }))
  return {
    ...workout,
    date,
    note: note.trim(),
    exercises: cleaned,
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
