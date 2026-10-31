import { addDays } from './date.js'
import { eventHistory } from './training-events.js'
import { convertWeight } from './units.js'
const sets = (e) => (e.sets || []).filter((s) => s.kind !== 'warmup' && (!s.status || s.status === 'done'))
export function historyTimeline(state, today, { days = 30, filter = 'all', query = '' } = {}) {
  const since = days ? addDays(today, -days + 1) : '2000-01-01'
  const q = query.trim().toLowerCase()
  const workouts = state.workouts.filter((w) => !w.sample && w.date >= since && w.date <= today)
  const events = eventHistory(state.settings.training, today).filter((e) => e.date >= since)
  const photos = (state.settings.display?.metricLight ? [] : state.checkins).filter(
    (c) => !c.synthetic && !c.sample && c.date >= since && c.date <= today,
  )
  const rows = [
    ...workouts.map((w) => ({
      id: w.id,
      date: w.date,
      at: w.startedAt || 0,
      type:
        w.kind === 'sport'
          ? 'warmup'
          : w.kind === 'recovery'
            ? 'movement'
            : w.kind === 'pump' || w.planning?.shortSession
              ? 'focus'
              : 'training',
      title: w.name,
      data: w,
      search: [w.name, w.focus, w.location, w.placeName, ...w.exercises.map((e) => e.name)].join(' '),
    })),
    ...events.map((e) => ({
      id: e.id,
      date: e.date,
      at: e.at,
      type: 'activity',
      title: e.title,
      data: e,
      search: e.title,
    })),
    ...photos.map((c) => ({
      id: c.id,
      date: c.date,
      at: c.createdAt || 0,
      type: 'photo',
      title: 'Photo check-in',
      data: c,
      search: 'photo check-in',
    })),
  ]
  const training = workouts.filter((w) => !['sport', 'pump', 'recovery'].includes(w.kind))
  return {
    rows: rows
      .filter((r) => (filter === 'all' || r.type === filter) && (!q || r.search.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at),
    days: new Set(training.filter((w) => w.exercises.some((e) => sets(e).length)).map((w) => w.date)).size,
    sets: training.reduce((n, w) => n + w.exercises.reduce((s, e) => s + sets(e).length, 0), 0),
    activities: events.length,
    photos: photos.length,
  }
}
export function exerciseTrend(workouts, exId, unit, today) {
  return workouts
    .filter((w) => !w.sample && !['sport', 'recovery', 'pump'].includes(w.kind) && w.date <= today)
    .map((w) => {
      const e = w.exercises.find((e) => e.exId === exId)
      const logged = e ? w.exercises.filter((x) => x.exId === exId).flatMap(sets) : []
      if (!logged.length) return null
      const best = [...logged].sort((a, b) =>
        e.type === 'time'
          ? (b.sec || 0) - (a.sec || 0)
          : e.weighted
            ? convertWeight(b.weight || 0, w.unit || unit, unit) -
                convertWeight(a.weight || 0, w.unit || unit, unit) || (b.reps || 0) - (a.reps || 0)
            : (b.reps || 0) - (a.reps || 0),
      )[0]
      return {
        id: w.id,
        date: w.date,
        type: e.type,
        weighted: e.weighted,
        value:
          e.type === 'time'
            ? best.sec || 0
            : e.weighted
              ? convertWeight(best.weight || 0, w.unit || unit, unit)
              : best.reps || 0,
        reps: best.reps,
        sets: logged.length,
        name: e.name,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)
}
