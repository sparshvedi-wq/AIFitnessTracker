import Icon from '../Icon.jsx'
import { TallyLogo } from '../Ink.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'

// Decoration supports the written choice; it never carries the label alone.
export const SPORT_EMOJI = {
  tennis: '🎾',
  badminton: '🏸',
  squash: '🎾',
  pickleball: '🏓',
  basketball: '🏀',
  soccer: '⚽',
  football: '🏈',
  volleyball: '🏐',
  running: '👟',
  cycling: '🚲',
  swimming: '🏊',
  golf: '⛳',
  baseball: '⚾',
  softball: '🥎',
  cricket: '🏏',
  hockey: '🏒',
  boxing: '🥊',
  combat: '🥊',
  rugby: '🏉',
  'martial-arts': '🥋',
}
export const EQUIPMENT_ICON = {
  Dumbbells: 'train',
  'Resistance bands': 'band',
  Bench: 'bench',
  'Pull-up bar': 'pullup',
  'Barbell & rack': 'bars',
  Kettlebell: 'kettlebell',
}

export function ChoiceArt({ kind, value, emoji }) {
  if (kind === 'experience') {
    const level = ['Starting out', 'Some experience', 'Experienced'].indexOf(value) + 1
    return (
      <span className="setup-art" aria-hidden="true">
        <span className="setup-level">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= level ? 'is-filled' : ''} style={{ height: 9 + n * 7 }} />
          ))}
        </span>
      </span>
    )
  }
  if (kind === 'time' && typeof value === 'number')
    return (
      <span className="setup-art setup-minute" aria-hidden="true">
        <span>{value}</span>
        <small>min</small>
      </span>
    )
  if (kind === 'rhythm')
    return (
      <span className="setup-art" aria-hidden="true">
        {value === 'flexible' ? (
          <span className="setup-infinity">∞</span>
        ) : (
          <span className="setup-week">
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <i key={n} className={[0, 2, 5].includes(n) ? 'is-filled' : ''} />
            ))}
          </span>
        )}
      </span>
    )
  const icon = kind === 'location' ? { gym: 'train', home: 'home', 'on-the-go': 'minimize' }[value] : null
  return (
    <span className="setup-art" aria-hidden="true">
      {icon ? <Icon name={icon} size={25} /> : <span className="setup-emoji">{emoji || '✦'}</span>}
    </span>
  )
}

export function SetupProgress({ value }) {
  const progress = Math.max(0, Math.min(100, value || 0))
  return (
    <div
      className="setup-progress"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  )
}

export function SetupHeader({ progress, onBack, action }) {
  return (
    <>
      <div className="setup-header">
        {onBack ? (
          <button type="button" className="setup-back" aria-label="Back in setup" onClick={onBack}>
            <Icon name="chevronLeft" size={20} />
          </button>
        ) : (
          <span className="setup-header-space" />
        )}
        <span className="setup-brand">
          <TallyLogo width={29} />
          <span>tally</span>
        </span>
        <span className="setup-header-space">{action}</span>
      </div>
      {progress !== null && <SetupProgress value={progress} />}
    </>
  )
}

export function SetupIllustration({ scene = 'neutral', variant = '', className = '' }) {
  return (
    <div
      className={`setup-scene ${variant ? `setup-scene--${variant}` : ''} ${className}`}
      aria-hidden="true"
    >
      <img
        src={ONBOARDING_ART[scene] || ONBOARDING_ART.neutral}
        alt=""
        width={scene === 'neutral' ? 1024 : 1536}
        height={scene === 'neutral' ? 1536 : 1024}
        decoding="async"
      />
    </div>
  )
}

export function SetupWelcome({ headingRef }) {
  return (
    <>
      <SetupIllustration scene="welcome" variant="welcome" />
      <h3 ref={headingRef} tabIndex={-1} className="setup-welcome-title">
        Training that
        <br />
        fits your day.
      </h3>
    </>
  )
}

export function PlanRibbon({ items, customExercises = [], findExercise }) {
  const muscles = [
    ...new Set(items.map((it) => findExercise(it.exId, customExercises)?.muscle).filter(Boolean)),
  ]
  if (!muscles.length) return null
  return (
    <div className="plan-ribbon" aria-label={`Training areas: ${muscles.join(', ')}`}>
      {muscles.map((muscle) => (
        <span key={muscle}>
          <i aria-hidden="true" />
          {muscle}
        </span>
      ))}
    </div>
  )
}
