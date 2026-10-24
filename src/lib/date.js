// Spelled out so labels don't depend on the browser's locale.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Date helpers. We key everything off a local "YYYY-MM-DD" string so that
// entries land on the day the user actually logged them (no UTC drift).

export function toKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey() {
  return toKey(new Date())
}

// Parse a "YYYY-MM-DD" key into a local Date (midnight local time).
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, n) {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

// Human friendly label, e.g. "Today", "Yesterday" or "Mon, Jun 28".
export function labelForKey(key) {
  const t = todayKey()
  if (key === t) return 'Today'
  if (key === addDays(t, -1)) return 'Yesterday'
  if (key === addDays(t, 1)) return 'Tomorrow'
  return fromKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Return an array of the last `n` day-keys ending today (oldest first).
export function lastNDays(n) {
  const out = []
  const t = todayKey()
  for (let i = n - 1; i >= 0; i--) out.push(addDays(t, -i))
  return out
}

// Short label for charts, e.g. "Jun 28".
export function shortLabel(key) {
  return fromKey(key).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// labelForKey for use mid-sentence: "today", "yesterday", but "Tue, Oct 20"
// keeps its capitals.
export function inlineLabel(key) {
  const label = labelForKey(key)
  return ['Today', 'Yesterday', 'Tomorrow'].includes(label) ? label.toLowerCase() : label
}
