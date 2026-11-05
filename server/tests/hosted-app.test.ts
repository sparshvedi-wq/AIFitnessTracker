import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHostedApp } from '../src/hosted-app.js'

test('single-container host serves the UI and SPA paths without swallowing missing APIs or assets', async()=>{
  const root=await mkdtemp(join(tmpdir(),'tally-host-'))
  await writeFile(join(root,'index.html'),'<html>Tally fixture</html>')
  const app=await createHostedApp(root)
  try {
    for(const url of ['/', '/training/history']) {
      const response=await app.inject({url})
      assert.equal(response.statusCode,200)
      assert.match(response.body,/Tally fixture/)
    }
    assert.equal((await app.inject({url:'/api/health'})).json().service,'tally-ink-photos')
    for(const url of ['/api/missing','/assets/missing.js'])assert.equal((await app.inject({url})).statusCode,404)
  } finally {await app.close(); await rm(root,{recursive:true,force:true})}
})
