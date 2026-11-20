// Reconcile independent edits against the exact state this tab last saw.
// A workout is one transaction: a stale tab cannot reopen or overwrite a
// session another tab has finished. Keep both versions on an actual conflict.
import { convertStateUnits } from './units.js'

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)
const object = (x) => x != null && typeof x === 'object' && !Array.isArray(x)
const collections = new Set(['workouts', 'routines', 'customExercises', 'personalRecords', 'checkins'])

export function mergeBrowserEdits(base, local, remote) {
  const unit =
    local.settings.weightUnit !== base.settings.weightUnit
      ? local.settings.weightUnit
      : remote.settings.weightUnit
  const align = (state) => (state.settings.weightUnit === unit ? state : convertStateUnits(state, unit))
  function merge(before, ours, theirs, path) {
    if (same(before, ours)) return theirs
    if (same(before, theirs) || same(ours, theirs)) return ours
    if (
      collections.has(path) &&
      [before, ours, theirs].every(Array.isArray) &&
      [before, ours, theirs].every((rows) => rows.every((r) => typeof r?.id === 'string'))
    ) {
      const [old, left, right] = [before, ours, theirs].map((rows) => new Map(rows.map((r) => [r.id, r])))
      return [...new Set([...right.keys(), ...left.keys()])]
        .map((id) => merge(old.get(id), left.get(id), right.get(id), 'saved record'))
        .filter(Boolean)
    }
    if (path !== 'activeWorkout' && path !== 'saved record' && [before, ours, theirs].every(object)) {
      const result = {}
      for (const key of new Set([...Object.keys(before), ...Object.keys(ours), ...Object.keys(theirs)])) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
        const value = merge(before[key], ours[key], theirs[key], path ? path + '.' + key : key)
        if (value !== undefined) result[key] = value
      }
      return result
    }
    throw new Error('Another tab changed the same training data.')
  }
  return merge(align(base), align(local), align(remote), '')
}

let lockDb
// Web Locks are unavailable on plain-HTTP Wi-Fi previews. IndexedDB write
// transactions still serialize same-origin tabs there.
export function withSaveLock(work) {
  if (globalThis.navigator?.locks) return navigator.locks.request('tally-browser-save', work)
  if (!globalThis.indexedDB) return Promise.resolve().then(work)
  lockDb ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('tally-save-lock', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('writer')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      lockDb = null
      reject(request.error)
    }
  })
  return lockDb.then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('writer', 'readwrite')
        let result
        tx.objectStore('writer').get('turn').onsuccess = () => {
          try {
            result = work()
          } catch (error) {
            tx.abort()
            reject(error)
          }
        }
        tx.oncomplete = () => resolve(result)
        tx.onabort = () => reject(tx.error || new Error('Save interrupted.'))
        tx.onerror = () => reject(tx.error)
      }),
  )
}
