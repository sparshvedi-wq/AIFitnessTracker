import { LEGACY_STORAGE_KEY, MAX_SNAPSHOT, STORAGE_KEY, validateSnapshot } from './protocol.js'

export type DeviceServices = {
  load: (key: string) => Promise<string | null>
  save: (key: string, value: string) => Promise<unknown>
  remove: (key: string) => Promise<unknown>
  say: (text: string) => Promise<void>
  haptic: (strong: boolean) => Promise<void>
  awake: (active: boolean) => Promise<void>
  shareText: (text: string) => Promise<unknown>
  exportBackup: (raw: string) => Promise<unknown>
  pickBackup: () => Promise<string | null>
  saveStatus: (failed: boolean) => void
  /** Local notification for a timer that ends while Tally is in the background. Resolves to its id, or null without permission. */
  scheduleCue: (seconds: number, title: string, body: string) => Promise<string | null>
  cancelCue: (id: string) => Promise<void>
}

const PHOTO_PREFIX = 'tally:photo:'
const MAX_PREVIEW = 1_000_000
const ANGLES = ['front', 'side', 'back']

function photoIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 200 || !value.every(isPhotoId)) throw new Error('Invalid check-in list.')
  return value
}
function isPhotoId(value: unknown): value is string {
  return typeof value === 'string' && /^[\w-]{1,100}$/.test(value)
}
/** Previews are three small JPEG data URLs and nothing else. */
function validPreviews(value: unknown): Record<string, string> {
  const previews = value as Record<string, unknown>
  if (!previews || typeof previews !== 'object' || Array.isArray(previews)
    || Object.keys(previews).some(key => !ANGLES.includes(key))
    || !ANGLES.every(a => typeof previews[a] === 'string' && (previews[a] as string).startsWith('data:image/jpeg;base64,') && (previews[a] as string).length <= MAX_PREVIEW)) {
    throw new Error('Invalid check-in photos.')
  }
  return previews as Record<string, string>
}

/** Serial writes prevent an older asynchronous save from overwriting a newer set. */
export function createDeviceService(device: DeviceServices) {
  let writes: Promise<unknown> = Promise.resolve()
  let lastRaw: string | null = null
  let saveSequence = 0
  let systemSheetOpen = false

  async function save(raw: unknown) {
    const sequence = ++saveSequence
    lastRaw = typeof raw === 'string' ? raw : null
    try {
      if (typeof raw !== 'string') throw new Error('Invalid training data.')
      validateSnapshot(raw)
    } catch (error) {
      device.saveStatus(true)
      throw error
    }
    const work = writes.then(() => device.save(STORAGE_KEY, raw))
    writes = work.catch(() => {})
    try {
      await work
      if (sequence === saveSequence) device.saveStatus(false)
    } catch {
      if (sequence === saveSequence) device.saveStatus(true)
      throw new Error('Your latest changes could not be saved on this device. Use Retry save.')
    }
    return null
  }

  async function withSheet(work: () => Promise<unknown>) {
    if (systemSheetOpen) throw new Error('Close the current system sheet before opening another.')
    systemSheetOpen = true
    try { return await work() } finally { systemSheetOpen = false }
  }

  return {
    retrySave: async () => { if (lastRaw !== null) await save(lastRaw) },
    async handle(method: string, payload: Record<string, unknown>): Promise<unknown> {
      switch (method) {
        case 'storage.load': {
          await writes
          const raw = (await device.load(STORAGE_KEY)) ?? (await device.load(LEGACY_STORAGE_KEY))
          if (raw !== null) validateSnapshot(raw)
          return raw
        }
        case 'storage.save': return save(payload.raw)
        case 'photos.load': {
          const ids = photoIds(payload.ids)
          const found: Record<string, unknown> = {}
          for (const id of ids) {
            const raw = await device.load(PHOTO_PREFIX + id)
            if (raw === null) continue
            try { found[id] = validPreviews(JSON.parse(raw)) } catch { /* Skip an unreadable preview; the check-in remains. */ }
          }
          return found
        }
        case 'photos.save': {
          if (!isPhotoId(payload.id)) throw new Error('Invalid check-in.')
          await device.save(PHOTO_PREFIX + payload.id, JSON.stringify(validPreviews(payload.previews)))
          return null
        }
        case 'timer.schedule': {
          const { seconds, title, body } = payload
          if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 1 || seconds > 3600
            || typeof title !== 'string' || title.length > 120 || typeof body !== 'string' || body.length > 240) {
            throw new Error('Invalid timer cue.')
          }
          return device.scheduleCue(Math.round(seconds), title, body)
        }
        case 'timer.cancel':
          if (typeof payload.id !== 'string' || payload.id.length > 200) throw new Error('Invalid timer cue.')
          await device.cancelCue(payload.id)
          return null
        case 'photos.delete':
          for (const id of photoIds(payload.ids)) await device.remove(PHOTO_PREFIX + id)
          return null
        case 'speech.say':
          if (typeof payload.text !== 'string' || payload.text.length > 2000) throw new Error('Invalid voice cue.')
          await device.say(payload.text)
          return null
        case 'haptics.buzz':
          await device.haptic(payload.strong === true)
          return null
        case 'screen.keepAwake':
          if (typeof payload.active !== 'boolean') throw new Error('Invalid screen setting.')
          await device.awake(payload.active)
          return null
        case 'share.text': {
          if (typeof payload.text !== 'string' || payload.text.length > 5000) throw new Error('Invalid workout summary.')
          const text = payload.text
          return withSheet(() => device.shareText(text))
        }
        case 'backup.export': {
          if (typeof payload.raw !== 'string') throw new Error('Invalid backup.')
          const raw = payload.raw
          validateSnapshot(raw)
          return withSheet(() => device.exportBackup(raw))
        }
        case 'backup.pick': return withSheet(async () => {
          const raw = await device.pickBackup()
          if (raw !== null) {
            if (raw.length > MAX_SNAPSHOT) throw new Error('The backup is too large.')
            validateSnapshot(raw)
          }
          // The existing web confirmation previews the backup before any state is replaced.
          return raw
        })
        default: throw new Error('Unsupported device action.')
      }
    },
  }
}
