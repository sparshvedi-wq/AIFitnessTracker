// One reference-locked, unisex character. Scene variation never changes theme.
export const ONBOARDING_ART = {
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
}

export function onboardingScene(step, profile = {}, response = false) {
  if (response && step === 'sports' && !profile.sports?.length) return 'rhythm'
  if (response && step === 'equipment' && !profile.equipment?.length) return 'time'
  if (step === 'goal' && response && profile.goal === 'General fitness') return 'time'
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
