import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { EXERCISES, ORIGINAL_IDS, findExercise } from '../src/lib/exercises.js'
import { metaOf } from '../src/lib/catalog/index.js'

const visuals = JSON.parse(readFileSync(new URL('../src/lib/exercise-visuals.json', import.meta.url)))

test('all 88 original exercises keep two captioned demonstration positions and their own image', () => {
  assert.equal(ORIGINAL_IDS.length, 88)
  assert.deepEqual(Object.keys(visuals).sort(), [...ORIGINAL_IDS].sort())
  for (const id of ORIGINAL_IDS) {
    const exercise = findExercise(id)
    const guide = visuals[id]
    assert.equal(guide.name, exercise.name, id)
    assert.equal(guide.frames.length, 2, id)
    assert.ok(
      guide.frames.every((caption) => typeof caption === 'string' && caption.length > 8),
      id,
    )
    const bytes = readFileSync(new URL(`../public/exercise-guides/${id}.png`, import.meta.url))
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${id}: PNG signature`)
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    assert.equal(width, height * 2, `${id}: two equal square frames`)
    assert.ok(height >= 512, `${id}: sufficient resolution for the guide`)
    assert.equal(metaOf(id).image, true, `${id}: visual status`)
  }
})

test('imported exercises declare no illustration and carry a complete written guide instead', () => {
  const images = new Set(readdirSync(new URL('../public/exercise-guides/', import.meta.url)))
  const imported = EXERCISES.filter((e) => !ORIGINAL_IDS.includes(e.id))
  assert.equal(imported.length, 167)
  for (const exercise of imported) {
    // No random mannequin and no broken image: there is no file and no visual entry.
    assert.equal(metaOf(exercise.id).image, false, exercise.id)
    assert.equal(visuals[exercise.id], undefined, exercise.id)
    assert.ok(!images.has(`${exercise.id}.png`), exercise.id)
    assert.ok(exercise.cues.length >= 2, `${exercise.id}: at least two technique cues`)
    assert.ok(
      exercise.cues.every((cue) => typeof cue === 'string' && cue.length >= 20 && /[.!?]$/.test(cue)),
      `${exercise.id}: complete sentences`,
    )
  }
  // Exactly the 88 original images ship; nothing was generated for imports.
  assert.equal([...images].filter((f) => f.endsWith('.png')).length, 88)
})
