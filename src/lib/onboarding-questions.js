// The words on each onboarding question: the question, and one line on what
// Tally does with the answer. Every "why" line is something the app really
// does (tests/onboarding-questions.test.mjs checks each one is present and
// short), so people always know why they are being asked.

export const QUESTION_COPY = {
  fallout: ['When a plan falls apart, what happens next?', 'Be honest. Most people say the same thing.'],
  goal: ['What do you want most?', 'Every session leans toward it.'],
  physique: ['Which look are you after?', 'Your picture of the goal. Change it any time.'],
  experience: ['How much have you trained?', 'Sets how many sets you start with and which moves you see.'],
  barriers: ['What gets in your way?', 'Pick all that apply. Tally answers each one.'],
  variety: ['Same moves, or new ones?', 'Decides how often Tally brings in exercises you haven’t done.'],
  about: ['What should we call you?', 'Optional. It’s how your plan greets you.'],
  gender: ['How do you describe yourself?', 'Only used to guess your first weights. Your sets take over after.'],
  age: ['Which age group?', 'Keeps photo features safe for under-18s.'],
  sports: ['Do you play a sport?', 'Tally can train around games and practice.'],
  'sport-choice': ['Which sports?', 'Each one gets its own warm-up.'],
  priority: ['What comes first?', 'Decides how hard training gets near a game.'],
  location: ['Where do you usually train?', 'Every move fits the equipment there.'],
  home: ['Do you also train at home?', 'Tally keeps home sessions to what you own.'],
  equipment: ['What’s at home?', 'Home sessions only use what you pick.'],
  'home-loads': ['Which dumbbells do you have?', 'Suggested weights match the sizes you own.'],
  movement: ['What works in your space?', 'Moves fit your floor, room and noise level.'],
  time: ['How long can you usually train?', 'A starting length. Change it before any session.'],
  comfort: ['Any areas to leave out?', 'Tally plans around them. Tap the body to choose.'],
  'photo-choice': ['How should Tally see your start?', 'Photos or a few numbers. Both work.'],
  manual: ['A few details instead', 'Height and weight give your plan a starting point.'],
}

// What usually happens after a plan breaks, said the way people say it.
export const FALLOUT_OPTIONS = [
  ['week', 'I skip the rest of the week'],
  ['restart', 'I start over from scratch'],
  ['stop', 'I stop for a while'],
  ['push', 'I push through, worn out'],
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
