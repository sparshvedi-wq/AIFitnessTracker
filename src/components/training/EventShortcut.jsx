import Icon from '../Icon.jsx'
import { trainingEventContext } from '../../lib/training-events.js'
import { labelForKey } from '../../lib/date.js'
// Shows the next event, or an "Add an event" prompt unless `hideEmpty` (Home keeps that on Train).
export default function EventShortcut({ state, today, now, nav, hideEmpty = false }) {
  const next = trainingEventContext(state.settings.training, { today, now }).next
  if (!next && hideEmpty) return null
  return (
    <div className="mt-3 border-b border-line">
      <button className="list-row !min-h-16" onClick={() => nav.openEvents(next ? 'list' : 'add')}>
        <span className="icon-tile">
          <Icon name={next ? 'sport' : 'plus'} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{next ? next.title : 'Add an event'}</span>
          <span className="mt-1 block text-[13px] text-muted">
            {next ? `${labelForKey(next.date)} · ${next.time}` : 'Practice, travel or a special occasion'}
          </span>
        </span>
        <Icon name="chevronRight" size={17} className="text-faint" />
      </button>
    </div>
  )
}
