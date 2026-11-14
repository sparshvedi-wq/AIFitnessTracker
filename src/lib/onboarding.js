export const ONBOARDING_VERSION = 2
export function onboardingSteps(p) {
  return [
    'welcome',
    'goal',
    'goal-demo',
    'physique',
    'experience',
    'barriers',
    'why-demo',
    'barrier-demo',
    'variety',
    'about',
    'gender',
    'age',
    'sports',
    ...(p.wantsSport || p.sports.length ? ['sport-choice', 'priority'] : []),
    ...(p.sports.length ? ['sport-demo'] : []),
    'location',
    ...(p.location === 'home' ? [] : ['home']),
    ...(p.hasHomeSetup || p.location === 'home' ? ['equipment'] : []),
    ...((p.hasHomeSetup || p.location === 'home') && p.equipment?.includes('Dumbbells')
      ? ['home-loads']
      : []),
    ...(p.location === 'on-the-go' ? ['movement'] : []),
    'equipment-demo',
    'time',
    'time-demo',
    'rhythm',
    'consistency-demo',
    'planning-demo',
    'comfort',
    'recovery-demo',
    'commit',
    'photos',
    ...(p.baselineMode === 'manual' ? ['manual'] : []),
    'building-demo',
    'review',
    'offer',
  ]
}
// Five internal chapters keep progress stable across conditional branches.
// Interactive demonstrations follow decisions; the plan precedes the offer.
const CHAPTERS = [
  [
    'welcome',
    'goal',
    'goal-demo',
    'physique',
    'experience',
    'barriers',
    'why-demo',
    'barrier-demo',
    'variety',
    'about',
    'gender',
    'age',
  ],
  ['sports', 'sport-choice', 'priority', 'sport-demo'],
  ['location', 'home', 'equipment', 'home-loads', 'movement', 'equipment-demo'],
  ['time', 'time-demo', 'rhythm', 'consistency-demo', 'planning-demo', 'comfort', 'recovery-demo', 'commit'],
  ['photos', 'manual', 'building-demo', 'review', 'offer'],
]
const CHAPTER_LABELS = ['About you', 'Sport', 'Your setup', 'Your day', 'Your body']
export function onboardingStage(step) {
  const index = Math.max(
    0,
    CHAPTERS.findIndex((group) => group.includes(step)),
  )
  return { index, label: CHAPTER_LABELS[index], total: CHAPTERS.length }
}
/**
 * How full each chapter's segment of the progress bar is (0–1). Earlier
 * chapters are full, later ones empty; the current one fills as its own
 * questions are answered and completes on its recap (`done`).
 */
export function chapterFills(step, p, done = false) {
  const steps = onboardingSteps(p).filter((s) => s !== 'welcome')
  const here = onboardingStage(step).index
  return CHAPTERS.map((_, i) => {
    if (i < here) return 1
    if (i > here) return 0
    if (done || ['review', 'offer'].includes(step)) return 1
    const mine = steps.filter((s) => onboardingStage(s).index === i)
    return (Math.max(0, mine.indexOf(step)) + 1) / (mine.length + 1)
  })
}
export function nextOnboardingStep(step, p, editingGroup = null) {
  const steps = onboardingSteps(p).filter((s) => !editingGroup || (!s.endsWith('-demo') && s !== 'offer')),
    next = steps[steps.indexOf(step) + 1]
  const finished =
    (editingGroup === 'goal' && step === 'physique') ||
    (editingGroup === 'experience' && step === 'experience') ||
    (editingGroup === 'barriers' && step === 'barriers') ||
    (editingGroup === 'variety' && step === 'variety') ||
    (editingGroup === 'time' && step === 'rhythm') ||
    (editingGroup === 'sports' &&
      ((step === 'sports' && !p.wantsSport && !p.sports.length) || step === 'priority')) ||
    (editingGroup === 'location' && !['home', 'equipment', 'home-loads', 'movement'].includes(next))
  return finished ? 'review' : next
}
/** A recap follows this answer: it is the last question of its chapter. */
export function shouldShowOnboardingResponse(step, p) {
  return Boolean(chapterRecap(step, p))
}
/**
 * What a finished chapter changes, in the person's own answers: a title and
 * up to three plain lines. Null unless `step` is the chapter's last question
 * (the last chapter ends with the plan itself, and a sport chapter with no
 * sport has nothing to say).
 */
export function chapterRecap(step, p) {
  const stage = onboardingStage(step)
  if (stage.index > 3) return null
  // Legacy saved chapter recaps can still resume; the new flow uses live demos.
  const mine = onboardingSteps(p).filter(
    (s) =>
      !['welcome', 'gender', 'age', 'barriers', 'variety', 'commit'].includes(s) &&
      !s.endsWith('-demo') &&
      onboardingStage(s).index === stage.index,
  )
  if (mine.at(-1) !== step) return null
  const said = (s) => onboardingResponse(s, p)
  const has = (s) => mine.includes(s)
  if (stage.index === 0) {
    const first = typeof p.name === 'string' ? p.name.trim().split(' ')[0] : ''
    // "Let's build muscle, Sam."
    const title = said('goal')[0]
    return {
      chapter: stage.label,
      title: first ? `${title.replace(/\.$/, '')}, ${first}.` : title,
      lines: [said('goal')[1], said('experience')[1]],
    }
  }
  if (stage.index === 1) {
    if (!p.sports?.length) return null
    return {
      chapter: stage.label,
      title: said('priority')[0],
      lines: [said('sport-choice')[1], said('priority')[1]],
    }
  }
  if (stage.index === 2) {
    const place = {
      gym: 'Gym sessions can use any equipment.',
      'on-the-go': 'On the go needs no equipment.',
    }[p.location]
    const lines = [
      ...(place ? [place] : []),
      ...(has('equipment') ? [said('equipment')[1]] : has('home') ? [said('home')[1]] : []),
      ...(has('home-loads') ? ['Suggested weights fit the dumbbells you listed.'] : []),
      ...(has('movement') ? [said('movement')[1]] : []),
    ].slice(0, 2)
    return { chapter: stage.label, title: 'Your places are set.', lines: [...lines, said('location')[1]] }
  }
  return {
    chapter: stage.label,
    title: 'Built around your day.',
    lines: [
      p.flexibleTime
        ? 'You choose the time before each workout.'
        : `${p.minutes} minutes. ${said('time')[1]}`,
      said('rhythm')[1],
      said('comfort')[1],
    ],
  }
}
export function restoredOnboardingResponse(draft, profile) {
  if (!draft || typeof draft.step !== 'string') return null
  return draft?.step === draft?.responseFor &&
    onboardingSteps(profile).includes(draft.step) &&
    shouldShowOnboardingResponse(draft.step, profile)
    ? draft.step
    : null
}
// The short reply shown after each setup answer: a title and one sentence.
export function onboardingResponse(step, p) {
  const home = p.hasHomeSetup || p.location === 'home'
  const responses = {
    welcome: ['Built around your day', 'Each session fits the time, place and energy you have.'],
    goal: [
      p.goal === 'Build muscle'
        ? 'Let’s build muscle.'
        : p.goal === 'Get stronger'
          ? 'Let’s get stronger.'
          : p.goal === 'Lose weight'
            ? 'Let’s make movement a habit.'
            : 'Let’s feel fitter.',
      p.goal === 'Build muscle'
        ? 'Your working sets will be balanced across your sessions.'
        : p.goal === 'Get stronger'
          ? 'Your logged sets guide when targets increase.'
          : p.goal === 'Lose weight'
            ? 'Keep strength in your routine, with activity you can return to.'
            : 'Strength and movement, fitted to the time you have.',
    ],
    experience: [
      p.experience === 'Starting out' ? 'We’ll show you how.' : 'Start with what you know.',
      p.experience === 'Starting out'
        ? 'Fewer sets, simple moves and guidance when you want it.'
        : 'Your first logged sets help set useful targets.',
    ],
    about: ['Thanks', 'Gender never decides your strength or your plan.'],
    sports: p.sports.length
      ? ['Your sport has a place here', 'Next, pick your sports and how much they count.']
      : ['That’s perfectly fine', 'We’ll focus on your main goal.'],
    'sport-choice': ['Warm-ups for your sport', 'Each sport gets its own warm-up.'],
    priority: [
      p.sportPriority === 'sport'
        ? 'Sport comes first.'
        : p.sportPriority === 'goal'
          ? 'Your goal comes first.'
          : 'Both shape your plan.',
      p.sportPriority === 'sport'
        ? 'Sport comes first. Games nearby mean lighter training.'
        : p.sportPriority === 'goal'
          ? 'Your goal comes first, with room for your sport.'
          : 'Add a practice or match and your next workout can adjust.',
    ],
    location: ['A starting place', 'You can pick another place before any workout.'],
    home: [
      home ? 'Let’s use what you have' : 'No home setup needed',
      home ? 'Home has its own equipment list.' : 'You can add home equipment later.',
    ],
    equipment: [
      'Only what you own',
      p.equipment.length
        ? `Home plans use ${p.equipment.join(', ').toLowerCase()}.`
        : 'Home plans use bodyweight moves.',
    ],
    'home-loads': [
      'Your actual weights.',
      'Suggested loads will fit your listed sizes. If the jump is too big, reps can change first.',
    ],
    movement: ['Your space counts', 'Plans fit your floor, space and position.'],
    time: [
      p.flexibleTime ? 'Time can change.' : `${p.minutes} minutes.`,
      'Change the time whenever you start a workout.',
    ],
    rhythm: [
      'No set workout days',
      p.goalMode === 'target'
        ? 'Any seven days count. Missed days don’t pile up.'
        : 'No weekly target. Train when it suits you.',
    ],
    comfort: [
      'Your comfort comes first',
      p.avoidMuscles?.length
        ? 'Those areas stay out of your plans.'
        : 'You can flag sore areas before any session.',
    ],
    photos: ['Your starting point', 'Three quick photos. AI review only with your permission.'],
  }
  return responses[step] || ['Made around your answers', 'Change these any time.']
}
