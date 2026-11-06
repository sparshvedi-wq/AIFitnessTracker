import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISES, ORIGINAL_IDS, findExercise, allExercises } from '../src/lib/exercises.js'
import { allMeta, metaOf, importReport, aliasesOf } from '../src/lib/catalog/index.js'
import { IMPORT_MANIFEST } from '../src/lib/catalog/import-manifest.js'
import { IMPORTED } from '../src/lib/catalog/imported.js'
import { SPORT_DRILLS } from '../src/lib/sports.js'
import { migrateExerciseIds } from '../src/lib/catalog/migrations.js'
import { defaultState, normalizeState } from '../src/lib/storage.js'
import { matchesExercise } from '../src/lib/exercise-search.js'
import { MOVEMENTS } from '../src/lib/planner.js'

// The planner list before the catalog import: every exercise kept at least
// these avoidance areas, so consolidation never loosened a restriction.
const LEGACY_USES = {
  'back-squat': ['Legs', 'Glutes', 'Back'], 'goblet-squat': ['Legs', 'Glutes'], 'bodyweight-squat': ['Legs', 'Glutes'],
  rdl: ['Legs', 'Glutes', 'Back'], 'glute-bridge': ['Glutes', 'Legs'], 'db-rdl': ['Legs', 'Glutes', 'Back'],
  'split-squat': ['Legs', 'Glutes'], 'bench-press': ['Chest', 'Shoulders', 'Triceps'], 'db-bench': ['Chest', 'Shoulders', 'Triceps'],
  'push-up': ['Chest', 'Shoulders', 'Triceps', 'Core'], 'incline-push-up': ['Chest', 'Shoulders', 'Triceps'],
  'db-row': ['Back', 'Biceps', 'Shoulders'], 'band-row': ['Back', 'Biceps', 'Shoulders'], 'lat-pulldown': ['Back', 'Biceps', 'Shoulders'],
  'pull-up': ['Back', 'Biceps', 'Shoulders'], 'prone-w': ['Back', 'Shoulders'], ohp: ['Shoulders', 'Triceps'],
  'lateral-raise': ['Shoulders'], 'db-overhead-press': ['Shoulders', 'Triceps'], 'biceps-curl': ['Biceps'],
  'triceps-pushdown': ['Triceps'], 'calf-raise': ['Legs'], 'dead-bug': ['Core'], 'side-plank': ['Core', 'Shoulders'],
  'standing-w': ['Back', 'Shoulders'], 'standing-brace': ['Core'], 'seated-knee-extension': ['Legs'],
  'seated-heel-raise': ['Legs'], 'seated-scapular': ['Back', 'Shoulders'], 'seated-reach': ['Shoulders'], 'seated-brace': ['Core'],
}

test('all 200 legacy records map to exactly one stable canonical ID with no orphans', () => {
  assert.equal(IMPORT_MANIFEST.length, 200)
  assert.equal(IMPORT_MANIFEST.filter((r) => r.source === 'base').length, 60)
  assert.equal(IMPORT_MANIFEST.filter((r) => r.source === 'extra').length, 140)
  assert.equal(new Set(IMPORT_MANIFEST.map((r) => r.key)).size, 200)
  const imported = new Set(IMPORTED.map((d) => d.id))
  for (const row of IMPORT_MANIFEST) {
    assert.match(row.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${row.key}: ID format`)
    assert.ok(findExercise(row.id), `${row.key}: ${row.id} resolves`)
    assert.ok(metaOf(row.id)?.reviewed, `${row.key}: ${row.id} reviewed`)
    if (row.relation === 'existing') assert.ok(ORIGINAL_IDS.includes(row.id), row.key)
    else assert.ok(imported.has(row.id), row.key)
  }
  // Every imported definition comes from at least one source record.
  const referenced = new Set(IMPORT_MANIFEST.map((r) => r.id))
  for (const id of imported) assert.ok(referenced.has(id), `${id} has a source record`)
  // No imported ID collides with an original one.
  for (const id of imported) assert.ok(!ORIGINAL_IDS.includes(id), id)
  const report = importReport(ORIGINAL_IDS)
  assert.deepEqual(report, {
    sourceRecords: 200,
    toRetainedInkIds: 32,
    retainedInkIdsMatched: 31,
    synonymsOfImported: 1,
    newDefinitions: 167,
    meaningfulVariations: report.meaningfulVariations,
    newMovements: 167 - report.meaningfulVariations,
    inkOnlyRetained: 57,
    finalUnique: 255,
  })
  assert.ok(report.meaningfulVariations > 40 && report.meaningfulVariations < 167)
})

test('the combined catalog keeps all 88 original IDs and has complete, reviewed metadata', () => {
  assert.equal(ORIGINAL_IDS.length, 88)
  assert.equal(EXERCISES.length, 255)
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, 255)
  for (const e of EXERCISES) {
    const meta = metaOf(e.id)
    assert.ok(meta, e.id)
    assert.deepEqual(meta.issues, [], e.id)
    assert.ok(['reps', 'time'].includes(e.type), e.id)
    assert.ok(meta.areas.length > 0, `${e.id}: areas`)
    if (meta.variationOf) assert.ok(findExercise(meta.variationOf), `${e.id}: variation of a real exercise`)
    // Logging convention matches the definition.
    if (meta.load === 'bw' || meta.load === 'band') assert.equal(e.weighted, false, `${e.id}: unloaded logging`)
    if (['hand', 'one', 'bar', 'stack', 'plate', 'assist', 'landmine'].includes(meta.load)) assert.equal(e.weighted, true, e.id)
  }
  assert.equal(allMeta().length, 255)
})

test('consolidation never loosened an avoidance restriction from the previous planner', () => {
  for (const [id, uses] of Object.entries(LEGACY_USES)) {
    const areas = metaOf(id).areas
    for (const area of uses) assert.ok(areas.includes(area), `${id} still loads ${area}`)
    assert.ok(MOVEMENTS.some((m) => m.id === id), `${id} is still plannable`)
  }
})

test('sport drills keep exactly the areas sports.js assigns them', () => {
  for (const drill of SPORT_DRILLS) assert.deepEqual([...metaOf(drill.id).areas].sort(), [...drill.uses].sort(), drill.id)
})

test('legacy names stay searchable as aliases', () => {
  const goblet = findExercise('goblet-squat')
  assert.ok(aliasesOf('goblet-squat', goblet.name).includes('Kettlebell goblet squat'))
  assert.ok(matchesExercise(findExercise('seated-leg-curl'), 'leg curl'))
  assert.ok(matchesExercise(findExercise('incline-push-up'), 'wall push-up'))
  assert.ok(matchesExercise(findExercise('wu-scapula'), 'wall slide'))
  assert.ok(matchesExercise(findExercise('goblet-squat'), 'kettlebell goblet'))
  assert.ok(matchesExercise(findExercise('deadlift'), 'conventional'))
  assert.ok(!matchesExercise(findExercise('push-up'), 'kettlebell'))
})

test('custom exercises can never silently replace a built-in', () => {
  const custom = [{ id: 'push-up', name: 'My push-up', muscle: 'Chest', type: 'reps', weighted: false, cues: [] }]
  assert.equal(findExercise('push-up', custom).name, 'Push-up')
  assert.equal(allExercises(custom).filter((e) => e.id === 'push-up').length, 1)
})

test('colliding custom IDs are renamed with their references, idempotently, and old saves round-trip', () => {
  const state = defaultState()
  state.customExercises = [
    { id: 'hip-thrust', name: 'My hip thrust', muscle: 'Glutes', type: 'reps', weighted: true, cues: [], custom: true },
    { id: 'custom-abc', name: 'Sled push', muscle: 'Legs', type: 'time', weighted: false, cues: [], custom: true },
  ]
  state.workouts = [
    {
      id: 'w1',
      date: '2026-10-01',
      startedAt: 1,
      unit: 'lb',
      exercises: [
        { exId: 'hip-thrust', name: 'My hip thrust', type: 'reps', weighted: true, sets: [{ reps: 10, weight: 50 }] },
        { exId: 'custom-abc', name: 'Sled push', type: 'time', weighted: false, sets: [{ sec: 30 }] },
      ],
      unfinished: [{ exId: 'hip-thrust', reason: 'time' }],
    },
  ]
  state.routines = [{ id: 'r1', name: 'Mine', items: [{ exId: 'hip-thrust', sets: 3, reps: 10 }] }]
  state.settings.favoriteExercises = ['hip-thrust', 'push-up']
  state.settings.exerciseNotes = { 'home:hip-thrust': 'pad', 'push-up': 'hands wide' }
  state.settings.training.excludedExercises = ['hip-thrust']
  const once = normalizeState(JSON.parse(JSON.stringify(state)))
  const id = once.customExercises[0].id
  assert.equal(id, 'custom-hip-thrust')
  assert.equal(once.customExercises[1].id, 'custom-abc', 'non-colliding customs keep their IDs')
  assert.equal(once.workouts[0].exercises[0].exId, id)
  assert.equal(once.workouts[0].exercises[1].exId, 'custom-abc')
  assert.equal(once.workouts[0].unfinished[0].exId, id)
  assert.equal(once.routines[0].items[0].exId, id)
  assert.deepEqual(once.settings.favoriteExercises, [id, 'push-up'])
  assert.deepEqual(once.settings.exerciseNotes, { [`home:${id}`]: 'pad', 'push-up': 'hands wide' })
  assert.deepEqual(once.settings.training.excludedExercises, [id])
  assert.equal(findExercise(id, once.customExercises).name, 'My hip thrust')
  // Idempotent: normalizing again changes nothing.
  const twice = normalizeState(JSON.parse(JSON.stringify(once)))
  assert.deepEqual(twice, once)
  assert.equal(migrateExerciseIds(once, { builtIn: new Map(EXERCISES.map((e) => [e.id, e.name])), original: new Set(ORIGINAL_IDS) }).renamed.length, 0)
  // A record that named the built-in keeps the built-in.
  const named = defaultState()
  named.customExercises = [{ id: 'push-up', name: 'Wall thing', muscle: 'Chest', type: 'reps', weighted: false, cues: [] }]
  named.workouts = [{ id: 'w', date: '2026-10-01', exercises: [{ exId: 'push-up', name: 'Push-up', sets: [{ reps: 10 }] }] }]
  const migrated = normalizeState(named)
  assert.equal(migrated.workouts[0].exercises[0].exId, 'push-up')
  assert.equal(migrated.customExercises[0].id, 'custom-push-up')
  // A save without collisions round-trips untouched apart from the version stamp.
  const plain = defaultState()
  plain.workouts = [{ id: 'x', date: '2026-10-02', exercises: [{ exId: 'db-row', name: 'One-arm dumbbell row', sets: [{ reps: 8, weight: 30 }] }] }]
  const back = normalizeState(JSON.parse(JSON.stringify(plain)))
  assert.deepEqual(back.workouts, plain.workouts)
})
