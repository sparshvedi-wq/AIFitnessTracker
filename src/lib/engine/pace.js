// How long this person's sessions actually take compared with the estimate.
//
// Plans are fitted to the requested minutes with one estimator
// (session-time.js: work per rep, rest after each set, setup and moving
// between exercises). People differ: some rest longer than planned, some set
// up faster. Sets are saved with the time they were logged, so the gaps
// between them can be compared with what the estimator expected for the same
// work. The typical ratio over recent sessions scales the time budget of the
// next plan, so "30 minutes" keeps meaning about 30 minutes for this person.
//
// Gaps longer than a break (a pause, a phone call) are left out, a few
// sessions are needed before anything changes, and the factor stays within
// sensible bounds and is pulled toward 1 while evidence is thin.
import { metaOf } from '../catalog/index.js'
import { MIN_REST, TIMING } from './config.js'
import { realHistory } from './ledger.js'
import { setWorkSeconds } from './session-time.js'

export const PACE = {
  sessions: 8, // recent sessions considered
  minSessions: 3, // before this, the standard estimate is used
  minGaps: 4, // logged gaps a session needs to count
  maxGapSec: 15 * 60, // longer than this is a break, not pace
  min: 0.8,
  max: 1.5,
  prior: 2, // sessions' worth of pull toward the standard estimate
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const defaultRest = (meta) => (meta?.role === 'compound' ? 90 : Math.max(60, MIN_REST[meta?.role] ?? 60))

/** Logged working sets of a record (or session) in the order they were done. */
function timedSets(record) {
  const out = []
  for (const e of record.exercises || []) {
    const meta = metaOf(e.exId)
    for (const s of e.sets || []) {
      if (s.kind === 'warmup' || (s.status && s.status !== 'done')) continue
      const at = isNum(s.at) ? s.at : isNum(s.doneAt) ? s.doneAt : null
      if (at === null) continue
      out.push({ at, e, s, meta })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

/**
 * Actual and expected seconds between consecutive logged sets of one session.
 * @returns {{ actual: number, expected: number, gaps: number }}
 */
export function sessionPace(record) {
  const sets = timedSets(record)
  let actual = 0
  let expected = 0
  let gaps = 0
  for (let i = 1; i < sets.length; i++) {
    const prev = sets[i - 1]
    const cur = sets[i]
    const gap = (cur.at - prev.at) / 1000
    if (!(gap > 0) || gap > PACE.maxGapSec) continue
    const rest = isNum(prev.e.restSec) ? prev.e.restSec : defaultRest(prev.meta)
    const item = { exId: cur.e.exId, reps: cur.s.reps, sec: cur.e.type === 'time' ? cur.s.sec : null, unilateral: cur.e.unilateral }
    let want = rest + setWorkSeconds(item, cur.meta) + TIMING.setOverheadSec
    if (cur.e !== prev.e) want += (cur.meta?.setupSec ?? 15) + TIMING.itemTransitionSec
    actual += gap
    expected += want
    gaps++
  }
  return { actual, expected, gaps }
}

/**
 * The factor this person's sessions take relative to the estimate (1 = as
 * estimated, 1.2 = 20% longer). Recent planned sessions only.
 */
export function paceFactor(workouts = [], { today } = {}) {
  const ratios = realHistory(workouts, today)
    .filter((w) => !['sport', 'recovery', 'manual'].includes(w.kind))
    .slice(-PACE.sessions * 2)
    .map(sessionPace)
    .filter((p) => p.gaps >= PACE.minGaps && p.expected > 0)
    .slice(-PACE.sessions)
    .map((p) => p.actual / p.expected)
  if (ratios.length < PACE.minSessions) return 1
  const sorted = [...ratios].sort((a, b) => a - b)
  const mid = sorted.length / 2
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
  const n = ratios.length
  const shrunk = 1 + ((median - 1) * n) / (n + PACE.prior)
  return Math.round(Math.min(PACE.max, Math.max(PACE.min, shrunk)) * 1000) / 1000
}
