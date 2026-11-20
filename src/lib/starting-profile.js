import { convertWeight } from './units.js'

export const MUSCLE_ESTIMATES = ['Not sure', 'Little muscle', 'Some muscle', 'Well developed']
export const BASELINE_FOCUS = ['arms', 'shoulders', 'chest', 'back', 'legs', 'glutes']
// A baseline describes where setup started; it must never replace a later log.
export function initialBaselineMetric(state, profile, date) {
  if (profile.baselineMode !== 'manual' || !profile.manualBaseline?.weightKg) return null
  if (state.settings.training.baselineMode === 'manual' && state.settings.training.manualBaseline) return null
  const existing = state.metrics[date]
  if (existing?.weight != null && !existing.sampleWeight) return null
  return {
    weight: convertWeight(profile.manualBaseline.weightKg, 'kg', state.settings.weightUnit),
    sampleWeight: false,
  }
}
export function readManualBaseline(entry = {}) {
  const heightCm =
    entry.heightUnit === 'ft'
      ? (Number(entry.feet) * 12 + Number(entry.inches || 0)) * 2.54
      : Number(entry.height)
  const weightKg = convertWeight(Number(entry.weight), entry.weightUnit || 'kg', 'kg')
  const errors = {}
  if (
    !Number.isFinite(heightCm) ||
    heightCm < 50 ||
    heightCm > 260 ||
    (entry.heightUnit && !['cm', 'ft'].includes(entry.heightUnit)) ||
    (entry.heightUnit === 'ft' &&
      (!Number.isInteger(Number(entry.feet)) ||
        !Number.isFinite(Number(entry.inches || 0)) ||
        Number(entry.inches || 0) < 0 ||
        Number(entry.inches || 0) >= 12))
  )
    errors.height = 'Enter a height from 50–260 cm, or the equivalent in feet and inches.'
  if (
    !Number.isFinite(weightKg) ||
    weightKg < 10 ||
    weightKg > 500 ||
    (entry.weightUnit && !['kg', 'lb'].includes(entry.weightUnit))
  )
    errors.weight = 'Enter a weight from 10–500 kg, or the equivalent in pounds.'
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      heightCm,
      notes: typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 600) : '',
      weightKg,
      muscleEstimate: MUSCLE_ESTIMATES.includes(entry.muscleEstimate) ? entry.muscleEstimate : 'Not sure',
      focusAreas: [
        ...new Set(
          (Array.isArray(entry.focusAreas) ? entry.focusAreas : []).filter((v) => BASELINE_FOCUS.includes(v)),
        ),
      ],
    },
  }
}
// Height follows the same measurement system as weight: lb → ft/in, kg → cm.
export function manualEntryOf(baseline, weightUnit = 'lb') {
  const totalInches = baseline?.heightCm ? Math.round(baseline.heightCm / 2.54) : null
  return {
    heightUnit: weightUnit === 'lb' ? 'ft' : 'cm',
    height: baseline?.heightCm ? String(Math.round(baseline.heightCm * 10) / 10) : '',
    feet: totalInches != null ? String(Math.floor(totalInches / 12)) : '',
    inches: totalInches != null ? String(totalInches % 12) : '',
    weightUnit,
    weight: baseline?.weightKg
      ? String(Math.round(convertWeight(baseline.weightKg, 'kg', weightUnit) * 10) / 10)
      : '',
    notes: baseline?.notes || '',
    muscleEstimate: baseline?.muscleEstimate || 'Not sure',
    focusAreas: baseline?.focusAreas || [],
  }
}
export function hasStartingProfile(profile, checkins, allowTest = false) {
  if (profile.baselineMode === 'manual') {
    const b = profile.manualBaseline
    return Boolean(
      b && readManualBaseline({ height: b.heightCm, weight: b.weightKg, weightUnit: 'kg' }).valid,
    )
  }
  return (checkins || []).some(
    (c) =>
      ((!c.synthetic && !c.sample) || (allowTest && profile.baselineMode === 'test')) &&
      (c.id === profile.baselinePhotoId || !profile.baselinePhotoId) &&
      (c.photoCount === 3 ||
        c.review?.status === 'ready' ||
        c.hasPreviews ||
        ['front', 'side', 'back'].every((a) => c.previews?.[a])),
  )
}
