// Saved check-in previews live outside the main training save. The main save
// is rewritten after every logged set; keeping ~60 images out of it keeps that
// write small and well under browser storage limits.
//
// Browser: IndexedDB on this origin. Expo Go: files on the device, through the
// native bridge, because the WebView origin changes with the computer's address.
import { isNativeApp, nativeRequest } from './native.js'

export const PREVIEW_LIMIT = 20

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tally-photo-previews', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('previews')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, work) {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('previews', mode)
      const result = work(tx.objectStore('previews'))
      tx.oncomplete = () => resolve(result.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Previews for the given check-ins, as `{ [id]: { front, side, back } }`. */
export async function loadPreviews(ids) {
  if (!ids.length) return {}
  if (isNativeApp()) return (await nativeRequest('photos.load', { ids }, 30_000)) || {}
  const found = await Promise.all(ids.map((id) => transact('readonly', (store) => store.get(id))))
  return Object.fromEntries(ids.map((id, i) => [id, found[i]]).filter(([, previews]) => previews))
}

export async function savePreviews(id, previews) {
  if (isNativeApp()) return nativeRequest('photos.save', { id, previews }, 30_000)
  return transact('readwrite', (store) => store.put(previews, id))
}

export async function deletePreviews(ids) {
  if (!ids.length) return
  if (isNativeApp()) return nativeRequest('photos.delete', { ids }, 30_000)
  await Promise.all(ids.map((id) => transact('readwrite', (store) => store.delete(id))))
}

/** Check-ins whose previews are kept: the most recent PREVIEW_LIMIT. */
export function keptPreviewIds(checkins) {
  return [...checkins]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-PREVIEW_LIMIT)
    .map((c) => c.id)
}

/**
 * Opens the preview store for a freshly loaded save. Saves from older versions
 * kept previews inline; those are copied to the store and only then removed
 * from the save, so a failed copy never loses an image.
 */
export async function openPreviews(state) {
  const inline = state.checkins.filter((c) => c.previews)
  const moved = {}
  for (const c of inline) {
    try {
      await savePreviews(c.id, c.previews)
      moved[c.id] = c.previews
    } catch (error) {
      console.error('Could not move a check-in preview:', error)
    }
  }
  const stored = await loadPreviews(state.checkins.filter((c) => !c.previews).map((c) => c.id)).catch(
    (error) => {
      console.error('Could not open check-in previews:', error)
      return {}
    },
  )
  return {
    previews: { ...stored, ...moved },
    state: {
      ...state,
      checkins: state.checkins.map((c) => {
        if (!moved[c.id]) return c
        const { previews: _previews, ...rest } = c
        return { ...rest, hasPreviews: true }
      }),
    },
  }
}
