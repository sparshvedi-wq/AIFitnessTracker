// Seeded scenario generator for property and metamorphic tests and for
// scripts/engine-evaluation.mjs. Synthetic people and synthetic history only.
import { rng } from '../../src/lib/engine/rng.js'
import { makeUser, at } from './engine-sim.mjs'
import { HOME_EQUIPMENT } from '../../src/lib/planner.js'
import { MORE_EQUIPMENT } from '../../src/lib/catalog/vocabulary.js'
import { BODY_AREAS } from '../../src/lib/body-areas.js'
import { addDays } from '../../src/lib/date.js'
import { findExercise } from '../../src/lib/exercises.js'
import { allMeta } from '../../src/lib/catalog/index.js'
import { totals } from '../../src/lib/workout.js'

export const GOALS = ['Build muscle', 'Get stronger', 'General fitness', 'Sport performance']
export const EXPERIENCE = ['Starting out', 'Some experience', 'Experienced']
const pick = (next, list) => list[Math.floor(next() * list.length)]
const subset = (next, list, p) => list.filter(() => next() < p)

const STRENGTH = allMeta().filter((m) => m.reviewed && m.kinds.includes('strength'))

/** A plausible past session built directly as a saved record. */
export function syntheticRecord(next, date, index, { unit = 'lb', location = 'gym' } = {}) {
  const count = 3 + Math.floor(next() * 4)
  const chosen = []
  while (chosen.length < count) {
    const m = pick(next, STRENGTH)
    if (!chosen.some((c) => c.id === m.id)) chosen.push(m)
  }
  const reasons = ['time', 'other', 'dislike', 'pain', 'equipment', 'soreness', 'unwell']
  const exercises = []
  const unfinished = []
  chosen.forEach((m) => {
    const def = findExercise(m.id)
    const planned = 2 + Math.floor(next() * 2)
    const done = next() < 0.8 ? planned : Math.floor(next() * planned)
    const sets = Array.from({ length: done }, () => ({
      kind: 'work',
      reps: def.type === 'time' ? null : 8 + Math.floor(next() * 5),
      sec: def.type === 'time' ? 30 : null,
      weight: def.weighted ? 10 + 5 * Math.floor(next() * 20) : null,
      targetReps: def.type === 'time' ? null : 10,
      targetSec: def.type === 'time' ? 30 : null,
    }))
    if (sets.length)
      exercises.push({ exId: m.id, name: def.name, muscle: def.muscle, type: def.type, weighted: def.weighted, sets })
    if (done < planned) unfinished.push({ exId: m.id, reason: pick(next, reasons), at: 0, carried: false })
  })
  const startedAt = at(date, 7 + Math.floor(next() * 12))
  return {
    id: `syn-${date}-${index}`,
    name: 'Synthetic',
    kind: 'adaptive',
    unit,
    location,
    date,
    startedAt,
    endedAt: startedAt + 45 * 60000,
    durationSec: 2700,
    exercises,
    unfinished,
    finishReason: unfinished.length ? pick(next, ['time', 'other']) : 'other',
    effort: 1 + Math.floor(next() * 4),
    totals: totals(exercises),
    records: [],
    note: '',
  }
}

/** One random but valid planning scenario. */
export function scenario(seed) {
  const next = rng(`scenario-${seed}`)
  const today = addDays('2026-11-05', -Math.floor(next() * 30))
  const placeKind = pick(next, ['gym', 'home', 'home', 'on-the-go', 'saved'])
  const equipment = subset(next, [...HOME_EQUIPMENT, ...MORE_EQUIPMENT], 0.35)
  const onTheGo = {
    space: pick(next, ['open', 'small']),
    position: pick(next, ['any', 'any', 'standing', 'seated']),
    noFloor: next() < 0.3,
    noJumping: next() < 0.6,
    wall: next() < 0.8,
  }
  const profile = {
    goal: pick(next, GOALS),
    experience: pick(next, EXPERIENCE),
    location: placeKind === 'saved' ? 'place-x' : placeKind,
    equipment,
    homeDumbbells: next() < 0.5 ? [5, 10, 15, 20, 25, 30].filter(() => next() < 0.6) : [],
    minutes: pick(next, [10, 15, 20, 30, 45, 60, 75, 90]),
    quiet: next() < 0.15,
    onTheGo,
    places:
      placeKind === 'saved'
        ? [{ id: 'place-x', name: 'Hotel', type: pick(next, ['gym', 'equipment', 'space']), equipment: subset(next, HOME_EQUIPMENT, 0.4), dumbbells: [], movement: onTheGo, quiet: next() < 0.3 }]
        : [],
    sports: next() < 0.3 ? [pick(next, ['tennis', 'running', 'soccer', 'golf'])] : [],
    sportPriority: pick(next, ['sport', 'balanced', 'goal']),
    avoidMuscles: next() < 0.15 ? subset(next, BODY_AREAS, 0.2) : [],
    variety: pick(next, ['familiar', 'balanced', 'more']),
  }
  const state = makeUser(profile)
  const days = Math.floor(next() * 14)
  state.workouts = Array.from({ length: days }, (_, i) => syntheticRecord(next, addDays(today, -1 - Math.floor((i * 21) / Math.max(1, days))), i, { location: profile.location }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
  if (next() < 0.2) state.settings.training.excludedExercises = subset(next, STRENGTH.map((m) => m.id), 0.05)
  const readiness = {
    energy: pick(next, ['low', 'normal', 'normal', 'high']),
    intensity: pick(next, ['easy', 'moderate', 'moderate', 'challenging']),
    sore: next() < 0.25 ? subset(next, BODY_AREAS, 0.25) : [],
    pain: next() < 0.15 ? subset(next, BODY_AREAS, 0.2) : [],
    sportSoon: next() < 0.1,
    unwell: next() < 0.05,
  }
  return {
    seed,
    state,
    options: {
      today,
      now: at(today, 8 + Math.floor(next() * 12)),
      minutes: profile.minutes,
      location: profile.location,
      readiness,
      shortSession: next() < 0.1,
      seed: `fixed-${seed}`,
    },
  }
}
