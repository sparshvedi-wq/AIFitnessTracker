import { defaultState } from './storage.js'
import { ONBOARDING_VERSION } from './onboarding.js'

// A fresh test run must never inherit progress or photo-derived training cues.
export function resetForTesting(state, stage) {
  if (!['onboarding', 'after-onboarding'].includes(stage)) return state
  const fresh = defaultState()
  if (stage === 'onboarding') return fresh
  return {
    ...fresh,
    settings: {
      ...fresh.settings,
      ...state.settings,
      milestones: {},
      training: {
        ...fresh.settings.training,
        ...state.settings.training,
        completed: true,
        onboardingVersion: ONBOARDING_VERSION,
        onboardingDraft: undefined,
        manualBaseline: undefined,
        manualEntry: undefined,
        baselinePhotoId: null,
        baselineMode: null,
        lifeEvents: [],
        eventMode: 'one-off',
        confirmedFocus: [],
        focusCheckinId: null,
        weakerSide: '',
        sideTestConfirmed: false,
        sideTestDate: null,
        sideExercise: '',
        lastSport: null,
      },
    },
  }
}
