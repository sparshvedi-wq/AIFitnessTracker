import { isNativeApp, nativeRequest } from './native.js'

export const PHOTO_ANGLES = ['front', 'side', 'back']
export async function preparePhoto(source) {
  if (source instanceof Blob && source.size > 30 * 1024 * 1024)
    throw new Error('Choose a photo smaller than 30 MB.')
  const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : null
  try {
    const image = new Image()
    image.src = objectUrl || source
    await image.decode().catch(() => {
      throw new Error('This photo could not be opened. Choose a JPEG or PNG, or use the phone camera.')
    })
    if (Math.min(image.width, image.height) < 256)
      throw new Error('Choose a photo at least 256 pixels wide and tall.')
    const render = (size, quality) => {
      const scale = Math.min(1, size / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Photo processing is unavailable on this device.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', quality)
    }
    const data = render(1536, 0.82)
    if (data.length > 4 * 1024 * 1024) throw new Error('Choose a smaller photo.')
    return { base64: data.split(',')[1], preview: render(480, 0.72) }
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
export async function pickDevicePhoto(camera = false) {
  if (!isNativeApp()) return null
  const source = await nativeRequest('photo.pick', { camera }, 300_000)
  return source ? preparePhoto(source) : null
}
export async function photoRequest(path, body, signal) {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) controller.abort()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 90000)
  try {
    let response
    try {
      response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      if (e.name === 'AbortError') {
        if (timedOut) throw new Error('The review took too long. Your photos are kept here; try again.')
        throw e
      }
      throw new Error(
        'Cannot reach photo analysis. Keep the computer and Tally photo service running on the same Wi-Fi.',
      )
    }
    let result
    try {
      result = await response.json()
    } catch {
      if (controller.signal.aborted) {
        if (timedOut) throw new Error('The review took too long. Your photos are kept here; try again.')
        throw new DOMException('Cancelled', 'AbortError')
      }
      throw new Error('The photo service is unavailable. Start it with npm run dev:photos.')
    }
    if (!response.ok) throw new Error(result.error || 'Photo review could not finish. Try again.')
    return result
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}
export function withoutPhotoPreviews(state) {
  return {
    ...state,
    checkins: (state.checkins || []).map(({ previews, ...checkin }) => checkin),
  }
}
