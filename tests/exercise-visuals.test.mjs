import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allExercises } from '../src/lib/exercises.js'

const visuals = JSON.parse(readFileSync(new URL('../src/lib/exercise-visuals.json', import.meta.url)))

test('every built-in exercise has two captioned demonstration positions and its own image', () => {
  const exercises = allExercises([])
  assert.deepEqual(Object.keys(visuals).sort(), exercises.map((exercise) => exercise.id).sort())
  for (const exercise of exercises) {
    const guide = visuals[exercise.id]
    assert.equal(guide.name, exercise.name, exercise.id)
    assert.equal(guide.frames.length, 2, exercise.id)
    assert.ok(
      guide.frames.every((caption) => typeof caption === 'string' && caption.length > 8),
      exercise.id,
    )
    const bytes = readFileSync(new URL(`../public/exercise-guides/${exercise.id}.png`, import.meta.url))
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${exercise.id}: PNG signature`)
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    assert.equal(width, height * 2, `${exercise.id}: two equal square frames`)
    assert.ok(height >= 512, `${exercise.id}: sufficient resolution for the guide`)
  }
})
