import { useMemo, useState } from 'react'
import { onboardingDemoPlan } from '../../lib/onboarding-demo.js'
import { findExercise } from '../../lib/exercises.js'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import './onboarding-intro.css'

export default function OnboardingIntro({ headingRef, state, profile, today, now }) {
  const [minutes, setMinutes] = useState(30)
  const plan = useMemo(
    () => onboardingDemoPlan(state, profile, { today, now, minutes }),
    [state, profile, today, now, minutes],
  )
  const first = findExercise(plan.moves[0]?.exId, state.customExercises)
  return (
    <div className="story first-look">
      <h3 className="story-title" tabIndex={-1} ref={headingRef}>A workout for the time you have.</h3>
      <figure className="first-look-card">
        <img className="first-look-figure" src={ONBOARDING_ART.time} alt="" fetchPriority="high" />
        <figcaption>
          <span>Sample workout</span>
          <strong key={minutes}>{minutes}<small> min</small></strong>
        </figcaption>
      </figure>
      <div className="first-look-controls">
        <div className="first-look-switch" role="group" aria-label="Try a different workout length">
          {[15, 30, 45].map((time) => (
            <button type="button" key={time} aria-pressed={minutes === time}
              onClick={() => setMinutes(time)}>{time} min</button>
          ))}
        </div>
        <p aria-live="polite">{plan.moves.length} {plan.moves.length === 1 ? 'exercise' : 'exercises'}{first && <> · Start with {first.name.toLowerCase()}</>}</p>
      </div>
    </div>
  )
}
