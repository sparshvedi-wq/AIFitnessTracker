// Phone-sized screenshots of the running dev app, from synthetic data only.
//
//   npm run dev                      (in another terminal; serves port 5182)
//   node scripts/capture-screens.mjs docs/screenshots/after
//
// Starts a headless Chrome or Edge with a throwaway profile, seeds browser
// storage with a synthetic save, opens each screen and saves PNG files. It
// never reads a real save, photos or environment secrets.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { defaultState } from '../src/lib/storage.js'
import { ONBOARDING_VERSION } from '../src/lib/onboarding.js'
import { makeSampleWorkouts } from '../src/lib/sample.js'
import { STORAGE_KEY } from '../expo/src/protocol.js'

const out = resolve(process.argv[2] || 'docs/screenshots/after')
const base = process.env.INK_URL || 'http://localhost:5182/'
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

function freshState() {
  return defaultState()
}
function trainedState(patch = {}) {
  const state = defaultState()
  state.settings.name = 'Sam'
  state.settings.training = {
    ...state.settings.training,
    completed: true,
    onboardingVersion: ONBOARDING_VERSION,
    goal: 'Build muscle',
    experience: 'Some experience',
    location: 'gym',
    equipment: ['Dumbbells', 'Resistance bands', 'Bench'],
    homeDumbbells: [10, 15, 20, 25, 30],
    minutes: 45,
    ...patch.training,
  }
  state.settings.display = { ...state.settings.display, ...patch.display }
  // Synthetic history: the sample generator with its sample flag removed.
  state.workouts = makeSampleWorkouts().map((w) => ({ ...w, id: w.id.replace('sample', 'fixture'), sample: false }))
  return state
}

const withToday = (state, readiness) => ({
  ...state,
  readiness: { energy: 'normal', sore: [], pain: [], intensity: 'moderate', sportSoon: false, ...readiness, date: localToday() },
})
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SCREENS = [
  { name: 'onboarding-welcome', state: freshState },
  { name: 'home', state: () => trainedState() },
  { name: 'home-full', state: () => trainedState(), full: true },
  { name: 'home-large-text', state: () => trainedState({ display: { largeText: true } }) },
  { name: 'home-dark', state: () => ({ ...trainedState(), settings: { ...trainedState().settings, theme: 'dark' } }) },
  { name: 'session-setup', state: () => trainedState(), steps: [{ click: 'Review workout' }] },
  {
    name: 'session-setup-why',
    state: () => trainedState(),
    steps: [{ click: 'Review workout' }, { click: 'Session options', by: 'label' }, { click: 'Why this session?' }],
  },
  { name: 'history', state: () => trainedState(), steps: [{ click: 'History', by: 'nav' }] },
  { name: 'home-low-energy', state: () => withToday(trainedState(), { energy: 'low' }) },
  { name: 'home-unwell', state: () => withToday(trainedState(), { energy: 'low', unwell: true }) },
  {
    name: 'preferences-learning',
    state: () => trainedState(),
    steps: [{ click: 'You', by: 'nav' }, { click: 'Training preferences' }, { click: 'Variety', optional: true }],
  },
  { name: 'ask-open', state: () => trainedState(), steps: [{ click: 'Ask or adjust', optional: true }] },
  {
    name: 'ask-result',
    state: () => trainedState(),
    steps: [
      { click: 'Ask or adjust', optional: true },
      { type: 'Show workouts over the past 30 days', optional: true },
    ],
  },
  {
    name: 'ask-preview',
    state: () => trainedState(),
    steps: [{ click: 'Ask or adjust', optional: true }, { type: 'Only 15 minutes today', optional: true }],
  },
]

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((ok, fail) => {
    ws.onopen = ok
    ws.onerror = fail
  })
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) fail(new Error(msg.error.message))
      else ok(msg.result)
    } else listeners.forEach((fn) => fn(msg))
  }
  return {
    send: (method, params = {}) =>
      new Promise((ok, fail) => {
        const n = ++id
        pending.set(n, { ok, fail })
        ws.send(JSON.stringify({ id: n, method, params }))
      }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  }
}

async function evaluate(page, expression) {
  const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function waitForApp(page) {
  for (let i = 0; i < 60; i++) {
    await sleep(250)
    const ready = await evaluate(page, "document.querySelector('#root')?.innerText.trim().length > 20").catch(
      () => false,
    )
    if (ready) break
  }
  // Fonts and the entrance fade settle before capture.
  await evaluate(page, 'document.fonts.ready.then(() => true)')
  await sleep(1200)
}

const clickScript = (text, by) => `(() => {
  const want = ${JSON.stringify(text)}.toLowerCase()
  const nodes = [...document.querySelectorAll(${JSON.stringify(by === 'nav' ? 'nav button' : 'button, [role=button], summary')})]
  const match = nodes.find((n) => {
    const label = (n.getAttribute('aria-label') || '').toLowerCase()
    const body = (n.textContent || '').trim().toLowerCase()
    return ${by === 'label' ? 'label === want' : 'body.startsWith(want) || label.startsWith(want)'}
  })
  if (!match) return false
  match.scrollIntoView({ block: 'center' })
  match.click()
  return true
})()`

const typeScript = (text) => `(() => {
  const input = document.querySelector('[data-ask-input]')
  if (!input) return false
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, ${JSON.stringify(text)})
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.form?.requestSubmit()
  return true
})()`

async function main() {
  const browser = BROWSERS.find((p) => existsSync(p))
  if (!browser) throw new Error('Chrome or Edge was not found.')
  mkdirSync(out, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'ink-shots-'))
  const port = 9333 + Math.floor(Math.random() * 400)
  const child = spawn(
    browser,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  try {
    let targets = null
    for (let i = 0; i < 50 && !targets; i++) {
      await sleep(200)
      targets = await fetch(`http://127.0.0.1:${port}/json/list`)
        .then((r) => r.json())
        .catch(() => null)
    }
    const target = targets?.find((t) => t.type === 'page')
    if (!target) throw new Error('Headless browser did not start.')
    const page = await cdp(target.webSocketDebuggerUrl)
    await page.send('Page.enable')
    await page.send('Runtime.enable')
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    })
    await page.send('Page.navigate', { url: base })
    await waitForApp(page)
    for (const screen of SCREENS) {
      if (only && !only.has(screen.name)) continue
      const state = screen.state()
      await evaluate(
        page,
        `localStorage.clear(); localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(state))}); true`,
      )
      await page.send('Page.navigate', { url: base })
      await waitForApp(page)
      let skipped = false
      for (const step of screen.steps || []) {
        const ok = step.click
          ? await evaluate(page, clickScript(step.click, step.by))
          : await evaluate(page, typeScript(step.type))
        if (!ok && !step.optional) throw new Error(`${screen.name}: could not find "${step.click || step.type}"`)
        if (!ok) skipped = true
        await sleep(900)
      }
      if (skipped) {
        console.log(`skipped ${screen.name} (control not present in this version)`)
        continue
      }
      await evaluate(page, 'window.scrollTo(0, 0); true')
      await sleep(300)
      let clip
      if (screen.full) {
        const height = await evaluate(page, 'Math.ceil(document.documentElement.scrollHeight)')
        clip = { x: 0, y: 0, width: 390, height: Math.min(height, 6000), scale: 1 }
      }
      const shot = await page.send('Page.captureScreenshot', {
        format: 'png',
        ...(clip ? { clip, captureBeyondViewport: true } : {}),
      })
      writeFileSync(join(out, `${screen.name}.png`), Buffer.from(shot.data, 'base64'))
      console.log(`saved ${screen.name}.png`)
    }
    page.close()
  } finally {
    child.kill()
    await sleep(500)
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      // The browser may still hold the temporary profile briefly on Windows.
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
