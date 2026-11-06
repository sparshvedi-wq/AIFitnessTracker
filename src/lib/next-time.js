// "What changes next time", shown right after saving. It uses the same
// progression rules the planner applies (engine/progression.js planTarget),
// so the promise matches the next plan for the same exercise and place.
import { findExercise } from './exercises.js'
import { availableLoads, DUMBBELL_MOVES } from './preferences.js'
import { fmtNum } from './workout.js'
import { metaOf } from './catalog/index.js'
import { planTarget } from './engine/progression.js'
import { equipmentSatisfied, placeCapabilities } from './engine/eligibility.js'
import { resolvePlace } from './places.js'
import { recordOutcome } from './engine/ledger.js'

// The place an exercise was actually done: if the workout moved somewhere the
// exercise can't be done (a mid-workout place change), it was the usual place.
function placeFor(meta, profile, location) {
  if (!meta?.equipment?.length) return location
  const here = resolvePlace(profile, location)
  return equipmentSatisfied(meta, placeCapabilities(here)) ? location : profile.location
}

export function nextTimeNotes(workout, profile, unit, customExercises = []) {
  if (['sport', 'recovery', 'pump'].includes(workout.kind)) return []
  const notes = []
  for (const e of workout.exercises || []) {
    const def = findExercise(e.exId, customExercises)
    const done = (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done'))
    if (!def || !done.length) continue
    const meta = metaOf(def.id) || { load: def.weighted ? 'hand' : 'bw', role: 'accessory' }
    const first = done[0]
    const item = { reps: first.targetReps ?? first.reps, sec: first.targetSec ?? first.sec }
    const session = {
      incomplete: recordOutcome(workout).exercises.some((o) => o.exId === e.exId && o.doneWork < o.planned),
      sets: done.map((s) => ({
        reps: s.reps ?? null,
        sec: s.sec ?? null,
        weight: s.weight ?? null,
        targetReps: s.targetReps ?? null,
        targetSec: s.targetSec ?? null,
      })),
    }
    const sizes = DUMBBELL_MOVES.includes(def.id) ? availableLoads(profile, placeFor(metaOf(def.id), profile, workout.location)) : []
    const target = planTarget({ meta, def, item, sessions: [session], unit, sizes })
    const lastWeight = Math.max(0, ...done.map((s) => s.weight || 0))
    if (def.type === 'time') {
      if (target.up)
        notes.push({ exId: def.id, name: def.name, change: `${target.sec}s`, why: 'You held every set.', up: true })
      continue
    }
    if (meta.load === 'assist') {
      notes.push({
        exId: def.id,
        name: def.name,
        change: `${fmtNum(target.weight)} ${unit} assistance`,
        why: target.up ? 'You hit every rep, so a little less help.' : `Same assistance; aim for all ${item.reps} reps.`,
        up: target.up,
      })
      continue
    }
    if (def.weighted && lastWeight > 0) {
      if (target.code === 'fitted-to-available') {
        notes.push({
          exId: def.id,
          name: def.name,
          change: `${fmtNum(target.weight)} ${unit}`,
          why: 'Your heaviest dumbbell here is lighter than last time.',
        })
        continue
      }
      if (target.code === 'more-reps-before-jump' || target.code === 'next-size-missing') {
        notes.push({
          exId: def.id,
          name: def.name,
          change: `${fmtNum(target.weight)} ${unit}, more reps`,
          why: sizes.length
            ? 'You hit every rep, but your next dumbbell size isn’t listed for this place.'
            : 'You hit every rep; the next weight is a big jump, so add a rep first.',
          up: true,
        })
        continue
      }
      notes.push({
        exId: def.id,
        name: def.name,
        change: `${fmtNum(target.weight)} ${unit}`,
        why: target.up ? 'You hit every rep.' : `Same weight; aim for all ${item.reps} reps.`,
        up: target.up,
      })
      continue
    }
    if (target.up)
      notes.push({ exId: def.id, name: def.name, change: `${target.reps} reps`, why: 'You hit every rep.', up: true })
  }
  // Increases first: they're what people want to know. Three lines at most.
  return notes.sort((a, b) => Number(Boolean(b.up)) - Number(Boolean(a.up))).slice(0, 3)
}
