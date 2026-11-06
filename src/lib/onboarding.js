export const ONBOARDING_VERSION = 2
export function onboardingSteps(p) {
  return [
    'welcome',
    'goal',
    'experience',
    'about',
    'sports',
    ...(p.wantsSport || p.sports.length ? ['sport-choice', 'priority'] : []),
    'location',
    ...(p.location === 'home' ? [] : ['home']),
    ...(p.hasHomeSetup || p.location === 'home' ? ['equipment'] : []),
    ...((p.hasHomeSetup || p.location === 'home') && p.equipment?.includes('Dumbbells')
      ? ['home-loads']
      : []),
    ...(p.location === 'on-the-go' ? ['movement'] : []),
    'time',
    'rhythm',
    'comfort',
    'photos',
    ...(p.baselineMode === 'manual' ? ['manual'] : []),
    'review',
  ]
}
export function onboardingStage(step) {
  const groups = [
    ['welcome', 'goal', 'experience', 'about'],
    ['sports', 'sport-choice', 'priority'],
    ['location', 'home', 'equipment', 'home-loads', 'movement'],
    ['time', 'rhythm', 'comfort'],
    ['photos', 'manual', 'review'],
  ]
  const index = Math.max(
    0,
    groups.findIndex((group) => group.includes(step)),
  )
  return {
    index,
    label: ['About you', 'Sport', 'Your setup', 'Your day', 'Starting point'][index],
    total: groups.length,
  }
}
export function nextOnboardingStep(step, p, editingGroup = null) {
  const steps = onboardingSteps(p),
    next = steps[steps.indexOf(step) + 1]
  const finished =
    editingGroup === 'goal' ||
    (editingGroup === 'time' && step === 'rhythm') ||
    (editingGroup === 'sports' &&
      ((step === 'sports' && !p.wantsSport && !p.sports.length) || step === 'priority')) ||
    (editingGroup === 'location' && !['home', 'equipment', 'home-loads', 'movement'].includes(next))
  return finished ? 'review' : next
}
// Stable checkpoints avoid a retreating progress bar when an answer adds a branch.
// The first question has no visible bar; its response earns the first filled step.
export function onboardingProgress(step) {
  return (
    {
      welcome: 0,
      goal: 0,
      experience: 8,
      about: 16,
      sports: 22,
      'sport-choice': 28,
      priority: 33,
      location: 40,
      home: 45,
      equipment: 50,
      'home-loads': 55,
      movement: 58,
      time: 63,
      rhythm: 70,
      comfort: 77,
      photos: 84,
      manual: 91,
      review: 100,
    }[step] ?? 0
  )
}
export function shouldShowOnboardingResponse(step, p) {
  if (step === 'sports') return !p.wantsSport && !p.sports.length
  if (step === 'equipment') return !p.equipment?.includes('Dumbbells')
  if (step === 'comfort') return Boolean(p.avoidMuscles?.length)
  return ['goal', 'experience', 'sport-choice', 'priority', 'home-loads', 'time', 'rhythm'].includes(step)
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
        ? 'Build muscle.'
        : p.goal === 'Get stronger'
          ? 'Get stronger.'
          : p.goal === 'Lose weight'
            ? 'Make movement a habit.'
            : 'Feel fitter.',
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
