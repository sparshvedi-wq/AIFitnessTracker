// Civil dates use the device timezone; refreshes in the same time slot are stable.
export const EDITORIAL_SCENES = {
  morning: ['morning-gym', 'morning-court'],
  day: ['day-home', 'day-gym'],
  evening: ['evening-gym', 'evening-home'],
}
export function editorialScene(now = new Date()) {
  const hour = now.getHours()
  const period = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'day' : 'evening'
  const civilDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000)
  const pool = EDITORIAL_SCENES[period]
  return { period, key: pool[((civilDay % pool.length) + pool.length) % pool.length] }
}
