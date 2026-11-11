import { useState } from 'react'
import Icon from './Icon.jsx'
import ExerciseThumbs from './ExerciseThumbs.jsx'
import { findExercise } from '../lib/exercises.js'
import { planNote } from '../lib/presentation.js'
import { planSeconds } from '../lib/engine/session-time.js'
import { PlanRibbon } from './training/SetupVisuals.jsx'
import { dailyArtwork } from '../lib/personal-records.js'

// The session at a glance: how long, how much, and anything unusual about today.
export function planFacts(plan) {
  const sets = plan.items.reduce((n, it) => n + (it.sets || 0), 0)
  const minutes = Math.max(5, Math.round(planSeconds(plan.items) / 300) * 5)
  return [
    [minutes, 'min'],
    [new Set(plan.items.map((it) => it.exId)).size, 'moves'],
    [sets, 'sets'],
  ]
}

export function CardFacts({ facts }) {
  return (
    <dl className="training-card-facts">
      {facts.map(([value, unit]) => (
        <div key={unit}>
          <dd className="num">{value}</dd>
          <dt>{unit}</dt>
        </div>
      ))}
    </dl>
  )
}

export default function TrainingCard({
  plan,
  onStart,
  compact = false,
  customExercises = [],
  title,
  startLabel = 'Review workout',
  artworkDay,
}) {
  const [expanded, setExpanded] = useState(false)
  const note = planNote(plan)
  const scheduled = Boolean(plan.schedule?.lighter || plan.schedule?.preparation)
  const artKind = plan.items.some((it) => findExercise(it.exId, customExercises)?.weighted)
    ? plan.location === 'home'
      ? 'home'
      : 'training'
    : 'bodyweight'
  return (
    <section className={`training-card ${compact ? 'training-card--compact' : ''}`}>
      {artworkDay && !compact && (
        <div className="training-art" aria-hidden="true">
          <span className="training-art-orbit" />
          <img
            key={dailyArtwork(artworkDay, artKind)}
            src={dailyArtwork(artworkDay, artKind)}
            alt=""
            decoding="async"
          />
        </div>
      )}
      {title && <p className="training-card-eyebrow">{title}</p>}
      <h2 className="training-card-title">{plan.name}</h2>
      {plan.items.length > 0 && <CardFacts facts={planFacts(plan)} />}
      {note && (
        <p className="training-card-note">
          <Icon name={scheduled ? 'sport' : 'info'} size={18} />
          <span>{note}</span>
        </p>
      )}
      {!compact && <ExerciseThumbs items={plan.items} customExercises={customExercises} className="mt-4" />}
      {onStart && (
        <button onClick={onStart} className="btn-primary mt-5 w-full">
          {startLabel}
          <Icon name="arrowRight" size={17} />
        </button>
      )}
      {plan.items.length > 0 && (
        <button
          className="training-card-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide exercises' : 'All exercises'}
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} />
        </button>
      )}
      {expanded && (
        <div className="training-card-list">
          <PlanRibbon items={plan.items} customExercises={customExercises} findExercise={findExercise} />
          {plan.items.map((it, i) => (
            <div
              key={`${it.exId}-${i}`}
              className="flex items-center justify-between gap-3 border-b border-line/70 py-3 last:border-0"
            >
              <span className="text-[15px] font-medium">{findExercise(it.exId, customExercises)?.name}</span>
              <span className="num shrink-0 text-[16px] text-ink2">
                {it.sets} × {it.sec ? `${it.sec}s` : `${it.reps}${it.unilateral ? ' / side' : ''}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
