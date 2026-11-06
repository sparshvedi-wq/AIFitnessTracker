import { readFileSync, writeFileSync } from 'node:fs'
import { importReport, allMeta } from '../src/lib/catalog/index.js'
import { IMPORT_MANIFEST } from '../src/lib/catalog/import-manifest.js'
import { allExercises } from '../src/lib/exercises.js'

const originalIds = Object.keys(JSON.parse(readFileSync(new URL('../src/lib/exercise-visuals.json', import.meta.url))))
const counts = importReport(originalIds)
const definitions = new Map(allExercises().map((exercise) => [exercise.id, exercise]))
const invalid = IMPORT_MANIFEST.filter((entry) => !definitions.has(entry.id))
if (invalid.length || counts.sourceRecords !== 200 || counts.finalUnique !== definitions.size) throw new Error('Catalog mapping failed validation')
const plannable = allMeta().filter((meta) => meta.reviewed && meta.kinds.includes('strength')).length
const rows = IMPORT_MANIFEST.map((entry) => `| ${entry.source} ${entry.index} | ${entry.name.replaceAll('|', '/')} | ${entry.relation} | ${entry.id} | ${definitions.get(entry.id).name} |`)
const text = `# Exercise catalog import audit

Generated from the actual canonical definitions and versioned source manifest by running \`node scripts/catalog-report.mjs\`.

| Measure | Count |
|---|---:|
| Legacy source records accounted for | ${counts.sourceRecords} |
| Source records mapped to retained Ink IDs | ${counts.toRetainedInkIds} |
| Distinct original Ink IDs matched | ${counts.retainedInkIdsMatched} |
| Source synonyms mapped to another imported definition | ${counts.synonymsOfImported} |
| New definitions | ${counts.newDefinitions} |
| Meaningful variations among new definitions | ${counts.meaningfulVariations} |
| Other new movements | ${counts.newMovements} |
| Original Ink-only movements retained | ${counts.inkOnlyRetained} |
| Final unique built-in definitions | ${counts.finalUnique} |
| Reviewed strength candidates before personal eligibility filtering | ${plannable} |

The original 88 IDs and mannequin guides remain intact. The imported exercises have written guides; images are displayed only for the 88 exercises with matching artwork. The total exceeds 200 because Ink-only movements and sport drills are retained. A movement is suggested only when its metadata, session kind, equipment, skill and personal constraints allow it.

The FRAME sources are read-only references: \`N:\\Workspaces\\AIFitnessTracker\\mobile\\src\\lib\\workouts.ts\` (60 base records) and \`exercise-catalog-extra.ts\` (140 records). No FRAME accounts, photographs or saved workouts were imported. Saved custom-ID collisions use the idempotent migration in \`src/lib/catalog/migrations.js\`; user-facing names and historical records are retained.

## Complete source-to-canonical mapping

| Source / index | Legacy name | Relationship | Stable Ink ID | Canonical name |
|---|---|---|---|---|
${rows.join('\n')}
`
writeFileSync(new URL('../docs/EXERCISE_CATALOG_IMPORT.md', import.meta.url), text)
console.log(JSON.stringify({ ...counts, reviewedStrengthCandidates: plannable, unresolved: invalid.length }))
