// Sets, reps, time, rest and load for chosen exercises.
//
// Rests never drop below the minimum useful rest for the exercise's role;
// extra time buys more sets (with diminishing returns) up to a cap set by
// readiness and experience, never shorter rests or an unlimited backlog.
import { MIN_REST } from './config.js'
import { comparableSessions, historyIndex, planTarget, progressionTrend } from './progression.js'
import { extraSetSeconds, planSeconds } from './session-time.js'
import { strengthTarget, trainsAny } from '../strength/index.js'

export function baseDose(meta, def, ctx) {
  const loaded = def.weighted && !['bw', 'band'].includes(meta.load)
  const strength = ctx.goal === 'Get stronger' && !ctx.easy && loaded && meta.role === 'compound'
  const item = {
    exId: meta.id,
    sets: 1,
    reps: strength ? 6 : ctx.easy ? 8 : meta.role === 'isolation' ? 12 : 10,
    restSec: ctx.shortSession && ctx.easy ? 45 : strength ? 120 : ctx.easy ? 75 : meta.role === 'compound' ? 90 : 60,
    unilateral: Boolean(meta.perSide && def.type === 'reps'),
  }
  item.restSec = Math.max(item.restSec, MIN_REST[meta.role] ?? 45)
  if (def.type === 'time') {
    delete item.reps
    item.sec = ctx.easy ? 20 : 30
  }
  return item
}

/** Applies progression from comparable history to a base item. */
export function withTarget(item, meta, def, ctx) {
  ctx.historyIndex ||= historyIndex(ctx.workouts, ctx.today)
  const sessions = comparableSessions(ctx.workouts, meta.id, {
    unit: ctx.unit,
    today: ctx.today,
    type: def.type,
    weighted: def.weighted,
    index: ctx.historyIndex,
    place: ['stack', 'plate', 'assist'].includes(meta.load) ? ctx.place.id : null,
  })
  const signal = ctx.signals.get(meta.id)
  const trend = progressionTrend(sessions, meta, def.type)
  // Lighter for this exercise when the whole day is lighter, or when it relies
  // on muscles a very hard session worked or a nearby practice will use.
  const easy = ctx.easy || trainsAny(meta.id, ctx.lighterMuscles, def)
  // Weight and reps from the adaptive strength model, when it applies.
  ctx.strengthCache ||= new Map()
  const adaptive = strengthTarget({
    exId: meta.id,
    def,
    meta,
    workouts: ctx.workouts,
    learning: ctx.state.learning,
    unit: ctx.unit,
    today: ctx.today,
    now: ctx.now,
    goal: ctx.goal,
    experience: ctx.experience,
    easy,
    highEffort: ctx.highEffort && !easy,
    returning: ctx.returning,
    sizes: ['hand', 'one'].includes(meta.load) && ctx.caps.has('db') ? ctx.dumbbellSizes : [],
    sets: ctx.setCap,
    // Reported discomfort or "harder than expected" holds the load.
    noIncrease: signal?.comfort.status === 'some' || signal?.difficulty === 'hard',
    place: ctx.place?.id ?? null,
    metrics: ctx.state.metrics,
    customExercises: ctx.state.customExercises,
    activities: ctx.activities,
    cache: ctx.strengthCache,
    // A step up in weight is offered as a test set, not imposed.
    offerIncrease: true,
  })
  // What the strength model thinks of this exercise today feeds selection:
  // does it suit this person's level here, and how fresh are its muscles.
  ctx.strengthFit ||= new Map()
  ctx.strengthFit.set(meta.id, adaptive ? { flags: adaptive.flags || [], readiness: adaptive.facts?.readiness ?? 1, code: adaptive.code } : null)
  if (adaptive) {
    const next = { ...item, reps: adaptive.reps, repRange: adaptive.range, targetRir: adaptive.rir }
    if (def.weighted) next.weight = adaptive.weight
    if (Array.isArray(adaptive.choices)) next.startChoices = adaptive.choices
    if (adaptive.offer) next.offer = adaptive.offer
    return {
      item: next,
      progression: {
        code: adaptive.code,
        up: adaptive.up,
        facts: adaptive.facts,
        flags: adaptive.flags,
        rule: adaptive.rule,
        confidence: adaptive.confidence,
        ...(adaptive.offer ? { offer: adaptive.offer } : {}),
      },
      trend,
    }
  }
  const target = planTarget({
    meta,
    def,
    item,
    sessions,
    unit: ctx.unit,
    sizes: ['hand', 'one'].includes(meta.load) && ctx.caps.has('db') ? ctx.dumbbellSizes : [],
    easy,
    awayDays: ctx.awayDays,
    comfort: signal?.comfort.status,
    effortAnswer: signal?.difficulty,
  })
  // Held every set at the top of what the simple rules allow (a 90 s hold,
  // 20 reps): outgrown, so a harder version is worth suggesting.
  if (target.code === 'at-cap') ctx.strengthFit.set(meta.id, { flags: ['outgrown'], readiness: 1, code: 'at-cap' })
  const next = { ...item }
  if (def.type === 'time') next.sec = target.sec ?? next.sec
  else next.reps = Math.min(def.weighted ? 15 : 20, target.reps ?? next.reps)
  if (def.weighted) next.weight = target.weight ?? null
  return {
    item: next,
    progression: {
      code: target.code,
      up: target.up,
      facts: target.facts,
      rule: target.rule,
      ...(target.code === 'at-cap' ? { flags: ['outgrown'] } : {}),
    },
    trend,
  }
}

/**
 * Adds sets by marginal value per second until the budget or the caps are
 * reached. Each extra set of the same exercise is worth less than the last.
 */
export function allocateSets(chosen, ctx) {
  const items = chosen.map((c) => c.item)
  const guarded = (c) => ctx.protectedAreas.size && c.meta.areas.some((a) => ctx.protectedAreas.has(a))
  const fill = (capFor) => {
    for (let guard = 0; guard < 60; guard++) {
      let best = null
      for (let i = 0; i < chosen.length; i++) {
        const item = items[i]
        if (item.sets >= capFor(chosen[i])) continue
        const added = extraSetSeconds(item)
        if (planSeconds(items) + added + ctx.easeIn > ctx.budget) continue
        const value = Math.max(0.1, chosen[i].score) / (item.sets + 0.5) / added
        if (!best || value > best.value || (value === best.value && i < best.i)) best = { i, value }
      }
      if (!best) break
      items[best.i].sets++
    }
  }
  fill((c) => (guarded(c) ? 1 : ctx.setCap))
  // Every exercise is at its usual cap and time is still left: one more set
  // where it is worth most. Control and drill work stays at the usual cap.
  const stretch = ctx.stretchCap ?? ctx.setCap
  if (stretch > ctx.setCap)
    fill((c) => (guarded(c) ? 1 : STRETCH_ROLES.has(c.meta.role) ? stretch : ctx.setCap))
  return items
}
const STRETCH_ROLES = new Set(['compound', 'accessory', 'isolation'])
