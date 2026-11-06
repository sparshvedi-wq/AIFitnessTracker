// Adjusting the workout in progress without losing anything.
//
// Three different things, kept apart:
//   adjust the current workout   previewReplan + applyReplan (this module)
//   end it and request another   workout-switch.js (saves completed work)
//   generate the next session    recommend.js (reads saved history)
//
// A replan keeps every completed set, load and edit exactly as logged, and
// changes only unfinished work. Completed work in this session and earlier
// today counts toward overlap when choosing substitutes. A preview records a
// fingerprint of the logged work it was built from; applying it to a session
// that has changed since is refused (the caller recomputes), and applying the
// same preview twice is a no-op.
import { metaOf } from '../catalog/index.js'
import { findExercise } from '../exercises.js'
import { hashString } from './rng.js'
import { eligibilityContext, planningContext } from './recommend.js'
import { ineligibility } from './eligibility.js'
import { rankSubstitutes } from './substitute.js'
import { extraSetSeconds, itemSeconds } from './session-time.js'
import { enterWork, finish, makeSessionExercise } from '../workout.js'

/** Fingerprint of everything logged or planned in a session; ignores timers and the cursor. */
export function sessionFingerprint(session) {
  if (!session) return 'none'
  return `${session.id}:${hashString(JSON.stringify([
    session.exercises, session.location, session.placeName, session.unit,
    session.movement, session.equipmentProfile, session.readiness,
    session.shortenedToMinutes,
  ]))}`
}

const pendingWork = (e) => e.sets.filter((s) => s.status === 'todo')

/**
 * @param change { minutes?: number, location?: string, avoid?: string[] }
 * @returns {{ ok: boolean, reason?: string, base, result, session, diff, minutes }}
 */
export function previewReplan(state, session, change, { now = Date.now(), today, profile, readiness } = {}) {
  if (!session || ['sport'].includes(session.kind)) return { ok: false, reason: 'not-adjustable' }
  const base = sessionFingerprint(session)
  const location = change.location || session.location
  const ctx = planningContext(state, {
    today,
    now,
    profile: { ...session.equipmentProfile, ...profile },
    readiness: { ...session.readiness, ...readiness },
    location,
    movement: change.location ? undefined : session.movement || undefined,
    liveSession: session,
  })
  const elig = eligibilityContext(ctx, null)
  const avoid = new Set(change.avoid || [])
  const inSession = new Set(session.exercises.map((e) => e.exId))
  const diff = { kept: [], replaced: [], removed: [], shortened: [] }

  // 1. Unfinished exercises that no longer fit the place or preferences get a substitute or are removed.
  let exercises = session.exercises.map((e) => {
    const pending = pendingWork(e)
    if (!pending.length) return e
    const meta = metaOf(e.exId)
    const code = meta ? ineligibility(meta, { ...elig, kind: null }) : null
    const unusable = avoid.has(e.exId) || (code && code !== 'experience')
    if (!unusable) return e
    const [best] = rankSubstitutes(e.exId, elig, {
      signals: ctx.signals,
      exclude: new Set([...inSession, ...avoid]),
      limit: 1,
      currentDef: findExercise(e.exId, state.customExercises) || e,
    })
    const done = e.sets.filter((s) => s.status !== 'todo')
    if (!best) {
      diff.removed.push({ exId: e.exId, name: e.name, sets: pending.length })
      // Removed by the app because nothing fits here: not the person's own skip.
      return {
        ...e,
        skipReason: avoid.has(e.exId) ? 'dislike' : 'equipment',
        removedBy: avoid.has(e.exId) ? undefined : 'replan',
        sets: e.sets.map((s) => (s.status === 'todo' ? { ...s, status: 'skipped' } : s)),
      }
    }
    inSession.add(best.meta.id)
    const work = pending.filter((s) => s.kind !== 'warmup')
    const replacement = makeSessionExercise(
      best.def,
      {
        sets: Math.max(1, work.length),
        reps: best.def.type === 'reps' ? (e.type === 'reps' ? work[0]?.reps ?? 10 : 10) : null,
        sec: best.def.type === 'time' ? (e.type === 'time' ? work[0]?.sec ?? 30 : 30) : null,
        restSec: e.restSec,
      },
      { reps: best.def.type === 'reps' ? work[0]?.reps ?? 10 : null, sec: best.def.type === 'time' ? 30 : null, weight: null },
      { note: 'Changed for this place. Pick a comfortable weight.' },
    )
    replacement.unilateral = Boolean(best.meta.perSide && best.def.type === 'reps')
    replacement.swappedFrom = e.exId
    // Deterministic key so the same preview always produces the same session.
    replacement.key = `${e.key || e.exId}-r-${best.meta.id}`
    diff.replaced.push({ from: e.exId, fromName: e.name, to: best.meta.id, toName: best.def.name })
    return done.length ? [{ ...e, sets: done }, replacement] : replacement
  })
  exercises = exercises.flat()

  // 2. Fit the remaining work into the time left, keeping completed work untouched.
  let minutes = null
  if (Number.isFinite(change.minutes) && change.minutes > 0) {
    minutes = change.minutes
    let budget = change.minutes * 60
    exercises = exercises.map((e) => {
      const item = { exId: e.exId, reps: e.sets[0]?.reps, sec: e.type === 'time' ? e.sets[0]?.sec || 30 : null, restSec: e.restSec, unilateral: e.unilateral }
      const setup = itemSeconds({ ...item, sets: 1 }) - extraSetSeconds(item)
      let first = !e.sets.some((s) => s.status === 'done')
      let cut = 0
      const sets = e.sets.map((s) => {
        if (s.status !== 'todo') return s
        const cost = extraSetSeconds({ ...item, reps: s.reps ?? item.reps, sec: e.type === 'time' ? s.sec || 30 : null }) + (first ? setup : 0)
        if (budget >= cost) {
          budget -= cost
          first = false
          return s
        }
        cut++
        return { ...s, status: 'skipped' }
      })
      if (!cut) return e
      diff.shortened.push({ exId: e.exId, name: e.name, removedSets: cut })
      return { ...e, sets, skipReason: e.skipReason || 'time' }
    })
  }
  for (const e of exercises) if (pendingWork(e).length) diff.kept.push({ exId: e.exId, name: e.name, sets: pendingWork(e).length })

  const place = ctx.place
  let next = {
    ...session,
    exercises,
    location: place.id,
    placeName: place.name,
    movement: change.location ? ctx.movement : session.movement,
    ...(minutes ? { shortenedToMinutes: minutes } : {}),
  }
  const firstTodo = exercises.findIndex((e) => pendingWork(e).length)
  if (firstTodo < 0) next = finish(next, now)
  else {
    const cur = session.cursor && exercises[session.cursor.ex]?.exId === session.exercises[session.cursor.ex]?.exId
      ? session.cursor
      : null
    const valid = cur && exercises[cur.ex]?.sets[cur.set]?.status === 'todo'
    const cursor = valid ? cur : { ex: firstTodo, set: exercises[firstTodo].sets.findIndex((s) => s.status === 'todo') }
    next = { ...next, cursor }
  }
  return {
    ok: true,
    base,
    result: sessionFingerprint(next),
    session: next,
    diff,
    minutes,
    location: place.id,
    placeName: place.name,
    changed: Boolean(diff.replaced.length || diff.removed.length || diff.shortened.length || place.id !== session.location),
  }
}

/**
 * Applies a preview to the live session.
 * @returns {{ status: 'applied' | 'already-applied' | 'stale', session }}
 */
export function applyReplan(current, preview, now = Date.now()) {
  const print = sessionFingerprint(current)
  if (print === preview.result) return { status: 'already-applied', session: current }
  if (print !== preview.base) return { status: 'stale', session: current }
  const next = { ...preview.session, startedAt: current.startedAt, lastActivityAt: current.lastActivityAt,
    pausedAt: current.pausedAt, pausedMs: current.pausedMs }
  if (next.phase === 'done') return { status: 'applied', session: finish(next, now) }
  if (current.phase === 'prepared') return { status: 'applied', session: { ...next, phase: 'prepared' } }
  // Timers continue from the current session; a changed set waits for the person.
  const currentExercise = current.exercises[current.cursor?.ex]
  const nextExercise = next.exercises[next.cursor?.ex]
  const sameCursor = current.cursor?.ex === next.cursor?.ex && current.cursor?.set === next.cursor?.set &&
    currentExercise?.exId === nextExercise?.exId && currentExercise?.key === nextExercise?.key
  return {
    status: 'applied',
    session: sameCursor
      ? { ...next, phase: current.phase, phaseEndsAt: current.phaseEndsAt, phaseLeft: current.phaseLeft, phaseTotal: current.phaseTotal }
      : enterWork({ ...next, phase: 'work' }, now),
  }
}
