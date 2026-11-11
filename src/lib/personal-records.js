import { convertWeight } from './units.js'
import { workoutVolume, isAssisted } from './workout.js'

export function validPersonalRecord(r) {
  return Boolean(
    r &&
    typeof r.id === 'string' &&
    typeof r.exId === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    ['lb', 'kg'].includes(r.unit) &&
    Number.isFinite(r.weight) &&
    r.weight >= 0 &&
    r.weight <= 10000 &&
    Number.isInteger(r.reps) &&
    r.reps >= 0 &&
    r.reps <= 1000 &&
    Number.isInteger(r.sec) &&
    r.sec >= 0 &&
    r.sec <= 86400 &&
    (r.reps > 0 || r.sec > 0),
  )
}

// Imported bests are evidence, not completed sessions or extra lifted volume.
export function liftedTotal(workouts, unit, today) {
  return workouts
    .filter((w) => !w.sample && w.date <= today)
    .reduce((sum, w) => sum + convertWeight(workoutVolume(w), w.unit || unit, unit), 0)
}

export function recordBook(workouts, manual, unit, today) {
  const entries = manual
    .filter(validPersonalRecord)
    .filter((r) => r.date <= today)
    .map((r) => ({ ...r, weight: convertWeight(r.weight, r.unit, unit), manual: true }))
  for (const w of workouts) {
    if (w.sample || w.date > today || ['sport', 'pump', 'recovery'].includes(w.kind)) continue
    // One line per exercise per workout: its best set, not every set logged.
    const session = new Map()
    for (const [ei, e] of (w.exercises || []).entries())
      for (const [i, s] of (e.sets || []).entries()) {
        if (
          s.kind === 'warmup' ||
          (s.status && s.status !== 'done') ||
          !((s.reps || 0) > 0 || (s.sec || 0) > 0)
        )
          continue
        const entry = {
          id: `${w.id}:${ei}:${i}`,
          exId: e.exId,
          date: w.date,
          weight: convertWeight(s.weight || 0, w.unit || unit, unit),
          reps: s.reps || 0,
          sec: s.sec || 0,
          manual: false,
        }
        const kept = session.get(e.exId)
        if (!kept || better(e.exId)(entry, kept) < 0) session.set(e.exId, entry)
      }
    entries.push(...session.values())
  }
  const groups = new Map()
  for (const r of entries) {
    if (!groups.has(r.exId)) groups.set(r.exId, [])
    groups.get(r.exId).push(r)
  }
  return [...groups].map(([exId, history]) => {
    history.sort((a, b) => b.date.localeCompare(a.date))
    const best = [...history].sort(better(exId))[0]
    return { exId, best, history }
  })
}

// Heaviest first (least assistance on assisted machines), then reps, then time.
const better = (exId) => (a, b) =>
  (isAssisted(exId) ? a.weight - b.weight : b.weight - a.weight) || b.reps - a.reps || b.sec - a.sec

// Stable within a day: artwork changes on another visit/day, never as a slideshow mid-set.
export function dailyArtwork(day, kind = 'training') {
  const choices =
    kind === 'records'
      ? ['m1-v3-strength', 'm1-v3-muscle', 'm1-experience']
      : kind === 'bodyweight'
        ? ['m1-movement', 'm1-experience', 'm1-time']
        : kind === 'home'
          ? ['m1-equipment', 'm1-v3-muscle', 'm1-experience']
          : ['m1-v3-gym', 'm1-v3-strength', 'm1-equipment', 'm1-movement', 'm1-v3-muscle']
  const index = [...day].reduce((n, c) => n * 31 + c.charCodeAt(0), 0) >>> 0
  return `/onboarding/${choices[index % choices.length]}.webp`
}
