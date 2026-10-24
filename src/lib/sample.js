// Ten weeks of believable training, for previewing the app before you have
// history of your own. Everything made here carries `sample: true`, so the
// You tab can take it all back out in one go.

import { TEMPLATES, findExercise } from './exercises.js'
import { addDays, fromKey, todayKey } from './date.js'
import { findRecords, totals } from './workout.js'

// Starting weights (lb) for the sample's weighted lifts.
const START = {
  'bench-press': 150, ohp: 85, 'db-bench': 55, 'lateral-raise': 20, 'triceps-pushdown': 50,
  'barbell-row': 135, 'lat-pulldown': 120, 'face-pull': 40, 'biceps-curl': 30,
  'goblet-squat': 55, 'db-row': 60, 'back-squat': 205, rdl: 165, lunge: 40, 'calf-raise': 115,
}

// Small seeded random so the sample looks the same every time.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const roundTo = (n, step) => Math.round(n / step) * step

export function makeSampleWorkouts(today = todayKey(), weeks = 10) {
  const rand = rng(7)
  const order = ['tpl-push', 'tpl-pull', 'tpl-lower', 'tpl-upper', 'tpl-push', 'tpl-pull', 'tpl-lower', 'tpl-full-body']
  // Fewer sessions early on, building to four a week.
  const pattern = (w) => (w < 3 ? [1, 4] : w < 6 ? [0, 2, 4] : w % 3 === 1 ? [0, 1, 3, 5] : [0, 2, 3, 5])
  const start = addDays(today, -7 * weeks)
  const monday = addDays(start, -((fromKey(start).getDay() + 6) % 7))
  const days = []
  for (let w = 0; w <= weeks; w++) {
    for (const d of pattern(w)) {
      const key = addDays(monday, w * 7 + d)
      if (key >= start && key < today) days.push(key)
    }
  }

  const out = []
  days.forEach((date, i) => {
    const routine = TEMPLATES.find((t) => t.id === order[i % order.length])
    const progress = i / Math.max(1, days.length - 1)
    const exercises = routine.items.map((item) => {
      const def = findExercise(item.exId)
      const sets = Array.from({ length: item.sets }, (_, s) => {
        if (def.type === 'time') return { reps: null, sec: item.sec + (rand() > 0.7 ? 5 : 0), weight: null, targetReps: null, targetSec: item.sec }
        const weight = def.weighted ? roundTo((START[def.id] || 50) * (0.88 + 0.14 * progress), 5) : null
        const miss = s === item.sets - 1 && rand() > 0.75 ? 1 : 0
        return { reps: item.reps - miss, sec: null, weight, targetReps: item.reps, targetSec: null }
      })
      return { exId: def.id, name: def.name, muscle: def.muscle, type: def.type, weighted: def.weighted, sets }
    })
    const durationSec = Math.round((40 + rand() * 14) * 60)
    const startedAt = fromKey(date).getTime() + (17 * 60 + Math.round(rand() * 90)) * 60000
    const asSession = { unit: 'lb', exercises: exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, status: 'done' })) })) }
    out.push({
      id: `sample-${date}`,
      routineId: routine.id,
      name: routine.name,
      unit: 'lb',
      date,
      startedAt,
      endedAt: startedAt + durationSec * 1000,
      durationSec,
      exercises,
      totals: totals(exercises),
      records: findRecords(asSession, out),
      effort: [2, 3, 2, 1][i % 4],
      note: '',
      sample: true,
    })
  })
  return out
}

// Bodyweight every third day, drifting down a little.
export function makeSampleWeights(today = todayKey(), weeks = 10) {
  const rand = rng(11)
  const out = {}
  for (let i = weeks * 7; i >= 1; i -= 3) {
    const trend = 183.4 - (weeks * 7 - i) * 0.062
    out[addDays(today, -i)] = Math.round((trend + (rand() - 0.5) * 0.9) * 10) / 10
  }
  return out
}
