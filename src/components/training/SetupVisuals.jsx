import Icon from '../Icon.jsx'
import { TallyLogo } from '../Ink.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import { useEffect, useRef, useState } from 'react'

export const EQUIPMENT_ICON = {
  Dumbbells: 'dumbbell',
  'Resistance bands': 'band',
  Bench: 'bench',
  'Pull-up bar': 'pullup',
  'Barbell & rack': 'bars',
  Kettlebell: 'kettlebell',
}

// Every scene a setup screen can show. Decoded ahead so a choice never flashes blank.
const PRELOAD = [
  'physique-athletic',
  'physique-balanced',
  'physique-powerful',
  'muscle',
  'strength',
  'weight',
  'rhythm',
  'sports',
  'gym',
  'equipment',
  'movement',
  'neutral',
  'review',
  // Scenes used by setup replies, so a reply never opens on an empty stage.
  'experience',
  'priority',
  'time',
  'location',
  'manual',
]
export function preloadSetupArt() {
  for (const key of PRELOAD) {
    const image = new Image()
    image.decoding = 'async'
    image.src = ONBOARDING_ART[key]
  }
}

export function ChoiceArt({ kind, value }) {
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
  if (kind === 'time')
    return (
      <span className="setup-art" aria-hidden="true">
        <Icon name="repeat" size={24} />
      </span>
    )
  if (kind === 'rhythm')
    return (
      <span className="setup-art" aria-hidden="true">
        {value === 'flexible' ? (
          <TallyStrokes count={3} />
        ) : (
          <span className="setup-week">
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <i key={n} className={[0, 2, 5].includes(n) ? 'is-filled' : ''} />
            ))}
          </span>
        )}
      </span>
    )
  return null
}

// Hand-counted strokes: the brand mark doubles as a count.
export function TallyStrokes({ count, height = 22, className = '', highlightFrom = Infinity }) {
  const marks = Math.max(0, Math.min(count, 25))
  const groups = Math.ceil(marks / 5)
  const width = groups * 34 - 8
  return (
    <svg
      width={Math.max(width, 8)}
      height={height}
      viewBox={`0 0 ${Math.max(width, 8)} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {Array.from({ length: marks }, (_, i) => {
        const group = Math.floor(i / 5),
          slot = i % 5,
          x0 = group * 34,
          lit = i >= highlightFrom
        if (slot === 4)
          return (
            <path
              key={i}
              d={`M${x0 - 2} ${height - 6}L${x0 + 26} ${5}`}
              stroke={lit ? 'rgb(var(--accent))' : 'currentColor'}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )
        const x = x0 + 3 + slot * 6.5
        return (
          <path
            key={i}
            d={`M${x} 3V${height - 3}`}
            stroke={lit ? 'rgb(var(--accent))' : 'currentColor'}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

export function SetupProgress({ value }) {
  const progress = Math.max(0, Math.min(100, value || 0))
  return (
    <div
      className="progress-chunky min-w-0 flex-1"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span style={{ width: `${Math.max(progress, 4)}%` }} />
    </div>
  )
}

// Welcome and the first question carry the brand; after that, one honest track.
export function SetupHeader({ progress, onBack, action }) {
  return (
    <div className="setup-header">
      {onBack ? (
        <button type="button" className="setup-back" aria-label="Back in setup" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
        </button>
      ) : (
        <span className="setup-header-space" />
      )}
      {progress === null ? (
        <span className="setup-brand">
          <TallyLogo width={27} />
          <span>tally</span>
        </span>
      ) : (
        <SetupProgress value={progress} />
      )}
      <span className="setup-header-space">{action || (progress !== null && <TallyLogo width={22} />)}</span>
    </div>
  )
}

// M1's head and shoulders, cropped from the neutral render.
export function GuideAvatar({ size = 52 }) {
  return (
    <span className="guide-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <img src={ONBOARDING_ART.neutral} alt="" width="1024" height="1536" decoding="async" />
    </span>
  )
}

// The question, said by M1. The heading stays a real heading for focus and screen readers.
export function GuideBubble({ headingRef, children, note }) {
  return (
    <div className="guide-row">
      <GuideAvatar />
      <div className="guide-bubble">
        <h3 ref={headingRef} tabIndex={-1} className="guide-question">
          {children}
        </h3>
        {note && <p className="guide-note">{note}</p>}
      </div>
    </div>
  )
}

// One scene, lit, standing on the floor glow. Swaps only after the next image decodes.
export function SetupIllustration({ scene = 'neutral', variant = '', className = '' }) {
  const src = ONBOARDING_ART[scene] || ONBOARDING_ART.neutral
  const [shown, setShown] = useState(src)
  const [entering, setEntering] = useState(false)
  const pending = useRef(src)
  useEffect(() => {
    if (src === shown) return
    pending.current = src
    const image = new Image()
    image.src = src
    const swap = () => {
      if (pending.current !== src) return
      setShown(src)
      setEntering(true)
    }
    ;(image.decode ? image.decode() : Promise.resolve()).then(swap, swap)
  }, [src, shown])
  return (
    <div
      className={`setup-scene ${variant ? `setup-scene--${variant}` : ''} ${className}`}
      aria-hidden="true"
    >
      <span className="floor-glow setup-scene-glow" />
      <img
        key={shown}
        className={`scene-current ${entering ? 'is-entering' : ''}`}
        src={shown}
        alt=""
        decoding="async"
        onAnimationEnd={() => setEntering(false)}
      />
    </div>
  )
}

// Renders drawn wider than tall; in a narrow tile they fill by height and crop the empty sides.
const WIDE = new Set([
  'rhythm',
  'welcome',
  'sports',
  'equipment',
  'movement',
  'location',
  'photos',
  'review',
  'time',
  'manual',
  'experience',
  'goal',
])

// Options that carry their own artwork: ghosted until chosen, then lit.
export function ImageChoices({ options, value, onChange, layout = 'grid', label }) {
  return (
    <div className={`image-choices image-choices--${layout}`} role="group" aria-label={label}>
      {options.map(([id, title, scene, detail]) => {
        const on = value === id
        return (
          <button
            key={String(id)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(id)}
            className={`tile image-choice ${on ? 'is-selected' : ''}`}
          >
            <span className="image-choice-art" aria-hidden="true">
              <span className={`floor-glow image-choice-glow ${on ? 'is-on' : ''}`} />
              <img
                src={ONBOARDING_ART[scene] || ONBOARDING_ART.neutral}
                alt=""
                decoding="async"
                className={`${on ? 'lit-figure' : 'ghost-figure'} ${layout === 'grid' && WIDE.has(scene) ? 'is-wide' : ''}`}
              />
            </span>
            <span className="image-choice-label">
              <span className="block">{title}</span>
              {detail && <span className="image-choice-detail">{detail}</span>}
            </span>
            {on && layout !== 'physiques' && (
              <span className="tile-check" aria-hidden="true">
                <Icon name="check" size={14} strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function SetupWelcome({ headingRef }) {
  useEffect(() => {
    preloadSetupArt()
  }, [])
  return (
    <div className="setup-welcome">
      <div className="setup-welcome-stage" aria-hidden="true">
        <span className="setup-stage-ring setup-stage-ring--outer" />
        <span className="floor-glow setup-stage-ring setup-stage-ring--inner" />
        <img className="ghost-figure welcome-ghost welcome-ghost--1" src={ONBOARDING_ART.strength} alt="" />
        <img className="ghost-figure welcome-ghost welcome-ghost--2" src={ONBOARDING_ART.weight} alt="" />
        <img className="ghost-figure welcome-ghost welcome-ghost--3" src={ONBOARDING_ART.muscle} alt="" />
        <img className="ghost-figure welcome-ghost welcome-ghost--4" src={ONBOARDING_ART.neutral} alt="" />
        <img className="welcome-hero" src={ONBOARDING_ART.welcome} alt="" decoding="async" />
        <span className="welcome-bubble">
          <strong>Hi, I’m M1.</strong>
          <span>I’ll train with you.</span>
        </span>
      </div>
      <h3 ref={headingRef} tabIndex={-1} className="setup-welcome-title">
        Training that fits your day.
      </h3>
    </div>
  )
}

// A short reaction after an answer: the lit figure on its stage, one headline, one useful line.
export function SetupResponse({ scene, title, copy, headingRef }) {
  return (
    <div className="setup-response" role="status">
      <div className="setup-response-stage" aria-hidden="true">
        <span className="setup-response-aura" />
        <SetupIllustration scene={scene} variant="response" />
      </div>
      <h3 ref={headingRef} tabIndex={-1} className="setup-response-title">
        {title}
      </h3>
      {copy && <p className="setup-response-copy">{copy}</p>}
    </div>
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
