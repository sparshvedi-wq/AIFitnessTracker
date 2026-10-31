// Quick choices for a first working weight, so nobody starts from 0 and taps
// "+" five times. They are conservative starting points, not estimates of
// strength; the person still chooses.
import { DUMBBELL_MOVES } from './preferences.js'

const BARBELL = ['back-squat', 'rdl', 'deadlift', 'bench-press', 'ohp', 'barbell-row']
const MACHINE = ['leg-press', 'triceps-pushdown', 'lat-pulldown', 'face-pull', 'calf-raise']

const DEFAULTS = {
  // Barbell choices start at an empty bar.
  barbell: { lb: [45, 65, 85, 95], kg: [20, 30, 40, 45] },
  dumbbell: { lb: [10, 15, 20, 25], kg: [4, 6, 8, 10] },
  machine: { lb: [20, 30, 40, 50], kg: [10, 15, 20, 25] },
  other: { lb: [10, 20, 30, 40], kg: [5, 10, 15, 20] },
}

export function loadKind(exId) {
  if (BARBELL.includes(exId)) return 'barbell'
  if (DUMBBELL_MOVES.includes(exId)) return 'dumbbell'
  if (MACHINE.includes(exId)) return 'machine'
  return 'other'
}

/** Up to four starting weights; uses the person's own dumbbells when they've listed them. */
export function startingLoadChoices(exId, unit, availableLoads = []) {
  const kind = loadKind(exId)
  if (kind === 'dumbbell' && availableLoads.length) return availableLoads.slice(0, 4)
  return DEFAULTS[kind][unit === 'kg' ? 'kg' : 'lb']
}

/** The next weight up or down: the next listed dumbbell, otherwise a fixed step. */
export function stepLoad(weight, direction, step, availableLoads = []) {
  const current = weight || 0
  if (availableLoads.length) {
    const next =
      direction > 0
        ? availableLoads.find((v) => v > current + 0.0001)
        : [...availableLoads].reverse().find((v) => v < current - 0.0001)
    return next ?? current
  }
  return Math.max(0, Math.round((current + direction * step) * 10) / 10)
}

const BAR = { lb: 45, kg: 20 }
const PLATES = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] }

/**
 * What goes on each side of a standard bar for a barbell total, e.g. 135 lb →
 * [45]. `exact` is false when standard plates can't make the number; the
 * plates then make the nearest lighter load.
 */
export function plateBreakdown(total, unit) {
  const system = unit === 'kg' ? 'kg' : 'lb'
  const bar = BAR[system]
  if (!(total >= bar)) return null
  let side = Math.round(((total - bar) / 2) * 100) / 100
  const plates = []
  for (const plate of PLATES[system]) {
    while (side >= plate - 0.001) {
      plates.push(plate)
      side = Math.round((side - plate) * 100) / 100
    }
  }
  return { bar, plates, exact: side < 0.01 }
}
