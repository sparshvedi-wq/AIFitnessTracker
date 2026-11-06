// Presentation only: never infer strength, diagnosis or fat percentage from photos.
export function photoReviewSlides(review) {
  if (!review) return []
  return [
    { kind: 'overview', title: 'Your starting point', text: review.summary },
    ...(review.observations || []).map((o) => ({
      kind: 'finding',
      title: o.area === 'overall' ? 'Overall balance' : o.area.charAt(0).toUpperCase() + o.area.slice(1),
      ...o,
    })),
    { kind: 'plan', title: 'Your training focus', focus: review.suggestedFocus || [] },
  ]
}
export function conciseSummary(text = '') {
  const first = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()
  return first && text.length > 200 ? first : text
}
