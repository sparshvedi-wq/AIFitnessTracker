import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/storage.js'
import { buildDailyPlan, profileOf, todayChoice, MOVEMENTS } from '../src/lib/planner.js'
import {
  placesOf,
  resolvePlace,
  updatePlace,
  removePlace,
  placeNameError,
  recordPlaceLabel,
  quietAt,
  MAX_PLACES,
} from '../src/lib/places.js'
import { availableLoads } from '../src/lib/preferences.js'
import { movementPreferences } from '../src/lib/movement-preferences.js'
import { convertStateUnits } from '../src/lib/units.js'
import { adaptRoutineItems } from '../src/lib/workout-adjustments.js'
import { buildSession, toWorkoutRecord } from '../src/lib/workout.js'

const today = '2026-10-31'
function withPlaces(patch = {}) {
  const state = defaultState()
  state.settings.training = { ...state.settings.training, completed: true, ...patch }
  return state
}
const hotel = {
  id: 'place-hotel',
  name: 'Hotel',
  type: 'equipment',
  equipment: ['Dumbbells', 'Bench'],
  dumbbells: [5, 10, 15, 20],
}
const office = { id: 'place-office', name: 'Office', type: 'space', movement: { position: 'seated' } }

test('older saves keep exactly the three built-in places and their equipment', () => {
  const p = profileOf(
    withPlaces({ equipment: ['Resistance bands'], homeDumbbells: [10], gymDumbbells: [5, 50] }),
  )
  assert.deepEqual(
    placesOf(p).map((x) => [x.id, x.name, x.base]),
    [
      ['gym', 'Gym', 'gym'],
      ['home', 'Home', 'home'],
      ['on-the-go', 'On the go', 'on-the-go'],
    ],
  )
  assert.deepEqual(resolvePlace(p, 'home').equipment, ['Resistance bands'])
  assert.deepEqual(availableLoads(p, 'gym'), [5, 50])
  assert.deepEqual(availableLoads(p, 'home'), [10])
})

test('a saved place plans only with its own equipment and dumbbells', () => {
  const state = withPlaces({ places: [hotel] })
  const plan = buildDailyPlan(state, { today, location: 'place-hotel' })
  assert.equal(plan.location, 'place-hotel')
  assert.equal(plan.placeName, 'Hotel')
  for (const it of plan.items) {
    const m = MOVEMENTS.find((x) => x.id === it.exId)
    assert.ok(
      m.requirements.every((alts) => alts.some((e) => hotel.equipment.includes(e))),
      it.exId,
    )
  }
  assert.deepEqual(availableLoads(profileOf(state), 'place-hotel'), [5, 10, 15, 20])
})

test('a no-equipment place uses its own space limits, not the On the go ones', () => {
  const p = profileOf(withPlaces({ places: [office], onTheGo: { position: 'standing' } }))
  assert.equal(movementPreferences(p, 'place-office').position, 'seated')
  assert.equal(movementPreferences(p, 'on-the-go').position, 'standing')
  assert.equal(movementPreferences(p, 'place-hotel'), movementPreferences(p, p.location))
  const plan = buildDailyPlan(withPlaces({ places: [office] }), { today, location: 'place-office' })
  assert.ok(plan.items.every((it) => it.exId.startsWith('seated-')))
})

test('a full-gym place offers everything, like the gym', () => {
  const state = withPlaces({ places: [{ id: 'place-work', name: 'Work gym', type: 'gym' }] })
  const work = buildDailyPlan(state, { today, location: 'place-work', minutes: 45 })
  const gym = buildDailyPlan(state, { today, location: 'gym', minutes: 45 })
  assert.deepEqual(
    work.items.map((i) => i.exId),
    gym.items.map((i) => i.exId),
  )
})

test('saved routines adapt to a place that lacks their equipment', () => {
  const state = withPlaces({ places: [office] })
  const { items, changes } = adaptRoutineItems(
    state,
    [{ exId: 'bench-press', sets: 3, reps: 8, weight: 135, restSec: 90 }],
    'place-office',
    { pain: [], sore: [] },
    { today },
  )
  assert.ok(!items.some((i) => i.exId === 'bench-press'))
  assert.ok(changes.length > 0)
})

test('editing and removing places never touches other places or loses history labels', () => {
  let p = profileOf(withPlaces())
  p = updatePlace(p, 'place-hotel', { ...hotel, name: '  Hotel  ' })
  assert.equal(resolvePlace(p, 'place-hotel').name, 'Hotel')
  p = updatePlace(p, 'home', { equipment: ['Kettlebell'], quiet: true })
  assert.deepEqual(p.equipment, ['Kettlebell'])
  assert.equal(p.homeQuiet, true)
  assert.equal(p.quiet, false, 'a quiet home does not make every place quiet')
  assert.equal(quietAt(p, 'home'), true)
  assert.equal(quietAt(p, 'gym'), false)
  p = { ...p, location: 'place-hotel' }
  p = removePlace(p, 'place-hotel')
  assert.equal(p.location, 'gym')
  assert.equal(resolvePlace(p, 'place-hotel').id, 'gym')
  assert.equal(removePlace(p, 'home'), p, 'built-in places cannot be removed')
  assert.equal(recordPlaceLabel({ location: 'place-hotel', placeName: 'Hotel' }), 'Hotel')
  assert.equal(recordPlaceLabel({ location: 'home' }), 'Home')
})

test('place names are required, short and unique, and the list has a limit', () => {
  const p = profileOf(withPlaces({ places: [hotel] }))
  assert.match(placeNameError(p, '  '), /name/)
  assert.match(placeNameError(p, 'hotel'), /already/)
  assert.match(placeNameError(p, 'gym'), /already/)
  assert.equal(placeNameError(p, 'Hotel', 'place-hotel'), '')
  assert.match(placeNameError(p, 'x'.repeat(31)), /30/)
  let many = p
  for (let i = 0; i < 12; i++) many = updatePlace(many, `place-${i}`, { name: `P${i}`, type: 'space' })
  assert.equal(many.places.length, MAX_PLACES)
})

test('home planning uses the usual place when today has no location choice', () => {
  const state = withPlaces({ location: 'home', equipment: ['Resistance bands'] })
  for (const readiness of [
    null,
    { date: today, todayMinutes: 15 },
    { date: '2026-10-30', todayLocation: 'gym' },
    { date: today, todayLocation: null },
    { date: today, todayLocation: '' },
  ]) {
    state.readiness = readiness
    const before = structuredClone(state)
    const choice = todayChoice(state, today)
    assert.equal(choice.location, undefined)
    assert.equal(choice.minutes, readiness?.date === today ? readiness.todayMinutes : undefined)
    const plan = buildDailyPlan(state, { today, ...choice })
    assert.equal(plan.location, 'home')
    assert.ok(plan.items.length > 0)
    assert.deepEqual(state, before)
  }
})

test('a today-only place that was deleted falls back to the usual place', () => {
  const state = withPlaces({ places: [hotel] })
  state.readiness = { date: today, todayLocation: 'place-hotel' }
  assert.equal(todayChoice(state, today).location, 'place-hotel')
  state.settings.training.places = []
  assert.equal(todayChoice(state, today).location, undefined)
})

test('switching units converts each saved place’s dumbbells', () => {
  const state = withPlaces({ places: [hotel] })
  const kg = convertStateUnits(state, 'kg')
  assert.ok(Math.abs(kg.settings.training.places[0].dumbbells[1] - 4.5359237) < 1e-9)
  const back = convertStateUnits(kg, 'lb')
  assert.ok(Math.abs(back.settings.training.places[0].dumbbells[1] - 10) < 1e-9)
})

test('a workout remembers where it happened by name', () => {
  const session = buildSession(
    {
      id: 'r',
      name: 'Push',
      location: 'place-hotel',
      placeName: 'Hotel',
      items: [{ exId: 'push-up', sets: 1, reps: 10 }],
    },
    { now: Date.parse('2026-10-31T12:00:00') },
  )
  const record = toWorkoutRecord({ ...session, phase: 'done' }, [])
  assert.equal(record.location, 'place-hotel')
  assert.equal(record.placeName, 'Hotel')
})

test('invalid saved places from a backup are ignored rather than breaking planning', () => {
  const state = withPlaces({
    places: [{ id: 'gym', name: 'Fake gym', type: 'gym' }, { id: 'x', name: '', type: 'gym' }, { id: 'y' }],
  })
  assert.deepEqual(
    placesOf(profileOf(state)).map((p) => p.id),
    ['gym', 'home', 'on-the-go'],
  )
  assert.ok(buildDailyPlan(state, { today, location: 'y' }).items.length > 0)
})

test('barbell loads break down into plates per side', async () => {
  const { plateBreakdown } = await import('../src/lib/starting-loads.js')
  assert.deepEqual(plateBreakdown(135, 'lb'), { bar: 45, plates: [45], exact: true })
  assert.deepEqual(plateBreakdown(45, 'lb'), { bar: 45, plates: [], exact: true })
  assert.deepEqual(plateBreakdown(100, 'kg'), { bar: 20, plates: [25, 15], exact: true })
  assert.equal(plateBreakdown(137, 'lb').exact, false)
  assert.equal(plateBreakdown(30, 'lb'), null)
})

test('excluded exercises are never suggested and saved routines swap them out', () => {
  const state = withPlaces({ excludedExercises: ['goblet-squat', 'bench-press'] })
  const plan = buildDailyPlan(state, { today, location: 'gym', minutes: 60 })
  assert.ok(!plan.items.some((i) => ['goblet-squat', 'bench-press'].includes(i.exId)))
  const { items, changes } = adaptRoutineItems(
    state,
    [{ exId: 'bench-press', sets: 3, reps: 8, restSec: 90 }],
    'gym',
    { pain: [], sore: [] },
    { today },
  )
  assert.ok(!items.some((i) => i.exId === 'bench-press'))
  assert.match(changes.join(' '), /asked not to have it suggested/)
})

test('the next-time note matches the planner’s progression and listed dumbbells', async () => {
  const { nextTimeNotes } = await import('../src/lib/next-time.js')
  const set = (weight, reps, targetReps = 10) => ({ weight, reps, targetReps, status: 'done', kind: 'work' })
  const workout = {
    kind: 'adaptive',
    location: 'home',
    exercises: [
      { exId: 'bench-press', sets: [set(95, 10), set(95, 10)] },
      { exId: 'goblet-squat', sets: [set(25, 10), set(25, 10)] },
      { exId: 'db-row', sets: [set(20, 8), set(20, 10)] },
    ],
  }
  const p = profileOf(withPlaces({ homeDumbbells: [15, 20, 25], equipment: ['Dumbbells'] }))
  const notes = nextTimeNotes(workout, p, 'lb')
  const by = Object.fromEntries(notes.map((n) => [n.exId, n]))
  assert.equal(by['bench-press'].change, '100 lb')
  assert.match(by['goblet-squat'].why, /isn’t listed/)
  assert.equal(by['db-row'].change, '20 lb')
  assert.match(by['db-row'].why, /aim for all 10 reps/)
  assert.equal(nextTimeNotes({ ...workout, kind: 'sport' }, p, 'lb').length, 0)
})
