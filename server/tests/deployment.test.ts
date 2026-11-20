import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { buildApp } from '../src/app.js'
import { createHttpHandler } from '../src/http-handler.js'

test('serverless adapter serves health, parses raw and platform-parsed JSON, rejects oversize and unknown API paths',async()=>{
  const app=buildApp({activity:async()=>({muscles:[],effort:'easy',durationMinutes:null,beforeHours:0,afterHours:0,summary:'Fixture',uncertain:false})})
  const handler=createHttpHandler(app)
  const server=createServer((req,res)=>void (async()=>{
    // Emulate a platform that parsed JSON before calling its exported handler.
    if(req.url?.endsWith('?parsed')) {
      const chunks=[]
      for await(const chunk of req)chunks.push(chunk)
      Object.assign(req,{body:JSON.parse(Buffer.concat(chunks).toString('utf8'))})
    }
    await handler(req,res)
  })())
  server.listen(0,'127.0.0.1')
  await once(server,'listening')
  const address=server.address()
  assert.ok(address && typeof address!=='string')
  const base=`http://127.0.0.1:${address.port}`
  try {
    assert.equal((await fetch(base+'/api/health')).status,200)
    const response=await fetch(base+'/api/activity-impact',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({description:'A fictional easy walk',consent:true})})
    assert.equal(response.status,200)
    assert.equal((await response.json()).summary,'Fixture')
    const parsed=await fetch(base+'/api/activity-impact?parsed',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({description:'A second fictional walk',consent:true})})
    assert.equal(parsed.status,200)
    const blocked=await fetch(base+'/api/activity-impact',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify({description:'Fictional walk',consent:true})})
    assert.equal(blocked.status,403)
    assert.equal((await fetch(base+'/api/missing')).status,404)
    const huge=await fetch(base+'/api/activity-impact',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(4_000_001)})
    assert.equal(huge.status,413)
  } finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); await app.close() }
})
