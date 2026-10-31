import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { buildApp } from '../src/app.js'
import { preparePhotos } from '../src/photo/images.js'
import { type ModelAssessment } from '../src/photo/schema.js'
const quality = { usable: true, feedback: 'Usable view' }
const result: ModelAssessment = {
  views: { front: quality, side: quality, back: quality },
  summary: 'Fixture only',
  observations: [],
  suggestedFocus: [],
  limitations: ['Images do not measure strength.'],
}
const photo = async (color: string, angle: 'front' | 'side' | 'back') => ({
  angle,
  base64: (
    await sharp({
      create: { width: 300, height: 400, channels: 3, background: color },
    })
      .jpeg()
      .toBuffer()
  ).toString('base64'),
})

test('photo routes validate consent, age, origins and return a reviewed result with injected analyzers only', async () => {
  let calls = 0
  const app = buildApp({
    analyze: async () => {
      calls++
      return result
    },
    quality: async () => quality,
  })
  const body = {
    consent: true,
    ownPhotosConfirmed: true,
    guardianPermission: false,
    ageGroup: '18+',
    goal: 'General fitness',
    photos: await Promise.all([
      photo('red', 'front'),
      photo('green', 'side'),
      photo('blue', 'back'),
    ]),
  }
  const missing = await app.inject({
    method: 'POST',
    url: '/api/photo-assessments',
    payload: { ...body, consent: false },
  })
  assert.equal(missing.statusCode, 400)
  assert.equal(calls, 0)
  const foreign = await app.inject({
    method: 'POST',
    url: '/api/photo-assessments',
    headers: { origin: 'http://untrusted.example' },
    payload: body,
  })
  assert.equal(foreign.statusCode, 403)
  assert.equal(calls, 0)
  const teen = await app.inject({
    method: 'POST',
    url: '/api/photo-assessments',
    payload: { ...body, ageGroup: '13-17' },
  })
  assert.equal(teen.statusCode, 400)
  const response = await app.inject({
    method: 'POST',
    url: '/api/photo-assessments',
    headers: { host: '192.168.1.2:5182', origin: 'http://192.168.1.2:5182' },
    payload: body,
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().status, 'ready')
  assert.equal(calls, 1)
  assert.equal(response.headers['cache-control'], 'no-store')
  const check = await app.inject({
    method: 'POST',
    url: '/api/photo-quality',
    payload: {
      ...body,
      photos: undefined,
      photo: body.photos[0],
      goal: undefined,
    },
  })
  assert.equal(check.statusCode, 200)
  await app.close()
})
test('duplicate and malformed images are rejected before model use', async () => {
  const front = await photo('red', 'front')
  await assert.rejects(
    () => preparePhotos([front, { ...front, angle: 'back' }]),
    /different photos/,
  )
  await assert.rejects(
    () => preparePhotos([{ angle: 'front', base64: 'not valid!' }]),
    /encoding/,
  )
})
test('flagged views withhold observations and provider errors do not expose secrets', async () => {
  const app = buildApp({
    analyze: async () => ({
      ...result,
      views: {
        ...result.views,
        front: { usable: false, feedback: 'Retake front' },
      },
      suggestedFocus: [{ area: 'arms', reason: 'must be hidden' }],
    }),
    quality: async () => {
      throw new Error('private-provider-detail')
    },
  })
  const photos = await Promise.all([
    photo('red', 'front'),
    photo('green', 'side'),
    photo('blue', 'back'),
  ])
  const common = {
    consent: true,
    ownPhotosConfirmed: true,
    guardianPermission: false,
    ageGroup: '18+',
  }
  const review = await app.inject({
    method: 'POST',
    url: '/api/photo-assessments',
    payload: { ...common, photos, goal: 'General fitness' },
  })
  assert.equal(review.json().status, 'retake_required')
  assert.deepEqual(review.json().suggestedFocus, [])
  const failed = await app.inject({
    method: 'POST',
    url: '/api/photo-quality',
    payload: { ...common, photo: photos[0] },
  })
  assert.equal(failed.statusCode, 502)
  assert.ok(!failed.body.includes('private-provider-detail'))
  await app.close()
})

test('synthetic adult fixtures use the actual validation pipeline only when explicitly enabled', async()=>{
  let calls=0
  const app=buildApp({allowSynthetic:true,quality:async()=>{calls++;return quality},analyze:async()=>{calls++;return result}})
  const photos=await Promise.all((['front','side','back'] as const).map(async angle=>({angle,base64:(await readFile(new URL(`../../src/assets/testing/${angle}.jpg`,import.meta.url))).toString('base64')})))
  const common={consent:true,ownPhotosConfirmed:false,synthetic:true,ageGroup:'18+',guardianPermission:false}
  const q=await app.inject({method:'POST',url:'/api/photo-quality',payload:{...common,photo:photos[0]}})
  assert.equal(q.statusCode,200)
  const r=await app.inject({method:'POST',url:'/api/photo-assessments',payload:{...common,goal:'General fitness',photos}})
  assert.equal(r.statusCode,200);assert.equal(r.json().status,'ready');assert.equal(calls,2)
  const wrong=await app.inject({method:'POST',url:'/api/photo-assessments',payload:{...common,ownPhotosConfirmed:true,goal:'General fitness',photos}})
  assert.equal(wrong.statusCode,400);assert.equal(calls,2)
  await app.close()
  const disabled=buildApp({allowSynthetic:false,analyze:async()=>{throw new Error('Must not call')},quality:async()=>{throw new Error('Must not call')}})
  const denied=await disabled.inject({method:'POST',url:'/api/photo-assessments',payload:{...common,goal:'General fitness',photos}})
  assert.equal(denied.statusCode,400)
  await disabled.close()
})
