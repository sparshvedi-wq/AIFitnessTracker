import { useEffect, useState } from 'react'
// `floor` keeps planning from running behind something that already happened,
// such as a workout saved seconds ago (the clock only refreshes each minute).
export const lastRecordedAt = (workouts = []) =>
  workouts.reduce((latest, w) => (w.sample ? latest : Math.max(latest, w.endedAt || 0)), 0)

export default function usePlanningTime(floor = 0) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return Math.max(now, Number.isFinite(floor) ? floor : 0)
}
