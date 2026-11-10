// "What changes next time", shown right after saving. It asks the same
// strength model the planner uses (src/lib/strength) what it would plan for
// each exercise in a few days, at the same place, with this workout already
// counted, so the promise matches the next plan. Exercises outside the
// strength model (timed holds, bands, custom moves) keep the simple
// progression rules the planner also uses for them (engine/progression.js).
import { findExercise } from './exercises.js'
import { availableLoads, DUMBBELL_MOVES } from './preferences.js'
import { fmtNum } from './workout.js'
import { metaOf } from './catalog/index.js'
import { planTarget } from './engine/progression.js'
import { equipmentSatisfied, placeCapabilities } from './engine/eligibility.js'
import { exerciseSignals } from './engine/learning.js'
import { recordOutcome, recordTime } from './engine/ledger.js'
import { resolvePlace } from './places.js'
import { toKey } from './date.js'
import { strengthTarget } from './strength/index.js'

const DAY = 86400000
// "Next time" is judged a few days on, once the muscles have recovered.
const NEXT_IN_DAYS = 3

// The place an exercise was actually done: if the workout moved somewhere the
// exercise can't be done (a mid-workout place change), it was the usual place.
function placeFor(meta, profile, location) {
  if (!meta?.equipment?.length) return location
  const here = resolvePlace(profile, location)
  return equipmentSatisfied(meta, placeCapabilities(here)) ? location : profile.location
}

const isWork = (s) => s.kind !== 'warmup' && (!s.status || s.status === 'done')

/**
 * @param workout  the saved record
 * @param profile  training profile
 * @param context  { workouts, learning, metrics } from app state, so the
 *   note reads the same history the planner will (the record is added if
 *   it isn't there yet)
 */
export function nextTimeNotes(workout, profile, unit, customExercises = [], context = {}) {
  if (['sport', 'recovery', 'pump'].includes(workout.kind)) return []
  const ended = Number.isFinite(workout.endedAt) ? workout.endedAt : Number.isFinite(workout.startedAt) ? workout.startedAt : Date.now()
  const record = {
    ...workout,
    id: workout.id || 'just-saved',
    date: workout.date || toKey(new Date(ended)),
    unit: workout.unit || unit,
    endedAt: ended,
  }
  const saved = Array.isArray(context.workouts) ? context.workouts : []
  // The saved list as it is (so the planner's cached model is reused), with
  // this record added only if it isn't saved yet.
  const workouts = saved.some((w) => w.id === record.id) ? saved : [...saved, record]
  const now = Math.max(ended, recordTime(record)) + NEXT_IN_DAYS * DAY
  const today = toKey(new Date(now))
  const signals = exerciseSignals({ workouts, learning: context.learning, settings: {} }, { now, today, place: record.location || null })
  const notes = []
  for (const e of record.exercises || []) {
    const def = findExercise(e.exId, customExercises)
    const done = (e.sets || []).filter(isWork)
    if (!def || !done.length) continue
    const meta = metaOf(def.id) || { load: def.weighted ? 'hand' : 'bw', role: 'accessory' }
    const place = placeFor(metaOf(def.id), profile, record.location)
    const sizes = DUMBBELL_MOVES.includes(def.id) ? availableLoads(profile, place) : []
    const signal = signals.get(def.id)
    const target = strengthTarget({
      exId: def.id,
      def,
      workouts,
      learning: context.learning,
      metrics: context.metrics,
      customExercises,
      unit,
      today,
      now,
      goal: profile.goal,
      experience: profile.experience,
      place,
      sizes,
      // The planner sizes loads for its usual set count (engine/recommend.js setCap).
      sets: profile.experience === 'Starting out' || !profile.experience ? 2 : 3,
      // A saved routine keeps its own reps; daily plans use the goal's range.
      ...(record.kind === 'routine' && Number.isFinite(done[0].targetReps) ? { fixedReps: done[0].targetReps } : {}),
      noIncrease: signal?.comfort.status === 'some' || signal?.difficulty === 'hard',
    })
    const note = target ? fromModel(def, meta, done, target, unit, sizes) : fromRules(def, meta, done, record, unit, sizes)
    if (note) notes.push({ exId: def.id, name: def.name, ...note })
  }
  // Increases first: they're what people want to know. Three lines at most.
  return notes.sort((a, b) => Number(Boolean(b.up)) - Number(Boolean(a.up))).slice(0, 3)
}

function fromModel(def, meta, done, target, unit, sizes) {
  if (target.mode === 'reps') {
    const best = Math.max(...done.map((s) => s.reps || 0))
    if (!(target.reps > 0)) return null
    return {
      change: `${target.reps} reps`,
      why:
        target.code === 'deload'
          ? 'A lighter session to reset after some tough ones.'
          : target.reps > best
            ? 'One step up in reps.'
            : target.reps === best
              ? 'Same again: make every rep count.'
              : 'A few less, from how those sets went.',
      up: Boolean(target.up),
    }
  }
  if (!Number.isFinite(target.weight)) return null
  const assist = target.mode === 'assist'
  const weights = done.map((s) => s.weight).filter((w) => Number.isFinite(w) && w >= 0)
  if (!weights.length) return null
  const lastWeight = assist ? Math.min(...weights) : Math.max(...weights)
  const lastReps = Math.min(...done.filter((s) => s.weight === lastWeight).map((s) => s.reps || 0))
  const each = meta.load === 'hand' ? ' each' : ''
  const change = assist
    ? `${fmtNum(target.weight)} ${unit} assistance × ${target.reps}`
    : `${fmtNum(target.weight)} ${unit}${each} × ${target.reps}`
  const flags = target.flags || []
  const harder = assist ? target.weight < lastWeight - 1e-6 : target.weight > lastWeight + 1e-6
  const lighter = assist ? target.weight > lastWeight + 1e-6 : target.weight < lastWeight - 1e-6
  let why
  if (target.code === 'deload') why = 'A lighter session to reset after some tough ones.'
  else if (harder) why = assist ? 'A little less help: you’re getting stronger.' : 'You’re ready for the next weight.'
  else if (lighter) why = assist ? 'A little more help, from how those sets went.' : 'A little lighter, from how those sets went.'
  else if (flags.includes('outgrown'))
    why = sizes.length ? 'You’ve outgrown the dumbbells listed here.' : 'You’ve outgrown this weight. Add weight if you can.'
  else if (flags.includes('more-reps-before-jump') || target.reps > lastReps)
    why = sizes.length && flags.includes('more-reps-before-jump')
      ? 'More reps first: your next dumbbell size isn’t listed for this place.'
      : 'Same weight, a rep or two more.'
  else why = `Same weight: aim for all ${target.reps} reps.`
  return { change, why, up: Boolean(target.up) && !lighter }
}

// Timed holds, bands and custom exercises: the planner's simple rules.
function fromRules(def, meta, done, record, unit, sizes) {
  const first = done[0]
  const item = { reps: first.targetReps ?? first.reps, sec: first.targetSec ?? first.sec }
  const session = {
    incomplete: recordOutcome(record).exercises.some((o) => o.exId === def.id && o.doneWork < o.planned),
    sets: done.map((s) => ({
      reps: s.reps ?? null,
      sec: s.sec ?? null,
      weight: s.weight ?? null,
      targetReps: s.targetReps ?? null,
      targetSec: s.targetSec ?? null,
    })),
  }
  const target = planTarget({ meta, def, item, sessions: [session], unit, sizes })
  if (def.type === 'time')
    return target.up ? { change: `${target.sec}s`, why: 'You held every set.', up: true } : null
  if (def.weighted && Math.max(0, ...done.map((s) => s.weight || 0)) > 0)
    return {
      change: `${fmtNum(target.weight)} ${unit}`,
      why: target.up ? 'You hit every rep.' : `Same weight; aim for all ${item.reps} reps.`,
      up: target.up,
    }
  return target.up ? { change: `${target.reps} reps`, why: 'You hit every rep.', up: true } : null
}
