import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { ONBOARDING_ART } from '../lib/onboarding-art.js'
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
  const share = total ? done / total : 0
  return (
    <button onClick={onOpen} className="training-card block w-full text-left">
      <span className="training-card-art" aria-hidden="true">
        <span className="floor-glow training-card-glow" />
        <img src={ONBOARDING_ART.muscle} alt="" decoding="async" />
      </span>
      <span className="training-card-head block">
        <span className="block text-[14px] font-bold text-accent-ink">
          {prepared ? 'Ready to start' : 'In progress'}
        </span>
        <span className="mt-2 block font-display text-[30px] leading-[1.04]">{session.name}</span>
        {!prepared && (
          <span className="mt-2 block truncate text-[14px] font-semibold text-ink2">
            {sessionStatus(session, now)}
          </span>
        )}
      </span>
      {!prepared && (
        <span className="relative mt-2 block">
          <span className="block text-[13px] font-semibold text-muted">
            {done} of {total} sets
          </span>
          <span className="progress-chunky mt-2" aria-hidden="true">
            <span style={{ width: `${Math.max(share * 100, 4)}%` }} />
          </span>
        </span>
      )}
      <span className="btn-primary pointer-events-none mt-4 w-full">
        {prepared ? 'Start' : 'Resume'}
        <Icon name="arrowRight" size={16} />
      </span>
    </button>
  )
}
