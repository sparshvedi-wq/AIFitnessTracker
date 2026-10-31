import { count } from '../lib/presentation.js'
import Icon from './Icon.jsx'
import { DateTile } from './Ink.jsx'
import { fmtNum } from '../lib/workout.js'
import { recordPlaceLabel } from '../lib/places.js'

export default function SessionRow({ workout, onClick, divider = false }) {
  const sets = workout.totals?.sets ?? workout.exercises?.reduce((n, e) => n + e.sets.length, 0) ?? 0
  const kind =
    workout.kind === 'sport'
      ? 'Warmup'
      : workout.kind === 'pump' || workout.planning?.shortSession
        ? 'Short session'
        : workout.kind === 'recovery'
          ? 'Light movement'
          : 'Training'
  return (
    <button onClick={onClick} className={`list-row ${divider ? 'border-t border-line' : ''}`}>
      <DateTile date={workout.date} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{workout.name}</span>
        <span className="mt-1 block text-[13px] text-muted">
          {kind}
          {recordPlaceLabel(workout) ? ` · ${recordPlaceLabel(workout)}` : ''} · {count(sets, 'set')}
          {workout.totals?.volume > 0 ? ` · ${fmtNum(workout.totals.volume)} ${workout.unit}` : ''}
        </span>
      </span>
      {workout.sample ? (
        <span className="tag">Demo</span>
      ) : (
        workout.records?.length > 0 && <Icon name="trend" size={17} className="text-accent" />
      )}
      <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
    </button>
  )
}
