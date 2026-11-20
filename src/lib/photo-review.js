// Render findings without inventing side, size, strength or confidence measurements.
export function findingCopy(observation, demo = false) {
  const text = observation.observation || ''
  // Sample copy can be revised. Never upgrade the certainty of a saved real reading.
  if (demo) {
    if (
      [
        'The relaxed shoulder outline looks slightly different between sides.',
        'Your shoulders may look slightly uneven.',
      ].includes(text)
    )
      return 'Your shoulders look uneven.'
    if (
      [
        'Upper-back development is a possible area to follow across future check-ins.',
        'Your upper back could be a training priority.',
      ].includes(text)
    )
      return 'Your back looks smaller in proportion to your torso.'
  }
  const known = {
    'The relaxed shoulder outline looks slightly different between sides.':
      'Your shoulders may look slightly uneven.',
    'Upper-back development is a possible area to follow across future check-ins.':
      'Your upper back could be a training priority.',
  }
  return known[text] || text
}
export function findingTrainingCopy(area, focus = []) {
  const group = {
    shoulders: 'shoulder',
    chest: 'chest',
    back: 'back',
    arms: 'arm',
    legs: 'leg',
    glutes: 'glute',
  }[area]
  return group && focus.some((f) => f.area === area)
    ? `Add this focus for a small ${group} emphasis. Your next photo check-in will review it.`
    : 'Your goals and workout feedback guide how Tally adjusts your training.'
}
export function focusAction(area) {
  return (
    {
      shoulders: 'Build shoulder balance',
      back: 'Develop your back',
      chest: 'Develop your chest',
      arms: 'Build arm balance',
      legs: 'Develop your legs',
      glutes: 'Develop your glutes',
      overall: 'Keep whole-body balance',
    }[area] || 'Keep balanced training'
  )
}
export function photoReviewSlides(review) {
  if (!review) return []
  return [
    { kind: 'overview', title: 'Your starting point' },
    ...(review.observations || []).map((o) => ({
      ...o,
      kind: 'finding',
      title: o.area === 'overall' ? 'Overall balance' : o.area.charAt(0).toUpperCase() + o.area.slice(1),
      observation: findingCopy(o, Boolean(review.demo)),
      trainingResponse: findingTrainingCopy(o.area, review.suggestedFocus),
    })),
    { kind: 'plan', title: 'Built into your training', focus: review.suggestedFocus || [] },
    { kind: 'checkins', title: 'Your plan keeps adapting' },
  ]
}
export function conciseSummary(text = '') {
  const first = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()
  return first && text.length > 200 ? first : text
}
