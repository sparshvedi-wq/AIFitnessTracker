import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { EXERCISES, ORIGINAL_IDS, findExercise } from '../src/lib/exercises.js'
import { metaOf } from '../src/lib/catalog/index.js'

function imageDimensions(bytes, format) {
  if (format === 'png') {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
  }

  assert.equal(format, 'jpg')
  assert.equal(bytes.readUInt16BE(0), 0xffd8)
  let offset = 2
  while (offset + 9 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]
    if (marker === 0xc0 || marker === 0xc2)
      return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)]
    if (marker === 0xda) break
    const length = bytes.readUInt16BE(offset + 2)
    assert.ok(length >= 2, 'valid JPEG segment length')
    offset += 2 + length
  }
  throw new Error('JPEG dimensions missing')
}

const visuals = JSON.parse(readFileSync(new URL('../src/lib/exercise-visuals.json', import.meta.url)))

test('each registered demonstration has two captioned positions and its own image', () => {
  assert.equal(ORIGINAL_IDS.length, 88)
  assert.deepEqual(Object.keys(visuals).sort(), EXERCISES.map((exercise) => exercise.id).sort())
  const hashes = new Set()
  for (const id of Object.keys(visuals)) {
    const exercise = findExercise(id)
    const guide = visuals[id]
    assert.equal(guide.name, exercise?.name, id)
    assert.equal(guide.frames.length, 2, id)
    assert.ok(
      guide.frames.every((caption) => typeof caption === 'string' && caption.length > 8),
      id,
    )
    const format = guide.format || 'png'
    const bytes = readFileSync(new URL(`../public/exercise-guides/${id}.${format}`, import.meta.url))
    const hash = createHash('sha256').update(bytes).digest('hex')
    assert.ok(!hashes.has(hash), `${id}: duplicate image`)
    hashes.add(hash)
    const [width, height] = imageDimensions(bytes, format)
    assert.equal(width, height * (guide.layout === 'stacked' ? 1 : 2), `${id}: two equal frames`)
    assert.ok(height >= 512, `${id}: sufficient resolution for the guide`)
    assert.equal(metaOf(id).image, true, `${id}: visual status`)
  }
})

test('every built-in carries written cues and its illustration status matches the shipped assets', () => {
  const images = new Set(readdirSync(new URL('../public/exercise-guides/', import.meta.url)))
  for (const exercise of EXERCISES) {
    const hasVisual = Object.hasOwn(visuals, exercise.id)
    assert.equal(metaOf(exercise.id).image, hasVisual, exercise.id)
    const format = visuals[exercise.id]?.format || 'png'
    assert.equal(images.has(`${exercise.id}.${format}`), hasVisual, exercise.id)
    if (ORIGINAL_IDS.includes(exercise.id)) {
      assert.ok(exercise.cues.every((cue) => typeof cue === 'string' && cue.trim()), exercise.id)
      assert.ok(exercise.cues.length, exercise.id)
      continue
    }
    assert.ok(exercise.cues.length >= 2, `${exercise.id}: at least two technique cues`)
    assert.ok(
      exercise.cues.every((cue) => typeof cue === 'string' && cue.length >= 20 && /[.!?]$/.test(cue)),
      `${exercise.id}: complete sentences`,
    )
  }
  assert.deepEqual(
    [...images].filter((file) => /\.(png|jpg)$/.test(file)).sort(),
    Object.entries(visuals).map(([id, guide]) => `${id}.${guide.format || 'png'}`).sort(),
  )
})
