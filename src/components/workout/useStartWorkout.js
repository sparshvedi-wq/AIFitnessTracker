// Start a routine (or an empty workout) from any tab and open the player.

import { useApp } from '../../store/AppContext.jsx'
import { buildSession, prepareSession } from '../../lib/workout.js'
import { unlockAudio } from '../../lib/coach.js'
import { resolvePlace } from '../../lib/places.js'

export default function useStartWorkout(nav) {
  const { state, dispatch, toast } = useApp()

  function begin(routine) {
    unlockAudio()
    const session = buildSession(routine, {
      workouts: state.workouts,
      customExercises: state.customExercises,
      unit: state.settings.weightUnit,
    })
    const ready = prepareSession(session)
    dispatch({ type: 'SET_ACTIVE_WORKOUT', session: ready })
    nav.openPlayer()
  }

  return function start(routine) {
    if (state.activeWorkout) {
      nav.openPlayer()
      toast('Resume or finish your current workout first', 'info')
      return
    }
    if (routine.id === 'quick') {
      const session = buildSession(
        {
          ...routine,
          kind: 'manual',
          location: state.settings.training.location,
          placeName: resolvePlace(state.settings.training, state.settings.training.location).name,
        },
        { unit: state.settings.weightUnit },
      )
      dispatch({ type: 'SET_ACTIVE_WORKOUT', session: { ...session, phase: 'work', startedAt: null } })
      nav.openPlayer()
      return
    }
    if (nav.prepareWorkout) {
      nav.prepareWorkout(routine)
      return
    }
    begin(routine)
  }
}

// Saved bodyweights, oldest first: [{ date, value }]
export function bodyweights(metrics) {
  return Object.entries(metrics)
    .filter(([, m]) => m?.weight != null && !m.sampleWeight)
    .map(([date, m]) => ({ date, value: m.weight }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}
