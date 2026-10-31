import { resolvePlace } from './places.js'
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
const seated = new Set(SEATED_EXERCISES.filter((e) => e.id.startsWith('seated-')).map((e) => e.id))
const floor = new Set([
  'glute-bridge',
  'prone-w',
  'push-up',
  'dead-bug',
  'side-plank',
  'plank',
  'hollow-hold',
  'russian-twist',
  'mountain-climber',
  'burpee',
  'cat-cow',
  'worlds-greatest',
  'hip-flexor',
  'childs-pose',
  'band-row',
])
const notStanding = new Set([
  ...floor,
  ...seated,
  'bench-press',
  'db-bench',
  'db-row',
  'lat-pulldown',
  'leg-press',
])
const travel = new Set([
  'lunge',
  'wu-jog',
  'wu-shuffle',
  'wu-strides',
  'wu-cut',
  'wu-football',
  'wu-basketball',
  'wu-volley',
  'wu-skate',
  'wu-cricket',
  'wu-cycle',
  'quiet-step',
  'skater',
  'back-squat',
  'bench-press',
  'rdl',
  'deadlift',
  'barbell-row',
])
const impact = new Set([
  'jumping-jack',
  'squat-jump',
  'burpee',
  'high-knees',
  'skater',
  'wu-jog',
  'wu-march',
  'wu-landing',
  'wu-strides',
  'wu-cut',
  'wu-racket',
  'wu-basketball',
  'wu-volley',
  'wu-combat',
])
const equipmentOnly = new Set([
  'back-squat',
  'goblet-squat',
  'rdl',
  'db-rdl',
  'bench-press',
  'db-bench',
  'db-row',
  'band-row',
  'lat-pulldown',
  'pull-up',
  'ohp',
  'db-overhead-press',
  'lateral-raise',
  'biceps-curl',
  'triceps-pushdown',
  'calf-raise',
  'deadlift',
  'barbell-row',
  'leg-press',
  'face-pull',
  'dip',
  'wu-cycle',
])
const known = new Set([
  ...floor,
  ...notStanding,
  ...travel,
  ...impact,
  ...SEATED_EXERCISES.map((e) => e.id),
  'goblet-squat',
  'bodyweight-squat',
  'split-squat',
  'db-rdl',
  'incline-push-up',
  'pull-up',
  'ohp',
  'db-overhead-press',
  'lateral-raise',
  'biceps-curl',
  'triceps-pushdown',
  'calf-raise',
  'dip',
  'face-pull',
  'quiet-march',
  'quiet-squat',
  'hamstring-stretch',
  'wu-ankles',
  'wu-leg-swings',
  'wu-lunge',
  'wu-lateral',
  'wu-hips',
  'wu-arms',
  'wu-rotation',
  'wu-scapula',
  'wu-wrists',
  'wu-balance',
  'wu-throw',
  'wu-swim',
  'wu-golf',
  'wu-hinge',
])
for (const id of [
  'wu-racket-still',
  'wu-basketball-still',
  'wu-footwork-still',
  'wu-volley-still',
  'wu-skate-still',
  'wu-box-still',
])
  known.add(id)
// Space and position limits apply at places without equipment (On the go, or a
// saved place like an office). Each such place has its own saved preferences.
export function movementPreferences(profile, location, override) {
  const place = resolvePlace(profile, location)
  return place.base === 'on-the-go' ? { ...DEFAULT_ON_THE_GO, ...place.movement, ...override } : null
}
export function movementAllowed(id, preferences) {
  if (!preferences) return true
  if (equipmentOnly.has(id)) return false
  if (!known.has(id)) return false // Unknown custom moves need explicit setup outside automatic recommendations.
  if (preferences.position === 'seated') return seated.has(id)
  if (preferences.position === 'standing' && notStanding.has(id)) return false
  if (preferences.noFloor && floor.has(id)) return false
  if (preferences.space === 'small' && travel.has(id)) return false
  if (preferences.noJumping && impact.has(id)) return false
  if (!preferences.wall && ['incline-push-up', 'wu-scapula'].includes(id)) return false
  return !seated.has(id) // Chair work is offered through the explicit seated preference.
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
