// One reference-locked, unisex character. Scene variation never changes theme.
export const ONBOARDING_ART = {
  'physique-athletic': '/onboarding/m1-physique-athletic.webp',
  'physique-balanced': '/onboarding/m1-physique-balanced.webp',
  'physique-powerful': '/onboarding/m1-physique-powerful.webp',
  neutral: '/onboarding/m1-neutral.webp',
  welcome: '/onboarding/m1-welcome.webp',
  goal: '/onboarding/m1-goal.webp',
  experience: '/onboarding/m1-experience.webp',
  sports: '/onboarding/m1-sports.webp',
  priority: '/onboarding/m1-priority.webp',
  location: '/onboarding/m1-location.webp',
  equipment: '/onboarding/m1-equipment.webp',
  movement: '/onboarding/m1-movement.webp',
  time: '/onboarding/m1-time.webp',
  rhythm: '/onboarding/m1-rhythm.webp',
  manual: '/onboarding/m1-manual.webp',
  photos: '/onboarding/m1-photos.webp',
  review: '/onboarding/m1-review.webp',
  muscle: '/onboarding/m1-v3-muscle.webp',
  strength: '/onboarding/m1-v3-strength.webp',
  weight: '/onboarding/m1-v3-weight.webp',
  gym: '/onboarding/m1-v3-gym.webp',
}

export function onboardingScene(step, profile = {}, response = false) {
  if (response && step === 'sports' && !profile.sports?.length) return 'rhythm'
  if (response && step === 'equipment' && !profile.equipment?.length) return 'time'
  if (response)
    return (
      {
        goal: 'review',
        experience: 'experience',
        'sport-choice': 'priority',
        priority: 'time',
        'home-loads': 'location',
        time: 'welcome',
        rhythm: 'movement',
        comfort: 'manual',
      }[step] || 'review'
    )
  if (step === 'goal')
    return (
      {
        'Build muscle': 'muscle',
        'Get stronger': 'strength',
        'Lose weight': 'weight',
        'General fitness': 'rhythm',
      }[profile.goal] || 'neutral'
    )
  if (step === 'location')
    return { gym: 'gym', home: 'equipment', 'on-the-go': 'movement' }[profile.location] || 'location'
  if (step === 'experience') return 'neutral'
  return (
    {
      welcome: 'welcome',
      goal: 'goal',
      experience: 'experience',
      about: 'neutral',
      sports: 'sports',
      'sport-choice': 'sports',
      priority: 'priority',
      location: 'location',
      home: 'equipment',
      equipment: 'equipment',
      'home-loads': 'equipment',
      movement: 'movement',
      time: 'time',
      rhythm: 'rhythm',
      comfort: 'neutral',
      photos: 'photos',
      manual: 'manual',
      review: 'review',
    }[step] || 'neutral'
  )
}

// The scene that matches what a planned session is for (Home's training card).
export function planScene(plan = {}, goal) {
  if (['recovery', 'movement'].includes(plan.kind) || plan.mode === 'movement') return 'movement'
  if (plan.kind === 'sport') return 'sports'
  return { 'Build muscle': 'muscle', 'Get stronger': 'strength', 'Lose weight': 'weight' }[goal] || 'rhythm'
}
