// "What changes next time", shown right after saving. It uses the same rule the
// planner applies (suggestTarget), so the promise matches the next plan.
import { findExercise } from './exercises.js'
import { availableLoads, DUMBBELL_MOVES, fitAvailableLoad } from './preferences.js'
import { fmtNum, suggestTarget } from './workout.js'

export function nextTimeNotes(workout, profile, unit, customExercises = []) {
  if (['sport', 'recovery', 'pump'].includes(workout.kind)) return []
  const notes = []
  for (const e of workout.exercises || []) {
    const def = findExercise(e.exId, customExercises)
    const done = (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done'))
    if (!def || !done.length) continue
    const first = done[0]
    const item = { reps: first.targetReps ?? first.reps, sec: first.targetSec ?? first.sec }
    const { target, up } = suggestTarget(def, item, { sets: done }, unit)
    const lastWeight = Math.max(0, ...done.map((s) => s.weight || 0))
    if (def.type === 'time') {
      if (up)
        notes.push({ exId: def.id, name: def.name, change: `${target.sec}s`, why: 'You held every set.' })
      continue
    }
    if (def.weighted && lastWeight > 0) {
      let weight = target.weight
      if (DUMBBELL_MOVES.includes(def.id)) {
        const fitted = fitAvailableLoad(weight, availableLoads(profile, workout.location))
        if (up && fitted != null && fitted <= lastWeight) {
          notes.push({
            exId: def.id,
            name: def.name,
            change: `${fmtNum(lastWeight)} ${unit}, more reps`,
            why: 'You hit every rep, but your next dumbbell size isn’t listed for this place.',
          })
          continue
        }
        weight = fitted ?? weight
      }
      notes.push({
        exId: def.id,
        name: def.name,
        change: `${fmtNum(weight)} ${unit}`,
        why: up ? 'You hit every rep.' : `Same weight; aim for all ${item.reps} reps.`,
        up,
      })
      continue
    }
    if (up)
      notes.push({
        exId: def.id,
        name: def.name,
        change: `${target.reps} reps`,
        why: 'You hit every rep.',
        up,
      })
  }
  // Increases first: they're what people want to know. Three lines at most.
  return notes.sort((a, b) => Number(Boolean(b.up)) - Number(Boolean(a.up))).slice(0, 3)
}
