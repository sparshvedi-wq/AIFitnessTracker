import Icon from '../Icon.jsx'
import { trainingEventContext } from '../../lib/training-events.js'
import { labelForKey } from '../../lib/date.js'
// Shows the next event, or an "Add an event" prompt unless `hideEmpty` (Home keeps that on Train).
export default function EventShortcut({ state, today, now, nav, hideEmpty = false }) {
  const next = trainingEventContext(state.settings.training, { today, now }).next
  if (!next && hideEmpty) return null
  return (
    <div className="mt-3">
      <button className="list-row !min-h-16" onClick={() => nav.openEvents(next ? 'list' : 'add')}>
        <span className="icon-tile">
          <Icon name={next ? 'sport' : 'plus'} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{next ? next.title : 'Add an event'}</span>
          {!next && (
            <span className="mt-0.5 block truncate text-[13px] text-muted">A game, practice or occasion</span>
          )}
        </span>
        {next && (
          <span className="event-when">
            {labelForKey(next.date)}
            <span className="num">{next.time}</span>
          </span>
        )}
        <Icon name="chevronRight" size={17} className="text-faint" />
      </button>
    </div>
  )
}
