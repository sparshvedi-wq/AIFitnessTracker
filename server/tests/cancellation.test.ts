import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import sharp from 'sharp'
import { buildApp } from '../src/app.js'

const photo = async (color: string, angle: 'front' | 'side' | 'back') => ({
  angle,
  base64: (
    await sharp({ create: { width: 300, height: 400, channels: 3, background: color } })
      .jpeg()
      .toBuffer()
  ).toString('base64'),
})
const within = <T>(work: Promise<T>, ms: number, what: string) =>
  Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} did not happen`)), ms)),
  ])

test('leaving a photo review aborts the paid model call; a finished request is never aborted', async () => {
  let started!: () => void
  const running = new Promise<void>((resolve) => (started = resolve))
  let aborted!: () => void
  const stopped = new Promise<void>((resolve) => (aborted = resolve))
  let qualitySignal: AbortSignal | undefined
  const app = buildApp({
    assist: null,
    quality: async (_photo, _age, signal) => {
      qualitySignal = signal
      return { usable: true, feedback: 'Usable view' }
    },
    analyze: (_photos, _goal, _age, _focus, signal) => {
      started()
      return new Promise((_, reject) =>
        signal?.addEventListener(
          'abort',
          () => {
            aborted()
            reject(new Error('aborted'))
          },
          { once: true },
        ),
      )
    },
  })
  await app.listen({ host: '127.0.0.1', port: 0 })
  try {
    const { port } = app.server.address() as AddressInfo
    const base = `http://127.0.0.1:${port}`
    const consent = { consent: true, ownPhotosConfirmed: true, guardianPermission: false, ageGroup: '18+' }

    const checked = await fetch(`${base}/api/photo-quality`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...consent, photo: await photo('red', 'front') }),
    })
    assert.equal(checked.status, 200)
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(qualitySignal?.aborted, false, 'a completed reply does not abort its own call')

    const client = new AbortController()
    const pending = fetch(`${base}/api/photo-assessments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...consent,
        goal: 'General fitness',
        photos: await Promise.all([photo('red', 'front'), photo('green', 'side'), photo('blue', 'back')]),
      }),
      signal: client.signal,
    }).catch(() => null)
    await within(running, 5000, 'the model call')
    client.abort()
    await pending
    await within(stopped, 5000, 'aborting the model call')
  } finally {
    await app.close()
  }
})
