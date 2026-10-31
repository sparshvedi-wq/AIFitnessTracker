// Where someone trains. Three places always exist (Gym, Home, On the go) and
// people can save their own: a hotel, an office, a parent's garage.
//
// Every place has a type that decides how planning treats it:
//   gym        everything a gym has; optionally the dumbbell sizes there
//   equipment  only the equipment listed (Home works this way)
//   space      no equipment; space and position preferences decide the moves
//
// The built-in places keep their original profile fields (`equipment`,
// `homeDumbbells`, `gymDumbbells`, `onTheGo`), so older saves need no
// migration. Saved places live in `profile.places`. `profile.quiet` means quiet
// training everywhere; each place can also be quiet on its own.
import { uid } from './id.js'

export const PLACE_TYPES = [
  ['gym', 'Full gym', 'Machines, racks and free weights'],
  ['equipment', 'My gear', 'Only what you list'],
  ['space', 'Bodyweight', 'No equipment; fits the space'],
]
export const MAX_PLACES = 8
export const MAX_PLACE_NAME = 30
const BUILT_IN = ['gym', 'home', 'on-the-go']
// The planner's three behaviours, which every place maps onto.
const BASE = { gym: 'gym', equipment: 'home', space: 'on-the-go' }

export const isBuiltInPlace = (id) => BUILT_IN.includes(id)

function builtIn(profile, id) {
  if (id === 'gym')
    return {
      id,
      name: 'Gym',
      type: 'gym',
      equipment: [],
      dumbbells: profile.gymDumbbells || [],
      quiet: false,
    }
  if (id === 'home')
    return {
      id,
      name: 'Home',
      type: 'equipment',
      equipment: profile.equipment || [],
      dumbbells: profile.homeDumbbells || [],
      quiet: Boolean(profile.homeQuiet),
    }
  return {
    id: 'on-the-go',
    name: 'On the go',
    type: 'space',
    equipment: [],
    dumbbells: [],
    movement: profile.onTheGo,
    quiet: false,
  }
}

function complete(place) {
  return {
    equipment: [],
    dumbbells: [],
    quiet: false,
    ...place,
    builtIn: isBuiltInPlace(place.id),
    base: BASE[place.type] || 'home',
  }
}

/** Every place, built-in first, then saved places in the order they were added. */
export function placesOf(profile = {}) {
  return [
    ...BUILT_IN.map((id) => complete(builtIn(profile, id))),
    ...(profile.places || []).filter(validPlace).map(complete),
  ]
}

/**
 * The place with this id. A place that no longer exists (deleted, or from
 * another device's backup) falls back to the usual place, then the gym.
 */
export function resolvePlace(profile = {}, id) {
  const all = placesOf(profile)
  return all.find((p) => p.id === id) || all.find((p) => p.id === profile.location) || all[0]
}

export function placeLabel(profile, id) {
  return resolvePlace(profile, id).name
}

/** The name to show for a saved workout, even if its place was later deleted. */
export function recordPlaceLabel(workout) {
  if (workout.placeName) return workout.placeName
  return { gym: 'Gym', home: 'Home', 'on-the-go': 'On the go' }[workout.location] || ''
}

/** A short line describing what a place offers. */
export function placeSummary(place) {
  if (place.type === 'gym')
    return place.dumbbells.length
      ? `Full gym · dumbbells to ${Math.max(...place.dumbbells)}`
      : 'Full gym equipment'
  if (place.type === 'space') {
    const m = place.movement || {}
    const fit =
      m.position === 'seated'
        ? 'seated'
        : m.space === 'small'
          ? 'small space'
          : m.position === 'standing'
            ? 'standing'
            : 'your space'
    return `Bodyweight · ${fit}${place.quiet ? ' · quiet' : ''}`
  }
  const listed = place.equipment.join(' · ') || 'Bodyweight'
  return place.quiet ? `${listed} · quiet` : listed
}

/** A saved place's fields only; anything else in the object is ignored. */
function validPlace(place) {
  return (
    place &&
    typeof place.id === 'string' &&
    !isBuiltInPlace(place.id) &&
    typeof place.name === 'string' &&
    place.name.trim() &&
    BASE[place.type]
  )
}

export function placeNameError(profile, name, id = null) {
  const clean = name.trim()
  if (!clean) return 'Give this place a name.'
  if (clean.length > MAX_PLACE_NAME) return `Keep the name to ${MAX_PLACE_NAME} characters.`
  const taken = placesOf(profile).some((p) => p.id !== id && p.name.toLowerCase() === clean.toLowerCase())
  return taken ? 'You already have a place with this name.' : ''
}

export function newPlace(type = 'equipment') {
  return { id: `place-${uid()}`, name: '', type, equipment: [], dumbbells: [], quiet: false }
}

/**
 * Returns the profile with one place changed. Built-in places write back to
 * their original fields; saved places are replaced in `places`.
 */
export function updatePlace(profile, id, patch) {
  if (id === 'gym') return 'dumbbells' in patch ? { ...profile, gymDumbbells: patch.dumbbells } : profile
  if (id === 'home')
    return {
      ...profile,
      ...('equipment' in patch ? { equipment: patch.equipment } : {}),
      ...('dumbbells' in patch ? { homeDumbbells: patch.dumbbells } : {}),
      ...('quiet' in patch ? { homeQuiet: patch.quiet } : {}),
    }
  if (id === 'on-the-go') return 'movement' in patch ? { ...profile, onTheGo: patch.movement } : profile
  const places = profile.places || []
  const exists = places.some((p) => p.id === id)
  const clean = (p) => ({
    id: p.id,
    name: p.name.trim().slice(0, MAX_PLACE_NAME),
    type: p.type,
    equipment: p.type === 'equipment' ? p.equipment || [] : [],
    dumbbells: p.type === 'space' ? [] : p.dumbbells || [],
    ...(p.type === 'space' ? { movement: p.movement } : {}),
    quiet: p.type === 'gym' ? false : Boolean(p.quiet),
  })
  return {
    ...profile,
    places: exists
      ? places.map((p) => (p.id === id ? clean({ ...p, ...patch }) : p))
      : [...places, clean({ ...newPlace(patch.type), ...patch, id })].slice(0, MAX_PLACES),
  }
}

/** Removes a saved place. Anything that pointed at it moves back to the gym or home. */
export function removePlace(profile, id) {
  if (isBuiltInPlace(id)) return profile
  const fallback = profile.location === id ? 'gym' : profile.location
  return { ...profile, location: fallback, places: (profile.places || []).filter((p) => p.id !== id) }
}

/** Quiet training applies everywhere when set in comfort settings, or at one place. */
export function quietAt(profile, id) {
  return Boolean(profile.quiet) || resolvePlace(profile, id).quiet
}
