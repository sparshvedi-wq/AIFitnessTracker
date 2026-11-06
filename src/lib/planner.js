import { findExercise } from './exercises.js'
import { addDays, shortLabel, todayKey } from './date.js'
import { lastPerformance } from './workout.js'
import { trainingTitle } from './training-copy.js'
import { resolvePlace } from './places.js'
import { availableLoads, fitAvailableLoad } from './preferences.js'
import { sportScheduleContext } from './sport-schedule.js'
import { movementPreferences, DEFAULT_ON_THE_GO } from './movement-preferences.js'
import { allMeta, metaOf } from './catalog/index.js'
import { EQUIPMENT_CAPABILITIES, GYM_CAPABILITIES, capabilitiesFor } from './catalog/vocabulary.js'
import { equipmentSatisfied, ineligibility, placeCapabilities, placeSupports, EXPERIENCE_LEVEL } from './engine/eligibility.js'
import { recommendMovement, recommendStrength } from './engine/recommend.js'
import { exerciseSignals } from './engine/learning.js'
import { planSeconds } from './engine/session-time.js'
import { carryCandidates } from './engine/rollover.js'
import { quietAt } from './places.js'

export { planSeconds, carryCandidates }

export const GOALS = ['Build muscle', 'Get stronger', 'General fitness']
export const HOME_EQUIPMENT = [
  'Dumbbells',
  'Resistance bands',
  'Bench',
  'Pull-up bar',
  'Barbell & rack',
  'Kettlebell',
]
export const DEFAULT_PROFILE = {
  completed: false,
  onboardingVersion: 0,
  goal: 'General fitness',
  experience: 'Starting out',
  ageGroup: '18+',
  sports: [],
  sportPriority: 'balanced',
  location: 'gym',
  equipment: [],
  minutes: 30,
  checkinDays: 14,
  confirmedFocus: [],
  weakerSide: '',
  sideTestConfirmed: false,
  quiet: false,
  homeQuiet: false,
  homeDumbbells: [],
  places: [],
  // Exercises someone asked never to be suggested. They can still pick them by hand.
  excludedExercises: [],
  gymDumbbells: [],
  replacements: {},
  sportSchedule: [],
  lifeEvents: [],
  eventMode: 'one-off',
  avoidMuscles: [],
  gender: 'Prefer not to say',
  onTheGo: { ...DEFAULT_ON_THE_GO },
  // familiar | balanced | more: how often new exercises are tried.
  variety: 'balanced',
  // Specialty equipment at the built-in gym beyond the assumed full set.
  gymExtras: [],
}
export const DEFAULT_READINESS = {
  energy: 'normal',
  // Set when someone says they aren't feeling well; never inferred.
  unwell: false,
  sore: [],
  pain: [],
  intensity: 'moderate',
  sportSoon: false,
}

// Every reviewed built-in exercise the planner can recommend, in the shape the
// rest of the app has always used. `requirements` are AND groups of
// alternative equipment capabilities (catalog/vocabulary.js); `uses` are the
// broad areas loaded. Metadata lives in catalog/.
const LABELS_FOR = {}
for (const [label, caps] of Object.entries(EQUIPMENT_CAPABILITIES))
  for (const cap of caps) (LABELS_FOR[cap] ||= []).push(label)
// Requirements in equipment-label terms: AND groups of labels that provide any
// of the needed capabilities ('Bench' or 'Adjustable bench' both give a bench).
const asLabels = (equipment) =>
  equipment.map((alternatives) => [...new Set(alternatives.flatMap((c) => LABELS_FOR[c] || [c]))])
export const MOVEMENTS = allMeta()
  .filter((m) => m.reviewed && (m.kinds.includes('strength') || m.kinds.includes('seated')))
  .map((m) => ({
    id: m.id,
    muscle: findExercise(m.id)?.muscle,
    pattern: m.pattern,
    family: m.family,
    requirements: asLabels(m.equipment),
    capabilities: m.equipment,
    uses: m.areas,
  }))

export function profileOf(state) {
  return { ...DEFAULT_PROFILE, ...state.settings?.training }
}
// `base` is a place's behaviour (see places.js). A gym has a configured full
// set of equipment plus any listed extras; other places have exactly what is
// listed; a no-equipment place has none.
export function availableMovement(m, base, equipment = []) {
  const meta = metaOf(m?.id)
  if (!meta) return false
  const caps =
    base === 'gym'
      ? new Set([...GYM_CAPABILITIES, ...capabilitiesFor(equipment)])
      : base === 'on-the-go'
        ? new Set()
        : new Set(capabilitiesFor(equipment))
  return equipmentSatisfied(meta, caps)
}
export function readinessOf(state, date = todayKey()) {
  const r = {
    ...DEFAULT_READINESS,
    ...(state.readiness?.date === date ? state.readiness : {}),
  }
  return { ...r, pain: [...new Set([...(state.settings?.training?.avoidMuscles || []), ...r.pain])] }
}
// What someone said they have today (time, place), from Home's quick bar.
// It lasts for the day only and never changes their usual setup.
export function todayChoice(state, date = todayKey()) {
  const r = state.readiness?.date === date ? state.readiness : {}
  const place = r.todayLocation && resolvePlace(profileOf(state), r.todayLocation)
  return {
    minutes: r.todayMinutes || undefined,
    location: place && place.id === r.todayLocation ? place.id : undefined,
  }
}
export function buildDailyPlan(state, options = {}) {
  const today = options.today || todayKey()
  let profile = { ...profileOf(state), ...options.profile }
  const readiness = { ...readinessOf(state, today), ...options.readiness }
  readiness.pain = [...new Set([...(profile.avoidMuscles || []), ...(readiness.pain || [])])]
  // "Not today" exercises from Ask or adjust last for the day only.
  if (readiness.avoidToday?.length)
    profile = { ...profile, excludedExercises: [...new Set([...(profile.excludedExercises || []), ...readiness.avoidToday])] }
  const request = { ...options, today, profile, readiness, now: options.now ?? Date.now() }
  return readiness.unwell || options.mode === 'movement'
    ? recommendMovement(state, request)
    : recommendStrength(state, request)
}

/** The full decision record for a recommendation, for debugging and evaluation. */
export function explainDailyPlan(state, options = {}) {
  return buildDailyPlan(state, options).decision
}

export function checkinSchedule(state, today = todayKey()) {
  const p = profileOf(state)
  const latest = [...(state.checkins || [])]
    .filter((c) => !c.synthetic && !c.sample)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const next = latest ? addDays(latest.date, p.checkinDays) : today
  return {
    latest,
    next,
    due: !latest || next <= today,
    label: !latest
      ? 'Your starting photos'
      : next <= today
        ? 'Photo check-in is due'
        : `Next photo check-in · ${shortLabel(next)}`,
  }
}

// A brief optional session, not progression work or a promise of appearance change.
export function buildEventPump(state, event, options = {}) {
  const today = options.today || todayKey(),
    p = profileOf(state)
  const r = { ...readinessOf(state, today), ...options.readiness }
  r.pain = [...new Set([...(p.avoidMuscles || []), ...(r.pain || [])])]
  const minutes = Math.min(15, Math.max(5, Number(options.minutes) || 10))
  const place = resolvePlace(p, options.location || p.location)
  const location = place.id
  const movement = movementPreferences(p, location, options.movement)
  const schedule = sportScheduleContext(p, { today, now: options.now ?? Date.now(), minutes })
  const wanted = (event?.focus || []).filter(
    (m) => !r.pain.includes(m) && !r.sore.includes(m) && !schedule.muscles.includes(m),
  )
  const recent = state.workouts
    .filter((w) => !w.sample && w.date >= addDays(today, -1) && w.date <= today)
    .flatMap((w) => w.exercises.filter((e) => e.sets?.length >= 2).map((e) => e.muscle))
  // The same hard rules as daily plans; short focus sessions also leave out
  // barbell lifts and anything beyond beginner level.
  const elig = {
    kind: movement?.position === 'seated' ? 'seated' : 'strength',
    caps: placeCapabilities(place),
    supports: placeSupports(place, movement),
    movement,
    quiet: quietAt(p, location),
    level: EXPERIENCE_LEVEL[p.experience] ?? 0,
    excluded: new Set(p.excludedExercises || []),
    blockedAreas: new Set([...r.pain, ...r.sore, ...recent, ...schedule.muscles]),
    signals: exerciseSignals(state, { now: options.now ?? Date.now(), today, place: location }),
  }
  const pool = MOVEMENTS.filter((m) => {
    const meta = metaOf(m.id)
    return wanted.includes(m.muscle) && !ineligibility(meta, elig) && meta.load !== 'bar' && meta.level === 0
  })
  const items = [],
    used = new Set()
  for (const m of pool.sort(
    (a, b) =>
      Number(a.requirements.length > 0) - Number(b.requirements.length > 0) ||
      Number(metaOf(b.id).staple) - Number(metaOf(a.id).staple) ||
      a.id.localeCompare(b.id),
  )) {
    if (used.has(m.muscle)) continue
    const def = findExercise(m.id)
    const last = lastPerformance(state.workouts, m.id, state.settings.weightUnit)
    const item = {
      exId: m.id,
      sets: 1,
      reps: 10,
      restSec: 60,
      note: 'Use an easy, familiar effort and finish with several comfortable reps left. No failure sets; stop if anything hurts.',
    }
    if (def.type === 'time') {
      delete item.reps
      item.sec = 20
    }
    if (def.weighted)
      item.weight = fitAvailableLoad(
        last ? Math.round(Math.max(...last.sets.map((s) => s.weight || 0)) * 0.7 * 2) / 2 : null,
        availableLoads(p, location),
      )
    if (planSeconds([...items, item]) + 120 <= minutes * 60) {
      items.push(item)
      used.add(m.muscle)
    }
    if (items.length >= 4) break
  }
  if (r.energy !== 'low')
    for (const item of items) {
      if (planSeconds(items) + 100 + 120 <= minutes * 60) item.sets = 2
    }
  const areas = [...new Set(items.map((i) => findExercise(i.exId).muscle.toLowerCase()))]
  return {
    id: `event-focus-${event?.id || today}`,
    kind: 'pump',
    name: trainingTitle(items, { short: true }),
    items,
    location,
    placeName: place.name,
    movement,
    readiness: r,
    lockedTargets: true,
    requestedMinutes: minutes,
    focus: items.length
      ? `A short, easy session for ${areas.join(', ')}.`
      : 'Nothing fits those areas today. Try another area.',
    reasons: [
      'Easy effort. No max lifts.',
      'Sore, painful and recently trained areas stay out.',
      ...(schedule.note ? [schedule.note] : []),
      'Doesn’t change your usual training.',
    ],
    planning: { eventId: event?.id, eventTitle: event?.title, purpose: 'short-focus', date: today },
  }
}
