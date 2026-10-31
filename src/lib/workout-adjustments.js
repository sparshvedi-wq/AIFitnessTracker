import { findExercise } from './exercises.js'
import { MOVEMENTS, availableMovement, profileOf, readinessOf } from './planner.js'
import { availableLoads, fitAvailableLoad, DUMBBELL_MOVES } from './preferences.js'
import { currentSet, lastPerformance, makeSessionExercise, enterWork, finish } from './workout.js'
import { movementAllowed, movementPreferences, movementSummary } from './movement-preferences.js'
import { sportScheduleContext } from './sport-schedule.js'
import { todayKey } from './date.js'
import { quietAt, resolvePlace } from './places.js'

export function replacementOptions(state, session) {
  const current = currentSet(session)?.ex
  if (!current || ['sport', 'pump'].includes(session.kind)) return []
  const p = { ...profileOf(state), ...session.equipmentProfile }
  const location = session.location || p.location
  const readiness = session.readiness || readinessOf(state)
  const movement = session.movement || movementPreferences(p, location)
  const place = resolvePlace(p, location)
  const meta = MOVEMENTS.find((m) => m.id === current.exId)
  const related = {
    squat: ['squat', 'single leg'],
    'single leg': ['single leg', 'squat'],
    hinge: ['hinge'],
    pull: ['pull', 'upper-back control'],
    'upper-back control': ['pull', 'upper-back control'],
    'shoulder accessory': ['shoulder accessory', 'overhead'],
  }
  const patterns = meta ? related[meta.pattern] || [meta.pattern] : null
  return MOVEMENTS.filter(
    (m) =>
      m.id !== current.exId &&
      (!patterns || patterns.includes(m.pattern)) &&
      (m.muscle === current.muscle || (meta?.pattern === 'hinge' && m.pattern === 'hinge')),
  )
    .filter(
      (m) =>
        p.experience !== 'Starting out' ||
        !['back-squat', 'rdl', 'db-rdl', 'pull-up', 'ohp', 'db-overhead-press'].includes(m.id),
    )
    .filter((m) => availableMovement(m, place.base, place.equipment))
    .filter((m) => !(p.excludedExercises || []).includes(m.id))
    .filter(
      (m) =>
        movementAllowed(m.id, movement) && (!m.id.startsWith('seated-') || movement?.position === 'seated'),
    )
    .filter(
      (m) =>
        !m.uses.some(
          (part) =>
            p.avoidMuscles?.includes(part) ||
            readiness.pain?.includes(part) ||
            readiness.sore?.includes(part),
        ),
    )
    .sort((a, b) => Number(b.pattern === meta?.pattern) - Number(a.pattern === meta?.pattern))
    .map((m) => findExercise(m.id))
    .filter(Boolean)
    .slice(0, 3)
}

export function adaptRoutineItems(state, items, location, readiness, options = {}) {
  const p = profileOf(state)
  const movement = movementPreferences(p, location, options.movement)
  const schedule = sportScheduleContext(p, {
    today: options.today || todayKey(),
    now: options.now ?? Date.now(),
    minutes: options.minutes || p.minutes,
  })
  const place = resolvePlace(p, location)
  const equipment = place.equipment
  const quiet = quietAt(p, location)
  const excluded = new Set(p.excludedExercises || [])
  const used = new Set()
  const adapted = []
  const changes = []
  if (movement) changes.push(movementSummary(movement))
  if (schedule.note) changes.push(schedule.note)
  const quietAlternatives = {
    'jumping-jack': 'quiet-step',
    'squat-jump': 'quiet-squat',
    burpee: 'quiet-march',
    'high-knees': 'quiet-march',
    skater: 'quiet-step',
    'mountain-climber': 'quiet-march',
  }
  for (const source of items) {
    let def = findExercise(source.exId, state.customExercises)
    if (!def) continue
    let item = { ...source }
    const meta = MOVEMENTS.find((m) => m.id === def.id)
    const avoids = [...(p.avoidMuscles || []), ...(readiness.pain || []), ...(readiness.sore || [])]
    const unavailable =
      excluded.has(def.id) ||
      !movementAllowed(def.id, movement) ||
      (meta
        ? !availableMovement(meta, place.base, equipment)
        : place.base !== 'gym' && (def.weighted || ['pull-up', 'dip'].includes(def.id)))
    if ((meta ? meta.uses : [def.muscle]).some((part) => avoids.includes(part))) {
      changes.push(def.name + ' omitted for today’s readiness.')
      continue
    }
    if (quiet && quietAlternatives[def.id] && movementAllowed(quietAlternatives[def.id], movement)) {
      const old = def.name
      def = findExercise(quietAlternatives[def.id])
      if (avoids.includes('Legs')) {
        changes.push(old + ' omitted for today’s readiness.')
        continue
      }
      item = { ...item, exId: def.id, sec: source.sec || 40, reps: undefined, weight: undefined }
      changes.push(old + ' replaced with ' + def.name + '.')
    } else if (unavailable) {
      const alternative = MOVEMENTS.find(
        (m) =>
          m.muscle === def.muscle &&
          !used.has(m.id) &&
          availableMovement(m, place.base, equipment) &&
          !excluded.has(m.id) &&
          movementAllowed(m.id, movement) &&
          (!m.id.startsWith('seated-') || movement?.position === 'seated') &&
          !m.uses.some((v) => avoids.includes(v)),
      )
      const excludedSource = excluded.has(def.id)
      if (!alternative) {
        changes.push(
          excludedSource
            ? `${def.name} left out because you asked not to have it suggested.`
            : def.name + ' omitted: no suitable equipment alternative.',
        )
        continue
      }
      const old = def.name
      def = findExercise(alternative.id)
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
    item.unilateral = ['db-row', 'split-squat', 'biceps-curl', 'seated-knee-extension'].includes(def.id)
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
    if (DUMBBELL_MOVES.includes(def.id))
      item.weight = fitAvailableLoad(item.weight, availableLoads(p, location))
    used.add(def.id)
    adapted.push(item)
  }
  return { items: adapted, changes, movement, schedule }
}

export function replaceCurrentExercise(session, def, state, now = Date.now()) {
  const cur = currentSet(session)
  if (!cur || !replacementOptions(state, session).some((d) => d.id === def.id)) return session
  const pending = cur.ex.sets.filter((s) => s.status === 'todo')
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
  replacement.unilateral = ['db-row', 'split-squat', 'biceps-curl', 'seated-knee-extension'].includes(def.id)
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
    const cost = (set) =>
      (e.type === 'time' ? set.sec || 30 : (set.reps || 10) * (e.unilateral ? 6 : 3) + 10) +
      (e.restSec || 0) +
      20
    const sets = e.sets.map((s) => {
      if (s.status !== 'todo') return s
      if (budget >= cost(s)) {
        budget -= cost(s)
        keptPending++
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
