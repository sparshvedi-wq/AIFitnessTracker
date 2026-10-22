// Guided workout logic — pure functions, no React.
//
// A routine is the plan: { id, name, circuit, items: [{ exId, sets, reps | sec, weight?, restSec }] }
// A session is a routine in progress (state.activeWorkout). It's built from a
// routine plus history, so targets already include progression suggestions.
// A workout is a finished session saved to state.workouts.

import { findExercise } from './exercises.js'
import { uid } from './id.js'
import { addDays, fromKey, todayKey, toKey } from './date.js'

export const WEIGHT_STEP = { lb: 5, kg: 2.5 }

// ── Building a session ──────────────────────────────────────────────

// The most recent finished workout that included this exercise.
export function lastPerformance(workouts, exId) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const ex = workouts[i].exercises.find((e) => e.exId === exId && e.sets.length > 0)
    if (ex) return { date: workouts[i].date, sets: ex.sets }
  }
  return null
}

// Progressive overload: look at last time and nudge the target up when
// every set hit its goal.
export function suggestTarget(def, item, last, unit) {
  const target = { reps: item.reps ?? null, sec: item.sec ?? null, weight: item.weight ?? null }
  if (!last) return { target, note: null, up: false }

  const done = last.sets
  if (def.type === 'time') {
    const goal = item.sec || 0
    const hit = done.every((s) => (s.sec || 0) >= (s.targetSec ?? goal))
    if (hit && goal > 0) return { target: { ...target, sec: goal + 5 }, note: '5 seconds longer than last time', up: true }
    return { target, note: null, up: false }
  }

  const hitAll = done.every((s) => (s.reps || 0) >= (s.targetReps ?? item.reps ?? 0))
  if (def.weighted) {
    const lastWeight = Math.max(0, ...done.map((s) => s.weight || 0))
    if (lastWeight <= 0) return { target, note: null, up: false }
    if (hitAll) {
      const step = WEIGHT_STEP[unit] || 5
      return { target: { ...target, weight: lastWeight + step }, note: `Up ${step} ${unit}: you hit every rep last time`, up: true }
    }
    return { target: { ...target, weight: lastWeight }, note: `Same weight: aim for all ${item.reps} reps this time`, up: false }
  }

  const bestReps = Math.max(0, ...done.map((s) => s.reps || 0))
  if (hitAll && bestReps >= (item.reps || 0)) {
    return { target: { ...target, reps: bestReps + 1 }, note: 'One more rep than last time', up: true }
  }
  return { target, note: null, up: false }
}

export function buildSession(routine, { workouts = [], customExercises = [], unit = 'lb', now = Date.now() } = {}) {
  const exercises = routine.items
    .map((item) => {
      const def = findExercise(item.exId, customExercises)
      if (!def) return null
      const last = lastPerformance(workouts, item.exId)
      const { target, note, up } = suggestTarget(def, item, last, unit)
      return makeSessionExercise(def, item, target, { last, note, up })
    })
    .filter(Boolean)

  const session = {
    id: uid(),
    routineId: routine.id,
    name: routine.name,
    circuit: Boolean(routine.circuit),
    unit,
    startedAt: now,
    pausedMs: 0,
    pausedAt: null,
    exercises,
    cursor: exercises.length ? { ex: 0, set: 0 } : null,
    phase: 'ready',
    phaseEndsAt: null,
    phaseLeft: null,
    phaseTotal: 0,
  }
  return session
}

export function makeSessionExercise(def, item, target, { last = null, note = null, up = false } = {}) {
  const sets = Array.from({ length: Math.max(1, item.sets || 1) }, () => ({
    targetReps: target.reps,
    targetSec: target.sec,
    targetWeight: target.weight,
    reps: target.reps,
    sec: target.sec,
    weight: target.weight,
    status: 'todo',
  }))
  return {
    key: uid(),
    exId: def.id,
    name: def.name,
    muscle: def.muscle,
    type: def.type,
    weighted: def.weighted,
    cues: def.cues || [],
    restSec: item.restSec ?? 60,
    sets,
    last: last ? { date: last.date, sets: last.sets } : null,
    note,
    up,
  }
}

// ── Moving through a session ────────────────────────────────────────

// Every set in the order it should be done. Normal routines go exercise by
// exercise; circuits go round by round.
export function stepOrder(session) {
  const out = []
  const { exercises } = session
  if (session.circuit) {
    const rounds = Math.max(0, ...exercises.map((e) => e.sets.length))
    for (let s = 0; s < rounds; s++) {
      exercises.forEach((e, i) => { if (s < e.sets.length) out.push({ ex: i, set: s }) })
    }
  } else {
    exercises.forEach((e, i) => e.sets.forEach((_, s) => out.push({ ex: i, set: s })))
  }
  return out
}

// Next unfinished set after `from`, wrapping around to anything skipped past.
export function nextStep(session, from = session.cursor) {
  const order = stepOrder(session)
  const isTodo = (c) => session.exercises[c.ex]?.sets[c.set]?.status === 'todo'
  const at = from ? order.findIndex((c) => c.ex === from.ex && c.set === from.set) : -1
  for (let i = at + 1; i < order.length; i++) if (isTodo(order[i])) return order[i]
  for (let i = 0; i <= at && i < order.length; i++) if (isTodo(order[i])) return order[i]
  return null
}

export function setCounts(session) {
  let done = 0
  let total = 0
  for (const e of session.exercises) {
    for (const s of e.sets) {
      if (s.status !== 'skipped') total++
      if (s.status === 'done') done++
    }
  }
  return { done, total }
}

// Which round of a circuit the cursor is in (1-based), and how many there are.
export function roundInfo(session) {
  if (!session.circuit || !session.cursor) return null
  const rounds = Math.max(0, ...session.exercises.map((e) => e.sets.length))
  return { round: session.cursor.set + 1, rounds }
}

export function elapsedMs(session, now = Date.now()) {
  const pausedNow = session.pausedAt ? now - session.pausedAt : 0
  return Math.max(0, now - session.startedAt - session.pausedMs - pausedNow)
}

// Phase changes. Each returns a new session; the store just saves it.
// Timers are stored as an absolute end time so they stay right even if the
// tab sleeps or the app is minimized.

// Done: freeze the clock (as a pause) until it's saved or you keep going.
export function finish(session, now = Date.now()) {
  return { ...session, phase: 'done', phaseEndsAt: null, phaseLeft: null, pausedAt: session.pausedAt ?? now }
}

export function keepGoing(session, now = Date.now()) {
  const to = nextStep(session, null)
  if (!to) return session
  return enterWork({ ...resume(session, now), cursor: to }, now, false)
}

function timed(session, phase, sec, now) {
  return { ...session, phase, phaseEndsAt: now + sec * 1000, phaseTotal: sec * 1000, phaseLeft: null }
}

export function currentSet(session) {
  const c = session.cursor
  if (!c) return null
  const ex = session.exercises[c.ex]
  return ex ? { ex, set: ex.sets[c.set] } : null
}

export function startReady(session, sec, now = Date.now()) {
  if (!sec) return enterWork(session, now, true)
  return timed({ ...session, phase: 'ready' }, 'ready', sec, now)
}

// Start the current set. Timed sets start their countdown right away when
// `autoStart` (coming out of a rest or the get-ready countdown).
export function enterWork(session, now = Date.now(), autoStart = true) {
  const cur = currentSet(session)
  if (!cur) return finish(session, now)
  if (cur.ex.type === 'time' && autoStart) return timed(session, 'work', cur.set.sec || cur.set.targetSec || 30, now)
  return { ...session, phase: 'work', phaseEndsAt: null, phaseLeft: null, phaseTotal: 0 }
}

export function startSetTimer(session, now = Date.now()) {
  const cur = currentSet(session)
  if (!cur) return session
  return timed(session, 'work', cur.set.sec || cur.set.targetSec || 30, now)
}

function patchSet(session, c, patch) {
  const exercises = session.exercises.map((e, i) =>
    i !== c.ex ? e : { ...e, sets: e.sets.map((s, j) => (j === c.set ? { ...s, ...patch } : s)) },
  )
  return { ...session, exercises }
}

export function updateSet(session, patch) {
  return session.cursor ? patchSet(session, session.cursor, patch) : session
}

// Log the current set and move on: rest if there's more to do, else finish.
export function completeSet(session, now = Date.now(), patch = {}) {
  const c = session.cursor
  if (!c) return session
  const ex = session.exercises[c.ex]
  let next = patchSet(session, c, { ...patch, status: 'done' })
  // Carry a changed weight into the sets still to come, unless you've
  // already set those yourself.
  const weight = next.exercises[c.ex].sets[c.set].weight
  if (ex.weighted && weight != null) {
    next.exercises[c.ex] = {
      ...next.exercises[c.ex],
      sets: next.exercises[c.ex].sets.map((s, j) =>
        j > c.set && s.status === 'todo' && s.weight === s.targetWeight ? { ...s, weight } : s,
      ),
    }
  }
  const to = nextStep(next, c)
  if (!to) return finish(next, now)
  next = { ...next, cursor: to }
  const rest = ex.restSec || 0
  if (rest > 0) return timed(next, 'rest', rest, now)
  return enterWork(next, now, true)
}

export function skipRest(session, now = Date.now()) {
  return enterWork(session, now, true)
}

export function adjustTimer(session, deltaSec, now = Date.now()) {
  if (session.pausedAt) {
    const left = Math.max(1000, (session.phaseLeft || 0) + deltaSec * 1000)
    return { ...session, phaseLeft: left, phaseTotal: Math.max(session.phaseTotal, left) }
  }
  if (!session.phaseEndsAt) return session
  const ends = Math.max(now + 1000, session.phaseEndsAt + deltaSec * 1000)
  return { ...session, phaseEndsAt: ends, phaseTotal: Math.max(session.phaseTotal, ends - now) }
}

export function pause(session, now = Date.now()) {
  if (session.pausedAt) return session
  const phaseLeft = session.phaseEndsAt ? Math.max(0, session.phaseEndsAt - now) : null
  return { ...session, pausedAt: now, phaseLeft, phaseEndsAt: null }
}

export function resume(session, now = Date.now()) {
  if (!session.pausedAt) return session
  const phaseEndsAt = session.phaseLeft != null ? now + session.phaseLeft : null
  return { ...session, pausedAt: null, pausedMs: session.pausedMs + (now - session.pausedAt), phaseEndsAt, phaseLeft: null }
}

// Skip what's left of the current exercise.
export function skipExercise(session, now = Date.now()) {
  const c = session.cursor
  if (!c) return session
  const exercises = session.exercises.map((e, i) =>
    i !== c.ex ? e : { ...e, sets: e.sets.map((s) => (s.status === 'todo' ? { ...s, status: 'skipped' } : s)) },
  )
  const next = { ...session, exercises }
  const to = nextStep(next, c)
  if (!to) return finish(next, now)
  return enterWork({ ...next, cursor: to }, now, false)
}

// Bring a skipped exercise back into the plan.
export function unskipExercise(session, exIndex) {
  const exercises = session.exercises.map((e, i) =>
    i !== exIndex ? e : { ...e, sets: e.sets.map((s) => (s.status === 'skipped' ? { ...s, status: 'todo' } : s)) },
  )
  return { ...session, exercises }
}

// Add one more set to an exercise, copying its last set's numbers.
export function addSet(session, exIndex = session.cursor?.ex) {
  if (exIndex == null) return session
  const exercises = session.exercises.map((e, i) => {
    if (i !== exIndex) return e
    const last = e.sets[e.sets.length - 1]
    return { ...e, sets: [...e.sets, { ...last, status: 'todo' }] }
  })
  return { ...session, exercises }
}

export function removeExercise(session, exIndex) {
  const exercises = session.exercises.filter((_, i) => i !== exIndex)
  let cursor = session.cursor
  if (cursor && cursor.ex === exIndex) cursor = null
  else if (cursor && cursor.ex > exIndex) cursor = { ...cursor, ex: cursor.ex - 1 }
  let next = { ...session, exercises, cursor }
  if (!cursor) {
    const to = nextStep(next, null)
    next = to ? enterWork({ ...next, cursor: to }, Date.now(), false) : finish(next)
  }
  return next
}

export function appendExercise(session, exercise) {
  const exercises = [...session.exercises, exercise]
  const next = { ...session, exercises }
  // A finished workout with a new exercise added picks back up there.
  if (session.phase === 'done' || !session.cursor) {
    return enterWork({ ...resume(next), cursor: { ex: exercises.length - 1, set: 0 } }, Date.now(), false)
  }
  return next
}

// Jump straight to any set (from the overview list).
export function jumpTo(session, c, now = Date.now()) {
  const target = session.exercises[c.ex]?.sets[c.set]
  if (!target) return session
  let next = session.phase === 'done' ? resume(session, now) : session
  if (target.status !== 'todo') next = patchSet(next, c, { status: 'todo' })
  return enterWork({ ...next, cursor: c }, now, false)
}

// Advance when a timer runs out. Returns the same object when nothing changed.
export function tick(session, now = Date.now()) {
  if (session.pausedAt || !session.phaseEndsAt || now < session.phaseEndsAt) return session
  if (session.phase === 'ready' || session.phase === 'rest') return enterWork(session, now, true)
  if (session.phase === 'work') {
    const cur = currentSet(session)
    return completeSet(session, now, { sec: cur?.set.sec || cur?.set.targetSec })
  }
  return session
}

// ── Finishing ───────────────────────────────────────────────────────

export function totals(exercises) {
  let sets = 0
  let reps = 0
  let volume = 0
  let seconds = 0
  for (const e of exercises) {
    for (const s of e.sets) {
      if (s.status && s.status !== 'done') continue
      sets++
      if (e.type === 'time') seconds += s.sec || 0
      else {
        reps += s.reps || 0
        if (e.weighted) volume += (s.reps || 0) * (s.weight || 0)
      }
    }
  }
  return { sets, reps, volume: Math.round(volume), seconds }
}

// Epley estimate of a one-rep max.
export const oneRepMax = (weight, reps) => (reps > 0 && weight > 0 ? weight * (1 + reps / 30) : 0)

export function bestLifts(workouts, exId) {
  let weight = 0
  let e1rm = 0
  let reps = 0
  let sec = 0
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.exId !== exId) continue
      for (const s of e.sets) {
        weight = Math.max(weight, s.weight || 0)
        e1rm = Math.max(e1rm, oneRepMax(s.weight || 0, s.reps || 0))
        reps = Math.max(reps, s.reps || 0)
        sec = Math.max(sec, s.sec || 0)
      }
    }
  }
  return { weight, e1rm, reps, sec }
}

// New personal records in this session compared with all earlier workouts.
// Only counts exercises you've done before, so a first try isn't a "record".
export function findRecords(session, workouts) {
  const out = []
  for (const e of session.exercises) {
    const done = e.sets.filter((s) => s.status === 'done')
    if (!done.length) continue
    const prior = workouts.some((w) => w.exercises.some((x) => x.exId === e.exId && x.sets.length))
    if (!prior) continue
    const best = bestLifts(workouts, e.exId)
    const unit = session.unit
    if (e.type === 'time') {
      const sec = Math.max(...done.map((s) => s.sec || 0))
      if (sec > best.sec) out.push({ exId: e.exId, name: e.name, label: `${sec}s hold` })
    } else if (e.weighted) {
      const weight = Math.max(...done.map((s) => s.weight || 0))
      const e1rm = Math.max(...done.map((s) => oneRepMax(s.weight || 0, s.reps || 0)))
      if (weight > best.weight) out.push({ exId: e.exId, name: e.name, label: `Heaviest: ${fmtNum(weight)} ${unit}` })
      else if (e1rm > best.e1rm + 0.01) out.push({ exId: e.exId, name: e.name, label: `Best set: est. 1RM ${fmtNum(Math.round(e1rm))} ${unit}` })
    } else {
      const reps = Math.max(...done.map((s) => s.reps || 0))
      if (reps > best.reps) out.push({ exId: e.exId, name: e.name, label: `Most reps: ${reps}` })
    }
  }
  return out
}

// Turn a session into the record kept in history. Only finished sets are kept.
export function toWorkoutRecord(session, workouts, { now = Date.now(), effort = null, note = '' } = {}) {
  const exercises = session.exercises
    .map((e) => ({
      exId: e.exId,
      name: e.name,
      muscle: e.muscle,
      type: e.type,
      weighted: e.weighted,
      sets: e.sets
        .filter((s) => s.status === 'done')
        .map((s) => ({
          reps: e.type === 'time' ? null : s.reps || 0,
          sec: e.type === 'time' ? s.sec || 0 : null,
          weight: e.weighted ? s.weight || 0 : null,
          targetReps: s.targetReps,
          targetSec: s.targetSec,
        })),
    }))
    .filter((e) => e.sets.length > 0)

  return {
    id: session.id,
    routineId: session.routineId,
    name: session.name,
    unit: session.unit,
    date: toKey(new Date(session.startedAt)),
    startedAt: session.startedAt,
    endedAt: now,
    durationSec: Math.round(elapsedMs(session, now) / 1000),
    exercises,
    totals: totals(exercises),
    records: findRecords(session, workouts),
    effort,
    note: note.trim(),
  }
}

// ── Planning & stats ────────────────────────────────────────────────

// Rough length of a routine in minutes: ~3s per rep plus timed work and rests.
export function estimateMinutes(routine) {
  let sec = 0
  for (const item of routine.items) {
    const work = item.sec ? item.sec : (item.reps || 10) * 3 + 10
    sec += item.sets * work + Math.max(0, item.sets - (routine.circuit ? 0 : 1)) * (item.restSec || 0)
  }
  return Math.max(1, Math.round(sec / 60))
}

export function lastDoneDate(workouts, routineId) {
  for (let i = workouts.length - 1; i >= 0; i--) if (workouts[i].routineId === routineId) return workouts[i].date
  return null
}

// Suggest the routine you've gone longest without doing.
export function pickNextRoutine(routines, workouts) {
  if (!routines.length) return null
  let best = null
  let bestDate = null
  for (const r of routines) {
    const d = lastDoneDate(workouts, r.id)
    if (!d) return r
    if (!bestDate || d < bestDate) { best = r; bestDate = d }
  }
  return best
}

// Monday-start week containing `key`.
export function weekStart(key) {
  const d = fromKey(key)
  const offset = (d.getDay() + 6) % 7
  return addDays(key, -offset)
}

export function weekSummary(workouts, today = todayKey()) {
  const start = weekStart(today)
  const list = workouts.filter((w) => w.date >= start && w.date <= today)
  const days = new Set(list.map((w) => w.date))
  return {
    start,
    count: list.length,
    minutes: Math.round(list.reduce((s, w) => s + w.durationSec, 0) / 60),
    volume: list.reduce((s, w) => s + (w.totals?.volume || 0), 0),
    days,
  }
}

// Consecutive weeks (ending this week or last) that met the weekly goal.
export function weekStreak(workouts, goal, today = todayKey()) {
  if (!goal) return 0
  const perWeek = new Map()
  for (const w of workouts) {
    const k = weekStart(w.date)
    perWeek.set(k, (perWeek.get(k) || 0) + 1)
  }
  let week = weekStart(today)
  // This week still counts as "in progress" — don't break the streak yet.
  if ((perWeek.get(week) || 0) < goal) week = addDays(week, -7)
  let streak = 0
  while ((perWeek.get(week) || 0) >= goal) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}

// ── Formatting ──────────────────────────────────────────────────────

export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

// "3 × 10 @ 60 lb", "3 × 40s"
export function describeSets(e, unit) {
  const sets = e.sets
  if (!sets.length) return ''
  const same = sets.every((s) => s.reps === sets[0].reps && s.sec === sets[0].sec && s.weight === sets[0].weight)
  const one = (s) => {
    if (e.type === 'time') return `${s.sec}s`
    const w = e.weighted && s.weight ? ` @ ${fmtNum(s.weight)} ${unit}` : ''
    return `${s.reps}${w}`
  }
  if (same) return `${sets.length} × ${one(sets[0])}`
  return sets.map(one).join(', ')
}

export function describeItem(item, def, unit) {
  const work = def?.type === 'time' ? `${item.sec}s` : `${item.reps} reps`
  const w = item.weight ? ` @ ${fmtNum(item.weight)} ${unit}` : ''
  return `${item.sets} × ${work}${w}`
}
