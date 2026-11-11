import Icon from './Icon.jsx'
import { sessionStatus, setCounts } from '../lib/workout.js'

// Home's view of the workout in progress. It shows the same live status as
// the mini bar on other tabs. Rest always waits for the person.
export default function ActiveSessionCard({ session, onOpen }) {
  const { done, total } = setCounts(session)
  const prepared = session.phase === 'prepared'
  const share = total ? done / total : 0
  return (
    <button onClick={onOpen} className="training-card block w-full text-left">
      <span className="training-card-eyebrow block">{prepared ? 'Ready to start' : 'In progress'}</span>
      <span className="training-card-title block">{session.name}</span>
      {!prepared && (
        <span className="mt-4 block">
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[15px] font-semibold text-ink2">
              {sessionStatus(session)}
            </span>
            <span className="shrink-0 text-[14px] font-semibold text-ink2">
              <span className="num mr-1 text-[22px] text-ink">
                {done}/{total}
              </span>
              sets
            </span>
          </span>
          <span className="progress-chunky mt-3" aria-hidden="true">
            <span style={{ width: `${Math.max(share * 100, 4)}%` }} />
          </span>
        </span>
      )}
      <span className="btn-primary pointer-events-none mt-5 w-full">
        {prepared ? 'Start' : 'Resume'}
        <Icon name="arrowRight" size={16} />
      </span>
    </button>
  )
}
