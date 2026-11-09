// Export/import all app data as a JSON file for backup & restore.

import { isNativeApp, nativeRequest } from './native.js'
import { todayKey } from './date.js'
import { validateSnapshot } from '../../expo/src/protocol.js'
import { withoutPhotoPreviews } from './photos.js'

export async function exportData(state) {
  state = withoutPhotoPreviews(state)
  if (isNativeApp()) {
    await nativeRequest('backup.export', { raw: JSON.stringify(state, null, 2) }, 300_000)
    return
  }
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Named by the local date, so an evening export isn't labelled tomorrow.
  a.download = `tally-backup-${todayKey()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function pickNativeBackup() {
  const raw = await nativeRequest('backup.pick', {}, 300_000)
  return raw === null ? null : validateBackup(validateSnapshot(raw))
}

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const listOf = (value, check) => value === undefined || (Array.isArray(value) && value.every(check))
const readableSession = (w) =>
  isRecord(w) &&
  Array.isArray(w.exercises) &&
  w.exercises.every((e) => isRecord(e) && Array.isArray(e.sets) && e.sets.every(isRecord))
const readableWorkout = (w) =>
  readableSession(w) && typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)

/**
 * The snapshot check only looks at the top level. A restore replaces everything
 * on the device, so every record the screens read must have its expected shape;
 * otherwise nothing is replaced.
 */
export function validateBackup(data) {
  const readable =
    listOf(data.workouts, readableWorkout) &&
    listOf(data.routines, (r) => isRecord(r) && Array.isArray(r.items) && r.items.every(isRecord)) &&
    listOf(data.customExercises, (e) => isRecord(e) && typeof e.id === 'string') &&
    listOf(data.checkins, isRecord) &&
    (data.metrics === undefined || isRecord(data.metrics)) &&
    (data.activeWorkout == null || readableSession(data.activeWorkout)) &&
    (data.settings?.training == null || isRecord(data.settings.training)) &&
    (data.settings?.workout == null || isRecord(data.settings.workout))
  if (!readable) throw new Error('This backup has records Tally can’t read. Nothing was changed.')
  return data
}

// Read & validate an imported JSON file. Resolves with the parsed state.
export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = validateBackup(validateSnapshot(String(reader.result)))
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}
