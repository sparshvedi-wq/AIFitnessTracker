import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHostedApp } from '../src/hosted-app.js'

test('single-container host serves the UI and SPA paths without swallowing missing APIs or assets', async()=>{
  const root=await mkdtemp(join(tmpdir(),'tally-host-'))
  await writeFile(join(root,'index.html'),'<html>Tally fixture</html>')
  await mkdir(join(root,'exercise-guides'))
  const image = Buffer.from('89504e470d0a1a0a', 'hex')
  await writeFile(join(root,'exercise-guides','fixture.png'), image)
  const app=await createHostedApp(root)
  try {
    for(const url of ['/', '/training/history']) {
      const response=await app.inject({url})
      assert.equal(response.statusCode,200)
      assert.match(response.body,/Tally fixture/)
    }
    assert.equal((await app.inject({url:'/api/health'})).json().service,'tally-ink-photos')
    const illustration = await app.inject({url:'/exercise-guides/fixture.png'})
    assert.equal(illustration.statusCode,200)
    assert.match(illustration.headers['content-type'] || '', /^image\/png/)
    assert.deepEqual(illustration.rawPayload,image)
    for(const url of ['/api/missing','/assets/missing.js','/exercise-guides/missing.png'])assert.equal((await app.inject({url})).statusCode,404)
  } finally {await app.close(); await rm(root,{recursive:true,force:true})}
})
