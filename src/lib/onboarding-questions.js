// The words on each onboarding question: the question, and at most a few
// words of help when the answer needs it. Kept short on purpose; the demos
// show what Tally does, so the questions don't have to explain it.

export const QUESTION_COPY = {
  fallout: ['When a plan breaks, then what?', null],
  goal: ['What do you want most?', null],
  physique: ['Which look are you after?', null],
  experience: ['How much have you trained?', null],
  barriers: ['What gets in your way?', 'Pick all that apply'],
  variety: ['Same moves, or new ones?', null],
  about: ['What should we call you?', 'Optional'],
  gender: ['How do you describe yourself?', null],
  age: ['How old are you?', null],
  sports: ['Do you play a sport?', null],
  'sport-choice': ['Which sports?', null],
  priority: ['What comes first?', null],
  location: ['Where do you train?', null],
  home: ['Train at home too?', null],
  equipment: ['What’s at home?', null],
  'home-loads': ['Which dumbbells?', null],
  movement: ['What works in your space?', null],
  time: ['How long usually works?', null],
  comfort: ['Any areas to avoid?', 'Tap the body'],
  'photo-choice': ['How would you like to start?', null],
  manual: ['A few details', null],
}

// What usually happens after a plan breaks, said the way people say it.
export const FALLOUT_OPTIONS = [
  ['week', 'I skip the week'],
  ['restart', 'I start over'],
  ['stop', 'I stop for a while'],
  ['push', 'I push on, worn out'],
]
/** Their answer, as one step of the restart loop. */
export const falloutStep = (id) =>
  ({ week: 'Skip the week', restart: 'Start over', stop: 'Stop for a while', push: 'Push on, worn out' })[id] ||
  'Fall behind'

export const EXPERIENCE_OPTIONS = [
  ['Starting out', 'New or coming back', 'Fewer sets, simple moves'],
  ['Some experience', 'I know the basics', 'A full session'],
  ['Experienced', 'I train regularly', 'More sets, harder moves'],
]
export const VARIETY_OPTIONS = [
  ['familiar', 'Keep it familiar', 'Mostly the same moves'],
  ['balanced', 'A mix of both', 'A new move now and then'],
  ['more', 'Keep it fresh', 'New moves more often'],
]
export const TIME_OPTIONS = [15, 30, 45, 60]

// Implementation intentions: deciding when you will exercise. In Milne,
// Orbell and Sheeran (2002, British Journal of Health Psychology 7, 163–184),
// 91% of people who wrote down when and where they would exercise did so in
// the following week, against 38% of a comparison group. Check the figures
// against the paper again before a public release.
export const PLAN_STUDY = {
  planned: 91,
  others: 38,
  source: 'Milne, Orbell & Sheeran, 2002',
}
