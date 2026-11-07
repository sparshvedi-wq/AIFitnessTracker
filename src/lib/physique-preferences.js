const LOOKS = {
  'Build muscle': [
    ['athletic', 'Lean & athletic'],
    ['balanced', 'Balanced muscle'],
    ['powerful', 'Solid build'],
  ],
  'Get stronger': [
    ['athletic', 'Athletic strength'],
    ['balanced', 'All-round strength'],
    ['powerful', 'Powerful build'],
  ],
  'Lose weight': [
    ['athletic', 'Active build'],
    ['balanced', 'Athletic build'],
    ['powerful', 'Strong build'],
  ],
  'General fitness': [
    ['athletic', 'Everyday fit'],
    ['balanced', 'Sport-ready'],
    ['powerful', 'Strong & active'],
  ],
}
export function physiqueOptions(goal, ageGroup) {
  const options = ageGroup === '13-17' ? LOOKS['General fitness'] : LOOKS[goal] || LOOKS['General fitness']
  return options.map(([id, label]) => ({ id, label, scene: `physique-${id}` }))
}
export function physiqueChoice(profile) {
  return profile.idealPhysique?.goal === profile.goal &&
    physiqueOptions(profile.goal, profile.ageGroup).some((o) => o.id === profile.idealPhysique?.id)
    ? profile.idealPhysique.id
    : null
}
