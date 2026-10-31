import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const root = fileURLToPath(new URL('../', import.meta.url))
const expoRoot = resolve(root, 'expo')
const photoRoot = resolve(root, 'server')
const children = []
let stopping = false

function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)

async function page(url, headers) {
  try { return await fetch(url, { signal: AbortSignal.timeout(1800), headers }) }
  catch { return null }
}
function run(file, args, cwd) {
  const child = spawn(process.execPath, ['--use-system-ca', file, ...args], { cwd, stdio: 'inherit', windowsHide: true })
  children.push(child)
  return child
}

try {
  const expoCli = resolve(expoRoot, 'node_modules/expo/bin/cli')
  if (!existsSync(expoCli)) throw new Error('Install the phone dependencies first: npm run setup:phone')
  const current = await page('http://127.0.0.1:8081/', { 'Expo-Platform': 'ios', Accept: 'application/expo+json' })
  if (current) {
    let slug
    try { slug = (await current.json()).extra?.expoClient?.slug } catch { /* Not an Expo manifest. */ }
    throw new Error(slug === 'tally-ink'
      ? 'Tally Ink is already running on Expo port 8081. Use its existing QR code or stop that terminal before restarting.'
      : 'Port 8081 belongs to another app. Stop its Expo terminal before starting Tally Ink. No process was stopped automatically.')
  }
  const photoHealth = await page('http://127.0.0.1:3010/api/health')
  if (photoHealth) {
    const health = await photoHealth.json().catch(() => ({}))
    if (health.service !== 'tally-ink-photos') throw new Error('Port 3010 belongs to a different service. Free it before starting Tally photos.')
    console.log('Using the Tally photo service on port 3010.')
  } else {
    if (!existsSync(resolve(photoRoot, 'node_modules/tsx/dist/loader.mjs'))) throw new Error('Install photo dependencies first: npm run setup:photos')
    const photos = spawn(process.execPath, ['--use-system-ca', '--env-file-if-exists=.env', '--import', 'tsx', 'src/index.ts'], { cwd: photoRoot, stdio: 'inherit', windowsHide: true })
    children.push(photos)
    let ready = false
    for (let attempt = 0; attempt < 25 && !stopping; attempt++) {
      const health = await page('http://127.0.0.1:3010/api/health')
      if (health?.ok) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    if (!ready) throw new Error('The Tally photo service did not start on port 3010.')
  }
  const existing = await page('http://127.0.0.1:5182/')
  if (existing) {
    const html = await existing.text()
    if (!existing.ok || !html.includes('<title>Tally</title>')) throw new Error('Port 5182 is occupied by a different app. Free that port before starting Ink.')
    console.log('Using the running Ink Vite server on port 5182.')
  } else {
    run(resolve(root, 'node_modules/vite/bin/vite.js'), ['--host'], root)
    let ready = false
    for (let attempt = 0; attempt < 25 && !stopping; attempt++) {
      const response = await page('http://127.0.0.1:5182/')
      if (response?.ok && (await response.text()).includes('<title>Tally</title>')) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    if (!ready) throw new Error('The Ink Vite server did not start on port 5182.')
  }
  console.log('Opening Tally Ink in Expo Go. Keep this terminal and your computer running.')
  const metro = run(expoCli, ['start', '--lan', '--port', '8081', ...process.argv.slice(2)], expoRoot)
  const code = await new Promise((resolve, reject) => { metro.once('error', reject); metro.once('close', resolve) })
  process.exitCode = typeof code === 'number' ? code : 0
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally { stop() }
