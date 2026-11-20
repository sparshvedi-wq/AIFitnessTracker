// Export/import all app data as a JSON file for backup & restore.

import { isNativeApp, nativeRequest } from './native.js'
import { todayKey } from './date.js'
import { validateSnapshot } from '../../expo/src/protocol.js'
import { normalizeState } from './storage.js'
import { buildDailyPlan } from './planner.js'
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
const readableEvidence = (e) => isRecord(e) && listOf(e.attempts, isRecord)
const readableSession = (w) =>
  isRecord(w) &&
  Array.isArray(w.exercises) &&
  w.exercises.every((e) => readableEvidence(e) && Array.isArray(e.sets) && e.sets.every(isRecord)) &&
  listOf(w.attemptOnly, readableEvidence) &&
  listOf(w.priorAttempts, readableEvidence)
function readableActive(w) {
  if (!readableSession(w)) return false
  if (w.cursor == null) return true
  const { ex, set } = w.cursor
  return Number.isInteger(ex) && Number.isInteger(set) && Boolean(w.exercises[ex]?.sets[set])
}
const readableWorkout = (w) =>
  readableSession(w) && typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)

/**
 * The snapshot check only looks at the top level. A restore replaces everything
 * on the device, so every record the screens read must have its expected shape;
 * otherwise nothing is replaced.
 */
const strings = (x) => typeof x === 'string'
function validProfile(p) {
  if (p == null) return true
  if (!isRecord(p)) return false
  const names = ['sports', 'equipment', 'avoidMuscles', 'confirmedFocus', 'excludedExercises', 'onboardingBarriers', 'gymExtras']
  return names.every((key) => listOf(p[key], strings)) &&
    ['homeDumbbells', 'gymDumbbells'].every((key) => listOf(p[key], Number.isFinite)) &&
    ['places', 'lifeEvents', 'sportSchedule'].every((key) => listOf(p[key], isRecord)) &&
    (!p.onboardingDraft || (isRecord(p.onboardingDraft) && !p.onboardingDraft.profile?.onboardingDraft && validProfile(p.onboardingDraft.profile)))
}
export function validateBackup(data) {
  const readable =
    listOf(data.workouts, readableWorkout) &&
    listOf(data.routines, (r) => isRecord(r) && Array.isArray(r.items) && r.items.every(isRecord)) &&
    listOf(data.customExercises, (e) => isRecord(e) && typeof e.id === 'string') &&
    listOf(data.checkins, isRecord) &&
    listOf(data.personalRecords, isRecord) &&
    (data.metrics === undefined || isRecord(data.metrics)) &&
    (data.activeWorkout == null || readableActive(data.activeWorkout)) &&
    validProfile(data.settings?.training) &&
    (data.settings?.workout == null || isRecord(data.settings.workout))
  if (!readable) throw new Error('This backup has records Tally can’t read. Nothing was changed.')
  try {
    const candidate = normalizeState(data)
    buildDailyPlan(candidate, { today: todayKey() })
  } catch {
    throw new Error('This backup has training settings Tally can’t read. Nothing was changed.')
  }
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
