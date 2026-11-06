// Sets, reps, time, rest and load for chosen exercises.
//
// Rests never drop below the minimum useful rest for the exercise's role;
// extra time buys more sets (with diminishing returns) up to a cap set by
// readiness and experience, never shorter rests or an unlimited backlog.
import { MIN_REST } from './config.js'
import { comparableSessions, historyIndex, planTarget, progressionTrend } from './progression.js'
import { extraSetSeconds, planSeconds } from './session-time.js'

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
  })
  const signal = ctx.signals.get(meta.id)
  const target = planTarget({
    meta,
    def,
    item,
    sessions,
    unit: ctx.unit,
    sizes: ['hand', 'one'].includes(meta.load) && ctx.caps.has('db') ? ctx.dumbbellSizes : [],
    easy: ctx.easy,
    awayDays: ctx.awayDays,
    comfort: signal?.comfort.status,
    effortAnswer: signal?.difficulty,
  })
  const next = { ...item }
  if (def.type === 'time') next.sec = target.sec ?? next.sec
  else next.reps = Math.min(def.weighted ? 15 : 20, target.reps ?? next.reps)
  if (def.weighted) next.weight = target.weight ?? null
  return {
    item: next,
    progression: { code: target.code, up: target.up, facts: target.facts, rule: target.rule },
    trend: progressionTrend(sessions, meta, def.type),
  }
}

/**
 * Adds sets by marginal value per second until the budget or the caps are
 * reached. Each extra set of the same exercise is worth less than the last.
 */
export function allocateSets(chosen, ctx) {
  const items = chosen.map((c) => c.item)
  const capFor = (c) => (ctx.protectedAreas.size && c.meta.areas.some((a) => ctx.protectedAreas.has(a)) ? 1 : ctx.setCap)
  for (let guard = 0; guard < 40; guard++) {
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
  return items
}
