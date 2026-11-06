// The daily recommendation: recommend → train → record → selectively ask →
// update preferences → reassess. Pure: every input (state, date, time, seed)
// is explicit, so identical inputs give identical plans.
//
// Stages: context → hard eligibility → normalized scoring (with bounded
// exploration) → constrained selection → dose and progression → validation
// → explanation and decision record.
import { allMeta, metaOf } from '../catalog/index.js'
import { MUSCLE_AREA } from '../catalog/vocabulary.js'
import { findExercise } from '../exercises.js'
import { addDays } from '../date.js'
import { sportById } from '../sports.js'
import { sportScheduleContext } from '../sport-schedule.js'
import { quietAt, resolvePlace } from '../places.js'
import { availableLoads, breakDays } from '../preferences.js'
import { movementPreferences, movementSummary } from '../movement-preferences.js'
import { trainingFocus, trainingTitle } from '../training-copy.js'
import {
  MIN_REST,
  AREA_CAPACITY,
  BALANCE_AREAS,
  ENGINE_VERSION,
  EXPERIENCE_TARGET_SCALE,
  EXPLORATION,
  ROLLOVER_MAX_IN_PLAN,
  RULES,
  SELECTION,
  TIMING,
  WEEKLY_TARGET,
} from './config.js'
import { EXPERIENCE_LEVEL, ineligibility, placeCapabilities, placeSupports, screenCatalog } from './eligibility.js'
import { exposureFrom, sessionAsRecord } from './exposure.js'
import { exerciseSignals } from './learning.js'
import { realHistory, recordOutcome } from './ledger.js'
import { rolloverCandidates } from './rollover.js'
import { familiesToLearn, scoreCandidate } from './scoring.js'
import { selectBeam, selectGreedy, selectionValue } from './select.js'
import { allocateSets, baseDose, withTarget } from './dose.js'
import { planSeconds } from './session-time.js'
import { headline, itemNote, reasonLines } from './explain.js'

export const DEFAULT_PROFILE_FIELDS = { variety: 'balanced' }
const PHOTO_AREAS = {
  arms: ['Biceps', 'Triceps'],
  shoulders: ['Shoulders'],
  chest: ['Chest'],
  back: ['Back'],
  legs: ['Legs'],
  glutes: ['Glutes'],
  overall: [],
}
const STRENGTH = (w) => !['sport', 'recovery', 'pump'].includes(w.kind)

/** Everything the policy needs, derived once. Exported for tests and debugging. */
export function planningContext(state, options = {}) {
  const today = options.today
  const now = options.now ?? Date.parse(`${today}T12:00:00`)
  const p = options.profile
  const r = options.readiness
  const shortSession = Boolean(options.shortSession)
  const minutes = Math.min(shortSession ? 15 : 90, Math.max(shortSession ? 5 : 10, Number(options.minutes || p.minutes) || 30))
  const place = resolvePlace(p, options.location || p.location)
  const movement = movementPreferences(p, place.id, options.movement)
  const quiet = quietAt(p, place.id)
  const schedule = sportScheduleContext(p, { today, now, minutes })
  const workouts = state.workouts || []
  const history = realHistory(workouts, today)
  const strength = history.filter(STRENGTH)
  const away = breakDays(strength, today)
  const returning = away >= 7
  const tough = [...strength].reverse().find((w) => w.date >= addDays(today, -3) && w.effort >= 4)
  const unwell = Boolean(r.unwell)
  // Stopping early because of feeling unwell makes the next day and a half lighter.
  const recentUnwell = strength.some(
    (w) => w.finishReason === 'unwell' && now - (w.endedAt || w.startedAt || 0) <= 36 * 3600000,
  )
  const easy =
    unwell ||
    recentUnwell ||
    r.energy === 'low' ||
    r.intensity === 'easy' ||
    Boolean(tough) ||
    returning ||
    r.sportSoon ||
    schedule.lighter
  const highEffort = r.intensity === 'challenging' && r.energy === 'high' && !easy
  const live = options.liveSession ? sessionAsRecord(options.liveSession, now) : null
  const exposure = exposureFrom(workouts, { now, today }, live ? [live] : [])
  const signals = exerciseSignals(state, { now, today, place: place.id })
  const rollover = rolloverCandidates(workouts, { now, today, place: place.id }).active
  // Reported pain or soreness on unfinished work in the last two days keeps those areas out.
  const flagged = history
    .filter((w) => w.date >= addDays(today, -2))
    .flatMap((w) => recordOutcome(w).exercises.filter((o) => ['discomfort', 'soreness'].includes(o.reason) && o.status !== 'complete'))
  const flaggedAreas = new Set(flagged.flatMap((o) => metaOf(o.exId)?.areas || []))
  const blockedAreas = new Set([...(r.pain || []), ...(r.sore || []), ...flaggedAreas])
  const confirmed = state.checkins?.find(
    (c) => !c.synthetic && !c.sample && c.id === p.focusCheckinId && c.date >= addDays(today, -42),
  )
  const manualFocus = p.baselineMode === 'manual' ? p.manualBaseline?.focusAreas || [] : []
  const focus = !state.settings?.display?.metricLight
    ? [...new Set([...manualFocus, ...(confirmed && p.ageGroup === '18+' ? p.confirmedFocus : [])])]
    : []
  const sportAreas = new Set((p.sports || []).flatMap((id) => sportById(id).muscles))
  const preparationAreas = new Set(schedule.preparation ? sportById(schedule.preparation.sport).muscles : [])
  const goal = p.goal || 'General fitness'
  const experience = p.experience || 'Starting out'
  const target = (WEEKLY_TARGET[goal] || 6) * (EXPERIENCE_TARGET_SCALE[experience] || 0.6)
  const focusAreas = new Set(focus.flatMap((f) => PHOTO_AREAS[f] || []))
  const needs = {}
  for (const area of BALANCE_AREAS) {
    const scale = ['Core', 'Biceps', 'Triceps'].includes(area) ? 0.6 : 1
    const goalTarget = target * scale * (focusAreas.has(area) ? 1.3 : 1)
    needs[area] = Math.max(0, Math.min(1, (goalTarget - (exposure.area[area]?.week || 0)) / goalTarget))
  }
  const caps = placeCapabilities(place)
  const variety = p.variety || 'balanced'
  const replacements = p.replacements || {}
  // The default seed depends on the day and history, not the place, so the
  // same equipment gives the same plan wherever it is saved.
  const seed = options.seed ?? `${today}|${history.length}`
  return {
    state,
    today,
    now,
    dayStart: Date.parse(`${today}T00:00:00`),
    p,
    r,
    goal,
    experience,
    level: EXPERIENCE_LEVEL[experience] ?? 0,
    minutes,
    shortSession,
    place,
    placeType: place.type,
    movement,
    quiet,
    schedule,
    workouts,
    history,
    strength,
    awayDays: away,
    returning,
    tough,
    unwell,
    recentUnwell,
    easy,
    highEffort,
    exposure,
    signals,
    rollover,
    flaggedAreas,
    blockedAreas,
    manualFocus,
    focus,
    focusAreas,
    focusSource: focus.length ? (manualFocus.length ? 'manual' : 'photo') : null,
    sportAreas,
    sportPriority: p.sportPriority || 'balanced',
    preparationAreas,
    protectedAreas: new Set(schedule.muscles || []),
    needs,
    capacity: AREA_CAPACITY[experience] || 5,
    caps,
    supports: placeSupports(place, movement),
    dumbbellSizes: availableLoads(p, place.id),
    unit: state.settings?.weightUnit || 'lb',
    variety,
    preferredReplacements: new Set(Object.values(replacements)),
    seed,
    strategy: options.strategy || EXPLORATION.defaultStrategy,
    selection: options.selection || 'beam',
    exploration: options.exploration || 'on',
    easeIn: shortSession ? TIMING.easeInSec.short : TIMING.easeInSec.normal,
    budget: minutes * 60,
    replacements,
  }
}

export function eligibilityContext(ctx, kind) {
  // A remembered swap replaces the original when the replacement is usable here.
  const base = {
    kind,
    caps: ctx.caps,
    supports: ctx.supports,
    movement: ctx.movement,
    quiet: ctx.quiet,
    level: ctx.level,
    excluded: new Set(ctx.p.excludedExercises || []),
    blockedAreas: ctx.blockedAreas,
    signals: ctx.signals,
    replaced: new Set(),
  }
  for (const [from, to] of Object.entries(ctx.replacements)) {
    if (!ineligibility(metaOf(to), base)) base.replaced.add(from)
  }
  return base
}

function siblingDiscomfort(ctx) {
  const out = new Map()
  for (const [id, s] of ctx.signals) {
    if (!s.comfort.reports) continue
    const meta = metaOf(id)
    if (meta) out.set(`${meta.family}|${meta.position}`, id)
  }
  return out
}

function regionGroup(items) {
  const counts = {}
  for (const it of items) {
    const meta = metaOf(it.exId)
    if (!meta?.region) continue
    counts[meta.region] = (counts[meta.region] || 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top && ['push', 'pull', 'lower', 'arms', 'core'].includes(top[0]) ? top[0] : null
}

function recentGroupFact(ctx) {
  // The most recent strength session in the last ~36 hours, and its main region.
  const recent = [...ctx.strength].reverse().find((w) => ctx.now - (w.endedAt || w.startedAt || 0) <= 36 * 3600000)
  if (!recent) return {}
  const items = (recent.exercises || []).filter((e) => (e.sets || []).some((s) => s.kind !== 'warmup'))
  const group = regionGroup(items)
  if (!group) return {}
  const when = recent.date === ctx.today ? 'earlier today' : recent.date === addDays(ctx.today, -1) ? 'yesterday' : 'recently'
  return { recentGroup: group, recentWhen: when }
}

/**
 * Plans a strength session (or the lighter / movement alternatives).
 * @returns plan object compatible with buildSession, plus `decision`.
 */
export function recommendStrength(state, options) {
  const ctx = planningContext(state, options)
  const movementMode = ctx.unwell || options.mode === 'movement'
  const kind = ctx.movement?.position === 'seated' ? 'seated' : 'strength'
  const screen = movementMode ? { eligible: [], excluded: {} } : screenCatalog(eligibilityContext(ctx, kind))
  ctx.siblingDiscomfort = siblingDiscomfort(ctx)
  ctx.familiesToLearn = familiesToLearn(screen.eligible, ctx.signals)
  // A family counts as familiar only if a familiar member can be done here;
  // trying a variant because the usual one isn't available is not exploration.
  ctx.familiarFamilies = new Set(
    screen.eligible
      .filter((m) => (ctx.signals.get(m.id)?.completions || 0) >= EXPLORATION.exploratoryBelow)
      .map((m) => m.family),
  )
  ctx.trends = new Map()
  const exploreBudget = ctx.easy || ctx.returning || ctx.shortSession ? 0 : EXPLORATION.maxPerSession[ctx.variety] ?? 1
  ctx.maxExplore = ctx.exploration === 'off' ? 0 : exploreBudget
  ctx.maxItems = Math.min(ctx.shortSession ? 3 : 6, Math.max(2, Math.floor(ctx.minutes / 7)))
  ctx.minItems = Math.min(2, ctx.maxItems)
  ctx.setCap = ctx.shortSession || ctx.easy || ctx.experience === 'Starting out' ? 2 : ctx.highEffort ? 4 : 3
  // Only the strongest unfinished candidates influence one plan.
  ctx.rollover = [...ctx.rollover].sort((a, b) => b.priority - a.priority).slice(0, ROLLOVER_MAX_IN_PLAN)

  const candidates = screen.eligible.map((meta) => {
    const def = findExercise(meta.id)
    const scored = scoreCandidate(meta, ctx)
    const { item, progression, trend } = withTarget(baseDose(meta, def, ctx), meta, def, ctx)
    ctx.trends.set(meta.id, trend)
    return { meta, def, item, progression, ...scored, explorable: ctx.familiesToLearn.has(meta.family) }
  })
  // Progression trends feed a feature; rescore now that every trend is known.
  for (const c of candidates) Object.assign(c, scoreCandidate(c.meta, ctx))

  // Low-value fillers (for example an exact repeat of yesterday when nothing
  // is needed) are dropped when enough worthwhile candidates remain.
  const worthwhile = candidates.filter((c) => c.score >= SELECTION.minScore)
  const pool = worthwhile.length >= ctx.minItems ? worthwhile : candidates
  const chosen = movementMode
    ? []
    : ctx.selection === 'greedy'
      ? selectGreedy(pool, ctx)
      : selectBeam(pool, ctx)
  const items = allocateSets(chosen, ctx)

  // Validation: everything chosen must still pass every hard rule and fit the time.
  const eligibilityCheck = eligibilityContext(ctx, kind)
  const violations = chosen.filter((c) => ineligibility(c.meta, eligibilityCheck)).map((c) => c.meta.id)
  if (violations.length || planSeconds(items) + ctx.easeIn > ctx.budget)
    throw new Error(`Recommendation failed validation: ${violations.join(', ') || 'time'}`)

  const plan = finishPlan(ctx, chosen, items, screen, candidates)
  // Full trace on request only (debugging and evaluation; never shown in the UI).
  if (options.trace)
    plan.decision.trace = [...candidates]
      .sort((a, b) => b.score - a.score)
      .map((c) => ({
        exId: c.meta.id,
        score: Math.round(c.score * 1000) / 1000,
        chosen: chosen.some((x) => x.meta.id === c.meta.id),
        features: Object.fromEntries(
          Object.entries(c.features)
            .filter(([, v]) => typeof v === 'number' && v !== 0)
            .map(([k, v]) => [k, Math.round(v * 1000) / 1000]),
        ),
      }))
  return plan
}

function codesFor(c, ctx) {
  const f = c.features
  const codes = []
  if (f.rollover > 0.05) codes.push('rollover')
  if (f.replacement) codes.push('remembered-swap')
  if (f.preference > 0.15) codes.push('learned-preference')
  if (f.focus >= 1) codes.push('focus')
  if (f.sport > 0) codes.push('sport')
  if (f.need > 0.4) codes.push('need')
  if (f.goal >= 0.85) codes.push('goal')
  if (f.practice) codes.push('practice')
  if (f.muscleOverlap > 0.4) codes.push('recent-overlap')
  if (c.sample.exploratory && ctx.maxExplore && c.explorable) codes.push('exploring')
  if (c.progression?.up) codes.push('progression')
  return codes
}

function sideFor(c, ctx) {
  const p = ctx.p
  return p.sideTestConfirmed &&
    !ctx.state.settings?.display?.metricLight &&
    p.sideTestDate >= addDays(ctx.today, -42) &&
    p.ageGroup === '18+' &&
    !ctx.easy &&
    p.sideExercise === c.meta.id &&
    ['db-row', 'biceps-curl', 'split-squat'].includes(c.meta.id) &&
    new Date(ctx.today + 'T12:00:00').getDate() % 2 === 0
    ? p.weakerSide
    : ''
}

function finishPlan(ctx, chosen, items, screen, candidates) {
  // Order: compound work first (heaviest setups and lower body first), then
  // accessories; ties by score, then a seeded tiebreak.
  const roleRank = { compound: 0, accessory: 1, isolation: 2, control: 3 }
  const patternRank = { squat: 0, hinge: 1, lunge: 2, 'push-h': 3, 'pull-h': 4, 'push-v': 5, 'pull-v': 6 }
  const pairs = chosen
    .map((c, i) => ({ c, item: items[i] }))
    .sort(
      (a, b) =>
        (roleRank[a.c.meta.role] ?? 4) - (roleRank[b.c.meta.role] ?? 4) ||
        (a.c.meta.role === 'compound' ? b.c.meta.setupSec - a.c.meta.setupSec : 0) ||
        (patternRank[a.c.meta.pattern] ?? 9) - (patternRank[b.c.meta.pattern] ?? 9) ||
        b.c.score - a.c.score,
    )
  const entries = pairs.map(({ c, item }) => {
    const codes = codesFor(c, ctx)
    const side = sideFor(c, ctx)
    const areaLabel = (MUSCLE_AREA[c.meta.primary[0]] || c.def.muscle).toLowerCase()
    const entry = { exId: c.meta.id, codes, unilateral: item.unilateral, progression: c.progression, side, areaLabel }
    return {
      item: {
        ...item,
        note: itemNote(entry, ctx),
        sideExtra: side ? { side, reps: 1, lastSetOnly: true } : null,
      },
      entry,
      c,
    }
  })
  const planItems = entries.map((e) => e.item)
  const included = new Set(planItems.map((i) => i.exId))
  const carried = ctx.rollover.filter(
    (cand) =>
      included.has(cand.exId) ||
      planItems.some((i) => metaOf(i.exId)?.family === cand.family && entries.find((e) => e.item === i)?.entry.codes.includes('rollover')),
  )
  const rolloverItem = entries.find((e) => e.entry.codes.includes('rollover'))
  const preferredItem = entries.find((e) => e.entry.codes.includes('learned-preference') && ctx.signals.get(e.item.exId)?.completions)
  const exploringItem = entries.find((e) => e.entry.codes.includes('exploring'))
  const recentAreas = BALANCE_AREAS.filter((a) => (ctx.exposure.area[a]?.recent || 0) >= ctx.capacity * 0.6)
  const facts = {
    mode: ctx.unwell ? 'movement' : ctx.easy ? 'lighter' : 'normal',
    items: planItems.length,
    returning: ctx.returning,
    awayDays: ctx.awayDays,
    minutes: ctx.minutes,
    short: ctx.shortSession,
    goal: ctx.goal,
    experience: ctx.experience,
    quiet: ctx.quiet,
    seated: ctx.movement?.position === 'seated',
    movementSummary: ctx.movement ? movementSummary(ctx.movement) : null,
    scheduleNote: ctx.schedule.note || null,
    sportsLine: ctx.p.sports?.length
      ? `${ctx.sportPriority === 'sport' ? 'Sport first' : ctx.sportPriority === 'goal' ? 'Goal first' : 'Sport and goal shared'}: ${ctx.p.sports.map((id) => sportById(id).name).join(', ')}.`
      : null,
    focusSource: ctx.focus.length ? (ctx.manualFocus.length ? 'manual' : 'photo') : null,
    sore: ctx.r.sore,
    pain: ctx.r.pain,
    recentAreas,
    tough: Boolean(ctx.tough),
    unwell: ctx.unwell,
    recentUnwell: ctx.recentUnwell,
    sportSoon: ctx.r.sportSoon,
    flagged: ctx.flaggedAreas.size > 0,
    bodyweightOnly: ctx.place.base !== 'gym' && !ctx.caps.size,
    rolloverExercise: rolloverItem ? findExercise(rolloverItem.item.exId)?.name : null,
    preferredExercise: !rolloverItem && preferredItem ? findExercise(preferredItem.item.exId)?.name : null,
    exploring: exploringItem ? findExercise(exploringItem.item.exId)?.name : null,
    planGroup: regionGroup(planItems),
    ...recentGroupFact(ctx),
  }
  const decision = {
    engine: ENGINE_VERSION,
    rules: RULES,
    seed: ctx.seed,
    strategy: ctx.strategy,
    selection: ctx.selection,
    selectionObjective: selectionValue(chosen, ctx),
    facts,
    excluded: screen.excluded,
    eligible: candidates.length,
    items: entries.map((e) => ({
      exId: e.item.exId,
      codes: e.entry.codes,
      score: Math.round(e.c.score * 1000) / 1000,
      features: Object.fromEntries(
        Object.entries(e.c.features)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => [k, Math.round(v * 1000) / 1000]),
      ),
      exploration: {
        exploratory: e.c.sample.exploratory,
        mean: Math.round(e.c.sample.mean * 1000) / 1000,
        sampled: Math.round(e.c.sample.value * 1000) / 1000,
      },
      progression: e.c.progression,
      evidence: [
        ...(e.c.features.rolloverSource ? [`rollover:${e.c.features.rolloverSource}`] : []),
        ...(ctx.signals.get(e.item.exId)?.completions ? [`completions:${ctx.signals.get(e.item.exId).completions}`] : []),
      ],
    })),
    uncertainty: {
      historySessions: ctx.history.length,
      exploratoryItems: entries.filter((e) => e.c.sample.exploratory).length,
      learnedExercises: [...ctx.signals.values()].filter((s) => s.sources.explicit || s.sources.inferred).length,
    },
  }
  const top = headline(decision)
  const reasons = reasonLines(decision)
  const firstSession = !ctx.workouts.some((w) => !w.sample && !['sport', 'recovery'].includes(w.kind))
  const focusLine =
    top?.text ||
    (ctx.schedule.note ||
      (ctx.movement?.position === 'seated'
        ? 'Light seated movement, at your own pace.'
        : trainingFocus({
            items: planItems,
            readiness: ctx.r,
            recentMuscles: new Set(),
            sports: ctx.p.sports || [],
            sportPriority: ctx.sportPriority,
            focus: ctx.focus,
            easy: ctx.easy,
            firstSession,
          })))
  return {
    id: `daily-${ctx.today}`,
    kind: 'adaptive',
    name: trainingTitle(planItems, { short: ctx.shortSession }),
    focus: focusLine,
    items: planItems,
    requestedMinutes: ctx.minutes,
    estimatedSeconds: planSeconds(planItems) + ctx.easeIn,
    lockedTargets: true,
    location: ctx.place.id,
    placeName: ctx.place.name,
    readiness: ctx.r,
    movement: ctx.movement,
    schedule: {
      next: ctx.schedule.next,
      lighter: ctx.schedule.lighter,
      muscles: ctx.schedule.muscles,
      overlap: Boolean(ctx.schedule.overlap),
      preparation: ctx.schedule.preparation,
      reasonEvent: ctx.schedule.reasonEvent,
      reasonPhase: ctx.schedule.reasonPhase,
    },
    reasons,
    explanation: top,
    alternatives: alternativesFor(ctx),
    planning: {
      carriedFrom: carried.map((c) => c.source),
      profileGoal: ctx.goal,
      date: ctx.today,
      shortSession: ctx.shortSession,
      engine: ENGINE_VERSION,
      rules: RULES,
      seed: ctx.seed,
      // Compact reason codes travel with the saved workout; the full record stays in memory.
      decision: { headline: top?.code || null, items: decision.items.map((i) => ({ exId: i.exId, codes: i.codes })) },
    },
    decision,
  }
}

function alternativesFor(ctx) {
  const out = []
  if (ctx.unwell || ctx.easy || ctx.r.energy === 'low')
    out.push({ kind: 'movement', label: 'Short movement session', minutes: 10 })
  if (ctx.unwell || ctx.r.energy === 'low' || ctx.tough) out.push({ kind: 'rest', label: 'Rest today' })
  return out
}

// ── Gentle movement: for unwell days, or as a low-readiness alternative ──
const GENTLE_ORDER = ['marching', 'spine-mobility', 'hip-mobility', 'shoulder-mobility', 'hamstring-mobility', 'scapular-control', 'core-brace', 'knee-control', 'calf']

/** A short, easy movement session: no loading, no exploration, nothing to make up. */
export function recommendMovement(state, options) {
  const ctx = planningContext(state, { ...options, shortSession: true })
  const minutes = Math.min(15, Math.max(5, Number(options.minutes) || 10))
  const seated = ctx.movement?.position === 'seated'
  const base = eligibilityContext(ctx, 'mobility')
  const kinds = seated ? ['seated'] : ['mobility', 'warmup', 'strength']
  const pool = []
  for (const family of GENTLE_ORDER) {
    const pick = (GENTLE_IDS[family] || [])
      .filter((m) => m.impact === 0 && !m.equipment.length && ['stretch', 'drill', 'control'].includes(m.role))
      .filter((m) => kinds.some((kind) => m.kinds.includes(kind) && !ineligibility(m, { ...base, kind })))
      .sort((a, b) => a.id.localeCompare(b.id))[0]
    if (pick) pool.push(pick)
  }
  const items = []
  const budget = minutes * 60 - TIMING.easeInSec.short
  for (const meta of pool) {
    const def = findExercise(meta.id)
    const restSec = Math.max(15, MIN_REST[meta.role] ?? 15)
    const item =
      def.type === 'time'
        ? { exId: meta.id, sets: 1, sec: 45, restSec }
        : { exId: meta.id, sets: 1, reps: 8, restSec, unilateral: Boolean(meta.perSide) }
    item.note = 'Easy and comfortable. Stop whenever you like.'
    if (planSeconds([...items, item]) <= budget) items.push(item)
    if (items.length >= 5) break
  }
  const facts = { mode: 'movement', items: items.length, minutes, unwell: ctx.unwell }
  return {
    id: `movement-${ctx.today}`,
    kind: 'recovery',
    name: items.length ? 'Gentle movement' : 'Rest day',
    focus: headline({ facts }).text,
    items,
    requestedMinutes: minutes,
    estimatedSeconds: planSeconds(items) + TIMING.easeInSec.short,
    lockedTargets: true,
    location: ctx.place.id,
    placeName: ctx.place.name,
    readiness: ctx.r,
    movement: ctx.movement,
    reasons: [
      ...(ctx.unwell ? ['You said you’re not feeling well, so nothing strenuous is planned.'] : []),
      'Easy movement only. Nothing here is owed or made up later.',
      'Resting instead is a good choice too.',
    ],
    explanation: headline({ facts }),
    alternatives: [{ kind: 'rest', label: 'Rest today' }],
    planning: { date: ctx.today, purpose: 'movement', engine: ENGINE_VERSION, rules: RULES, carriedFrom: [] },
    decision: { engine: ENGINE_VERSION, rules: RULES, facts, items: items.map((i) => ({ exId: i.exId, codes: ['gentle'] })) },
  }
}

const GENTLE_IDS = Object.fromEntries(
  GENTLE_ORDER.map((family) => [family, allMeta().filter((m) => m.family === family)]),
)
