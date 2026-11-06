import test from 'node:test'
import assert from 'node:assert/strict'
import type OpenAI from 'openai'
import { buildApp } from '../src/app.js'
import { ASSIST_LIMITS, createAssistService, createInterpreter, revalidate, type AssistOutput, type Interpreter } from '../src/assistant.js'

const base = {
  text: 'can I do the hotel thing for like quarter hr',
  today: '2026-11-05',
  timeZone: 'Europe/London',
  places: ['Gym', 'Home', 'Hotel'],
  exercises: ['Goblet squat', 'Push-up'],
  clientId: 'client-aaaa-1111',
}
const out = (patch: Partial<AssistOutput> = {}): AssistOutput => ({
  intent: 'plan.minutes',
  minutes: 15,
  place: null,
  exercise: null,
  days: null,
  filter: null,
  scope: 'temporary',
  needsClarification: false,
  clarification: null,
  ...patch,
})
const fake = (fn: (signal: AbortSignal) => Promise<AssistOutput>): Interpreter => async (_r, signal) => ({ output: await fn(signal), usage: { input: 120, output: 40 } })

test('language help is off unless explicitly enabled', async () => {
  const previous = process.env.ASSIST_AI_ENABLED
  delete process.env.ASSIST_AI_ENABLED
  try {
    const app = buildApp({ analyze: async () => { throw new Error('x') }, quality: async () => { throw new Error('x') } })
    const r = await app.inject({ method: 'POST', url: '/api/assistant/interpret', payload: base })
    assert.equal(r.statusCode, 503)
    assert.equal(r.json().code, 'disabled')
    await app.close()
  } finally {
    if (previous !== undefined) process.env.ASSIST_AI_ENABLED = previous
  }
})

test('requests are validated before any model call, and only bounded context is accepted', async () => {
  let calls = 0
  const app = buildApp({ assist: createAssistService(fake(async () => { calls++; return out() })) })
  for (const payload of [
    { ...base, text: '' },
    { ...base, text: 'x'.repeat(201) },
    { ...base, history: [{ date: '2026-10-01' }] },
    { ...base, clientId: 'bad id with spaces' },
    { ...base, places: Array(20).fill('Gym') },
  ])
    assert.equal((await app.inject({ method: 'POST', url: '/api/assistant/interpret', payload })).statusCode, 400)
  assert.equal(calls, 0)
  const r = await app.inject({ method: 'POST', url: '/api/assistant/interpret', payload: base })
  assert.equal(r.statusCode, 200)
  assert.equal(r.json().intent, 'plan.minutes')
  assert.equal(r.json().minutes, 15)
  await app.close()
})

test('a valid schema is not trusted blindly: names, numbers and missing arguments are rechecked', () => {
  assert.equal(revalidate(out({ intent: 'plan.place', place: 'Moon base', minutes: null }), base).needsClarification, true)
  assert.equal(revalidate(out({ intent: 'plan.place', place: 'hotel', minutes: null }), base).place, 'Hotel')
  assert.equal(revalidate(out({ minutes: 600 }), base).minutes, null)
  assert.equal(revalidate(out({ minutes: 600 }), base).needsClarification, true)
  assert.equal(revalidate(out({ intent: 'exercise.replace', exercise: 'Deadlift' }), base).exercise, null)
  assert.equal(revalidate(out({ clarification: '<script>x</script>' }), base).clarification, 'scriptx/script')
})

test('cache never crosses clients, budgets stop runaway use, and usage keeps no prompt text', async () => {
  let calls = 0
  const service = createAssistService(fake(async () => { calls++; return out() }))
  const signal = new AbortController().signal
  assert.equal((await service.interpret(base, signal)).status, 'ok')
  assert.equal((await service.interpret({ ...base, text: base.text.toUpperCase() }, signal)).cached, true)
  assert.equal(calls, 1)
  await service.interpret({ ...base, clientId: 'client-bbbb-2222' }, signal)
  assert.equal(calls, 2, 'another person never receives a cached interpretation')
  for (let i = 0; i < ASSIST_LIMITS.perClientPerDay; i++) await service.interpret({ ...base, text: `only ${10 + i} minutes` }, signal)
  assert.equal((await service.interpret({ ...base, text: 'something new' }, signal)).status, 'budget')
  const report = service.report()
  assert.ok(report.inputTokens > 0 && report.outputTokens > 0)
  assert.ok(!JSON.stringify(report).includes('hotel'))
})

test('timeouts, cancellation and provider errors fail safely without leaking details', async () => {
  const hanging = createAssistService(
    fake((signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('sk-secret-should-not-leak'))))),
  )
  const controller = new AbortController()
  const pending = hanging.interpret(base, controller.signal)
  controller.abort()
  assert.equal((await pending).status, 'cancelled')
  const app = buildApp({ assist: createAssistService(fake(async () => { throw new Error('sk-secret-should-not-leak') })) })
  const r = await app.inject({ method: 'POST', url: '/api/assistant/interpret', payload: base })
  assert.equal(r.statusCode, 502)
  assert.ok(!r.body.includes('sk-secret'))
  await app.close()
})

test('the Luna adapter uses the fixed model, no storage, no retries, a strict format and passes cancellation', async () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key'
  let request: Record<string, unknown> = {}
  let options: { signal?: AbortSignal } = {}
  const client = {
    responses: {
      parse: async (r: Record<string, unknown>, o: { signal?: AbortSignal }) => {
        request = r
        options = o
        return { status: 'completed', output_parsed: out(), usage: { input_tokens: 90, output_tokens: 30 } }
      },
    },
  } as unknown as OpenAI
  try {
    const signal = new AbortController().signal
    const result = await createInterpreter(client)(base, signal)
    assert.equal(request.model, 'gpt-6-luna')
    assert.equal(request.store, false)
    assert.deepEqual(request.reasoning, { effort: 'none' })
    assert.equal((request.text as { format: { type: string; strict: boolean } }).format.type, 'json_schema')
    assert.equal(options.signal, signal)
    assert.ok(!String(request.input).includes('clientId'), 'the client identifier never goes to the model')
    assert.equal(result.usage.input, 90)
    const incomplete = { responses: { parse: async () => ({ status: 'incomplete', output_parsed: null }) } } as unknown as OpenAI
    await assert.rejects(createInterpreter(incomplete)(base, signal))
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})
