// Extra form-guide content: which muscles a move works and the mistakes to
// watch for. Exercises without an entry fall back to their muscle group.
// Videos are placeholders until real clips are added (see FormSheet).

const MUSCLES = {
  Legs: { primary: 'Quads, glutes and hamstrings', secondary: 'Core and lower back keep you braced' },
  Glutes: { primary: 'Glutes', secondary: 'Hamstrings and core' },
  Chest: { primary: 'Chest', secondary: 'Front shoulders and triceps' },
  Back: { primary: 'Lats and upper back', secondary: 'Biceps and rear shoulders' },
  Shoulders: { primary: 'Shoulders', secondary: 'Upper back and triceps' },
  Biceps: { primary: 'Biceps', secondary: 'Forearms' },
  Triceps: { primary: 'Triceps', secondary: 'Chest and front shoulders' },
  Core: { primary: 'Abs and obliques', secondary: 'Hip flexors and lower back' },
  Cardio: { primary: 'Heart and lungs', secondary: 'Legs, shoulders and core' },
  Mobility: { primary: 'Hips, spine and hamstrings', secondary: 'Breathing and posture' },
}

const BY_EXERCISE = {
  rdl: {
    muscles: { primary: 'Hamstrings and glutes', secondary: 'Lower back and grip' },
    mistakes: ['Rounding your back to reach lower', 'Bending the knees into a squat', 'Letting the bar drift away from your legs'],
  },
  'back-squat': {
    muscles: { primary: 'Quads and glutes', secondary: 'Hamstrings, adductors and core' },
    mistakes: ['Knees caving in on the way up', 'Heels lifting off the floor', 'Cutting depth short as you tire'],
  },
  'bench-press': {
    muscles: { primary: 'Chest', secondary: 'Front shoulders and triceps' },
    mistakes: ['Bouncing the bar off your chest', 'Flaring elbows straight out', 'Hips lifting off the bench'],
  },
  deadlift: {
    muscles: { primary: 'Glutes, hamstrings and back', secondary: 'Quads, traps and grip' },
    mistakes: ['Jerking the bar off the floor', 'Hips shooting up first', 'Leaning back at the top'],
  },
  ohp: {
    muscles: { primary: 'Shoulders', secondary: 'Triceps and upper chest' },
    mistakes: ['Arching your lower back', 'Pressing the bar out in front', 'Not finishing with arms straight overhead'],
  },
  'pull-up': {
    muscles: { primary: 'Lats', secondary: 'Biceps and mid back' },
    mistakes: ['Kicking or swinging for momentum', 'Stopping short of a full hang', 'Shrugging shoulders to your ears'],
  },
  'barbell-row': {
    muscles: { primary: 'Mid back and lats', secondary: 'Rear shoulders and biceps' },
    mistakes: ['Standing up more each rep', 'Yanking with your arms', 'Rounding your back'],
  },
  'push-up': {
    muscles: { primary: 'Chest and triceps', secondary: 'Shoulders and core' },
    mistakes: ['Hips sagging toward the floor', 'Half reps', 'Head dropping forward'],
  },
  lunge: {
    muscles: { primary: 'Quads and glutes', secondary: 'Hamstrings and calves' },
    mistakes: ['Front knee caving inward', 'Steps that are too short', 'Leaning your chest forward'],
  },
  plank: {
    muscles: { primary: 'Abs', secondary: 'Shoulders and glutes' },
    mistakes: ['Hips too high or sagging', 'Holding your breath', 'Shoulders creeping past your elbows'],
  },
}

const GENERIC_MISTAKES = ['Rushing the lowering half of each rep', 'Losing your brace as you tire', 'Adding weight before the reps look clean']

export function formGuide(exId, muscle) {
  const own = BY_EXERCISE[exId] || {}
  return {
    muscles: own.muscles || MUSCLES[muscle] || { primary: muscle, secondary: '' },
    mistakes: own.mistakes || GENERIC_MISTAKES,
  }
}
