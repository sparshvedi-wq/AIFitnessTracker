import { todayReadiness } from './strength/index.js'
import { exerciseProfile } from './strength/library.js'
import { involvementOf } from './strength/recovery.js'
import { MUSCLE_AREA, MUSCLE_LABEL } from './catalog/vocabulary.js'
import { findExercise } from './exercises.js'
import { realHistory, recordTime } from './engine/ledger.js'
import { pastActivityLoad } from './sport-schedule.js'
import { profileOf, readinessOf } from './planner.js'

const HOUR = 3600000
export const RECOVERY_HORIZONS = [0, 24, 48]

// A view of the planner's recovery model, never a separate recovery formula.
// Freeze the evidence at `now`: projections cannot pull in future workouts/events.
export function recoveryTimeline(state, today, now) {
  const workouts = realHistory(state.workouts, today).filter((w) => recordTime(w) <= now)
  const profile = profileOf(state)
  const activities = pastActivityLoad(profile, { today, now })
  const recent = new Map()
  const remember = (muscle, at) => {
    if (at >= now - 7 * 24 * HOUR) recent.set(muscle, Math.max(recent.get(muscle) || 0, at))
  }
  for (const w of workouts) {
    if (['sport', 'recovery'].includes(w.kind)) continue
    const at = recordTime(w)
    if (at < now - 7 * 24 * HOUR) continue
    for (const ex of w.exercises || []) {
      const completed = ex.sets?.some(
        (s) =>
          s.kind !== 'warmup' &&
          (!s.status || s.status === 'done') &&
          ((s.reps || 0) > 0 || (s.sec || 0) > 0),
      )
      if (!completed) continue
      const muscles = involvementOf(exerciseProfile(ex.exId, findExercise(ex.exId, state.customExercises)))
      for (const [muscle, share] of Object.entries(muscles)) if (share >= 0.25) remember(muscle, at)
    }
  }
  for (const a of activities)
    for (const [muscle, area] of Object.entries(MUSCLE_AREA)) {
      if (a.areas.includes(area)) remember(muscle, a.at)
    }
  if (!recent.size) return []
  const context = {
    workouts,
    unit: state.settings.weightUnit,
    today,
    experience: profile.experience,
    learning: state.learning,
    metrics: state.metrics,
    customExercises: state.customExercises,
    activities,
  }
  const forecasts = RECOVERY_HORIZONS.map(
    (hours) => todayReadiness({ ...context, now: now + hours * HOUR })?.readiness,
  )
  // If the model fails, don't substitute "fully recovered" for missing evidence.
  if (forecasts.some((f) => !f)) return []
  const reported = readinessOf(state, today)
  return [...recent]
    .map(([muscle, lastAt]) => ({
      muscle,
      label: MUSCLE_LABEL[muscle] || muscle,
      lastAt,
      avoid: reported.pain.includes(MUSCLE_AREA[muscle]),
      sore: reported.sore.includes(MUSCLE_AREA[muscle]),
      values: forecasts.map((f) =>
        Number.isFinite(f[muscle]) ? Math.max(0, Math.min(100, Math.round(f[muscle] * 100))) : null,
      ),
    }))
    .filter((row) => row.values.every((v) => v !== null))
    .sort(
      (a, b) =>
        Number(b.avoid) - Number(a.avoid) ||
        Number(b.sore) - Number(a.sore) ||
        a.values[0] - b.values[0] ||
        b.lastAt - a.lastAt ||
        a.label.localeCompare(b.label),
    )
}
