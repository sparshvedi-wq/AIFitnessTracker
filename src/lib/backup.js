// Export/import all app data as a JSON file for backup & restore.

import { STORAGE_KEY } from './storage.js'

export function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calorie-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Read & validate an imported JSON file. Resolves with the parsed state.
export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        // Minimal shape validation — must look like our state blob.
        if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) {
          throw new Error('This file does not look like a valid backup.')
        }
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

export { STORAGE_KEY }
