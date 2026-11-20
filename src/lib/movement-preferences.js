import { resolvePlace } from './places.js'
import { metaOf } from './catalog/index.js'
export const DEFAULT_ON_THE_GO = {
  space: 'open',
  position: 'any',
  noFloor: false,
  noJumping: true,
  wall: true,
}
export const SEATED_EXERCISES = [
  {
    id: 'seated-knee-extension',
    name: 'Seated knee extension',
    muscle: 'Legs',
    type: 'reps',
    weighted: false,
    cues: [
      'Sit on a stable, non-rolling chair with feet supported.',
      'Slowly straighten one knee within a comfortable range, then lower. Alternate legs; reps are per side.',
    ],
  },
  {
    id: 'seated-heel-raise',
    name: 'Seated heel raise',
    muscle: 'Legs',
    type: 'reps',
    weighted: false,
    cues: [
      'Sit tall with feet flat and knees comfortably bent.',
      'Lift both heels without bouncing, then lower slowly. Keep this unweighted.',
    ],
  },
  {
    id: 'seated-scapular',
    name: 'Seated shoulder-blade squeeze',
    muscle: 'Back',
    type: 'reps',
    weighted: false,
    cues: [
      'Sit upright with feet supported and arms relaxed.',
      'Gently draw shoulder blades together, pause, and release. Do not shrug or force the range. This is light control work.',
    ],
  },
  {
    id: 'seated-reach',
    name: 'Seated shoulder reach',
    muscle: 'Shoulders',
    type: 'time',
    weighted: false,
    cues: [
      'Use a stable chair with feet supported.',
      'Slowly reach your arms forward and upward within a comfortable range. Keep breathing; skip any uncomfortable movement.',
    ],
  },
  {
    id: 'seated-brace',
    name: 'Seated core brace',
    muscle: 'Core',
    type: 'time',
    weighted: false,
    cues: [
      'Sit tall on a stable chair with feet supported.',
      'Gently tighten your middle while breathing normally. Release regularly; do not hold your breath.',
    ],
  },
  {
    id: 'standing-brace',
    name: 'Standing core brace',
    muscle: 'Core',
    type: 'time',
    weighted: false,
    cues: [
      'Stand with feet comfortably apart and knees relaxed.',
      'Gently tighten your middle while breathing normally, then release. Stay upright without leaning.',
    ],
  },
  {
    id: 'standing-w',
    name: 'Standing W squeeze',
    muscle: 'Back',
    type: 'reps',
    weighted: false,
    cues: [
      'Stand tall and bend elbows into a relaxed W shape.',
      'Gently draw shoulder blades together, then release. Keep shoulders down. This is light control work, not loaded pulling.',
    ],
  },
]
// Space and position limits apply at places without equipment (On the go, or a
// saved place like an office). Each such place has its own saved preferences.
export function movementPreferences(profile, location, override) {
  const place = resolvePlace(profile, location)
  return place.base === 'on-the-go' ? { ...DEFAULT_ON_THE_GO, ...place.movement, ...override } : null
}
export function movementAllowed(id, preferences) {
  if (!preferences) return true
  const meta = metaOf(id)
  // Unknown or unreviewed moves (including custom ones) need explicit setup
  // before automatic recommendations can use them.
  if (!meta || !meta.reviewed) return false
  // Places with space preferences have no equipment.
  if (meta.equipment.length) return false
  if (preferences.position === 'seated') return meta.position === 'seat'
  // Chair work is offered through the explicit seated preference.
  if (meta.position === 'seat') return false
  if (preferences.position === 'standing' && meta.position !== 'stand') return false
  if (preferences.noFloor && ['floor', 'kneel'].includes(meta.position)) return false
  if (preferences.space === 'small' && meta.space === 'open') return false
  if (preferences.noJumping && meta.impact >= 2) return false
  if (!preferences.wall && meta.support.includes('wall')) return false
  return true
}
export function movementSummary(p) {
  if (!p) return ''
  return [
    p.space === 'small' ? 'Small space' : 'Room to move',
    p.position === 'standing'
      ? 'Standing only'
      : p.position === 'seated'
        ? 'Seated only'
        : p.noFloor
          ? 'No floor work'
          : 'Any position',
    p.noJumping ? 'No jumping' : '',
    !p.wall ? 'No wall needed' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
