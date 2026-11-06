// Versioned, idempotent migrations for saved exercise IDs.
//
// Catalog 2 adds 167 built-in IDs. A custom exercise saved earlier could
// already use one of those IDs (or an original built-in ID, in very old or
// hand-edited backups). Before catalog 2, findExercise() resolved such an ID
// to the custom entry, so the user saw their own exercise. Catalog 2 resolves
// built-in IDs first, so each colliding custom exercise is renamed and every
// reference that meant it is moved with it. Nothing is deleted, and no data is
// moved between FRAME and Ink.
//
// Running the migration again finds no collisions and returns the same state.

export const ID_MIGRATION_VERSION = 2

function uniqueId(base, taken) {
  let id = `custom-${base}`
  for (let n = 2; taken.has(id); n++) id = `custom-${base}-${n}`
  taken.add(id)
  return id
}

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

/**
 * @param {object} state    a normalized save
 * @param {object} catalog  { builtIn: Map<id, name>, original: Set<id> } of built-in exercises
 * @returns {{ state: object, renamed: Array<{from: string, to: string}> }}
 */
export function migrateExerciseIds(state, catalog) {
  const customs = state.customExercises || []
  const collisions = customs.filter((c) => c && catalog.builtIn.has(c.id))
  if (!collisions.length) {
    return {
      state: state.catalogVersion === ID_MIGRATION_VERSION ? state : { ...state, catalogVersion: ID_MIGRATION_VERSION },
      renamed: [],
    }
  }
  const taken = new Set([...catalog.builtIn.keys(), ...customs.map((c) => c.id)])
  const plan = new Map(collisions.map((c) => [c.id, { to: uniqueId(c.id, taken), custom: c }]))
  // A reference is moved when it meant the custom exercise.
  //  - Records that store a name: move when it matches the custom name and
  //    not the built-in name. A record named like the built-in stays put.
  //  - ID-only references (routines, favourites, notes…): the old app showed
  //    the custom exercise for these, so they follow it.
  const target = (exId, storedName) => {
    const entry = plan.get(exId)
    if (!entry) return exId
    if (storedName === undefined) return entry.to
    const builtInName = catalog.builtIn.get(exId)
    if (sameName(storedName, entry.custom.name) && !sameName(storedName, builtInName)) return entry.to
    if (sameName(storedName, builtInName)) return exId
    return catalog.original.has(exId) ? exId : entry.to
  }
  const moveExercises = (exercises = []) =>
    exercises.map((e) => {
      const to = target(e.exId, e.name ?? '')
      return to === e.exId ? e : { ...e, exId: to }
    })
  const workouts = (state.workouts || []).map((w) => {
    const exercises = moveExercises(w.exercises)
    const moved = new Map((w.exercises || []).map((e, i) => [e.exId, exercises[i].exId]))
    return {
      ...w,
      exercises,
      ...(w.unfinished
        ? { unfinished: w.unfinished.map((u) => ({ ...u, exId: moved.get(u.exId) ?? u.exId })) }
        : {}),
      ...(w.outcome?.exercises
        ? {
            outcome: {
              ...w.outcome,
              exercises: w.outcome.exercises.map((o) => ({ ...o, exId: moved.get(o.exId) ?? o.exId })),
            },
          }
        : {}),
    }
  })
  const training = state.settings?.training || {}
  const replacements = Object.fromEntries(
    Object.entries(training.replacements || {}).map(([from, to]) => [target(from), target(to)]),
  )
  const notes = Object.fromEntries(
    Object.entries(state.settings?.exerciseNotes || {}).map(([key, text]) => {
      const [location, exId] = key.includes(':') ? key.split(/:(.+)/) : [null, key]
      const to = target(exId)
      return [location ? `${location}:${to}` : to, text]
    }),
  )
  const next = {
    ...state,
    catalogVersion: ID_MIGRATION_VERSION,
    customExercises: customs.map((c) => (plan.has(c.id) ? { ...c, id: plan.get(c.id).to } : c)),
    workouts,
    routines: (state.routines || []).map((r) => ({
      ...r,
      items: (r.items || []).map((it) => ({ ...it, exId: target(it.exId) })),
    })),
    activeWorkout: state.activeWorkout
      ? { ...state.activeWorkout, exercises: moveExercises(state.activeWorkout.exercises) }
      : state.activeWorkout,
    learning: state.learning
      ? {
          ...state.learning,
          events: (state.learning.events || []).map((e) => (e.exId ? { ...e, exId: target(e.exId) } : e)),
        }
      : state.learning,
    settings: {
      ...state.settings,
      favoriteExercises: (state.settings?.favoriteExercises || []).map((id) => target(id)),
      exerciseNotes: notes,
      liftGoal: state.settings?.liftGoal
        ? { ...state.settings.liftGoal, exId: target(state.settings.liftGoal.exId) }
        : state.settings?.liftGoal ?? null,
      training: {
        ...training,
        excludedExercises: (training.excludedExercises || []).map((id) => target(id)),
        replacements,
        ...(training.sideExercise ? { sideExercise: target(training.sideExercise) } : {}),
      },
    },
  }
  return { state: next, renamed: [...plan].map(([from, { to }]) => ({ from, to })) }
}
