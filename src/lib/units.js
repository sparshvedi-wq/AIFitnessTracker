export function convertWeight(value, from, to) {
  if (value == null || from === to) return value
  return (
    value * (from === 'lb' && to === 'kg' ? 0.45359237 : from === 'kg' && to === 'lb' ? 1 / 0.45359237 : 1)
  )
}
// Convert quantities, not just labels. Retain full precision so toggling units
// is reversible. User-written notes are never rewritten.
export function convertStateUnits(state, to) {
  const from = state.settings.weightUnit
  if (!['lb', 'kg'].includes(to) || from === to) return state
  const weight = (v, source = from) => convertWeight(v, source, to)
  const sets = (items, source) =>
    (items || []).map((s) => ({
      ...s,
      weight: weight(s.weight, source),
      targetWeight: weight(s.targetWeight, source),
    }))
  const exercises = (items, source) =>
    (items || []).map((e) => ({
      ...e,
      sets: sets(e.sets, source),
      ...(e.last ? { last: { ...e.last, sets: sets(e.last.sets, source) } } : {}),
    }))
  const label = (text, source) =>
    text?.replace(
      /([0-9][0-9,.]*) (lb|kg)\b/g,
      (_, n, u) =>
        Math.round(convertWeight(Number(n.replaceAll(',', '')), u || source, to) * 10) / 10 + ' ' + to,
    )
  const workout = (w) => ({
    ...w,
    unit: to,
    exercises: exercises(w.exercises, w.unit || from),
    ...(w.totals ? { totals: { ...w.totals, volume: weight(w.totals.volume, w.unit || from) } } : {}),
    records: (w.records || []).map((r) => ({ ...r, label: label(r.label, w.unit || from) })),
  })
  return {
    ...state,
    settings: {
      ...state.settings,
      weightUnit: to,
      liftGoal: state.settings.liftGoal
        ? { ...state.settings.liftGoal, target: weight(state.settings.liftGoal.target) }
        : null,
      training: {
        ...state.settings.training,
        homeDumbbells: (state.settings.training?.homeDumbbells || []).map((v) => weight(v)),
        gymDumbbells: (state.settings.training?.gymDumbbells || []).map((v) => weight(v)),
        places: (state.settings.training?.places || []).map((p) => ({
          ...p,
          dumbbells: (p.dumbbells || []).map((v) => weight(v)),
        })),
      },
    },
    metrics: Object.fromEntries(
      Object.entries(state.metrics).map(([date, m]) => [date, { ...m, weight: weight(m.weight) }]),
    ),
    routines: state.routines.map((r) => ({
      ...r,
      items: r.items.map((it) => ({ ...it, weight: weight(it.weight) })),
    })),
    workouts: state.workouts.map(workout),
    activeWorkout: state.activeWorkout
      ? {
          ...state.activeWorkout,
          unit: to,
          exercises: exercises(state.activeWorkout.exercises, state.activeWorkout.unit || from),
        }
      : null,
  }
}

// Height in the user's measurement system: 5′10″ for imperial, 178 cm for metric.
export function formatHeight(cm, weightUnit) {
  if (!cm) return ''
  if (weightUnit !== 'lb') return `${Math.round(cm)} cm`
  const inches = Math.round(cm / 2.54)
  return `${Math.floor(inches / 12)}′${inches % 12}″`
}
