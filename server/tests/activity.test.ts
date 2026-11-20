import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'
import { createActivityAnalyzer } from '../src/activity.js'
import type OpenAI from 'openai'

const impact={muscles:['Legs' as const,'Back' as const],effort:'hard' as const,durationMinutes:45,beforeHours:48,afterHours:24,summary:'Leave room around the activity.',uncertain:false}
test('custom activity route requires explicit consent and validates text before calling a model',async()=>{
  let calls=0
  const app=buildApp({activity:async()=>{calls++;return impact}})
  for(const body of [{description:'Moved boxes for an hour'},{description:'tiny',consent:true},{description:'x'.repeat(701),consent:true}])assert.equal((await app.inject({method:'POST',url:'/api/activity-impact',payload:body})).statusCode,400)
  assert.equal(calls,0)
  const r=await app.inject({method:'POST',url:'/api/activity-impact',payload:{description:'Moved boxes upstairs for one hour',consent:true}})
  assert.equal(r.statusCode,200);assert.equal(r.json().model,'gpt-6-luna');assert.deepEqual(r.json().muscles,['Legs','Back'])
  assert.equal(r.headers['cache-control'],'no-store')
  const blocked=await app.inject({method:'POST',url:'/api/activity-impact',headers:{origin:'https://other.example'},payload:{description:'Moved boxes upstairs',consent:true}})
  assert.equal(blocked.statusCode,403);await app.close()
})
test('provider failures do not leak text or secrets, and malformed output is never applied',async()=>{
  const app=buildApp({activity:async()=>{throw new Error('sk-private-should-not-leak')}})
  const r=await app.inject({method:'POST',url:'/api/activity-impact',payload:{description:'A normal custom activity',consent:true}})
  assert.equal(r.statusCode,502);assert.ok(!r.body.includes('sk-private'))
  await app.close()
})
test('Luna adapter fixes model, disables persistence and retries, and clamps unknown/easy impact',async()=>{
  const previous=process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY='test-only-not-a-real-key'
  let input:unknown
  const fake={responses:{parse:async(request:unknown)=>{input=request;return {status:'completed',output_parsed:{...impact,uncertain:true}}}}} as unknown as OpenAI
  try {
    const result=await createActivityAnalyzer(fake)('Unknown activity, no clear movement described')
    assert.equal(result.beforeHours,0);assert.equal(result.afterHours,0)
    assert.equal((input as {model:string}).model,'gpt-6-luna');assert.equal((input as {store:boolean}).store,false)
  } finally {if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous}
})
