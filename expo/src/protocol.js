export const CHANNEL = 'tally-native-v1'
export const RESPONSE_EVENT = 'tally:native-response'
export const STORAGE_KEY = 'tally:v1'
/** Saves from before the rename; read as a fallback and never deleted. */
export const LEGACY_STORAGE_KEY = 'calorie-tracker:v1'
export const MAX_SNAPSHOT = 8_000_000

/** @param {string} raw */
export function validateSnapshot(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_SNAPSHOT) throw new Error('The backup is too large to save on this device.')
  const value = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)
    // Current saves always carry workouts; saves from before the rename carry entries.
    || !Array.isArray(value.workouts) && !Array.isArray(value.entries)
    || value.workouts !== undefined && !Array.isArray(value.workouts)
    || value.routines !== undefined && !Array.isArray(value.routines)
    || value.settings !== undefined && (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings))) {
    throw new Error('This file does not look like a valid Tally backup.')
  }
  return value
}

/** @param {string | undefined} hostUri @param {string | undefined} override */
export function resolveInkUrl(hostUri, override) {
  if (override?.trim()) {
    const url = new URL(override.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http or https Ink app URL without credentials.')
    return url.href
  }
  if (!hostUri) throw new Error('Start this project with npm run dev:phone, or set EXPO_PUBLIC_INK_URL.')
  const url = new URL(hostUri.includes('://') ? hostUri : 'http://' + hostUri)
  url.protocol = 'http:'
  url.port = '5182'
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url.href
}

/** @param {string} url @param {string} origin */
export function isAppOrigin(url, origin) {
  try { return new URL(url).origin === origin } catch { return false }
}

const methods = new Set(['storage.load', 'storage.save', 'photos.load', 'photos.save', 'photos.delete', 'timer.schedule', 'timer.cancel', 'speech.say', 'haptics.buzz', 'screen.keepAwake', 'share.text', 'backup.export', 'backup.pick', 'photo.pick'])

/** @param {string} raw @param {string} url @param {string} origin */
export function parseRequest(raw, url, origin) {
  if (!isAppOrigin(url, origin) || raw.length > MAX_SNAPSHOT * 2 + 1000) throw new Error('Invalid native request origin or size.')
  const value = JSON.parse(raw)
  if (!value || value.channel !== CHANNEL || typeof value.id !== 'string' || value.id.length > 100
    || typeof value.method !== 'string' || !methods.has(value.method) || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
    throw new Error('Unsupported native request.')
  }
  return /** @type {{channel:string;id:string;method:string;payload:Record<string,unknown>}} */ (value)
}

/** @param {string} id @param {unknown} result @param {string | null} error */
export function responseScript(id, result, error = null) {
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(RESPONSE_EVENT)},{detail:${JSON.stringify({ channel: CHANNEL, id, result, error })}}));true;`
}
