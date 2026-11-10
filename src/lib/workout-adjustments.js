import { findExercise } from './exercises.js'
import { profileOf, readinessOf } from './planner.js'
import { availableLoads, fitAvailableLoad, DUMBBELL_MOVES } from './preferences.js'
import { currentSet, lastPerformance, makeSessionExercise, enterWork, finish, openRest } from './workout.js'
import { movementAllowed, movementPreferences, movementSummary } from './movement-preferences.js'
import { sportScheduleContext } from './sport-schedule.js'
import { todayKey, toKey } from './date.js'
import { snapLoad, strengthNote, strengthTarget, trainsAny } from './strength/index.js'
import { quietAt, resolvePlace } from './places.js'
import { metaOf } from './catalog/index.js'
import { eligibilityContext, planningContext } from './engine/recommend.js'
import { ineligibility } from './engine/eligibility.js'
import { rankSubstitutes } from './engine/substitute.js'
import { extraSetSeconds, itemSeconds } from './engine/session-time.js'

/** Planning context for adjustments to an existing session or routine. */
function adjustmentContext(state, { location, readiness, profile, movement, today, now, liveSession }) {
  const p = { ...profileOf(state), ...profile }
  const r = { ...readinessOf(state, today), ...readiness }
  r.pain = [...new Set([...(p.avoidMuscles || []), ...(r.pain || [])])]
  r.sore = r.sore || []
  return planningContext(state, {
    today,
    now,
    profile: p,
    readiness: r,
    location: location || p.location,
    movement,
    liveSession,
  })
}

export function replacementOptions(state, session, { now = Date.now(), today = todayKey() } = {}) {
  const current = currentSet(session)?.ex
  if (!current || ['sport', 'pump'].includes(session.kind)) return []
  const ctx = adjustmentContext(state, {
    location: session.location,
    readiness: session.readiness || undefined,
    profile: session.equipmentProfile || undefined,
    // The movement limits saved with the session, not today's defaults.
    movement: session.movement || undefined,
    today,
    now,
    liveSession: session,
  })
  const elig = eligibilityContext(ctx, null)
  // Never offer something already in this session.
  const exclude = new Set(session.exercises.map((e) => e.exId))
  return rankSubstitutes(current.exId, elig, {
    signals: ctx.signals,
    exclude,
    limit: 4,
    currentDef: findExercise(current.exId, state.customExercises) || current,
  }).map((r) => r.def)
}

const QUIET_ALTERNATIVES = {
  'jumping-jack': 'quiet-step',
  'squat-jump': 'quiet-squat',
  burpee: 'quiet-march',
  'high-knees': 'quiet-march',
  skater: 'quiet-step',
  'mountain-climber': 'quiet-march',
}

export function adaptRoutineItems(state, items, location, readiness, options = {}) {
  const today = options.today || todayKey()
  const now = options.now ?? Date.now()
  const p = profileOf(state)
  const movement = movementPreferences(p, location, options.movement)
  const schedule = sportScheduleContext(p, { today, now, minutes: options.minutes || p.minutes })
  const place = resolvePlace(p, location)
  const quiet = quietAt(p, location)
  const ctx = adjustmentContext(state, { location, readiness, movement: options.movement, today, now })
  const elig = eligibilityContext(ctx, null)
  // Area avoidance is reported separately for routines ("omitted for today's readiness").
  const eligNoAreas = { ...elig, blockedAreas: new Set() }
  const avoids = new Set([...(p.avoidMuscles || []), ...(readiness.pain || []), ...(readiness.sore || [])])
  const excluded = new Set(p.excludedExercises || [])
  const unit = state.settings.weightUnit
  const used = new Set()
  const adapted = []
  const changes = []
  if (movement) changes.push(movementSummary(movement))
  if (schedule.note) changes.push(schedule.note)
  for (const source of items) {
    let def = findExercise(source.exId, state.customExercises)
    if (!def) continue
    let item = { ...source }
    const meta = metaOf(def.id)
    const areas = meta ? meta.areas : [def.muscle]
    if (areas.some((part) => avoids.has(part))) {
      changes.push(def.name + ' omitted for today’s readiness.')
      continue
    }
    // Custom exercises have no metadata: away from a gym, anything weighted or bar-based is unavailable.
    const code = meta ? ineligibility(meta, eligNoAreas) : null
    const unavailable = meta
      ? Boolean(code) && code !== 'experience'
      : place.base !== 'gym' && def.weighted
    const quietSwap = quiet && QUIET_ALTERNATIVES[def.id]
    if (quietSwap && movementAllowed(QUIET_ALTERNATIVES[def.id], movement)) {
      const old = def.name
      def = findExercise(QUIET_ALTERNATIVES[def.id])
      if (avoids.has('Legs')) {
        changes.push(old + ' omitted for today’s readiness.')
        continue
      }
      item = { ...item, exId: def.id, sec: source.sec || 40, reps: undefined, weight: undefined }
      changes.push(old + ' replaced with ' + def.name + '.')
    } else if (unavailable) {
      const [best] = rankSubstitutes(def.id, elig, {
        signals: ctx.signals,
        exclude: new Set([...used, ...items.map((i) => i.exId)]),
        limit: 1,
        currentDef: def,
      })
      const excludedSource = excluded.has(def.id) || ['explicit-dislike', 'reported-discomfort'].includes(code)
      if (!best) {
        changes.push(
          excludedSource
            ? `${def.name} left out because you asked not to have it suggested.`
            : def.name + ' omitted: no suitable equipment alternative.',
        )
        continue
      }
      const old = def.name
      def = best.def
      item = {
        ...item,
        exId: def.id,
        reps: def.type === 'reps' ? source.reps || 10 : undefined,
        sec: def.type === 'time' ? source.sec || 30 : undefined,
        weight: null,
      }
      changes.push(
        `${old} replaced with ${def.name}${excludedSource ? ' because you asked not to have it suggested' : ' for this setup'}.`,
      )
    }
    if (used.has(def.id)) {
      changes.push(def.name + ' kept once to avoid duplicate work.')
      continue
    }
    const finalMeta = metaOf(def.id)
    item.unilateral = Boolean(finalMeta?.perSide && def.type === 'reps')
    // A match or hard session nearby lightens everything; a normal practice
    // only the exercises that rely on the muscles it uses.
    const eventMuscles = schedule.muscles.includes(def.muscle) || trainsAny(def.id, ctx.lighterMuscles, def)
    if (schedule.lighter && (schedule.systemic || eventMuscles)) {
      item.sets = Math.min(item.sets || 1, eventMuscles ? 1 : 2)
      if (def.type === 'reps') item.reps = Math.min(item.reps || 8, 8)
      const last = lastPerformance(state.workouts, def.id, unit)
      if (def.weighted && finalMeta?.load !== 'assist') {
        const historical = last ? Math.max(...last.sets.map((s) => s.weight || 0)) : null
        const baseline = item.weight > 0 ? Math.min(item.weight, historical || Infinity) : historical
        // Always a weight the equipment can hold (plates, a stack step, a listed dumbbell).
        item.weight =
          baseline > 0
            ? snapLoad({ exId: def.id, weight: baseline * 0.85, unit, sizes: availableLoads(p, location), used: historical ? [historical] : [] })
            : null
      }
    }
    if (DUMBBELL_MOVES.includes(def.id)) {
      const loads = availableLoads(p, location)
      const planned = item.weight
      item.weight = fitAvailableLoad(planned, loads)
      // A lighter day can plan below the lightest dumbbell here. Use the
      // lightest one when it is no heavier than the person has lifted
      // before, rather than losing the weight entirely.
      if (item.weight === null && planned > 0 && loads.length) {
        const lifted = lastPerformance(state.workouts, def.id, state.settings.weightUnit)
        const best = lifted ? Math.max(...lifted.sets.map((s) => s.weight || 0)) : 0
        if (best > 0 && loads[0] <= best) item.weight = loads[0]
      }
    }
    used.add(def.id)
    adapted.push(item)
  }
  // What the strength model needs to plan these items the way daily plans are:
  // the day's lighter signals, muscles to go easy on, past activities, pace,
  // and exercises whose load is held after a "felt hard" or discomfort report.
  const holds = adapted
    .map((i) => i.exId)
    .filter((id) => {
      const signal = ctx.signals.get(id)
      return signal?.comfort.status === 'some' || signal?.difficulty === 'hard'
    })
  return {
    items: adapted,
    changes,
    movement,
    schedule,
    context: {
      easy: ctx.easy,
      returning: ctx.returning,
      highEffort: ctx.highEffort,
      holds,
      lighterMuscles: [...ctx.lighterMuscles],
      activities: ctx.activities,
      pace: ctx.pace,
    },
  }
}

export function replaceCurrentExercise(session, def, state, now = Date.now()) {
  const cur = currentSet(session)
  if (!cur || !replacementOptions(state, session, { now }).some((d) => d.id === def.id)) return session
  const pending = cur.ex.sets.filter((s) => s.status === 'todo' && s.kind !== 'warmup')
  if (!pending.length) return session
  const last = lastPerformance(
    state.workouts.filter((w) => w.unit === session.unit),
    def.id,
  )
  const p = { ...profileOf(state), ...session.equipmentProfile }
  const location = session.location || p.location
  // A different movement never inherits the old movement's load or progression:
  // its own history (or, carefully, a close relative's) sets the numbers, at
  // this place, at today's bodyweight and after the sets already done today.
  const adaptive = swapTarget(state, session, def, { now, location, profile: p, sets: pending.length })
  const item = {
    sets: pending.length,
    reps: def.type === 'reps' ? (adaptive?.reps ?? (cur.ex.type === 'reps' ? cur.set.reps : 10)) : null,
    sec: def.type === 'time' ? (cur.ex.type === 'time' ? cur.set.sec : 30) : null,
    restSec: cur.ex.restSec,
    ...(adaptive ? { repRange: adaptive.range, targetRir: adaptive.rir } : {}),
  }
  const lastWeight = def.weighted && last ? last.sets.at(-1)?.weight ?? null : null
  const previousWeight =
    lastWeight > 0
      ? session.schedule?.systemic
        ? snapLoad({ exId: def.id, weight: lastWeight * 0.85, unit: session.unit, sizes: availableLoads(p, location), used: [lastWeight] })
        : lastWeight
      : null
  const chosen = adaptive && adaptive.mode !== 'reps' && adaptive.weight != null ? adaptive.weight : previousWeight
  const weight = DUMBBELL_MOVES.includes(def.id) ? fitAvailableLoad(chosen, availableLoads(p, location)) : chosen
  const replacement = makeSessionExercise(
    def,
    { ...item, ...(Array.isArray(adaptive?.choices) ? { startChoices: adaptive.choices } : {}) },
    { reps: item.reps, sec: item.sec, weight },
    { last, note: swapNote(def, weight, adaptive, session.unit) },
  )
  replacement.unilateral = Boolean(metaOf(def.id)?.perSide && def.type === 'reps')
  // Recorded so future plans can learn which substitutes are accepted, and where.
  replacement.swappedFrom = cur.ex.exId
  const completed = cur.ex.sets.filter((s) => s.status === 'done')
  const exercises = [...session.exercises]
  const index = session.cursor.ex
  if (completed.length) exercises.splice(index, 1, { ...cur.ex, sets: completed }, replacement)
  else exercises.splice(index, 1, replacement)
  const next = {
    ...session,
    exercises,
    cursor: { ex: index + (completed.length ? 1 : 0), set: 0 },
    phaseEndsAt: null,
    phaseLeft: null,
    phaseTotal: 0,
  }
  return session.phase === 'prepared' ? { ...next, phase: 'prepared' } : enterWork(next, now)
}

/** Weight and reps for an exercise swapped in mid-workout, from the strength model. */
export function swapTarget(state, session, def, { now = Date.now(), location, profile, sets = 3 } = {}) {
  const p = profile || { ...profileOf(state), ...session.equipmentProfile }
  const r = session.readiness || {}
  const lighter = new Set(session.lighterMuscles || [])
  return strengthTarget({
    exId: def.id,
    def,
    workouts: state.workouts,
    customExercises: state.customExercises,
    learning: state.learning,
    metrics: state.metrics,
    unit: session.unit,
    today: toKey(new Date(now)),
    now,
    goal: p.goal,
    experience: p.experience,
    easy: Boolean(session.schedule?.systemic || r.unwell || r.energy === 'low' || r.intensity === 'easy' || trainsAny(def.id, lighter, def)),
    place: location || session.location || null,
    sizes: availableLoads(p, location || session.location),
    sets,
    // Today's sets so far: muscles already worked are a little tired.
    live: session,
  })
}

function swapNote(def, weight, adaptive, unit) {
  if (!def.weighted) return strengthNote(adaptive, unit) || 'Swapped for today.'
  if (weight == null) return 'Swapped for today. Pick a comfortable weight.'
  return strengthNote(adaptive, unit) || 'Swapped for today. Change the weight if it feels off.'
}

// Keep all completed sets and only remove work that has not been logged.
// The estimate is a planning aid, never a deadline or a measured duration.
export function shortenSession(session, minutes, now = Date.now()) {
  if (!Number.isFinite(minutes) || minutes < 1) return session
  let budget = minutes * 60
  let keptPending = 0
  const exercises = session.exercises.map((e) => {
    const item = { exId: e.exId, reps: e.sets[0]?.reps, sec: e.type === 'time' ? e.sets[0]?.sec || 30 : null, restSec: e.restSec, unilateral: e.unilateral }
    // The first pending set of an exercise also pays its setup and transition.
    const setup = itemSeconds({ ...item, sets: 1 }) - extraSetSeconds(item)
    let firstPending = !e.sets.some((s) => s.status === 'done')
    const sets = e.sets.map((s) => {
      if (s.status !== 'todo') return s
      const cost =
        extraSetSeconds({ ...item, reps: s.reps ?? item.reps, sec: e.type === 'time' ? s.sec || 30 : null }) +
        (firstPending ? setup : 0)
      if (budget >= cost) {
        budget -= cost
        keptPending++
        firstPending = false
        return s
      }
      return { ...s, status: 'skipped' }
    })
    return {
      ...e,
      sets,
      ...(sets.some((s, i) => s.status === 'skipped' && e.sets[i].status === 'todo')
        ? { skipReason: 'time' }
        : {}),
    }
  })
  const next = { ...session, exercises, shortenedToMinutes: minutes }
  if (!keptPending) return finish(next, now)
  const ex = exercises.findIndex((e) => e.sets.some((s) => s.status === 'todo'))
  const cursor = { ex, set: exercises[ex].sets.findIndex((s) => s.status === 'todo') }
  if (session.cursor?.ex === cursor.ex && session.cursor?.set === cursor.set)
    return next.phase === 'rest' ? openRest(next) : next
  return session.phase === 'prepared' ? { ...next, cursor } : enterWork({ ...next, cursor }, now)
}
