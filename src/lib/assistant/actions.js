// Results and previews for "Ask or adjust…", computed from the app's own data.
//
// Read-only requests return a small result object. Changes return a preview
// with a diff; applying one is checked against the state it was made from,
// so a stale preview can never overwrite newer logs, and Undo restores only
// what the change touched.
import { addDays } from '../date.js'
import { findExercise } from '../exercises.js'
import { metaOf } from '../catalog/index.js'
import { buildDailyPlan, readinessOf, todayChoice } from '../planner.js'
import { exerciseTrend } from '../history-insights.js'
import { eventHistory } from '../training-events.js'
import { fmtNum } from '../workout.js'
import { applyReplan, previewReplan, sessionFingerprint } from '../engine/replan.js'
import { hashString } from '../engine/rng.js'

const WARMUP = (w) => w.kind === 'sport'
const MOVEMENT = (w) => w.kind === 'recovery'
const workingSets = (w) =>
  (w.exercises || []).reduce((n, e) => n + (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done')).length, 0)

/** History in a local-date range; future, sample and synthetic records never count. */
export function historyResult(state, { from, to, label, filter = 'all' }, today) {
  const end = to > today ? today : to
  const workouts = (state.workouts || []).filter((w) => !w.sample && w.date >= from && w.date <= end)
  const training = workouts.filter((w) => !WARMUP(w) && !MOVEMENT(w) && workingSets(w) > 0)
  const warmups = workouts.filter(WARMUP)
  const events = eventHistory(state.settings.training, today).filter((e) => e.date >= from && e.date <= end)
  const rows =
    filter === 'warmup'
      ? warmups
      : filter === 'activity'
        ? []
        : filter === 'training'
          ? training
          : [...training, ...warmups, ...workouts.filter(MOVEMENT)]
  return {
    kind: 'history',
    label,
    from,
    to: end,
    filter,
    trainingSessions: training.length,
    trainingDays: new Set(training.map((w) => w.date)).size,
    workingSets: training.reduce((n, w) => n + workingSets(w), 0),
    warmups: warmups.length,
    activities: events.length,
    recent: rows
      .sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, 5)
      .map((w) => ({ id: w.id, date: w.date, name: w.name })),
    activityRows: filter === 'activity' || filter === 'all' ? events.slice(0, 5).map((e) => ({ id: e.id, date: e.date, name: e.title })) : [],
  }
}

/** Comparable best sets for one exercise, oldest to newest. */
export function progressResult(state, exId, today) {
  const unit = state.settings.weightUnit
  const def = findExercise(exId, state.customExercises)
  const trend = exerciseTrend(state.workouts || [], exId, unit, today)
  const assisted = metaOf(exId)?.load === 'assist'
  const describe = (p) =>
    p.type === 'time'
      ? `${p.value}s`
      : p.weighted
        ? `${fmtNum(p.value)} ${unit}${assisted ? ' assistance' : ''} × ${p.reps}`
        : `${p.value} reps`
  if (trend.length < 2)
    return { kind: 'progress', exId, name: def?.name || exId, sessions: trend.length, enough: false }
  const first = trend[0]
  const last = trend.at(-1)
  // Only like-for-like numbers are compared; less assistance counts as better.
  const better = assisted ? last.value < first.value : last.value > first.value
  const same = last.value === first.value
  return {
    kind: 'progress',
    exId,
    name: def?.name || exId,
    sessions: trend.length,
    enough: true,
    from: { date: first.date, text: describe(first) },
    to: { date: last.date, text: describe(last) },
    direction: same ? 'same' : better ? 'up' : 'down',
  }
}

export function explainResult(plan) {
  return { kind: 'explain', headline: plan.explanation?.text || plan.focus, reasons: plan.reasons.slice(0, 4) }
}

const planKey = (plan) => plan.items.map((i) => `${i.exId}:${i.sets}`).join('|')
const contextKey = (state) => hashString(JSON.stringify([
  state.workouts, state.learning, state.settings, state.customExercises,
  state.checkins, state.activeWorkout ? sessionFingerprint(state.activeWorkout) : null,
]))
const previewKey = (state, plan, today) => hashString(JSON.stringify([today, contextKey(state), state.readiness || null, plan.items]))

/**
 * A preview of today's plan with temporary changes, or of the workout in
 * progress when there is one. Nothing is saved until applied.
 */
export function previewChanges(state, intents, { today, now }) {
  const minutes = intents.find((i) => i.type === 'plan.minutes')?.args.minutes
  const location = intents.find((i) => i.type === 'plan.place')?.args.location
  const avoid = intents.filter((i) => i.type === 'exercise.replace').map((i) => i.args.exId)
  const active = state.activeWorkout
  if (active) {
    const preview = previewReplan(state, active, { minutes, location, avoid }, { today, now })
    if (!preview.ok) return { kind: 'unavailable', reason: 'This workout can’t be adjusted here.' }
    return {
      kind: 'preview',
      target: 'workout',
      sessionId: active.id,
      base: preview.base,
      result: preview.result,
      session: preview.session,
      diff: {
        removed: [...preview.diff.removed.map((r) => r.name), ...preview.diff.shortened.map((s) => `${s.name}: ${s.removedSets} fewer sets`)],
        added: preview.diff.replaced.map((r) => `${r.fromName} → ${r.toName}`),
        minutes: minutes || null,
        place: location ? preview.placeName : null,
      },
      changed: preview.changed,
    }
  }
  const choice = todayChoice(state, today)
  const current = buildDailyPlan(state, { today, now, ...choice })
  const readiness = readinessOf(state, today)
  const patch = {
    ...(minutes ? { todayMinutes: Math.min(90, Math.max(5, minutes)) } : {}),
    ...(location ? { todayLocation: location } : {}),
    ...(avoid.length ? { avoidToday: [...new Set([...(readiness.avoidToday || []), ...avoid])] } : {}),
  }
  const nextState = { ...state, readiness: { ...readiness, ...patch, date: today } }
  const next = buildDailyPlan(nextState, { today, now, ...todayChoice(nextState, today) })
  const before = new Set(current.items.map((i) => i.exId))
  const after = new Set(next.items.map((i) => i.exId))
  return {
    kind: 'preview',
    target: 'plan',
    base: previewKey(state, current, today),
    readinessBefore: state.readiness || null,
    readinessAfter: nextState.readiness,
    diff: {
      removed: current.items.filter((i) => !after.has(i.exId)).map((i) => findExercise(i.exId)?.name || i.exId),
      added: next.items.filter((i) => !before.has(i.exId)).map((i) => findExercise(i.exId)?.name || i.exId),
      minutes: minutes ? { from: current.requestedMinutes, to: next.requestedMinutes } : null,
      place: location ? next.placeName : null,
      estimate: Math.round(next.estimatedSeconds / 60),
    },
    changed: planKey(current) !== planKey(next) || Boolean(location || minutes),
    plan: next,
  }
}

/**
 * Applies a preview. Returns the actions to dispatch and an undo token, or
 * { status: 'stale' } if the state it was made from has changed.
 */
export function applyPreview(state, preview, { today, now }) {
  if (preview.target === 'workout') {
    const active = state.activeWorkout
    if (!active || active.id !== preview.sessionId) return { status: 'stale' }
    const result = applyReplan(active, { base: preview.base, result: preview.result, session: preview.session }, now)
    if (result.status === 'stale') return { status: 'stale' }
    return {
      status: result.status,
      actions: result.status === 'applied' ? [{ type: 'SET_ACTIVE_WORKOUT', session: result.session }] : [],
      undo: { target: 'workout', previous: active, appliedPrint: sessionFingerprint(result.session) },
    }
  }
  const current = buildDailyPlan(state, { today, now, ...todayChoice(state, today) })
  const base = previewKey(state, current, today)
  if (base !== preview.base) return { status: 'stale' }
  return {
    status: 'applied',
    actions: [{ type: 'SET_READINESS', readiness: preview.readinessAfter }],
    undo: { target: 'plan', previous: preview.readinessBefore, applied: preview.readinessAfter, context: contextKey(state) },
  }
}

/** Undo restores only what the change touched, and only if nothing newer was logged. */
export function undoChange(state, undo, { now = Date.now() } = {}) {
  if (undo.target === 'workout') {
    const active = state.activeWorkout
    if (!active || active.id !== undo.previous.id || sessionFingerprint(active) !== undo.appliedPrint)
      return { status: 'stale', actions: [] }
    const restored = applyReplan(active, { base: undo.appliedPrint, result: sessionFingerprint(undo.previous), session: undo.previous }, now)
    return { status: 'undone', actions: [{ type: 'SET_ACTIVE_WORKOUT', session: restored.session }] }
  }
  if (JSON.stringify(state.readiness) !== JSON.stringify(undo.applied) || contextKey(state) !== undo.context) return { status: 'stale', actions: [] }
  return { status: 'undone', actions: [{ type: 'SET_READINESS', readiness: undo.previous }] }
}

export const recentRange = (today, days) => ({ from: addDays(today, -(days - 1)), to: today, label: `past ${days} days` })
