import { findExercise } from './exercises.js'
import { profileOf, readinessOf } from './planner.js'
import { availableLoads, fitAvailableLoad, DUMBBELL_MOVES } from './preferences.js'
import { currentSet, lastPerformance, makeSessionExercise, enterWork, finish } from './workout.js'
import { movementAllowed, movementPreferences, movementSummary } from './movement-preferences.js'
import { sportScheduleContext } from './sport-schedule.js'
import { todayKey } from './date.js'
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
    if (schedule.lighter) {
      item.sets = Math.min(item.sets || 1, schedule.muscles.includes(def.muscle) ? 1 : 2)
      if (def.type === 'reps') item.reps = Math.min(item.reps || 8, 8)
      const last = lastPerformance(state.workouts, def.id, state.settings.weightUnit)
      if (def.weighted) {
        const historical = last ? Math.max(...last.sets.map((s) => s.weight || 0)) : null
        const baseline = item.weight > 0 ? Math.min(item.weight, historical || Infinity) : historical
        item.weight = baseline > 0 ? Math.floor(baseline * 0.85 * 2) / 2 || null : null
      }
    }
    if (DUMBBELL_MOVES.includes(def.id)) item.weight = fitAvailableLoad(item.weight, availableLoads(p, location))
    used.add(def.id)
    adapted.push(item)
  }
  return { items: adapted, changes, movement, schedule }
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
  const item = {
    sets: pending.length,
    reps: def.type === 'reps' ? (cur.ex.type === 'reps' ? cur.set.reps : 10) : null,
    sec: def.type === 'time' ? (cur.ex.type === 'time' ? cur.set.sec : 30) : null,
    restSec: cur.ex.restSec,
  }
  // A different movement never inherits the old movement's load or progression.
  const previousWeight =
    def.weighted && last
      ? (last.sets.at(-1)?.weight ?? 0) * (session.schedule?.lighter ? 0.85 : 1) || null
      : null
  const p = { ...profileOf(state), ...session.equipmentProfile }
  const location = session.location || p.location
  const weight = DUMBBELL_MOVES.includes(def.id)
    ? fitAvailableLoad(previousWeight, availableLoads(p, location))
    : previousWeight
  const replacement = makeSessionExercise(
    def,
    item,
    { reps: item.reps, sec: item.sec, weight },
    { last, note: 'Swapped for today. Pick a comfortable weight.' },
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
  if (session.cursor?.ex === cursor.ex && session.cursor?.set === cursor.set) return next
  return session.phase === 'prepared' ? { ...next, cursor } : enterWork({ ...next, cursor }, now)
}
