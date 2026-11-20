const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const ALIASES = {
  db: 'dumbbell',
  bb: 'barbell',
  ohp: 'overhead press',
  pecs: 'chest',
  quads: 'legs',
  hamstrings: 'legs',
  abs: 'core',
  lat: 'back',
}
export function matchesExercise(exercise, query) {
  const haystack = normalize(
    [
      exercise.name,
      exercise.id,
      exercise.muscle,
      ...(exercise.aliases || []),
      exercise.type === 'time' ? 'timed' : exercise.weighted ? 'weighted' : 'bodyweight',
      ...(exercise.uses || []),
    ].join(' '),
  )
  return normalize(query)
    .split(' ')
    .filter(Boolean)
    .every((word) => haystack.includes(ALIASES[word] || word))
}
