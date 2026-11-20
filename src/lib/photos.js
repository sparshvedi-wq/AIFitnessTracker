import { isNativeApp, nativeRequest } from './native.js'

export const PHOTO_ANGLES = ['front', 'side', 'back']
// Three base64 views plus JSON must fit under the hosting function's body limit.
export const MAX_PHOTO_DATA_URL = 1_200_000
export function encodeUploadPhoto(render) {
  for (const size of [1536, 1280, 1024]) {
    for (const quality of [0.82, 0.72, 0.62]) {
      const data = render(size, quality)
      if (data.length <= MAX_PHOTO_DATA_URL) return data
    }
  }
  throw new Error('This photo is too large. Choose a simpler, smaller photo.')
}
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
    const data = encodeUploadPhoto(render)
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
  const payload = JSON.stringify(body)
  if (new TextEncoder().encode(payload).length > 4_000_000)
    throw new Error(
      'This saved photoset is too large to upload. Replace its photos to prepare smaller copies.',
    )
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
        body: payload,
        signal: controller.signal,
      })
    } catch (e) {
      if (e.name === 'AbortError') {
        if (timedOut) throw new Error('The review took too long. Your photos are kept here; try again.')
        throw e
      }
      throw new Error(
        import.meta.env?.DEV
          ? 'Cannot reach photo analysis. Keep the computer and Tally photo service running on the same Wi-Fi.'
          : 'Cannot reach photo analysis. Check your internet connection and try again.',
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
      throw new Error(
        import.meta.env?.DEV
          ? 'The photo service is unavailable. Start it with npm run dev:photos.'
          : 'Photo analysis is temporarily unavailable. Please try again shortly.',
      )
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
