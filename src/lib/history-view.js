import { addDays, fromKey, MONTHS, toKey, WEEKDAY_INITIALS } from './date.js'
import { weekStart } from './workout.js'
import { convertWeight } from './units.js'

const dateAt = (year, month, day) =>
  toKey(new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate())))
export function historyVolumeView(workouts, range, today, unit) {
  const d = fromKey(today)
  const year = d.getFullYear(),
    month = d.getMonth(),
    day = d.getDate()
  const volume = (start, end) =>
    workouts.reduce(
      (sum, w) =>
        !w.sample &&
        !['sport', 'recovery', 'pump'].includes(w.kind) &&
        w.date >= start &&
        w.date <= end &&
        w.date <= today
          ? sum + (convertWeight(w.totals?.volume || 0, w.unit || unit, unit) || 0)
          : sum,
      0,
    )
  if (range === 'week') {
    const start = weekStart(today)
    return {
      title: 'Volume this week',
      comparison: 'Same days last week',
      now: volume(start, today),
      prev: volume(addDays(start, -7), addDays(today, -7)),
      bars: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i)
        return {
          label: WEEKDAY_INITIALS[i],
          date,
          volume: volume(date, date),
          current: date === today,
          future: date > today,
        }
      }),
    }
  }
  if (range === 'month') {
    const start = dateAt(year, month, 1)
    const previousStart = dateAt(year, month - 1, 1)
    return {
      title: 'Volume this month',
      comparison: 'Same dates last month',
      now: volume(start, today),
      prev: volume(previousStart, dateAt(year, month - 1, day)),
      bars: Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => {
        const date = dateAt(year, month, i + 1)
        return {
          label: i % 7 === 0 ? String(i + 1) : '',
          date,
          volume: volume(date, date),
          current: date === today,
          future: date > today,
        }
      }),
    }
  }
  return {
    title: 'Volume this year',
    comparison: 'Same dates last year',
    now: volume(dateAt(year, 0, 1), today),
    prev: volume(dateAt(year - 1, 0, 1), dateAt(year - 1, month, day)),
    bars: Array.from({ length: 12 }, (_, i) => ({
      label: MONTHS[i][0],
      date: dateAt(year, i, 1),
      volume: volume(dateAt(year, i, 1), dateAt(year, i + 1, 0)),
      current: i === month,
      future: i > month,
    })),
  }
}
