import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
// Invoke the installed npm CLI with Node so PowerShell script policy is irrelevant.
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this helper with npm run setup:phone.')
const child = spawn(process.execPath, ['--use-system-ca', npmCli, 'ci'], {
  cwd: resolve(root, 'expo'), stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --use-system-ca`.trim() },
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('close', code => { process.exitCode = code ?? 1 })
