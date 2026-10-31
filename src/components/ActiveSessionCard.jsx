import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import TrainingPhoto from './TrainingPhoto.jsx'
import { sessionStatus, setCounts } from '../lib/workout.js'

// Home's view of the workout in progress. It shows the same live status as
// the mini bar on other tabs, including the rest countdown.
export default function ActiveSessionCard({ session, onOpen }) {
  const [now, setNow] = useState(Date.now)
  const ticking = Boolean(session.phaseEndsAt && !session.pausedAt)
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])
  const { done, total } = setCounts(session)
  const prepared = session.phase === 'prepared'
  return (
    <button
      onClick={onOpen}
      className="flex min-h-[120px] w-full items-center gap-4 rounded-hero bg-paper p-4 text-left text-on-paper"
    >
      <TrainingPhoto rotate className="!aspect-square !h-20 !w-20 shrink-0 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-paper-muted">
          {prepared ? 'Ready to start' : `${done} of ${total} sets`}
        </span>
        <span className="mt-1 block truncate font-display text-[25px] leading-tight">{session.name}</span>
        {!prepared && (
          <span className="mt-1 block truncate text-[13px] text-paper-muted">
            {sessionStatus(session, now)}
          </span>
        )}
        <span className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold">
          {prepared ? 'Start' : 'Resume'}
          <Icon name="arrowRight" size={15} />
        </span>
      </span>
    </button>
  )
}
