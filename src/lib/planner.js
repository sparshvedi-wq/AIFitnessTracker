import { findExercise } from './exercises.js'
import { addDays, shortLabel, todayKey } from './date.js'
import { lastPerformance, suggestTarget } from './workout.js'
import { sportById } from './sports.js'
import { trainingFocus, trainingTitle } from './training-copy.js'
import { quietAt, resolvePlace } from './places.js'
import { availableLoads, fitAvailableLoad, breakDays, DUMBBELL_MOVES } from './preferences.js'
import { sportScheduleContext } from './sport-schedule.js'
import {
  movementAllowed,
  movementPreferences,
  movementSummary,
  DEFAULT_ON_THE_GO,
} from './movement-preferences.js'

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
}
export const DEFAULT_READINESS = {
  energy: 'normal',
  sore: [],
  pain: [],
  intensity: 'moderate',
  sportSoon: false,
}

// Requirements are AND clauses containing alternative pieces of equipment.
export const MOVEMENTS = [
  ['back-squat', 'Legs', 'squat', [['Barbell & rack']], ['Legs', 'Glutes', 'Back']],
  ['goblet-squat', 'Legs', 'squat', [['Dumbbells', 'Kettlebell']], ['Legs', 'Glutes']],
  ['bodyweight-squat', 'Legs', 'squat', [], ['Legs', 'Glutes']],
  ['rdl', 'Legs', 'hinge', [['Barbell & rack']], ['Legs', 'Glutes', 'Back']],
  ['glute-bridge', 'Glutes', 'hinge', [], ['Glutes', 'Legs']],
  ['db-rdl', 'Legs', 'hinge', [['Dumbbells']], ['Legs', 'Glutes', 'Back']],
  ['split-squat', 'Legs', 'single leg', [], ['Legs', 'Glutes']],
  ['bench-press', 'Chest', 'push', [['Barbell & rack'], ['Bench']], ['Chest', 'Shoulders', 'Triceps']],
  ['db-bench', 'Chest', 'push', [['Dumbbells'], ['Bench']], ['Chest', 'Shoulders', 'Triceps']],
  ['push-up', 'Chest', 'push', [], ['Chest', 'Shoulders', 'Triceps', 'Core']],
  ['incline-push-up', 'Chest', 'push', [], ['Chest', 'Shoulders', 'Triceps']],
  ['db-row', 'Back', 'pull', [['Dumbbells'], ['Bench']], ['Back', 'Biceps', 'Shoulders']],
  ['band-row', 'Back', 'pull', [['Resistance bands']], ['Back', 'Biceps', 'Shoulders']],
  ['lat-pulldown', 'Back', 'pull', [['Gym machines']], ['Back', 'Biceps', 'Shoulders']],
  ['pull-up', 'Back', 'pull', [['Pull-up bar']], ['Back', 'Biceps', 'Shoulders']],
  ['prone-w', 'Back', 'upper-back control', [], ['Back', 'Shoulders']],
  ['ohp', 'Shoulders', 'overhead', [['Barbell & rack']], ['Shoulders', 'Triceps']],
  ['lateral-raise', 'Shoulders', 'shoulder accessory', [['Dumbbells']], ['Shoulders']],
  ['db-overhead-press', 'Shoulders', 'overhead', [['Dumbbells']], ['Shoulders', 'Triceps']],
  ['biceps-curl', 'Biceps', 'arm accessory', [['Dumbbells']], ['Biceps']],
  ['triceps-pushdown', 'Triceps', 'arm accessory', [['Gym machines']], ['Triceps']],
  ['calf-raise', 'Legs', 'ankle control', [['Dumbbells', 'Barbell & rack']], ['Legs']],
  ['dead-bug', 'Core', 'core', [], ['Core']],
  ['side-plank', 'Core', 'core', [], ['Core', 'Shoulders']],
  ['standing-w', 'Back', 'upper-back control', [], ['Back', 'Shoulders']],
  ['standing-brace', 'Core', 'core', [], ['Core']],
  ['seated-knee-extension', 'Legs', 'knee control', [], ['Legs']],
  ['seated-heel-raise', 'Legs', 'ankle control', [], ['Legs']],
  ['seated-scapular', 'Back', 'upper-back control', [], ['Back', 'Shoulders']],
  ['seated-reach', 'Shoulders', 'shoulder accessory', [], ['Shoulders']],
  ['seated-brace', 'Core', 'core', [], ['Core']],
].map(([id, muscle, pattern, requirements, uses]) => ({
  id,
  muscle,
  pattern,
  requirements,
  uses,
}))

export function profileOf(state) {
  return { ...DEFAULT_PROFILE, ...state.settings?.training }
}
// `base` is a place's behaviour (see places.js): a gym has everything.
export function availableMovement(m, base, equipment) {
  return (
    base === 'gym' || m.requirements.every((alternatives) => alternatives.some((e) => equipment.includes(e)))
  )
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
export function planSeconds(items) {
  // Include transitions and every prescribed rest. Unilateral reps are per side.
  return items.reduce(
    (sum, it) =>
      sum +
      it.sets * (it.sec || (it.reps || 10) * (it.unilateral ? 6 : 3) + 10) +
      it.sets * (it.restSec || 0) +
      20,
    0,
  )
}

export function carryCandidates(workouts, today) {
  const recent = workouts.filter((w) => !w.sample && w.date >= addDays(today, -7) && w.date <= today)
  const resolved = new Set(recent.flatMap((w) => w.planning?.carriedFrom || []))
  return recent
    .flatMap((w) =>
      (w.unfinished || [])
        .filter((u) => u.reason === 'time' && !u.carried)
        .map((u) => ({ ...u, source: `${w.id}:${u.exId}` })),
    )
    .filter(
      (u) =>
        !resolved.has(u.source) &&
        !recent.some(
          (w) => w.exercises.some((e) => e.exId === u.exId && e.sets.length) && w.startedAt > (u.at || 0),
        ),
    )
}

export function buildDailyPlan(state, options = {}) {
  const today = options.today || todayKey()
  const p = { ...profileOf(state), ...options.profile }
  const r = { ...readinessOf(state, today), ...options.readiness }
  r.pain = [...new Set([...(p.avoidMuscles || []), ...r.pain])]
  const shortSession = Boolean(options.shortSession)
  const easeInSeconds = shortSession ? 90 : 180
  const minutes = Math.min(
    shortSession ? 15 : 90,
    Math.max(shortSession ? 5 : 10, Number(options.minutes || p.minutes) || 30),
  )
  const place = resolvePlace(p, options.location || p.location)
  const location = place.id
  const equipment = place.equipment
  const quiet = quietAt(p, location)
  const movement = movementPreferences(p, location, options.movement)
  const schedule = sportScheduleContext(p, { today, now: options.now ?? Date.now(), minutes })
  const history = (state.workouts || []).filter(
    (w) => !w.sample && w.date <= today && w.kind !== 'sport' && w.kind !== 'recovery' && w.kind !== 'pump',
  )
  const week = history.filter((w) => w.date >= addDays(today, -6))
  const recent = history.filter((w) => w.date >= addDays(today, -1))
  const tough = [...history].reverse().find((w) => w.date >= addDays(today, -3) && w.effort >= 4)
  const away = breakDays(history, today)
  const returning = away >= 7
  const easy =
    r.energy === 'low' ||
    r.intensity === 'easy' ||
    Boolean(tough) ||
    returning ||
    r.sportSoon ||
    schedule.lighter
  const highEffort = r.intensity === 'challenging' && r.energy === 'high' && !easy
  const volume = Object.fromEntries(MOVEMENTS.map((m) => [m.muscle, 0]))
  week.forEach((w) =>
    w.exercises.forEach((e) => {
      volume[e.muscle] = (volume[e.muscle] || 0) + e.sets.filter((s) => s.kind !== 'warmup').length
    }),
  )
  const recentMuscles = new Set(
    recent.flatMap((w) =>
      w.exercises.filter((e) => e.sets.filter((s) => s.kind !== 'warmup').length >= 2).map((e) => e.muscle),
    ),
  )
  state.workouts
    .filter((w) => !w.sample && w.kind === 'pump' && w.date >= addDays(today, -1) && w.date <= today)
    .forEach((w) => w.exercises.filter((e) => e.sets?.length).forEach((e) => recentMuscles.add(e.muscle)))
  const confirmed = state.checkins?.find(
    (c) => !c.synthetic && !c.sample && c.id === p.focusCheckinId && c.date >= addDays(today, -42),
  )
  const manualFocus = p.baselineMode === 'manual' ? p.manualBaseline?.focusAreas || [] : []
  const focus = !state.settings?.display?.metricLight
    ? [...new Set([...manualFocus, ...(confirmed && p.ageGroup === '18+' ? p.confirmedFocus : [])])]
    : []
  const areaMap = {
    arms: ['Biceps', 'Triceps'],
    shoulders: ['Shoulders'],
    chest: ['Chest'],
    back: ['Back'],
    legs: ['Legs'],
    glutes: ['Glutes'],
    overall: [],
  }
  const focusMuscles = focus.flatMap((f) => areaMap[f] || [])
  const sportMuscles = [
    ...new Set([
      ...p.sports.flatMap((id) => sportById(id).muscles),
      ...(schedule.preparation ? sportById(schedule.preparation.sport).muscles : []),
    ]),
  ]
  const carries = carryCandidates(history, today)
  const repeatedSkips = Object.fromEntries(
    MOVEMENTS.map((m) => [
      m.id,
      week.filter((w) =>
        w.unfinished?.some((u) => u.exId === m.id && ['dislike', 'equipment'].includes(u.reason)),
      ).length,
    ]),
  )
  const flagged = history
    .filter((w) => w.date >= addDays(today, -2))
    .flatMap((w) => w.unfinished || [])
    .filter((u) => ['pain', 'soreness'].includes(u.reason))
  const flaggedParts = new Set(flagged.flatMap((u) => MOVEMENTS.find((m) => m.id === u.exId)?.uses || []))
  const excluded = new Set(p.excludedExercises || [])
  const all = MOVEMENTS.filter((m) => !excluded.has(m.id) && availableMovement(m, place.base, equipment))
    .filter(
      (m) =>
        movementAllowed(m.id, movement) &&
        (m.id.startsWith('seated-') ? movement?.position === 'seated' : true),
    )
    .filter(
      (m) =>
        !p.replacements?.[m.id] ||
        !MOVEMENTS.some(
          (other) =>
            other.id === p.replacements[m.id] &&
            availableMovement(other, place.base, equipment) &&
            movementAllowed(other.id, movement) &&
            !other.uses.some(
              (part) =>
                r.pain.includes(part) ||
                r.sore.includes(part) ||
                recentMuscles.has(part) ||
                flaggedParts.has(part),
            ),
        ),
    )
    .filter(
      (m) =>
        !m.uses.some(
          (part) =>
            r.pain.includes(part) ||
            r.sore.includes(part) ||
            recentMuscles.has(part) ||
            flaggedParts.has(part),
        ),
    )
    .filter(
      (m) =>
        !(
          p.experience === 'Starting out' &&
          ['back-squat', 'rdl', 'db-rdl', 'pull-up', 'ohp', 'db-overhead-press'].includes(m.id)
        ),
    )
  const scored = all
    .map((m, index) => ({
      ...m,
      score:
        20 -
        (Object.values(p.replacements || {}).includes(m.id) ? -12 : 0) -
        (volume[m.muscle] || 0) * 2 +
        (schedule.muscles.includes(m.muscle) ? -12 : 0) +
        (focusMuscles.includes(m.muscle) ? 8 : 0) +
        (sportMuscles.includes(m.muscle)
          ? p.sportPriority === 'sport'
            ? 9
            : p.sportPriority === 'balanced'
              ? 4
              : 0
          : 0) +
        (schedule.preparation &&
        sportById(schedule.preparation.sport).muscles.includes(m.muscle) &&
        !schedule.muscles.includes(m.muscle)
          ? 5
          : 0) +
        (carries.some((c) => c.exId === m.id) ? 3 : 0) -
        repeatedSkips[m.id] * 10 +
        (place.base === 'gym' && m.requirements.length ? 1 : 0) -
        index * 0.015,
    }))
    .sort((a, b) => b.score - a.score)
  const selected = []
  const used = new Set()
  const muscleCount = {}
  const region = (muscle) =>
    ['Legs', 'Glutes'].includes(muscle) ? 'lower' : muscle === 'Core' ? 'core' : 'upper'
  // Choose different areas before considering a second exercise for any one area.
  scored.sort((a, b) => b.score - a.score)
  // Keep movement variety; a focus is an emphasis, never a whole session of one part.
  for (const m of scored) {
    if (used.has(m.pattern) || (muscleCount[m.muscle] || 0) >= 1) continue
    // A short balanced session should not spend both available slots on
    // quads/glutes while compatible upper-body work is available (or vice versa).
    if (selected.length === 1) {
      const firstRegion = region(findExercise(selected[0].exId).muscle)
      const opposite = firstRegion === 'lower' ? 'upper' : firstRegion === 'upper' ? 'lower' : null
      if (
        opposite &&
        region(m.muscle) !== opposite &&
        scored.some((other) => region(other.muscle) === opposite && !used.has(other.pattern))
      )
        continue
    }
    const def = findExercise(m.id)
    if (!def) continue
    const unilateral = ['db-row', 'split-squat', 'biceps-curl', 'seated-knee-extension'].includes(m.id)
    const item = {
      exId: m.id,
      sets: 1,
      reps: p.goal === 'Get stronger' && !easy && def.weighted ? 6 : easy ? 8 : 10,
      restSec:
        shortSession && easy ? 45 : p.goal === 'Get stronger' && !easy && def.weighted ? 120 : easy ? 75 : 90,
      unilateral,
    }
    if (def.type === 'time') {
      delete item.reps
      item.sec = easy ? 20 : 30
    }
    const last = lastPerformance(
      history.filter((w) => !w.unit || w.unit === state.settings.weightUnit),
      m.id,
    )
    const proposed = suggestTarget(def, item, last, state.settings.weightUnit)
    if (last && !def.weighted && !easy && def.type === 'reps')
      item.reps = Math.min(15, proposed.target.reps || item.reps)
    // Keep targets inside a useful range; tired days never get an increase.
    if (last && def.weighted)
      item.weight = easy
        ? Math.round(Math.max(...last.sets.map((s) => s.weight || 0)) * 0.85 * 2) / 2
        : proposed.target.weight
    if (def.weighted && DUMBBELL_MOVES.includes(m.id)) {
      item.weight = fitAvailableLoad(item.weight, availableLoads(p, location))
    }
    const side =
      p.sideTestConfirmed &&
      !state.settings?.display?.metricLight &&
      p.sideTestDate >= addDays(today, -42) &&
      p.ageGroup === '18+' &&
      !easy &&
      p.sideExercise === m.id &&
      ['db-row', 'biceps-curl', 'split-squat'].includes(m.id) &&
      new Date(today + 'T12:00:00').getDate() % 2 === 0
        ? p.weakerSide
        : ''
    const cause = focusMuscles.includes(m.muscle)
      ? manualFocus.length
        ? 'Your chosen focus.'
        : 'Your photo focus.'
      : sportMuscles.includes(m.muscle) && p.sports.length
        ? 'Supports your sport.'
        : `Balances your ${m.muscle.toLowerCase()} training.`
    item.note = `${cause}${returning ? ' Lighter restart; adjust to how you feel.' : ''}${quiet ? ' Quiet: no jumping.' : ''}${unilateral ? ' Reps per side; weaker side first.' : ''}${m.id === 'biceps-curl' ? ' One dumbbell at a time.' : ''}${side ? ` Last set: one extra ${side}-side rep if it feels fine.` : ''}`
    item.sideExtra = side ? { side, reps: 1, lastSetOnly: true } : null
    if (planSeconds([...selected, item]) + easeInSeconds <= minutes * 60) {
      selected.push(item)
      used.add(m.pattern)
      muscleCount[m.muscle] = (muscleCount[m.muscle] || 0) + 1
    }
    if (selected.length >= Math.min(shortSession ? 3 : 6, Math.max(2, Math.floor(minutes / 7)))) break
  }
  // Extra time buys quality sets; never rush rests or create an unlimited backlog.
  const cap = shortSession || easy || p.experience === 'Starting out' ? 2 : highEffort ? 4 : 3
  for (let round = 1; round < cap; round++) {
    selected.forEach((item) => {
      if (schedule.muscles.includes(findExercise(item.exId).muscle) && item.sets >= 1) return
      if (
        planSeconds(selected) +
          (item.sec || (item.reps || 10) * (item.unilateral ? 6 : 3) + 10) +
          item.restSec +
          easeInSeconds <=
        minutes * 60
      )
        item.sets++
    })
  }
  const reasons = [
    ...(schedule.note ? [schedule.note] : []),
    ...(movement
      ? [
          movementSummary(movement),
          ...(movement.position === 'seated' ? ['Seated moves on a stable chair.'] : []),
        ]
      : []),
    ...(returning ? [`Last strength session ${away} days ago, so a lighter restart.`] : []),
    ...(quiet ? ['Quiet: no jumps or impact.'] : []),
    `Fits ${minutes} minutes, with time to ease in and rest.`,
    ...(shortSession ? ['A short option. Nothing to make up later.'] : []),
    p.goal === 'Sport performance'
      ? 'Sport preparation with balanced strength work.'
      : `${p.goal}, sized for ${p.experience.toLowerCase()}.`,
    ...(p.sports.length
      ? [
          `${p.sportPriority === 'sport' ? 'Sport first' : p.sportPriority === 'goal' ? 'Goal first' : 'Sport and goal shared'}: ${p.sports.map((id) => sportById(id).name).join(', ')}.`,
        ]
      : []),
    ...(focus.length
      ? [manualFocus.length ? 'Your chosen focus gets priority.' : 'Your photo focus gets priority.']
      : []),
    ...(r.sore.length ? [`Resting ${r.sore.join(', ').toLowerCase()}.`] : []),
    ...(r.pain.length ? [`Avoiding ${r.pain.join(', ').toLowerCase()}. Stop if anything hurts.`] : []),
    ...(recentMuscles.size ? ['Recently trained areas get a rest.'] : []),
    ...(tough ? ['Last session felt very hard, so this one is lighter.'] : []),
    ...(r.sportSoon ? ['Light, with sport coming up.'] : []),
    ...(flaggedParts.size ? ['Moves you skipped for pain or soreness stay out for now.'] : []),
    ...(place.base !== 'gym' && !equipment.length ? ['Bodyweight only.'] : []),
  ]
  const carried = carries.filter((c) => selected.some((it) => it.exId === c.exId)).slice(0, 1)
  if (carried.length) reasons.push('One move you didn’t have time for last time comes first.')
  return {
    id: `daily-${today}`,
    kind: 'adaptive',
    name: trainingTitle(selected, { short: shortSession }),
    focus: returning
      ? 'A lighter restart. Build back at your own pace.'
      : schedule.note ||
        (movement?.position === 'seated'
          ? 'Light seated movement, at your own pace.'
          : trainingFocus({
              items: selected,
              readiness: r,
              recentMuscles,
              sports: p.sports,
              sportPriority: p.sportPriority,
              focus,
              easy,
              firstSession: !state.workouts.some((w) => !w.sample && !['sport', 'recovery'].includes(w.kind)),
            })),
    items: selected,
    requestedMinutes: minutes,
    estimatedSeconds: planSeconds(selected) + easeInSeconds,
    lockedTargets: true,
    location,
    placeName: place.name,
    readiness: r,
    movement,
    schedule: {
      next: schedule.next,
      lighter: schedule.lighter,
      muscles: schedule.muscles,
      overlap: Boolean(schedule.overlap),
      preparation: schedule.preparation,
      reasonEvent: schedule.reasonEvent,
      reasonPhase: schedule.reasonPhase,
    },
    reasons,
    planning: {
      carriedFrom: carried.map((c) => c.source),
      profileGoal: p.goal,
      date: today,
      shortSession,
    },
  }
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
  const pool = MOVEMENTS.filter(
    (m) =>
      wanted.includes(m.muscle) &&
      !m.uses.some(
        (part) =>
          r.pain.includes(part) ||
          r.sore.includes(part) ||
          recent.includes(part) ||
          schedule.muscles.includes(part),
      ) &&
      availableMovement(m, place.base, place.equipment) &&
      !(p.excludedExercises || []).includes(m.id) &&
      movementAllowed(m.id, movement) &&
      !['back-squat', 'rdl', 'db-rdl', 'pull-up', 'ohp', 'db-overhead-press', 'bench-press'].includes(m.id),
  )
  const items = [],
    used = new Set()
  for (const m of pool.sort(
    (a, b) => Number(a.requirements.length > 0) - Number(b.requirements.length > 0),
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
