import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import {
  CHANNEL,
  MAX_SNAPSHOT,
  STORAGE_KEY,
  RESPONSE_EVENT,
  isAppOrigin,
  parseRequest,
  resolveInkUrl,
  responseScript,
  validateSnapshot,
} from '../expo/src/protocol.js'
import { createDeviceService } from '../expo/src/device-service.ts'
import { createNativeBridge } from '../src/lib/native.js'

const snapshot = JSON.stringify({
  version: 1,
  entries: [],
  workouts: [],
  routines: [],
  settings: { name: 'Fictional test' },
})
function device(overrides = {}) {
  let saved = null
  const keyed = new Map()
  const statuses = []
  return {
    load: async (key) => (key?.startsWith('tally:photo:') ? (keyed.get(key) ?? null) : saved),
    save: async (key, value) => {
      if (key?.startsWith('tally:photo:')) keyed.set(key, value)
      else saved = value
    },
    remove: async (key) => {
      keyed.delete(key)
    },
    say: async () => {},
    haptic: async () => {},
    awake: async () => {},
    shareText: async () => null,
    exportBackup: async () => null,
    pickBackup: async () => null,
    saveStatus: (failed) => statuses.push(failed),
    scheduleCue: async () => 'cue-1',
    cancelCue: async () => {},
    statuses,
    ...overrides,
  }
}

test('phone URLs follow the Expo host, support IPv6, and reject unsafe overrides', () => {
  assert.equal(resolveInkUrl('192.168.1.2:8081'), 'http://192.168.1.2:5182/')
  assert.equal(resolveInkUrl('[::1]:8081'), 'http://[::1]:5182/')
  assert.equal(resolveInkUrl(undefined, 'https://app.example.test/'), 'https://app.example.test/')
  assert.throws(() => resolveInkUrl(undefined))
  assert.throws(() => resolveInkUrl(undefined, 'javascript:alert(1)'))
  assert.throws(() => resolveInkUrl(undefined, 'https://password@example.test/'))
})

test('native actions accept only the exact app origin and known message protocol', () => {
  const origin = 'http://192.168.1.2:5182'
  const raw = JSON.stringify({ channel: CHANNEL, id: '1', method: 'storage.load', payload: {} })
  assert.equal(parseRequest(raw, origin + '/', origin).method, 'storage.load')
  for (const url of ['https://other.test/', origin + '.evil.test/', 'about:blank', 'javascript:alert(1)'])
    assert.throws(() => parseRequest(raw, url, origin))
  assert.equal(isAppOrigin(origin + '/nested', origin), true)
  assert.throws(() => parseRequest(raw.replace('storage.load', 'execute.code'), origin, origin))
})

test('invalid or oversized training backups are never persisted', async () => {
  assert.deepEqual(validateSnapshot(snapshot).entries, [])
  const service = createDeviceService(
    device({ save: async () => assert.fail('Invalid data reached storage') }),
  )
  for (const raw of [
    'null',
    '[]',
    '{}',
    '{bad json',
    JSON.stringify({ entries: [], workouts: 'wrong' }),
    'x'.repeat(MAX_SNAPSHOT + 1),
  ])
    await assert.rejects(service.handle('storage.save', { raw }))
})

test('native saves survive bridge recreation and do not depend on a LAN address', async () => {
  const storage = device()
  await createDeviceService(storage).handle('storage.save', { raw: snapshot })
  assert.equal(await createDeviceService(storage).handle('storage.load', {}), snapshot)
})

test('concurrent saves retain their order even if the first write is slow', async () => {
  const writes = []
  let release
  const first = new Promise((resolve) => {
    release = resolve
  })
  const service = createDeviceService(
    device({
      save: async (_key, raw) => {
        if (!writes.length) await first
        writes.push(raw)
      },
    }),
  )
  const newer = snapshot.replace('Fictional test', 'Newest test')
  const one = service.handle('storage.save', { raw: snapshot })
  const two = service.handle('storage.save', { raw: newer })
  release()
  await Promise.all([one, two])
  assert.deepEqual(writes, [snapshot, newer])
})

test('a failed native save can retry its latest value without clearing saved data', async () => {
  let fail = true,
    stored = 'previous'
  const storage = device({
    save: async (_key, raw) => {
      if (fail) throw new Error('Disk full')
      stored = raw
    },
  })
  const service = createDeviceService(storage)
  await assert.rejects(service.handle('storage.save', { raw: snapshot }), /Retry save/)
  assert.equal(stored, 'previous')
  fail = false
  await service.retrySave()
  assert.equal(stored, snapshot)
  assert.deepEqual(storage.statuses, [true, false])
})

test('corrupt saved data prevents startup rather than being replaced by defaults', async () => {
  const service = createDeviceService(
    device({ load: async () => '{broken', save: async () => assert.fail('Startup overwrote data') }),
  )
  await assert.rejects(service.handle('storage.load', {}))
})

test('backup picking previews data without saving and cancellation stays harmless', async () => {
  const service = createDeviceService(
    device({
      pickBackup: async () => snapshot,
      save: async () => assert.fail('Import bypassed confirmation'),
    }),
  )
  assert.equal(await service.handle('backup.pick', {}), snapshot)
  assert.equal(await createDeviceService(device()).handle('backup.pick', {}), null)
})

test('native voice, haptic, wake and sharing actions reach only the selected adapter', async () => {
  const seen = []
  const service = createDeviceService(
    device({
      say: async (t) => seen.push(t),
      haptic: async (strong) => seen.push(strong),
      awake: async (active) => seen.push(active),
      shareText: async (t) => seen.push(t),
      exportBackup: async (raw) => seen.push(raw),
    }),
  )
  await service.handle('speech.say', { text: 'Begin set' })
  await service.handle('haptics.buzz', { strong: true })
  await service.handle('haptics.buzz', { style: 'celebrate' })
  await service.handle('haptics.buzz', { style: 'not-a-style' })
  await service.handle('screen.keepAwake', { active: false })
  await service.handle('share.text', { text: 'Fictional summary' })
  await service.handle('backup.export', { raw: snapshot })
  // Older { strong } calls still work; unknown styles fall back to a light tap.
  assert.deepEqual(seen, ['Begin set', 'success', 'celebrate', 'light', false, 'Fictional summary', snapshot])
})

test('the real web bridge round-trips a response and does not evaluate backup contents', async () => {
  let listener
  const storage = device()
  const service = createDeviceService(storage)
  const host = {
    addEventListener: (name, callback) => {
      assert.equal(name, RESPONSE_EVENT)
      listener = callback
    },
    ReactNativeWebView: {
      postMessage: (raw) => {
        const request = parseRequest(raw, 'http://ink.test/', 'http://ink.test')
        void service.handle(request.method, request.payload).then((result) => {
          const sandbox = {
            window: { dispatchEvent: (event) => listener(event) },
            CustomEvent: class {
              constructor(type, init) {
                this.type = type
                this.detail = init.detail
              }
            },
          }
          vm.runInNewContext(responseScript(request.id, result), sandbox)
        })
      },
    },
  }
  const bridge = createNativeBridge(host)
  assert.equal(createNativeBridge(undefined).available(), false)
  await bridge.request('storage.save', { raw: snapshot })
  assert.equal(await bridge.request('storage.load'), snapshot)
  assert.equal(STORAGE_KEY, 'tally:v1')
})

test('Expo startup hydrates native state before any default save and never needs browser storage', async () => {
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const storage = device()
  await storage.save(STORAGE_KEY, snapshot)
  const service = createDeviceService(storage)
  let listener
  const host = {
    addEventListener: (_name, callback) => {
      listener = callback
    },
    ReactNativeWebView: {
      postMessage: (raw) => {
        const request = parseRequest(raw, 'http://ink.test/', 'http://ink.test')
        void service
          .handle(request.method, request.payload)
          .then((result) => listener({ detail: { channel: CHANNEL, id: request.id, result, error: null } }))
      },
    },
  }
  try {
    globalThis.window = host
    globalThis.localStorage = {
      getItem: () => assert.fail('Native startup used browser storage'),
      setItem: () => assert.fail('Native save used browser storage'),
    }
    const native = await import('../src/lib/native.js?native-startup-test')
    await native.restoreNativeState()
    assert.equal(native.readNativeState(), snapshot)
    const newer = snapshot.replace('Fictional test', 'Restored native test')
    await native.persistNativeState(newer)
    assert.equal(await storage.load(STORAGE_KEY), newer)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalLocalStorage
  }
})

test('a device response with the wrong ID cannot satisfy a pending request', async () => {
  let listener
  const bridge = createNativeBridge({
    addEventListener: (_name, callback) => {
      listener = callback
    },
    ReactNativeWebView: {
      postMessage: () =>
        listener({ detail: { channel: CHANNEL, id: 'unrelated-id', result: 'wrong', error: null } }),
    },
  })
  await assert.rejects(bridge.request('storage.load', {}, 5), /did not respond/)
})

test('saves from before the rename still open, and new saves need no calorie fields', async () => {
  assert.deepEqual(validateSnapshot(JSON.stringify({ workouts: [], settings: {} })).workouts, [])
  const legacy = device()
  const keys = []
  legacy.load = async (key) => (keys.push(key), key === 'calorie-tracker:v1' ? snapshot : null)
  const service = createDeviceService(legacy)
  assert.equal(await service.handle('storage.load', {}), snapshot)
  assert.deepEqual(keys, ['tally:v1', 'calorie-tracker:v1'])
})

test('check-in previews are stored apart from the training save and validated', async () => {
  const storage = device()
  const service = createDeviceService(storage)
  const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(100)
  const previews = { front: jpeg, side: jpeg, back: jpeg }
  await service.handle('photos.save', { id: 'abc123', previews })
  assert.deepEqual(await service.handle('photos.load', { ids: ['abc123', 'missing'] }), { abc123: previews })
  await service.handle('photos.delete', { ids: ['abc123'] })
  assert.deepEqual(await service.handle('photos.load', { ids: ['abc123'] }), {})
  for (const bad of [
    { id: '../x', previews },
    { id: 'ok', previews: { ...previews, front: 'javascript:alert(1)' } },
    { id: 'ok', previews: { ...previews, extra: jpeg } },
  ])
    await assert.rejects(service.handle('photos.save', bad))
})
