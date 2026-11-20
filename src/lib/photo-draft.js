// Local photo drafts use IndexedDB rather than filling the history store.
// Nothing here uploads photos. Each origin/device has its own draft.
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tally-photo-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
let pending = Promise.resolve()
export function photoDraft(action, value) {
  const next = pending.catch(() => {}).then(() => runDraft(action, value))
  pending = next.catch(() => {})
  return next
}
async function runDraft(action, value) {
  const db = await database()
  try {
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', action === 'read' ? 'readonly' : 'readwrite')
      const store = tx.objectStore('drafts')
      const request =
        action === 'read'
          ? store.get('current')
          : action === 'clear'
            ? store.delete('current')
            : store.put(value, 'current')
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    if (action === 'read' && result && Date.now() - result.at >= 7 * 86400000) {
      await runDraft('clear')
      return undefined
    }
    return result
  } finally {
    db.close()
  }
}
