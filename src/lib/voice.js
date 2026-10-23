// Tally's voice: a dry, encouraging coach who keeps it to one line.
// Each helper picks a line from the day's numbers. Lines rotate by date so
// they don't change on every render but don't repeat every day either.

const pick = (lines, seed = '') => {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return lines[h % lines.length]
}

// Today tab, under the title.
export function todayLine({ date, today, eaten, goal, trainedToday, weekCount, weeklyGoal, nextName }) {
  if (date < today) {
    return eaten > 0 ? 'The record stands. You can still edit it.' : 'Nothing on the books for this one.'
  }
  if (date > today) return 'The future. Plan it, then go earn it.'
  const hour = new Date().getHours()
  if (trainedToday && goal && eaten >= goal * 0.85) return pick(['Trained and fed. That’s a full day.', 'Both boxes ticked. Go rest.'], date)
  if (trainedToday) return pick(['Session banked. Now refuel properly.', 'That one counts. Eat like it.'], date)
  if (weeklyGoal && weekCount >= weeklyGoal) return pick(['Weekly goal done. Everything else is a bonus.', `${weekCount} for ${weeklyGoal}. Show-off.`], date)
  if (goal && eaten > goal) return 'Over on calories. Tomorrow’s a clean sheet.'
  if (hour < 11) return pick(['Morning. Let’s make today count.', 'Fresh page. Start the tally.'], date)
  if (nextName) return pick([`${nextName} is waiting. Don’t keep it long.`, `${nextName} won’t do itself.`], date)
  return pick(['Every rep counts. So does lunch.', 'Small marks add up.'], date)
}

// Workout tab, under the weekly tally.
export function weekLine(count, goal) {
  if (!goal) return count ? `${count} logged this week.` : 'No goal set. Just show up.'
  if (count === 0) return 'Clean slate. First mark’s the hardest.'
  if (count >= goal + 1) return 'Past the goal. Now you’re just showing off.'
  if (count >= goal) return 'Goal hit. The week is yours.'
  const left = goal - count
  return left === 1 ? 'One more and the week is yours.' : `${left} more marks to close the week.`
}

// Workout summary, the big line after a session.
export function finishLine(records, sets) {
  if (records > 0) return records === 1 ? 'New personal best. Screenshot it.' : `${records} personal bests. Somebody’s been eating.`
  if (sets >= 20) return 'Big session. Mark it down.'
  return pick(['Another one on the tally.', 'Done. That’s a mark.', 'Showed up. That’s the whole trick.'], String(sets))
}
