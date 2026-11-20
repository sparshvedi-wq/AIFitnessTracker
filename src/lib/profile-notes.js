// Local preference recognition only. Never infer weakness, pain or a weaker side.
const TERMS = {
  shoulders: /\bshoulders?\b/i,
  chest: /\b(chest|pecs?)\b/i,
  // "Back" as a body area, not "get back into", "back to" or "come back".
  back: /\b(lats?|(upper|lower|mid|my|the|your)\s+back)\b|\bback\b(?=\s*(and|,|&|\/|muscles?|width|thickness|development|focus|$))/i,
  arms: /\b(arms?|biceps?|triceps?)\b/i,
  legs: /\b(legs?|quads?|calves|hamstrings?)\b/i,
  glutes: /\b(glutes?|hips?)\b/i,
}
// Negation, pain, limits or caution: the note stays a note, never a focus.
const CAUTION =
  /\b(no|not|never|don[’']?t|avoid\w*|pain\w*|hurt\w*|injur\w*|sore\w*|ach\w*|tight\w*|stiff\w*|weak\w*|bad|surgery|rehab\w*|careful\w*|strain\w*|sprain\w*|tender|torn|tear|issues?|problems?)\b/i
export function noteFocusSuggestions(text = '') {
  if (CAUTION.test(text)) return []
  return Object.entries(TERMS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([area]) => area)
}
