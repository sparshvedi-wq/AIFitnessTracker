import { findExercise } from '../lib/exercises.js'
import { planThumbs } from '../lib/exercise-thumbs.js'

// A strip of the plan's first demonstrations (end position), plus how many more follow.
export default function ExerciseThumbs({ items, customExercises = [], limit = 3, className = '' }) {
  const thumbs = planThumbs(items, limit)
  if (!thumbs.length) return null
  const unique = new Set(items.map((it) => it.exId)).size
  const more = unique - thumbs.length
  return (
    <ul className={`exercise-thumbs ${className}`} aria-label="Exercises in this session">
      {thumbs.map((t) => {
        const name = findExercise(t.exId, customExercises)?.name || ''
        return (
          <li key={t.exId} className="exercise-thumb">
            <img src={t.src} alt={name} loading="lazy" decoding="async" width="2048" height="1024" />
          </li>
        )
      })}
      {more > 0 && (
        <li className="exercise-thumb exercise-thumb--more" aria-label={`${more} more`}>
          +{more}
        </li>
      )}
    </ul>
  )
}
