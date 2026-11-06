import { useState } from 'react'
import Icon from './Icon.jsx'
import TrainingPhoto from './TrainingPhoto.jsx'
import { findExercise } from '../lib/exercises.js'
import { planSummary } from '../lib/presentation.js'
import { PlanRibbon } from './training/SetupVisuals.jsx'

export default function TrainingCard({
  plan,
  place,
  onStart,
  rotate = false,
  compact = false,
  customExercises = [],
  showContext = true,
  title,
}) {
  const [expanded, setExpanded] = useState(false)
  const sets = plan.items.reduce((n, it) => n + it.sets, 0)
  return (
    <section className="training-card overflow-hidden rounded-hero bg-paper text-on-paper">
      {!compact && <TrainingPhoto rotate={rotate} location={place?.base} className="training-hero-image" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className={`font-display ${compact ? 'text-[25px]' : 'text-[28px]'} leading-tight`}>
            {title || plan.name}
          </h2>
          <button
            className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-paper-muted/40 px-3 text-[12px] font-semibold"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Hide workout details' : 'View workout details'}
            aria-expanded={expanded}
          >
            <Icon name={expanded ? 'x' : 'list'} size={16} />
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-muted">{planSummary(plan)}</p>
        {expanded && (
          <PlanRibbon items={plan.items} customExercises={customExercises} findExercise={findExercise} />
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-paper-muted">
          {showContext && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={15} />
                {plan.requestedMinutes} min
              </span>
              <span className="max-w-[45%] truncate">{plan.placeName || place?.name}</span>
            </>
          )}
          <span>
            {plan.items.length} {plan.items.length === 1 ? 'exercise' : 'exercises'} · {sets}{' '}
            {sets === 1 ? 'set' : 'sets'}
          </span>
        </div>
        {expanded && (
          <div className="mt-4 border-t border-paper-muted/40 pt-1">
            {plan.items.map((it, i) => (
              <div
                key={`${it.exId}-${i}`}
                className="flex items-center justify-between gap-3 border-b border-paper-muted/25 py-3 last:border-0"
              >
                <span className="text-[14px] font-medium">
                  <span className="mr-2 text-[12px] text-paper-muted">{String(i + 1).padStart(2, '0')}</span>
                  {findExercise(it.exId, customExercises)?.name}
                </span>
                <span className="shrink-0 text-[13px] text-paper-muted">
                  {it.sets} × {it.sec ? `${it.sec}s` : `${it.reps}${it.unilateral ? ' / side' : ''}`}
                </span>
              </div>
            ))}
          </div>
        )}
        <button onClick={onStart} className="btn mt-4 min-h-[52px] w-full bg-on-paper text-paper">
          Review workout
          <Icon name="arrowRight" size={17} />
        </button>
      </div>
    </section>
  )
}
