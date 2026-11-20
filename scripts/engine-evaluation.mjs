// Compares the recommendation engine with the previous planner on identical
// simulated sequences, and compares exploration and selection strategies.
//
//   node scripts/engine-evaluation.mjs            (writes docs/evaluations/engine-evaluation.json)
//   node scripts/engine-evaluation.mjs --quick    (fewer personas, for a fast check)
//
// The previous planner is loaded from git (commit f764d8c) into a temporary
// folder, so both run against the same simulated people. Simulated people are
// synthetic: hidden likes, dislikes and discomforts drive their behaviour.
// These are behavioural simulations of the planning loop, not evidence about
// fitness outcomes.
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { makeUser, train, answer, at } from '../tests/helpers/engine-sim.mjs'
import { scenario } from '../tests/helpers/scenarios.mjs'
import { buildDailyPlan } from '../src/lib/planner.js'
import { metaOf, allMeta } from '../src/lib/catalog/index.js'
import { rng } from '../src/lib/engine/rng.js'
import { addDays } from '../src/lib/date.js'
import { chooseQuestion } from '../src/lib/engine/feedback.js'
import { answerEvent, dismissEvent } from '../src/lib/engine/learning.js'
import { eligibilityContext, planningContext, recommendStrength } from '../src/lib/engine/recommend.js'
import { ineligibility } from '../src/lib/engine/eligibility.js'
import { profileOf, readinessOf } from '../src/lib/planner.js'

const quick = process.argv.includes('--quick')
const PERSONAS = quick ? 12 : 48
const DAYS = quick ? 14 : 28
const SNAPSHOT = 'f764d8c'

async function legacyPlanner() {
  const dir = mkdtempSync(join(tmpdir(), 'ink-legacy-'))
  execSync(`git archive ${SNAPSHOT} src/lib expo/src/protocol.js | tar -x -C "${dir}"`, { stdio: 'pipe', shell: true })
  const mod = await import(pathToFileURL(join(dir, 'src/lib/planner.js')).href)
  const temporaryRoot = resolve(tmpdir())
  const target = resolve(dir)
  const within = relative(temporaryRoot, target)
  if (!within || within.startsWith('..') || isAbsolute(within) || !within.startsWith('ink-legacy-')) throw new Error('Unexpected evaluation directory')
  return { buildDailyPlan: mod.buildDailyPlan, movementIds: new Set(mod.MOVEMENTS.map((m) => m.id)), cleanup: () => rmSync(target, { recursive: true, force: true }) }
}

const FAMILY_MEMBERS = {}
for (const m of allMeta()) if (m.kinds.includes('strength')) (FAMILY_MEMBERS[m.family] ||= []).push(m.id)

function persona(i) {
  const next = rng(`persona-${i}`)
  const pick = (list) => list[Math.floor(next() * list.length)]
  const place = pick(['gym', 'home', 'mixed'])
  const profile = {
    goal: pick(['Build muscle', 'Get stronger', 'General fitness', 'Sport performance']),
    experience: pick(['Starting out', 'Some experience', 'Experienced']),
    location: place === 'home' ? 'home' : 'gym',
    equipment: pick([['Dumbbells', 'Bench'], ['Dumbbells', 'Resistance bands'], ['Kettlebell'], ['Dumbbells', 'Bench', 'Pull-up bar'], []]),
    minutes: pick([20, 30, 45, 60]),
  }
  // Hidden truths the planner must discover from behaviour and answers.
  const families = Object.keys(FAMILY_MEMBERS).filter((f) => FAMILY_MEMBERS[f].length >= 3)
  const disliked = new Set()
  const liked = new Set()
  for (const f of families) {
    const members = FAMILY_MEMBERS[f]
    if (next() < 0.35) disliked.add(pick(members))
    if (next() < 0.35) liked.add(pick(members))
  }
  const painful = new Set(next() < 0.5 ? [pick(allMeta().filter((m) => m.kinds.includes('strength') && m.staple).map((m) => m.id))] : [])
  return { i, profile, place, disliked, liked, painful, shortRate: 0.25 + next() * 0.2, answerRate: 0.6, next }
}

function simulate(engine, p, { strategy, learn = true } = {}) {
  let state = makeUser(p.profile)
  const start = '2026-09-01'
  const log = []
  const random = rng(`behaviour-${p.i}`)
  // Answers use their own stream so both planners see identical days.
  const replies = rng(`replies-${p.i}`)
  for (let d = 0; d < DAYS; d++) {
    if (random() < 0.35) continue // rest days happen
    const date = addDays(start, d)
    const location = p.place === 'mixed' ? (d % 3 === 0 ? 'home' : 'gym') : p.profile.location
    const short = random() < p.shortRate
    const t0 = performance.now()
    const plan = engine(state, { today: date, now: at(date, 9), location, seed: `${p.i}-${d}`, ...(strategy ? { strategy } : {}) })
    const ms = performance.now() - t0
    // Behaviour: discomfort and dislikes are skipped with a reason; short days stop early.
    const skip = {}
    for (const it of plan.items) {
      if (p.painful.has(it.exId)) skip[it.exId] = 'pain'
      else if (p.disliked.has(it.exId)) skip[it.exId] = 'dislike'
    }
    const keep = short ? Math.max(1, Math.floor(plan.items.length / 2)) : Infinity
    const { state: after, record } = train(state, plan, date, {
      hour: 9,
      skip,
      sets: (_e, index) => (index < keep ? Infinity : 0),
      finishReason: short ? 'time' : 'other',
    })
    state = after
    let asked = null
    if (learn) {
      const q = chooseQuestion(state, record, { now: at(date, 11), today: date })
      if (q) {
        asked = q
        if (replies() < p.answerRate) {
          const value =
            q.question === 'again'
              ? p.disliked.has(q.exId)
                ? 'no'
                : p.liked.has(q.exId)
                  ? 'yes'
                  : 'maybe'
              : q.question === 'feel'
                ? p.painful.has(q.exId)
                  ? 'uncomfortable'
                  : 'good'
                : q.question === 'setup'
                  ? p.painful.has(q.exId)
                    ? 'movement'
                    : 'neither'
                  : 'right'
          state = answer(state, answerEvent({ exId: q.exId, question: q.question, value, workoutId: record.id, at: at(date, 11) }))
        } else state = answer(state, dismissEvent({ exId: q.exId, question: q.question, workoutId: record.id, at: at(date, 11) }))
      }
    }
    log.push({ date, location, plan, record, ms, short, asked, state })
  }
  return log
}

function metrics(log, p, { minutes }) {
  const m = {
    sessions: log.length,
    plannedItems: 0,
    timeOverBudget: 0,
    exactRepeat24h: 0,
    familyRepeat24h: 0,
    discomfortRepeats: 0,
    dislikedAfterSkip: 0,
    dislikedOpportunities: 0,
    likedRecommended: 0,
    rolloverReconsidered: 0,
    rolloverOpportunities: 0,
    maxSetsAfterShortDay: 0,
    questions: 0,
    answered: 0,
    distinctExercises: new Set(),
    p95ms: 0,
  }
  const skippedFor = { pain: new Set(), dislike: new Map() }
  const times = []
  log.forEach((entry, idx) => {
    const { plan, record } = entry
    times.push(entry.ms)
    m.plannedItems += plan.items.length
    if (plan.estimatedSeconds > (plan.requestedMinutes || minutes) * 60) m.timeOverBudget++
    const prev = log[idx - 1]
    const recentDone = prev && Date.parse(entry.date) - Date.parse(prev.date) <= 86400000 ? prev.record.exercises.filter((e) => e.sets.length) : []
    for (const it of plan.items) {
      m.distinctExercises.add(it.exId)
      if (p.liked.has(it.exId)) m.likedRecommended++
      if (recentDone.some((e) => e.exId === it.exId)) m.exactRepeat24h++
      else if (recentDone.some((e) => metaOf(e.exId)?.family === metaOf(it.exId)?.family)) m.familyRepeat24h++
      if (skippedFor.pain.has(it.exId)) m.discomfortRepeats++
      const dislikes = skippedFor.dislike.get(it.exId) || 0
      if (dislikes >= 2) m.dislikedAfterSkip++
    }
    for (const id of skippedFor.dislike.keys()) if ((skippedFor.dislike.get(id) || 0) >= 2) m.dislikedOpportunities++
    if (prev?.short) {
      const missedFamilies = new Set(
        prev.plan.items.slice(Math.max(1, Math.floor(prev.plan.items.length / 2))).map((i) => metaOf(i.exId)?.family),
      )
      m.rolloverOpportunities += missedFamilies.size
      for (const f of missedFamilies) if (plan.items.some((i) => metaOf(i.exId)?.family === f)) m.rolloverReconsidered++
      m.maxSetsAfterShortDay = Math.max(m.maxSetsAfterShortDay, ...plan.items.map((i) => i.sets), 0)
    }
    for (const e of record.outcome?.exercises || []) {
      if (e.reason === 'discomfort' && e.status === 'skipped') skippedFor.pain.add(e.exId)
      if (e.reason === 'dislike' && e.status === 'skipped') skippedFor.dislike.set(e.exId, (skippedFor.dislike.get(e.exId) || 0) + 1)
    }
    if (entry.asked) m.questions++
  })
  times.sort((a, b) => a - b)
  m.p95ms = Math.round(times[Math.floor(times.length * 0.95)] || 0)
  m.distinctExercises = m.distinctExercises.size
  return m
}

function sum(rows, key) {
  return rows.reduce((n, r) => n + (r[key] || 0), 0)
}

function summarize(rows) {
  const plans = sum(rows, 'sessions')
  return {
    sessions: plans,
    plannedExerciseItems: sum(rows, 'plannedItems'),
    itemsPerSession: +(sum(rows, 'plannedItems') / plans).toFixed(2),
    timeOverBudget: sum(rows, 'timeOverBudget'),
    exactRepeatsWithin24h: sum(rows, 'exactRepeat24h'),
    familyRepeatsWithin24h: sum(rows, 'familyRepeat24h'),
    discomfortExerciseRecommendedAgain: sum(rows, 'discomfortRepeats'),
    exerciseSkippedTwiceAsDislikedRecommendedAgain: sum(rows, 'dislikedAfterSkip'),
    likedVariantRecommendations: sum(rows, 'likedRecommended'),
    missedFamiliesReconsideredNextSession: `${sum(rows, 'rolloverReconsidered')}/${sum(rows, 'rolloverOpportunities')}`,
    rolloverRate: +(sum(rows, 'rolloverReconsidered') / Math.max(1, sum(rows, 'rolloverOpportunities'))).toFixed(3),
    maxSetsPerItemAfterShortDay: Math.max(...rows.map((r) => r.maxSetsAfterShortDay)),
    questionsPerSession: +(sum(rows, 'questions') / plans).toFixed(3),
    distinctExercisesPerPerson: +(sum(rows, 'distinctExercises') / rows.length).toFixed(1),
    worstPersonaP95PlanMs: Math.max(...rows.map((r) => r.p95ms)),
  }
}

function constraintAudit(count) {
  // Re-checks every generated plan against the hard rules, independently of the planner.
  let plans = 0
  let violations = 0
  for (let i = 0; i < count; i++) {
    const sc = scenario(i)
    const plan = buildDailyPlan(sc.state, sc.options)
    plans++
    if (plan.kind === 'recovery') continue
    const profile = profileOf(sc.state)
    const readiness = { ...readinessOf(sc.state, sc.options.today), ...sc.options.readiness }
    readiness.pain = [...new Set([...(profile.avoidMuscles || []), ...readiness.pain])]
    const ctx = planningContext(sc.state, { ...sc.options, profile, readiness })
    const elig = eligibilityContext(ctx, ctx.movement?.position === 'seated' ? 'seated' : 'strength')
    for (const it of plan.items) if (ineligibility(metaOf(it.exId), elig)) violations++
    if (plan.estimatedSeconds > ctx.minutes * 60) violations++
  }
  return { plans, violations }
}

function selectionComparison(count) {
  let beamBetter = 0
  let equal = 0
  let greedyBetter = 0
  let beamMs = 0
  let greedyMs = 0
  for (let i = 0; i < count; i++) {
    const sc = scenario(i)
    const profile = profileOf(sc.state)
    const readiness = { ...readinessOf(sc.state, sc.options.today), ...sc.options.readiness }
    if (readiness.unwell) continue
    const request = { ...sc.options, profile, readiness }
    let t0 = performance.now()
    const beam = recommendStrength(sc.state, { ...request, selection: 'beam' })
    beamMs += performance.now() - t0
    t0 = performance.now()
    const greedy = recommendStrength(sc.state, { ...request, selection: 'greedy' })
    greedyMs += performance.now() - t0
    // Compare the actual unrounded objective, not rounded display scores.
    const value = (plan) => plan.decision.selectionObjective
    const vb = value(beam)
    const vg = value(greedy)
    if (vb > vg + 1e-9) beamBetter++
    else if (vg > vb + 1e-9) greedyBetter++
    else equal++
  }
  const n = beamBetter + equal + greedyBetter
  return {
    scenarios: n,
    beamBetter,
    equal,
    greedyBetter,
    meanMsBeam: +(beamMs / n).toFixed(1),
    meanMsGreedy: +(greedyMs / n).toFixed(1),
  }
}

async function main() {
  const legacy = await legacyPlanner()
  const people = Array.from({ length: PERSONAS }, (_, i) => persona(i))
  const results = {
    generatedAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), personas: PERSONAS, days: DAYS,
    interpretation: 'Synthetic behavior, not fitness outcomes. Whole-system comparisons change both catalog and policy; engineLegacyCandidatePool controls the strength candidate IDs to separate catalog expansion from policy changes.',
    engines: {},
  }
  const runs = {
    legacy: (state, o) => legacy.buildDailyPlan(state, o),
    engine: (state, o) => buildDailyPlan(state, o),
    engineLegacyCandidatePool: (state, o) => buildDailyPlan({
      ...state,
      settings: { ...state.settings, training: { ...state.settings.training, excludedExercises: [
        ...(state.settings.training.excludedExercises || []),
        ...allMeta().filter((m) => m.kinds.includes('strength') && !legacy.movementIds.has(m.id)).map((m) => m.id),
      ] } },
    }, o),
  }
  for (const [name, engine] of Object.entries(runs)) {
    const rows = people.map((p) => metrics(simulate(engine, p, { learn: name !== 'legacy' }), p, p.profile))
    results.engines[name] = summarize(rows)
  }
  // Exploration policies on the same people (all learning from answers).
  results.exploration = {}
  for (const strategy of ['greedy', 'ucb', 'epsilon', 'thompson']) {
    const rows = people.map((p) => metrics(simulate((s, o) => buildDailyPlan(s, { ...o, strategy }), p, { strategy }), p, p.profile))
    results.exploration[strategy] = summarize(rows)
  }
  results.constraintAudit = constraintAudit(quick ? 200 : 1000)
  results.selection = selectionComparison(quick ? 100 : 400)
  legacy.cleanup()
  mkdirSync('docs/evaluations', { recursive: true })
  writeFileSync('docs/evaluations/engine-evaluation.json', JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
