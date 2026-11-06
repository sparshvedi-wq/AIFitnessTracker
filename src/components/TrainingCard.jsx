import { useState } from 'react'
import Icon from './Icon.jsx'
import ExerciseThumbs from './ExerciseThumbs.jsx'
import { findExercise } from '../lib/exercises.js'
import { planSummary } from '../lib/presentation.js'
import { ONBOARDING_ART } from '../lib/onboarding-art.js'
export { planScene } from '../lib/onboarding-art.js'
import { PlanRibbon } from './training/SetupVisuals.jsx'

const WIDE = new Set(['movement', 'sports', 'rhythm'])

export default function TrainingCard({
  plan,
  place,
  onStart,
  compact = false,
  customExercises = [],
  showContext = true,
  title,
  scene = 'neutral',
  hideStart = false,
}) {
  const [expanded, setExpanded] = useState(false)
  const sets = plan.items.reduce((n, it) => n + it.sets, 0)
  const wide = WIDE.has(scene)
  return (
    <section className={`training-card ${compact ? 'training-card--compact' : ''}`}>
      {!compact && (
        <span className={`training-card-art ${wide ? 'is-wide' : ''}`} aria-hidden="true">
          <span className="floor-glow training-card-glow" />
          <img src={ONBOARDING_ART[scene] || ONBOARDING_ART.neutral} alt="" decoding="async" />
        </span>
      )}
      <div className="training-card-head">
        {title && <p className="text-[14px] font-bold text-accent-ink">{title}</p>}
        <h2
          className={`font-display ${compact ? 'text-[26px]' : 'text-[32px]'} leading-[1.02] tracking-[-0.02em]`}
        >
          {plan.name}
        </h2>
        <p className="mt-2 text-[14px] font-semibold text-ink2">
          {showContext && (
            <>
              {plan.requestedMinutes} min · {plan.placeName || place?.name} ·{' '}
            </>
          )}
          {plan.items.length} {plan.items.length === 1 ? 'exercise' : 'exercises'}
          {!showContext && ` · ${sets} ${sets === 1 ? 'set' : 'sets'}`}
        </p>
      </div>
      <p className="training-card-why">{planSummary(plan)}</p>
      {!compact && <ExerciseThumbs items={plan.items} customExercises={customExercises} className="mt-4" />}
      <button
        className="training-card-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? 'Hide exercises' : 'All exercises'}
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      {expanded && (
        <div className="training-card-list">
          <PlanRibbon items={plan.items} customExercises={customExercises} findExercise={findExercise} />
          {plan.items.map((it, i) => (
            <div
              key={`${it.exId}-${i}`}
              className="flex items-center justify-between gap-3 border-b border-line/70 py-3 last:border-0"
            >
              <span className="text-[15px] font-medium">
                <span className="mr-2 text-[12px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                {findExercise(it.exId, customExercises)?.name}
              </span>
              <span className="shrink-0 text-[14px] text-ink2">
                {it.sets} × {it.sec ? `${it.sec}s` : `${it.reps}${it.unilateral ? ' / side' : ''}`}
              </span>
            </div>
          ))}
        </div>
      )}
      {!hideStart && (
        <button onClick={onStart} className="btn-primary mt-4 w-full">
          Review workout
          <Icon name="arrowRight" size={17} />
        </button>
      )}
    </section>
  )
}
