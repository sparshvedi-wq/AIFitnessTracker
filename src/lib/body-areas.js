// Broad planning groups, not a diagnosis or a left/right strength assessment.
export const BODY_AREAS = ['Shoulders', 'Chest', 'Biceps', 'Triceps', 'Core', 'Back', 'Glutes', 'Legs']
export function toggleBodyArea(selected, area) {
  if (!BODY_AREAS.includes(area)) return selected
  return selected.includes(area) ? selected.filter((v) => v !== area) : [...selected, area]
}
