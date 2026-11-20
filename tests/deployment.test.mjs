import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeUploadPhoto, MAX_PHOTO_DATA_URL, photoRequest } from '../src/lib/photos.js'
import config from '../expo/app.config.js'

test('photo upload keeps normal quality and reduces only oversized images', () => {
  const calls = []
  const encoded = encodeUploadPhoto((size, quality) => {
    calls.push([size, quality])
    return quality > 0.72 ? 'x'.repeat(MAX_PHOTO_DATA_URL + 1) : 'small'
  })
  assert.equal(encoded, 'small')
  assert.deepEqual(calls, [
    [1536, 0.82],
    [1536, 0.72],
  ])
  assert.equal(
    encodeUploadPhoto(() => 'normal'),
    'normal',
  )
  assert.throws(() => encodeUploadPhoto(() => 'x'.repeat(MAX_PHOTO_DATA_URL + 1)), /too large/)
})
test('an oversized restored draft is rejected before any fetch', async () => {
  await assert.rejects(
    photoRequest('/api/photo-assessments', { photos: ['x'.repeat(4_000_001)] }),
    /too large/,
  )
})
test('store build requires a deployed HTTPS URL while LAN development stays available', () => {
  const previous = { build: process.env.EAS_BUILD, url: process.env.EXPO_PUBLIC_INK_URL }
  try {
    process.env.EAS_BUILD = 'true'
    delete process.env.EXPO_PUBLIC_INK_URL
    assert.throws(() => config({ config: { ios: {}, android: {} } }), /HTTPS/)
    process.env.EXPO_PUBLIC_INK_URL = 'http://localhost:5182'
    assert.throws(() => config({ config: { ios: {}, android: {} } }), /HTTPS/)
    process.env.EXPO_PUBLIC_INK_URL = 'https://tally.example'
    const result = config({ config: { name: 'Tally', ios: { supportsTablet: true } } })
    assert.equal(result.ios.supportsTablet, true)
    assert.ok(result.ios.bundleIdentifier)
  } finally {
    for (const [key, value] of [
      ['EAS_BUILD', previous.build],
      ['EXPO_PUBLIC_INK_URL', previous.url],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
