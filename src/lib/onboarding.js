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
    ['location', 'home', 'equipment', 'movement'],
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
    (editingGroup === 'location' && !['home', 'equipment', 'movement'].includes(next))
  return finished ? 'review' : next
}
// The short reply shown after each setup answer: a title and one sentence.
export function onboardingResponse(step, p) {
  const home = p.hasHomeSetup || p.location === 'home'
  const responses = {
    welcome: ['Built around your day', 'Each session fits the time, place and energy you have.'],
    goal: [
      p.goal === 'Build muscle'
        ? 'Room to build'
        : p.goal === 'Get stronger'
          ? 'A clear starting point'
          : 'Fitness that fits your life',
      `${p.goal} shapes your exercises and reps.`,
    ],
    experience: [
      p.experience === 'Starting out' ? 'We’ll start with the basics' : 'Your experience counts',
      p.experience === 'Starting out'
        ? 'Fewer sets, simple moves and guidance when you want it.'
        : 'Your logged sets shape what comes next. No max testing.',
    ],
    about: ['Thanks', 'Gender never decides your strength or your plan.'],
    sports: p.sports.length
      ? ['Your sport has a place here', 'Next, pick your sports and how much they count.']
      : ['That’s perfectly fine', 'We’ll focus on your main goal.'],
    'sport-choice': ['Warm-ups for your sport', 'Each sport gets its own warm-up.'],
    priority: [
      'Both can fit',
      p.sportPriority === 'sport'
        ? 'Sport comes first. Games nearby mean lighter training.'
        : p.sportPriority === 'goal'
          ? 'Your goal comes first, with room for your sport.'
          : 'Sport and your goal share the plan.',
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
    movement: ['Your space counts', 'Plans fit your floor, space and position.'],
    time: ['A shorter day still works', 'Just your usual length. Change it any day.'],
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
