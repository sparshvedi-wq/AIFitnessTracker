import { PHOTO_FOCUS } from './config.js'

export const PHOTO_AREAS = {
  arms: ['Biceps', 'Triceps'],
  shoulders: ['Shoulders'],
  chest: ['Chest'],
  back: ['Back'],
  legs: ['Legs'],
  glutes: ['Glutes'],
  overall: [],
}
const DAY = 86400000
function dayNumber(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const ms = Date.parse(`${key}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === key ? ms / DAY : null
}
const isReal = (c) => c && !c.sample && !c.synthetic && !c.review?.demo
const stamp = (c) => (Number.isFinite(c.createdAt) ? c.createdAt : 0)
const reviewed = (c) =>
  c.review?.status === 'ready' &&
  Array.isArray(c.review.observations) &&
  Array.isArray(c.review.suggestedFocus) &&
  !Object.values(c.review.views || {}).some((v) => v?.usable === false)
const supports = (c, area) =>
  reviewed(c) &&
  c.review.suggestedFocus.some((f) => f?.area === area) &&
  c.review.observations.some(
    (o) =>
      o?.area === area &&
      Array.isArray(o.evidenceViews) &&
      o.evidenceViews.some((v) => ['front', 'side', 'back'].includes(v)),
  )

// Only previously approved areas can influence a plan. A newer review can
// retire an old priority; it cannot silently introduce a new one. Same-day
// repeats don't add evidence, and matching priorities never establish a
// smaller/weaker side. No appearance signal changes load or side-specific reps.
export function photoFocusEvidence(checkins, profile, today) {
  if (!profile || profile.ageGroup !== '18+' || !Array.isArray(checkins) || !profile.focusCheckinId) return []
  const nowDay = dayNumber(today)
  if (nowDay === null) return []
  const anchor = checkins.find((c) => isReal(c) && c.id === profile.focusCheckinId)
  const anchorDay = dayNumber(anchor?.date)
  if (anchorDay === null || anchorDay > nowDay) return []
  const approved = Array.isArray(profile.confirmedFocus)
    ? [...new Set(profile.confirmedFocus)].filter(
        (a) => Array.isArray(PHOTO_AREAS[a]) && PHOTO_AREAS[a].length,
      )
    : []
  if (!approved.length) return []
  const rows = checkins
    .filter((c) => isReal(c) && (reviewed(c) || (c === anchor && !c.review)))
    .map((c) => ({ c, day: dayNumber(c.date) }))
    .filter(({ day }) => day !== null && day <= nowDay && nowDay - day < PHOTO_FOCUS.expiresDays)
    .sort((a, b) => b.day - a.day || stamp(b.c) - stamp(a.c) || String(b.c.id).localeCompare(String(a.c.id)))
  const days = new Set()
  const uniqueDays = rows.filter(({ day }) => !days.has(day) && days.add(day))
  const latest = uniqueDays[0]
  if (!latest || latest.day < anchorDay) return []
  const age = nowDay - latest.day
  const fade =
    age <= PHOTO_FOCUS.fullWeightDays
      ? 1
      : (PHOTO_FOCUS.expiresDays - age) / (PHOTO_FOCUS.expiresDays - PHOTO_FOCUS.fullWeightDays)
  return approved.flatMap((area) => {
    // Missing review data from an old, explicitly approved save gets only the
    // initial weight. A new review must actually support the selected area.
    if (!(latest.c === anchor && !anchor.review) && !supports(latest.c, area)) return []
    let followup = false
    for (const older of supports(latest.c, area) ? uniqueDays.slice(1) : []) {
      if (!supports(older.c, area)) break
      if (latest.day - older.day >= PHOTO_FOCUS.followupGapDays) {
        followup = true
        break
      }
    }
    return [
      {
        area,
        checkinId: latest.c.id,
        date: latest.c.date,
        followup,
        rankWeight: (followup ? PHOTO_FOCUS.followupRank : PHOTO_FOCUS.initialRank) * fade,
        targetBoost: (followup ? PHOTO_FOCUS.followupTargetBoost : PHOTO_FOCUS.initialTargetBoost) * fade,
      },
    ]
  })
}
