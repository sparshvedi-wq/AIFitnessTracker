// Shared vocabulary for the canonical exercise catalog (see docs/RECOMMENDATION_ENGINE.md).
// Pure data: no imports, so every module can use it without import cycles.

export const CATALOG_VERSION = 2

// Detailed muscles used for guides and overlap accounting, and the broad body
// area (Ink's planning vocabulary) each one belongs to. Areas drive explicit
// avoidance: a sore or painful area excludes every exercise that loads it.
export const MUSCLE_AREA = {
  quads: 'Legs',
  hamstrings: 'Legs',
  calves: 'Legs',
  adductors: 'Legs',
  'hip-flexors': 'Legs',
  glutes: 'Glutes',
  abductors: 'Glutes',
  lats: 'Back',
  'upper-back': 'Back',
  traps: 'Back',
  'lower-back': 'Back',
  chest: 'Chest',
  'front-delts': 'Shoulders',
  'side-delts': 'Shoulders',
  'rear-delts': 'Shoulders',
  'rotator-cuff': 'Shoulders',
  serratus: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Biceps',
  abs: 'Core',
  obliques: 'Core',
}

export const MUSCLE_LABEL = {
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  adductors: 'Inner thighs',
  'hip-flexors': 'Hip flexors',
  glutes: 'Glutes',
  abductors: 'Outer hips',
  lats: 'Lats',
  'upper-back': 'Upper back',
  traps: 'Upper traps',
  'lower-back': 'Lower back',
  chest: 'Chest',
  'front-delts': 'Front shoulders',
  'side-delts': 'Side shoulders',
  'rear-delts': 'Rear shoulders',
  'rotator-cuff': 'Rotator cuff',
  serratus: 'Serratus',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms and grip',
  abs: 'Abs',
  obliques: 'Obliques',
}

// Joint actions describe *how* a movement loads the body, so two differently
// named exercises can still be recognised as similar work.
export const JOINT_ACTIONS = {
  ke: 'knee extension',
  kf: 'knee flexion',
  he: 'hip extension',
  hf: 'hip flexion',
  hab: 'hip abduction',
  had: 'hip adduction',
  ap: 'ankle plantar flexion',
  sf: 'shoulder flexion',
  sab: 'shoulder abduction',
  se: 'shoulder extension',
  shad: 'horizontal shoulder adduction',
  shab: 'horizontal shoulder abduction',
  ser: 'shoulder external rotation',
  sret: 'scapular retraction',
  sel: 'scapular elevation',
  spro: 'scapular protraction',
  ef: 'elbow flexion',
  ee: 'elbow extension',
  tf: 'trunk flexion',
  te: 'trunk extension',
  tr: 'trunk rotation',
  ar: 'anti-rotation',
  aext: 'anti-extension',
  alat: 'anti-lateral flexion',
  loc: 'locomotion',
  mob: 'mobility',
}

// Equipment capabilities. A place offers a set of these; an exercise lists
// what it needs as AND groups of OR alternatives.
export const CAPABILITIES = {
  db: 'Dumbbells',
  kb: 'Kettlebell',
  bb: 'Barbell',
  rack: 'Squat rack',
  bench: 'Bench',
  incline: 'Adjustable bench',
  bar: 'Pull-up bar',
  dip: 'Dip bars',
  band: 'Resistance bands',
  loop: 'Loop bands',
  anchor: 'Band anchor',
  cable: 'Cable machine',
  machine: 'Gym machines',
  step: 'Sturdy step or box',
  landmine: 'Landmine',
  trx: 'Suspension trainer',
  ball: 'Stability ball',
  slider: 'Sliders',
  wheel: 'Ab wheel',
  hack: 'Hack squat',
  belt: 'Belt squat',
  pendulum: 'Pendulum squat',
  bike: 'Bike',
}

// What a configured full gym is assumed to have. Specialty items are not
// assumed; a gym place can list them as extras.
export const GYM_CAPABILITIES = [
  'db',
  'kb',
  'bb',
  'rack',
  'bench',
  'incline',
  'bar',
  'dip',
  'cable',
  'machine',
  'step',
  'bike',
]

// Equipment labels people pick, and the capabilities each provides. The first
// six are the original home options and keep their exact saved labels.
export const EQUIPMENT_CAPABILITIES = {
  Dumbbells: ['db'],
  'Resistance bands': ['band'],
  Bench: ['bench'],
  'Pull-up bar': ['bar'],
  'Barbell & rack': ['bb', 'rack'],
  Kettlebell: ['kb'],
  'Adjustable bench': ['bench', 'incline'],
  'Band anchor': ['anchor'],
  'Loop bands': ['loop'],
  'Sturdy step or box': ['step'],
  'Dip bars': ['dip'],
  'Cable machine': ['cable'],
  'Suspension trainer': ['trx'],
  'Stability ball': ['ball'],
  Sliders: ['slider'],
  'Ab wheel': ['wheel'],
  Landmine: ['landmine'],
  'Hack squat': ['hack'],
  'Belt squat': ['belt'],
  'Pendulum squat': ['pendulum'],
  // Older planner label; still understood in saved data.
  'Gym machines': ['machine', 'cable'],
}
export const MORE_EQUIPMENT = [
  'Adjustable bench',
  'Band anchor',
  'Loop bands',
  'Sturdy step or box',
  'Dip bars',
  'Cable machine',
  'Suspension trainer',
  'Stability ball',
  'Sliders',
  'Ab wheel',
  'Landmine',
]
export const GYM_EXTRAS = [
  'Resistance bands',
  'Loop bands',
  'Band anchor',
  'Suspension trainer',
  'Stability ball',
  'Sliders',
  'Ab wheel',
  'Landmine',
  'Hack squat',
  'Belt squat',
  'Pendulum squat',
]

export function capabilitiesFor(labels = []) {
  return [...new Set(labels.flatMap((label) => EQUIPMENT_CAPABILITIES[label] || []))]
}

export const POSITIONS = ['stand', 'floor', 'kneel', 'lean', 'bench', 'seat', 'machine', 'hang']
export const LOAD_CONVENTIONS = {
  bw: 'Bodyweight; reps or time are logged',
  hand: 'Weight of one dumbbell; both hands hold one',
  one: 'Weight of the single implement held',
  bar: 'Total of bar and plates',
  landmine: 'Plates added to the bar end',
  stack: 'Machine or cable stack setting',
  plate: 'Plate-loaded machine total',
  band: 'Band resistance; load logged as none',
  assist: 'Assistance setting; less assistance is harder',
}
// Smallest sensible change for each convention when no listed sizes exist.
export const LOAD_STEP = {
  hand: { lb: 5, kg: 2 },
  one: { lb: 5, kg: 2 },
  bar: { lb: 5, kg: 2.5 },
  landmine: { lb: 5, kg: 2.5 },
  stack: { lb: 10, kg: 5 },
  plate: { lb: 10, kg: 5 },
  assist: { lb: 10, kg: 5 },
}
export const KINDS = {
  S: 'strength',
  T: 'seated',
  W: 'warmup',
  M: 'mobility',
  K: 'conditioning',
}
export const ROLES = ['compound', 'accessory', 'isolation', 'control', 'drill', 'stretch']
// Coarse slots used to balance a session.
export const PATTERN_REGION = {
  squat: 'lower',
  hinge: 'lower',
  lunge: 'lower',
  calf: 'lower',
  'hip-iso': 'lower',
  'knee-iso': 'lower',
  'push-h': 'push',
  'push-v': 'push',
  'pull-h': 'pull',
  'pull-v': 'pull',
  'shoulder-iso': 'push',
  'rear-iso': 'pull',
  arms: 'arms',
  core: 'core',
  control: 'control',
  carry: 'core',
  conditioning: 'conditioning',
  mobility: 'mobility',
  warmup: 'warmup',
}
