import { findExercise } from './exercises.js'
import { sportById } from './sports.js'

// Describe actual planning inputs without inventing symptoms from photos.
export function trainingFocus({
  items,
  readiness,
  recentMuscles,
  sports = [],
  sportPriority,
  focus = [],
  focusSource,
  easy,
  firstSession = false,
}) {
  if (!items.length) return 'Your recent training and recovery suggest taking a break today.'
  const muscles = items.map((it) => findExercise(it.exId)?.muscle)
  const upperOnly = muscles.every((m) => !['Legs', 'Glutes'].includes(m))
  if (upperOnly && [...readiness.sore, ...readiness.pain].includes('Legs')) {
    return 'We’ll give your legs a break and focus on upper body today.'
  }
  if (upperOnly && recentMuscles.has('Legs'))
    return 'Your legs worked recently, so today gives upper body some attention.'
  if (readiness.sore.length || readiness.pain.length)
    return 'Giving your sore or uncomfortable areas a break, while keeping the rest balanced.'
  if (easy) return 'A lighter session today, with balanced work and room to recover.'
  if (sports.length) {
    const name = sportById(sports[0]).name.toLowerCase()
    return sportPriority === 'sport'
      ? `Building a balanced base for ${name}.`
      : `Overall muscle balance, with a little extra support for ${name}.`
  }
  if (focus.length)
    return focusSource === 'photo'
      ? 'Balanced training, with a small photo-based emphasis.'
      : 'Balanced work, with extra attention to the areas you chose.'
  // The first session explains itself on its own screen in the player.
  if (firstSession) return ''
  if (recentMuscles.size && muscles.every((m) => !recentMuscles.has(m)))
    return 'Areas you haven’t trained in the last couple of days.'
  return 'Balanced work across your main muscle groups.'
}

const UPPER_PUSH = ['Chest', 'Shoulders', 'Triceps']
const UPPER_PULL = ['Back', 'Biceps']
const LOWER = ['Legs', 'Glutes']

// A plain name from what the session contains: "Lower body", "Push", "Full body".
export function trainingTitle(items, { short = false } = {}) {
  const muscles = new Set(items.map((it) => findExercise(it.exId)?.muscle).filter(Boolean))
  const has = (group) => group.some((m) => muscles.has(m))
  const push = has(UPPER_PUSH),
    pull = has(UPPER_PULL),
    lower = has(LOWER)
  const title = !items.length
    ? 'Rest day'
    : items.every((it) => it.exId.startsWith('seated-'))
      ? 'Seated movement'
      : lower && (push || pull)
        ? 'Full body'
        : lower
          ? 'Lower body'
          : push && pull
            ? 'Upper body'
            : push
              ? 'Push'
              : pull
                ? 'Pull'
                : muscles.has('Mobility')
                  ? 'Mobility'
                  : 'Core & conditioning'
  return short && items.length ? `Quick ${title.toLowerCase()}` : title
}
