import Icon from '../Icon.jsx'
import { TallyLogo } from '../Ink.jsx'

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

export function SetupProgress({ stage }) {
  return (
    <div
      className="setup-progress"
      role="progressbar"
      aria-label={`Setup: ${stage.label}`}
      aria-valuemin={1}
      aria-valuemax={stage.total}
      aria-valuenow={stage.index + 1}
    >
      {Array.from({ length: stage.total }, (_, i) => (
        <span key={i} className={i < stage.index ? 'is-complete' : i === stage.index ? 'is-current' : ''} />
      ))}
    </div>
  )
}

export function SetupWelcome() {
  return (
    <>
      <div className="setup-welcome-art" aria-hidden="true">
        <span className="setup-orbit orbit-one">⏱️</span>
        <span className="setup-orbit orbit-two">🎾</span>
        <span className="setup-orbit orbit-three">🏋️</span>
        <div className="setup-welcome-core">
          <TallyLogo width={50} />
          <span>
            Your day.
            <br />
            Your training.
          </span>
        </div>
      </div>
      <p className="mt-6 font-display text-[28px] leading-tight">
        A plan for the day
        <br />
        you actually have.
      </p>
      <p className="mt-3 text-[16px] leading-relaxed text-muted">
        Tell us a little about yourself. We’ll build your first session.
      </p>
      <div className="setup-welcome-steps">
        {[
          ['01', 'Your goals'],
          ['02', 'Your setup'],
          ['03', 'Your starting point'],
        ].map(([n, label]) => (
          <span key={n}>
            <small>{n}</small>
            {label}
          </span>
        ))}
      </div>
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
