// One estimator for how long planned work takes: set work, per-side reps,
// rests, equipment setup and moving between exercises. Plans are fitted to
// the requested minutes with this estimate; rests are never cut below the
// minimum useful rest to make time.
import { metaOf } from '../catalog/index.js'
import { TIMING } from './config.js'

export function setWorkSeconds(item, meta = metaOf(item.exId)) {
  if (item.sec) return item.sec
  const perSide = item.unilateral ?? meta?.perSide ?? false
  return (item.reps || 10) * (meta?.tempo || TIMING.repSec) * (perSide ? 2 : 1)
}

/**
 * Seconds for one planned item, including its setup and the move to the next.
 * Rest is counted after every set (the rest after an exercise's last set is
 * the break before the next one), so the estimate does not depend on order.
 */
export function itemSeconds(item) {
  const meta = metaOf(item.exId)
  const sets = Math.max(1, item.sets || 1)
  const work = setWorkSeconds(item, meta) + TIMING.setOverheadSec
  return (meta?.setupSec ?? 15) + TIMING.itemTransitionSec + sets * (work + (item.restSec || 0))
}

/** Seconds one more set of this item would add. */
export function extraSetSeconds(item) {
  return setWorkSeconds(item) + TIMING.setOverheadSec + (item.restSec || 0)
}

export function planSeconds(items) {
  return items.reduce((sum, item) => sum + itemSeconds(item), 0)
}
