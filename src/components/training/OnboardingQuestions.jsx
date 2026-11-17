// Onboarding questions in the story style: one big question, one line on
// what Tally does with the answer, and answers that are one tap. A single
// choice moves on by itself; the footer button is there for going back over.
import Icon from '../Icon.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import { QUESTION_COPY } from '../../lib/onboarding-questions.js'
import { Check, delay, reducedMotion, useTimers } from './story-kit.jsx'

export function QuestionHead({ step, headingRef, title }) {
  const [question, why] = QUESTION_COPY[step] || [title, null]
  return (
    <div className="q-head">
      <h3 ref={headingRef} tabIndex={-1} className="story-title story-in">
        {question}
      </h3>
      {why && (
        <p className="q-why story-in" style={delay(0.06)}>
          <span aria-hidden="true" className="q-why-dot" />
          {why}
        </p>
      )}
    </div>
  )
}

// Signal bars for a level of experience, 1 to 3.
function Level({ n }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={3 + i * 7} y={16 - i * 5} width="4.5" height={5 + i * 5} rx="1.5" fill="currentColor" opacity={i < n ? 1 : 0.25} />
      ))}
    </svg>
  )
}
function OptionIcon({ icon }) {
  if (icon == null) return null
  if (typeof icon === 'number') return <span className="story-tile-icon"><Level n={icon} /></span>
  return (
    <span className="story-tile-icon">
      <Icon name={icon} size={21} strokeWidth={2.3} />
    </span>
  )
}

/**
 * Tiles for a choice. `onDone` (single choice only) moves on after the tile
 * has lit; a second tap in that moment changes the answer instead.
 */
export function StoryOptions({ label, options, value, onSelect, onDone, multi = false, layout = 'list' }) {
  const timers = useTimers()
  const isOn = (id) => (multi ? (value || []).includes(id) : value === id)
  return (
    <div
      className={`story-tiles q-tiles q-tiles--${layout}`}
      role={multi ? 'group' : 'radiogroup'}
      aria-label={label}
    >
      {options.map((o, i) => {
        const on = isOn(o.id)
        return (
          <button
            key={String(o.id)}
            type="button"
            role={multi ? undefined : 'radio'}
            aria-checked={multi ? undefined : on}
            aria-pressed={multi ? on : undefined}
            className={`story-tile q-tile story-in ${on ? 'is-on' : ''} ${o.num != null ? 'q-tile--num' : ''} ${o.wide ? 'q-tile--wide' : ''}`}
            style={delay(0.1 + i * 0.05)}
            onClick={() => {
              onSelect(o.id)
              if (!multi && onDone) {
                timers.clear()
                timers.later(() => onDone(o.id), reducedMotion() ? 120 : 380)
              }
            }}
          >
            {o.num != null ? (
              <span className="q-num">
                <b>{o.num}</b>
                <small>{o.unit}</small>
              </span>
            ) : (
              <>
                <OptionIcon icon={o.icon} />
                <span className="q-tile-text">
                  <span className="q-tile-title">{o.title}</span>
                  {o.detail && <span className="q-tile-detail">{o.detail}</span>}
                </span>
                <span className={`q-ring ${on ? 'is-on' : ''}`} aria-hidden="true">
                  {on && <Check size={13} />}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Picture cards: goals, builds, places. */
export function ArtOptions({ label, options, value, onSelect, onDone, layout = 'grid' }) {
  const timers = useTimers()
  return (
    <div className={`q-art q-art--${layout}`} role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const on = value === o.id
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            className={`q-art-card story-in ${on ? 'is-on' : ''}`}
            style={delay(0.1 + i * 0.06)}
            onClick={() => {
              onSelect(o.id)
              if (onDone) {
                timers.clear()
                timers.later(() => onDone(o.id), reducedMotion() ? 120 : 420)
              }
            }}
          >
            <span className="q-art-pic" aria-hidden="true">
              <span className="q-art-glow" />
              <img src={ONBOARDING_ART[o.art] || ONBOARDING_ART.neutral} alt="" decoding="async" />
            </span>
            <span className="q-art-label">
              {o.title}
              {o.detail && <small>{o.detail}</small>}
            </span>
            <span className={`q-ring ${on ? 'is-on' : ''}`} aria-hidden="true">
              {on && <Check size={13} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
