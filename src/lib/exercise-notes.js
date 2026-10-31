// Exercise notes can differ by place: seat height at the gym, band colour at
// home. A note saved before places existed still shows everywhere.

export const noteKey = (exId, location) => (location ? `${location}:${exId}` : exId)

export function exerciseNote(notes = {}, exId, location) {
  return (location && notes[noteKey(exId, location)]) || notes[exId] || ''
}

export function withExerciseNote(notes = {}, exId, location, text) {
  const key = noteKey(exId, location)
  const next = { ...notes }
  if (text.trim()) next[key] = text.trim()
  else {
    // Clearing removes the note that was showing, which may be the shared one.
    if (!next[key]) delete next[exId]
    delete next[key]
  }
  return next
}

// "at the gym", "at home", "on the go", "at Hotel".
export function atPlace(name) {
  if (!name) return ''
  if (name === 'Gym') return 'at the gym'
  if (name === 'Home') return 'at home'
  if (name === 'On the go') return 'on the go'
  return `at ${name}`
}
