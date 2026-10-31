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
  return raw === null ? null : validateSnapshot(raw)
}

// Read & validate an imported JSON file. Resolves with the parsed state.
export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = validateSnapshot(String(reader.result))
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}
