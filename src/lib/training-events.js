import { addDays, fromKey, toKey } from './date.js'
import { SPORTS, sportById } from './sports.js'

export const EVENT_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core']
export const eventTime = (event) => new Date(`${event.date}T${event.time}:00`).getTime()
const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && toKey(fromKey(date)) === date
export function validTrainingEvent(e) {
  return Boolean(
    e &&
    typeof e.id === 'string' &&
    e.id &&
    typeof e.title === 'string' &&
    e.title.trim().length &&
    e.title.length <= 100 &&
    ['activity', 'competition', 'occasion'].includes(e.kind) &&
    validDate(e.date) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time || '') &&
    Number.isInteger(e.minutes) &&
    e.minutes >= 5 &&
    e.minutes <= 480 &&
    ['easy', 'normal', 'hard'].includes(e.effort) &&
    ['planned', 'done', 'cancelled'].includes(e.status) &&
    (!e.sport || SPORTS.some((s) => s.id === e.sport)) &&
    e.impact &&
    typeof e.impact.summary === 'string' &&
    e.impact.summary.length <= 500 &&
    (!e.focus || (Array.isArray(e.focus) && e.focus.every((m) => EVENT_MUSCLES.includes(m)))) &&
    Array.isArray(e.impact.muscles) &&
    e.impact.muscles.every((m) => EVENT_MUSCLES.includes(m)) &&
    [e.impact.beforeHours, e.impact.afterHours].every((h) => Number.isFinite(h) && h >= 0 && h <= 48) &&
    Number.isFinite(eventTime(e)),
  )
}
export function presetImpact(sport, effort = 'normal', kind = 'activity') {
  const muscles = sport ? sportById(sport).muscles.filter((m) => EVENT_MUSCLES.includes(m)) : []
  return {
    muscles,
    beforeHours: effort === 'easy' ? 0 : kind === 'competition' || effort === 'hard' ? 48 : 24,
    afterHours: effort === 'easy' ? 0 : effort === 'hard' || kind === 'competition' ? 24 : 12,
    summary:
      effort === 'easy'
        ? 'No change to your plan.'
        : `Lighter around it${muscles.length ? `, especially ${muscles.join(', ').toLowerCase()}` : ''}.`,
    source: 'preset',
  }
}
export function eventOccurrences(events = [], start, end) {
  return (Array.isArray(events) ? events : [])
    .filter(validTrainingEvent)
    .filter((e) => e.status !== 'cancelled' && e.date >= start && e.date <= end)
    .map((e) => ({
      ...e,
      name: e.title,
      at: eventTime(e),
      endsAt: eventTime(e) + e.minutes * 60000,
      key: e.id,
      type: e.kind === 'competition' ? 'match' : 'practice',
    }))
    .sort((a, b) => a.at - b.at)
}
export function trainingEventContext(profile, { today, now = Date.now(), minutes = 30 } = {}) {
  const rows = eventOccurrences(profile.lifeEvents, addDays(today, -2), addDays(today, 7))
  const upcoming = rows.filter((e) => e.status === 'planned' && e.endsAt > now)
  const protectedEvents = upcoming.filter(
    (e) => e.kind !== 'occasion' && e.effort !== 'easy' && e.at - now <= e.impact.beforeHours * 3600000,
  )
  const recent = rows.filter(
    (e) =>
      e.kind !== 'occasion' &&
      e.endsAt <= now &&
      e.effort !== 'easy' &&
      now - e.endsAt <= e.impact.afterHours * 3600000,
  )
  const relevant = [...protectedEvents, ...recent]
  const preparation =
    upcoming.find((e) => e.kind === 'competition' && e.sport && e.at > now && e.at - now <= 7 * 86400000) ||
    null
  const overlap = upcoming.find((e) => e.at < now + minutes * 60000 && e.endsAt > now) || null
  const before = protectedEvents[0],
    after = recent.at(-1)
  const note = before
    ? `Saving energy for ${before.title.toLowerCase()}.`
    : after
      ? `${after.status === 'done' ? 'You logged' : 'You had planned'} ${after.title.toLowerCase()}, so this one is lighter.`
      : preparation
        ? `${preparation.title} soon: balanced work with some ${sportById(preparation.sport).name.toLowerCase()} prep.`
        : ''
  return {
    upcoming,
    recent,
    next: upcoming[0] || null,
    preparation,
    overlap,
    lighter: relevant.length > 0,
    muscles: [...new Set(relevant.flatMap((e) => e.impact.muscles))],
    note,
    reasonEvent: before || after || null,
    reasonPhase: before ? 'before' : 'after',
  }
}
export function eventHistory(profile, today) {
  return eventOccurrences(profile.lifeEvents, '2000-01-01', today).filter(
    (e) => e.status === 'done' && e.at <= Date.now(),
  )
}
export function saveTrainingEvent(profile, event) {
  if (!validTrainingEvent(event)) return profile
  // Derived occurrence fields must not become stored timestamps after rescheduling.
  const { name, at, endsAt, key, type, ...stored } = event
  return {
    ...profile,
    eventMode: 'one-off',
    lifeEvents: [...(profile.lifeEvents || []).filter((e) => e.id !== event.id), stored],
  }
}
