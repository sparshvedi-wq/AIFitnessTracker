import Icon from '../Icon.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import './first-workout.css'

// One screen before the first set ever: what this session is for, once.
export default function FirstSessionIntro({ weighted, onStart, onMinimize }) {
  return (
    <section className="first-intro" aria-labelledby="first-intro-title">
      <header className="flex items-center">
        <button onClick={onMinimize} className="icon-btn" aria-label="Minimize workout">
          <Icon name="chevronDown" size={20} strokeWidth={2.2} />
        </button>
      </header>
      <div className="first-intro-stage" aria-hidden="true">
        <span className="floor-glow first-intro-floor" />
        <img src={weighted ? ONBOARDING_ART.strength : ONBOARDING_ART.movement} alt="" />
      </div>
      <p className="first-intro-eyebrow">First session</p>
      <h2 id="first-intro-title" className="first-intro-title">
        {weighted ? 'Find your starting weights.' : 'Find your level.'}
      </h2>
      <p className="first-intro-copy">
        {weighted ? 'Pick loads you can move with control.' : 'Move with control.'} Tally builds from what you
        log.
      </p>
      <button className="btn-primary first-intro-start min-h-12 w-full" onClick={onStart}>
        Let’s go
        <Icon name="arrowRight" size={16} />
      </button>
    </section>
  )
}
