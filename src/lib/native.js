import { CHANNEL, RESPONSE_EVENT, validateSnapshot } from '../../expo/src/protocol.js'

// One small adapter; ordinary browsers continue using their existing APIs.
export function createNativeBridge(host) {
  const pending = new Map()
  const session = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
  let counter = 0,
    listening = false
  const available = () => typeof host?.ReactNativeWebView?.postMessage === 'function'
  function request(method, payload = {}, timeout = 15_000) {
    if (!available()) return Promise.reject(new Error('The native device connection is unavailable.'))
    if (!listening) {
      host.addEventListener(RESPONSE_EVENT, ({ detail }) => {
        if (detail?.channel !== CHANNEL || typeof detail.id !== 'string') return
        const work = pending.get(detail.id)
        if (!work) return
        pending.delete(detail.id)
        clearTimeout(work.timer)
        if (detail.error) work.reject(new Error(detail.error))
        else work.resolve(detail.result)
      })
      listening = true
    }
    return new Promise((resolve, reject) => {
      const id = session + '-' + ++counter
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('The device did not respond. Reopen Tally and try again.'))
      }, timeout)
      pending.set(id, { resolve, reject, timer })
      try {
        host.ReactNativeWebView.postMessage(JSON.stringify({ channel: CHANNEL, id, method, payload }))
      } catch (error) {
        clearTimeout(timer)
        pending.delete(id)
        reject(error)
      }
    })
  }
  return { available, request }
}

const bridge = createNativeBridge(typeof window === 'undefined' ? undefined : window)
export const isNativeApp = bridge.available
export const nativeRequest = bridge.request
let deviceSnapshot = null
export const readNativeState = () => deviceSnapshot

export async function restoreNativeState() {
  if (!isNativeApp()) return
  const raw = await nativeRequest('storage.load')
  if (raw !== null) {
    validateSnapshot(raw)
  }
  deviceSnapshot = raw
}

export async function persistNativeState(raw) {
  if (!isNativeApp()) return
  deviceSnapshot = raw
  await nativeRequest('storage.save', { raw })
}
