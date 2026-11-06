// Recent completed work, accounted beyond exercise names.
//
// Every completed set contributes set-equivalents to the muscles, broad areas,
// movement pattern, substitution family, joint actions and exercise involved,
// using the documented contribution estimates in config.js. Recent work fades
// with a half-life; the seven-day totals do not. These are planning
// heuristics, not measurements of recovery.
import { metaOf } from '../catalog/index.js'
import { MUSCLE_AREA } from '../catalog/vocabulary.js'
import { CONTRIBUTION, EFFORT_FACTOR, HALF_LIFE_HOURS, WARMUP_FACTOR } from './config.js'
import { realHistory, recordTime } from './ledger.js'

const HOUR = 3600000
const ROLE_FACTOR = { compound: 1, accessory: 1, isolation: 1, control: 0.4, drill: 0.25, stretch: 0.1 }

function setDose(meta, set, type) {
  // Timed sets count by duration (40 s ≈ one set), within sensible bounds.
  const base = type === 'time' ? Math.min(1.5, Math.max(0.5, (set.sec || 30) / 40)) : 1
  return base * (set.kind === 'warmup' ? WARMUP_FACTOR : 1) * (ROLE_FACTOR[meta?.role] ?? 1)
}

function bump(map, key, recent, week, at) {
  const entry = map[key] || (map[key] = { recent: 0, week: 0, lastAt: 0, sets: 0 })
  entry.recent += recent
  entry.week += week
  entry.sets += week > 0 ? 1 : 0
  entry.lastAt = Math.max(entry.lastAt, at)
}

/**
 * @param {Array} workouts saved records
 * @param {{ now: number, today: string, include?: (record) => boolean }} options
 * @param {Array} extraSessions completed parts of sessions not yet saved
 *   (the workout in progress); same shape as records.
 */
export function exposureFrom(workouts, { now, today, include = () => true }, extraSessions = []) {
  const out = { muscle: {}, area: {}, pattern: {}, family: {}, joint: {}, exercise: {}, records: 0 }
  const weekStart = now - 7 * 24 * HOUR
  // Older work no longer affects either window (0.5^(21 days / 36 h) is negligible).
  const horizon = now - 21 * 24 * HOUR
  const records = [
    ...realHistory(workouts, today).filter((r) => recordTime(r) >= horizon && include(r)),
    ...extraSessions,
  ]
  for (const record of records) {
    const at = recordTime(record)
    if (!Number.isFinite(at) || at > now + HOUR) continue
    const ageHours = Math.max(0, (now - at) / HOUR)
    const inWeek = at >= weekStart ? 1 : 0
    const effort = EFFORT_FACTOR[record.effort] ?? 1
    let counted = false
    for (const e of record.exercises || []) {
      const meta = metaOf(e.exId)
      for (const set of e.sets || []) {
        if (set.status && set.status !== 'done') continue
        const dose = setDose(meta, set, e.type) * effort
        if (!dose) continue
        counted = true
        const decay = (hl) => dose * Math.pow(0.5, ageHours / hl)
        const week = dose * inWeek
        if (meta) {
          const parts = [
            ...meta.primary.map((m) => [m, CONTRIBUTION.primary]),
            ...meta.secondary.map((m) => [m, CONTRIBUTION.secondary]),
            ...meta.stabilizers.map((m) => [m, CONTRIBUTION.stabilizer]),
          ]
          const areaShare = {}
          for (const [m, share] of parts) {
            bump(out.muscle, m, decay(HALF_LIFE_HOURS.muscle) * share, week * share, at)
            const area = MUSCLE_AREA[m]
            areaShare[area] = Math.max(areaShare[area] || 0, share)
          }
          // Drills list their areas directly.
          if (!parts.length) for (const area of meta.areas) areaShare[area] = CONTRIBUTION.secondary
          for (const [area, share] of Object.entries(areaShare))
            bump(out.area, area, decay(HALF_LIFE_HOURS.muscle) * share, week * share, at)
          bump(out.pattern, meta.pattern, decay(HALF_LIFE_HOURS.pattern), week, at)
          bump(out.family, meta.family, decay(HALF_LIFE_HOURS.pattern), week, at)
          for (const j of meta.joints) bump(out.joint, j, decay(HALF_LIFE_HOURS.pattern), week, at)
        } else if (e.muscle && !['Cardio', 'Mobility'].includes(e.muscle)) {
          // Custom exercises still count toward their chosen muscle group.
          bump(out.area, e.muscle, decay(HALF_LIFE_HOURS.muscle), week, at)
        }
        if (set.kind !== 'warmup') bump(out.exercise, e.exId, decay(HALF_LIFE_HOURS.exercise), week, at)
      }
    }
    if (counted) out.records++
  }
  return out
}

/** Completed parts of a live session, shaped like a record for exposure accounting. */
export function sessionAsRecord(session, now) {
  if (!session) return null
  const exercises = session.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.status === 'done') }))
    .filter((e) => e.sets.length)
  if (!exercises.length) return null
  return { id: `live-${session.id}`, date: null, endedAt: now, exercises, effort: null, live: true }
}
