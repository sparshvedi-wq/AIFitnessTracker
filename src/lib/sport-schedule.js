import { addDays, fromKey, toKey } from './date.js'
import { SPORTS, sportById } from './sports.js'
import { trainingEventContext } from './training-events.js'

export const EVENT_TYPES = { practice: 'Practice', match: 'Match / competition' }
export const EVENT_EFFORTS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && toKey(fromKey(value)) === value
export function validSportEvent(event) {
  return Boolean(
    event &&
    typeof event.id === 'string' &&
    event.id.length > 0 &&
    SPORTS.some((s) => s.id === event.sport) &&
    Object.hasOwn(EVENT_TYPES, event.type) &&
    Object.hasOwn(EVENT_EFFORTS, event.effort) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time || '') &&
    Number.isInteger(event.minutes) &&
    event.minutes >= 10 &&
    event.minutes <= 360 &&
    (!event.startsOn || validDate(event.startsOn)) &&
    (event.repeat === 'weekly'
      ? Array.isArray(event.days) &&
        event.days.length &&
        event.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : event.repeat === 'once' && validDate(event.date)),
  )
}

// Local wall-clock times deliberately follow the device timezone, including DST.
export function sportOccurrences(events = [], start, end) {
  const rows = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    for (const event of (Array.isArray(events) ? events : []).filter(validSportEvent)) {
      if (event.repeat === 'weekly' && event.startsOn && date < event.startsOn) continue
      if (event.repeat === 'weekly' ? !event.days.includes(fromKey(date).getDay()) : event.date !== date)
        continue
      if (event.skippedDates?.includes(date)) continue
      const at = new Date(`${date}T${event.time}:00`).getTime()
      if (!Number.isFinite(at)) continue
      rows.push({
        ...event,
        date,
        at,
        endsAt: at + event.minutes * 60000,
        name: sportById(event.sport).name,
        key: `${event.id}:${date}`,
      })
    }
  }
  return rows.sort((a, b) => a.at - b.at)
}

// A conservative planning preference, not a recovery measurement or prescription.
export function sportScheduleContext(profile, { today, now = Date.now(), minutes = 30 } = {}) {
  const events = sportOccurrences(
    profile.eventMode === 'one-off' ? [] : profile.sportSchedule || [],
    addDays(today, -1),
    addDays(today, 2),
  )
  const upcoming = events.filter((e) => e.at + e.minutes * 60000 > now && e.at - now <= 48 * 3600000)
  const recent = events.filter(
    (e) =>
      e.endsAt <= now &&
      now - e.endsAt <= 24 * 3600000 &&
      (e.effort === 'hard' || (e.type === 'match' && e.effort !== 'easy')),
  )
  const protectedEvents = upcoming.filter(
    (e) =>
      e.at - now <= (e.type === 'match' || e.effort === 'hard' ? 48 : 24) * 3600000 && e.effort !== 'easy',
  )
  const relevant = [...protectedEvents, ...recent]
  const muscles = [...new Set(relevant.flatMap((e) => sportById(e.sport).muscles))]
  const overlap = upcoming.find((e) => e.at < now + minutes * 60000 && e.endsAt > now)
  const next = upcoming[0] || null
  const note = overlap
    ? `${overlap.name} ${overlap.type === 'match' ? 'competition' : 'practice'} overlaps this time. Go shorter, warm up, or train later.`
    : protectedEvents[0]
      ? `Lighter before your ${protectedEvents[0].name.toLowerCase()} ${protectedEvents[0].type === 'match' ? 'competition' : 'practice'}.`
      : recent[0]
        ? `Lighter after ${recent[0].name.toLowerCase()}.`
        : ''
  const life = trainingEventContext(profile, { today, now, minutes })
  return {
    next: life.next || next,
    recent: [...recent, ...life.recent],
    upcoming: [...upcoming, ...life.upcoming].sort((a, b) => a.at - b.at),
    muscles: [...new Set([...muscles, ...life.muscles])],
    lighter: relevant.length > 0 || life.lighter,
    overlap: life.overlap || overlap,
    note: life.note || note,
    preparation: life.preparation,
    reasonEvent: life.reasonEvent || protectedEvents[0] || recent[0] || null,
    reasonPhase: life.reasonEvent ? life.reasonPhase : protectedEvents.length ? 'before' : 'after',
  }
}
