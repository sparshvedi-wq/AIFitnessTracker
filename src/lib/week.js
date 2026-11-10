import { addDays, fromKey } from './date.js'
import { weekStart } from './workout.js'
import { checkinSchedule } from './planner.js'
import { sportOccurrences } from './sport-schedule.js'
import { convertWeight } from './units.js'
import { metaOf } from './catalog/index.js'
import { exerciseProfile } from './strength/library.js'
import { MUSCLE_AREA } from './catalog/vocabulary.js'

const actual = (workout, today) => !workout.sample && workout.date <= today
export const strengthSession = (w) => !['sport', 'recovery', 'pump'].includes(w.kind)
const loggedSets = (e) =>
  (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done'))
const setCount = (w) => (w.exercises || []).reduce((n, e) => n + loggedSets(e).length, 0)

// How one exercise's sets divide between broad areas (shares sum to 1).
const SPLITS = new Map()
function areaSplit(e) {
  if (SPLITS.has(e.exId)) return SPLITS.get(e.exId)
  const profile = exerciseProfile(e.exId)
  let split
  if (profile && Object.keys(profile.muscles || {}).length) {
    const areas = new Map()
    for (const [m, share] of Object.entries(profile.muscles)) {
      const area = MUSCLE_AREA[m] || 'Other'
      areas.set(area, (areas.get(area) || 0) + share)
    }
    split = [...areas].filter(([, v]) => v >= 0.1)
    const total = split.reduce((n, [, v]) => n + v, 0) || 1
    split = split.map(([a, v]) => [a, v / total])
  } else split = [[e.muscle || 'Other', 1]]
  SPLITS.set(e.exId, split)
  return split
}

export function weekOverview(state, today, offset = 0) {
  const start = addDays(weekStart(today), offset * 7)
  const end = addDays(start, 6)
  const events = sportOccurrences(state.settings.training?.sportSchedule, start, end)
  const photo = checkinSchedule(state, today)
  const dueDate = photo.due ? today : photo.next
  return {
    start,
    end,
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      return {
        date,
        number: fromKey(date).getDate(),
        today: date === today,
        workouts: state.workouts.filter((w) => actual(w, today) && w.date === date),
        events: events.filter((e) => e.date === date),
        photos: state.settings.display?.metricLight
          ? []
          : state.checkins.filter((c) => !c.synthetic && !c.sample && c.date === date && c.date <= today),
        photoDue: !state.settings.display?.metricLight && date === dueDate,
      }
    }),
  }
}

function exerciseProgress(current, earlier, unit) {
  const comparisons = []
  const latest = new Map()
  for (const w of [...current].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startedAt || 0) - (b.startedAt || 0),
  )) {
    for (const e of w.exercises || []) if (loggedSets(e).length) latest.set(e.exId, { e, w })
  }
  for (const [id, { e, w }] of latest) {
    if (e.type === 'time') continue // Logged target duration is not proof of measured progress.
    const prior = [...earlier]
      .sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt || 0) - (a.startedAt || 0))
      .find((old) => old.exercises?.some((x) => x.exId === id && loggedSets(x).length))
    const old = prior?.exercises.find((x) => x.exId === id)
    if (!old || old.type !== e.type || old.weighted !== e.weighted) continue
    const currentSets = loggedSets(e).filter((s) => s.reps > 0)
    const previousSets = loggedSets(old).filter((s) => s.reps > 0)
    if (!currentSets.length || !previousSets.length) continue
    const base = { exId: id, name: e.name || id, date: w.date, previousDate: prior.date, unit }
    if (e.weighted && metaOf(id)?.load === 'assist') {
      // Assisted machines: less assistance for the same reps is progress.
      const load = (s, rec) => convertWeight(s.weight || 0, rec.unit || unit, unit)
      const before = previousSets.reduce((best, s) => (!best || load(s, prior) < best.weight ? { weight: load(s, prior), reps: s.reps } : best), null)
      for (const set of currentSets) {
        const now = load(set, w)
        if (before && now < before.weight - 0.05 && set.reps >= before.reps)
          comparisons.push({ ...base, kind: 'assist', delta: before.weight - now, from: before.weight, to: now, reps: set.reps })
        const same = previousSets.filter((s) => Math.abs(load(s, prior) - now) < 0.05)
        const reps = same.length ? Math.max(...same.map((s) => s.reps)) : null
        if (reps && set.reps > reps)
          comparisons.push({ ...base, kind: 'reps', delta: set.reps - reps, load: now, from: reps, to: set.reps, assisted: true })
      }
    } else if (e.weighted) {
      // Same load and more reps is directly comparable across lb/kg records.
      for (const set of currentSets) {
        const load = convertWeight(set.weight, w.unit || unit, unit)
        if (!(load > 0)) continue
        const matching = previousSets.filter(
          (s) => Math.abs(convertWeight(s.weight, prior.unit || unit, unit) - load) < 0.05,
        )
        const reps = matching.length ? Math.max(...matching.map((s) => s.reps)) : null
        if (reps && set.reps > reps)
          comparisons.push({ ...base, kind: 'reps', delta: set.reps - reps, load, from: reps, to: set.reps })
        const bestPrevious = previousSets.reduce((best, s) => {
          const weight = convertWeight(s.weight, prior.unit || unit, unit)
          return weight > 0 && (!best || weight > best.weight) ? { weight, reps: s.reps } : best
        }, null)
        if (bestPrevious && load > bestPrevious.weight + 0.05 && set.reps >= bestPrevious.reps)
          comparisons.push({
            ...base,
            kind: 'load',
            delta: load - bestPrevious.weight,
            from: bestPrevious.weight,
            to: load,
            reps: set.reps,
          })
      }
    } else {
      const from = Math.max(...previousSets.map((s) => s.reps))
      const to = Math.max(...currentSets.map((s) => s.reps))
      if (to > from) comparisons.push({ ...base, kind: 'reps', delta: to - from, from, to, load: null })
    }
  }
  return comparisons.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))[0] || null
}

export function weeklyRecap(state, today, period = 'last') {
  const start = addDays(weekStart(today), period === 'current' ? 0 : -7)
  const end = period === 'current' ? today : addDays(start, 6)
  const source = state.workouts.filter((w) => actual(w, today))
  const sessions = source.filter((w) => w.date >= start && w.date <= end && setCount(w) > 0)
  const strength = sessions.filter(strengthSession)
  const previous = source.filter(
    (w) =>
      strengthSession(w) && w.date >= addDays(start, -7) && w.date <= addDays(end, -7) && setCount(w) > 0,
  )
  const earlier = source.filter((w) => strengthSession(w) && w.date < start)
  const sets = strength.reduce((n, w) => n + setCount(w), 0)
  const priorSets = previous.reduce((n, w) => n + setCount(w), 0)
  // Sets per area, sharing each set between the areas it trains (from the
  // exercise library): a bench press set counts mostly for chest, partly for
  // triceps and shoulders. Shown to the nearest half set.
  const muscles = new Map()
  for (const w of strength)
    for (const e of w.exercises || []) {
      const count = loggedSets(e).length
      if (!count) continue
      for (const [area, share] of areaSplit(e)) muscles.set(area, (muscles.get(area) || 0) + count * share)
    }
  const skips = new Map()
  for (const w of strength)
    for (const item of w.unfinished || []) {
      if (['equipment', 'time', 'dislike', 'pain', 'soreness'].includes(item.reason))
        skips.set(item.reason, (skips.get(item.reason) || 0) + 1)
    }
  return {
    start,
    end,
    period,
    sessions,
    strength,
    days: new Set(strength.map((w) => w.date)).size,
    sets,
    priorDays: new Set(previous.map((w) => w.date)).size,
    priorSets,
    hasComparison: previous.length > 0,
    warmups: sessions.filter((w) => w.kind === 'sport').length,
    movement: sessions.filter((w) => ['recovery', 'pump'].includes(w.kind)).length,
    exercises: new Set(
      strength.flatMap((w) => w.exercises.filter((e) => loggedSets(e).length).map((e) => e.exId)),
    ).size,
    bars: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      return {
        date,
        sets: strength.filter((w) => w.date === date).reduce((n, w) => n + setCount(w), 0),
        future: date > end,
      }
    }),
    muscles: [...muscles]
      .map(([name, count]) => ({ name, sets: Math.round(count * 2) / 2 }))
      .filter((m) => m.sets > 0)
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name)),
    progress: exerciseProgress(strength, earlier, state.settings.weightUnit),
    skips: [...skips].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  }
}

export function defaultRecapPeriod(state, today) {
  return weeklyRecap(state, today, 'last').sessions.length ? 'last' : 'current'
}
