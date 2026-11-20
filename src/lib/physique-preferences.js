const LOOKS = [
  ['athletic','Everyday fit'],
  ['balanced','Athletic'],
  ['powerful','Muscular'],
]
export function physiqueOptions() {
  return LOOKS.map(([id,label]) => ({id,label,scene:`physique-${id}`}))
}
export function physiqueChoice(profile) {
  return profile.idealPhysique?.goal === profile.goal &&
    physiqueOptions(profile.goal, profile.ageGroup).some((o) => o.id === profile.idealPhysique?.id)
    ? profile.idealPhysique.id
    : null
}
