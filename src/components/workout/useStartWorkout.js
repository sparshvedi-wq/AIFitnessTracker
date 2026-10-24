// Start a routine (or an empty workout) from any tab and open the player.

import { useApp } from '../../store/AppContext.jsx'
import { buildSession, startReady } from '../../lib/workout.js'
import { unlockAudio } from '../../lib/coach.js'

export default function useStartWorkout(nav) {
  const { state, dispatch, toast } = useApp()

  function begin(routine) {
    unlockAudio()
    const session = buildSession(routine, {
      workouts: state.workouts,
      customExercises: state.customExercises,
      unit: state.settings.weightUnit,
    })
    const ready = session.exercises.length ? startReady(session, state.settings.workout.countdown) : { ...session, phase: 'work' }
    dispatch({ type: 'SET_ACTIVE_WORKOUT', session: ready })
    nav.openPlayer()
  }

  return function start(routine) {
    if (state.activeWorkout) {
      toast(`${state.activeWorkout.name} is still in progress`, 'info', { label: 'Replace it', onClick: () => begin(routine) })
      return
    }
    begin(routine)
  }
}

// Saved bodyweights, oldest first: [{ date, value }]
export function bodyweights(metrics) {
  return Object.entries(metrics)
    .filter(([, m]) => m?.weight != null)
    .map(([date, m]) => ({ date, value: m.weight }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}
