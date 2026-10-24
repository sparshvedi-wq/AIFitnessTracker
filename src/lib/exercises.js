// Built-in exercise catalog and starter routines.
//
// Exercise: { id, name, muscle, type: 'reps' | 'time', weighted, cues[] }
// Routine item: { exId, sets, reps | sec, restSec }

export const EXERCISES = [
  // Legs
  { id: 'back-squat', name: 'Back squat', muscle: 'Legs', type: 'reps', weighted: true, cues: ['Brace your core before you descend', 'Knees track over your toes', 'Hips to at least knee height, then drive up'] },
  { id: 'goblet-squat', name: 'Goblet squat', muscle: 'Legs', type: 'reps', weighted: true, cues: ['Hold the weight at your chest', 'Sit between your heels', 'Keep your chest tall'] },
  { id: 'rdl', name: 'Romanian deadlift', muscle: 'Legs', type: 'reps', weighted: true, cues: ['Soft knees, push your hips back', 'Bar stays close to your legs', 'Stop when you feel a hamstring stretch'] },
  { id: 'deadlift', name: 'Deadlift', muscle: 'Back', type: 'reps', weighted: true, cues: ['Bar over mid-foot', 'Pull the slack out before you lift', 'Stand tall, don\'t lean back'] },
  { id: 'lunge', name: 'Walking lunge', muscle: 'Legs', type: 'reps', weighted: true, cues: ['Long step, back knee toward the floor', 'Front knee stays over the ankle', 'Reps are per leg'] },
  { id: 'leg-press', name: 'Leg press', muscle: 'Legs', type: 'reps', weighted: true, cues: ['Feet shoulder-width on the platform', 'Lower until knees reach 90°', 'Don\'t lock your knees at the top'] },
  { id: 'calf-raise', name: 'Calf raise', muscle: 'Legs', type: 'reps', weighted: true, cues: ['Full stretch at the bottom', 'Pause one second at the top'] },
  { id: 'glute-bridge', name: 'Glute bridge', muscle: 'Glutes', type: 'reps', weighted: false, cues: ['Drive through your heels', 'Squeeze at the top for a second', 'Ribs down, no arching'] },
  { id: 'squat-jump', name: 'Squat jump', muscle: 'Legs', type: 'time', weighted: false, cues: ['Land softly, knees bent', 'Swing your arms for height'] },

  // Push
  { id: 'bench-press', name: 'Bench press', muscle: 'Chest', type: 'reps', weighted: true, cues: ['Shoulder blades pinched together', 'Lower to mid-chest', 'Feet planted, press up and back'] },
  { id: 'db-bench', name: 'Dumbbell bench press', muscle: 'Chest', type: 'reps', weighted: true, cues: ['Elbows about 45° from your body', 'Press the dumbbells up and slightly together'] },
  { id: 'push-up', name: 'Push-up', muscle: 'Chest', type: 'reps', weighted: false, cues: ['Body in one straight line', 'Chest to just above the floor', 'Drop to your knees to finish the set'] },
  { id: 'ohp', name: 'Overhead press', muscle: 'Shoulders', type: 'reps', weighted: true, cues: ['Squeeze glutes so your back doesn\'t arch', 'Head through once the bar passes your face'] },
  { id: 'lateral-raise', name: 'Lateral raise', muscle: 'Shoulders', type: 'reps', weighted: true, cues: ['Slight bend in the elbows', 'Raise to shoulder height, no higher', 'Slow on the way down'] },
  { id: 'dip', name: 'Dip', muscle: 'Triceps', type: 'reps', weighted: false, cues: ['Lean slightly forward', 'Lower until upper arms are parallel to the floor'] },
  { id: 'triceps-pushdown', name: 'Triceps pushdown', muscle: 'Triceps', type: 'reps', weighted: true, cues: ['Elbows pinned to your sides', 'Fully straighten your arms'] },

  // Pull
  { id: 'pull-up', name: 'Pull-up', muscle: 'Back', type: 'reps', weighted: false, cues: ['Start from a dead hang', 'Pull your elbows down to your ribs', 'Chin over the bar'] },
  { id: 'lat-pulldown', name: 'Lat pulldown', muscle: 'Back', type: 'reps', weighted: true, cues: ['Lean back slightly', 'Pull the bar to your upper chest', 'Control it on the way up'] },
  { id: 'barbell-row', name: 'Bent-over row', muscle: 'Back', type: 'reps', weighted: true, cues: ['Hinge to about 45°', 'Pull toward your belly button', 'Keep your back flat'] },
  { id: 'db-row', name: 'One-arm dumbbell row', muscle: 'Back', type: 'reps', weighted: true, cues: ['Hand and knee on the bench', 'Pull the dumbbell to your hip', 'Reps are per arm'] },
  { id: 'face-pull', name: 'Face pull', muscle: 'Shoulders', type: 'reps', weighted: true, cues: ['Rope at eye height', 'Pull toward your forehead, elbows high'] },
  { id: 'biceps-curl', name: 'Biceps curl', muscle: 'Biceps', type: 'reps', weighted: true, cues: ['Elbows stay at your sides', 'No swinging', 'Slow on the way down'] },

  // Core
  { id: 'plank', name: 'Plank', muscle: 'Core', type: 'time', weighted: false, cues: ['Elbows under shoulders', 'Squeeze glutes, tuck your ribs', 'Breathe steadily'] },
  { id: 'side-plank', name: 'Side plank', muscle: 'Core', type: 'time', weighted: false, cues: ['Hips high in a straight line', 'Switch sides halfway'] },
  { id: 'dead-bug', name: 'Dead bug', muscle: 'Core', type: 'reps', weighted: false, cues: ['Lower back pressed into the floor', 'Opposite arm and leg move together', 'Exhale as you extend'] },
  { id: 'hollow-hold', name: 'Hollow hold', muscle: 'Core', type: 'time', weighted: false, cues: ['Lower back flat on the floor', 'Bend your knees to make it easier'] },
  { id: 'russian-twist', name: 'Russian twist', muscle: 'Core', type: 'time', weighted: false, cues: ['Lean back with a long spine', 'Rotate from your ribs, not your arms'] },
  { id: 'mountain-climber', name: 'Mountain climbers', muscle: 'Core', type: 'time', weighted: false, cues: ['Shoulders over wrists', 'Drive knees toward your chest quickly'] },

  // Cardio
  { id: 'jumping-jack', name: 'Jumping jacks', muscle: 'Cardio', type: 'time', weighted: false, cues: ['Stay light on the balls of your feet'] },
  { id: 'burpee', name: 'Burpees', muscle: 'Cardio', type: 'time', weighted: false, cues: ['Chest to the floor, then jump', 'Step back instead of jumping to make it easier'] },
  { id: 'high-knees', name: 'High knees', muscle: 'Cardio', type: 'time', weighted: false, cues: ['Knees to hip height', 'Pump your arms'] },
  { id: 'skater', name: 'Skater hops', muscle: 'Cardio', type: 'time', weighted: false, cues: ['Land on one foot, sink into the hip', 'Touch down softly'] },

  // Mobility
  { id: 'cat-cow', name: 'Cat-cow', muscle: 'Mobility', type: 'time', weighted: false, cues: ['Move with your breath', 'Round up on the exhale'] },
  { id: 'worlds-greatest', name: 'World\'s greatest stretch', muscle: 'Mobility', type: 'time', weighted: false, cues: ['Lunge, elbow to instep, rotate up', 'Switch sides halfway'] },
  { id: 'hip-flexor', name: 'Hip flexor stretch', muscle: 'Mobility', type: 'time', weighted: false, cues: ['Half-kneeling, squeeze the back glute', 'Switch sides halfway'] },
  { id: 'hamstring-stretch', name: 'Hamstring stretch', muscle: 'Mobility', type: 'time', weighted: false, cues: ['Hinge from the hips with a flat back', 'Ease in, don\'t bounce'] },
  { id: 'childs-pose', name: 'Child\'s pose', muscle: 'Mobility', type: 'time', weighted: false, cues: ['Knees wide, reach forward', 'Breathe into your back'] },
]

export const MUSCLES = ['Legs', 'Glutes', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio', 'Mobility']

const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

// Custom exercises (state.customExercises) override and extend the catalog.
export function findExercise(id, custom = []) {
  return custom.find((e) => e.id === id) || BY_ID[id] || null
}

export function allExercises(custom = []) {
  return [...EXERCISES, ...custom]
}

const r = (exId, sets, reps, restSec) => ({ exId, sets, reps, restSec })
const t = (exId, sets, sec, restSec) => ({ exId, sets, sec, restSec })

// Starter routines. `circuit` routines run one set of every exercise per round.
export const TEMPLATES = [
  {
    id: 'tpl-push',
    name: 'Push day',
    blurb: 'Chest, shoulders and triceps.',
    level: 'Intermediate',
    tag: 'Push',
    icon: 'push',
    items: [r('bench-press', 4, 8, 120), r('ohp', 3, 10, 90), r('db-bench', 3, 10, 90), r('lateral-raise', 3, 12, 60), r('triceps-pushdown', 3, 12, 60)],
  },
  {
    id: 'tpl-pull',
    name: 'Pull day',
    blurb: 'Back and biceps, with face pulls for healthy shoulders.',
    level: 'Intermediate',
    tag: 'Pull',
    icon: 'pull',
    items: [r('pull-up', 4, 6, 120), r('barbell-row', 4, 8, 120), r('lat-pulldown', 3, 10, 90), r('face-pull', 3, 15, 60), r('biceps-curl', 3, 12, 60)],
  },
  {
    id: 'tpl-full-body',
    tag: 'Full body',
    icon: 'full',
    name: 'Full body',
    blurb: 'Five moves that cover everything. Great first workout.',
    level: 'Beginner',
    items: [r('goblet-squat', 3, 10, 60), r('push-up', 3, 10, 60), r('db-row', 3, 10, 60), r('glute-bridge', 3, 12, 45), t('plank', 3, 30, 45)],
  },
  {
    id: 'tpl-upper',
    tag: 'Upper',
    icon: 'upper',
    name: 'Upper body',
    blurb: 'Press, pull and arms with longer rests for heavier sets.',
    level: 'Intermediate',
    items: [r('bench-press', 4, 8, 120), r('barbell-row', 4, 8, 120), r('ohp', 3, 10, 90), r('lat-pulldown', 3, 10, 90), r('biceps-curl', 3, 12, 60), r('triceps-pushdown', 3, 12, 60)],
  },
  {
    id: 'tpl-lower',
    tag: 'Legs',
    icon: 'legs',
    name: 'Leg day',
    blurb: 'Squat, hinge and single-leg work.',
    level: 'Intermediate',
    items: [r('back-squat', 4, 6, 150), r('rdl', 3, 8, 120), r('lunge', 3, 10, 90), r('calf-raise', 3, 15, 60), t('side-plank', 2, 40, 30)],
  },
  {
    id: 'tpl-hiit',
    tag: 'Conditioning',
    icon: 'zap',
    name: '20-minute HIIT',
    blurb: 'Bodyweight circuit, 40 seconds on, 20 off, three rounds.',
    level: 'All levels',
    circuit: true,
    items: [t('jumping-jack', 3, 40, 20), t('squat-jump', 3, 40, 20), t('mountain-climber', 3, 40, 20), t('burpee', 3, 40, 20), t('high-knees', 3, 40, 20), t('skater', 3, 40, 60)],
  },
  {
    id: 'tpl-core',
    tag: 'Conditioning',
    icon: 'target',
    name: 'Core circuit',
    blurb: 'Ten minutes of planks, holds and twists.',
    level: 'All levels',
    circuit: true,
    items: [t('plank', 3, 40, 15), r('dead-bug', 3, 12, 15), t('russian-twist', 3, 30, 15), t('hollow-hold', 3, 25, 45)],
  },
  {
    id: 'tpl-mobility',
    tag: 'Conditioning',
    icon: 'sprout',
    name: 'Mobility reset',
    blurb: 'Gentle stretches for rest days or after a session.',
    level: 'All levels',
    items: [t('cat-cow', 1, 60, 10), t('worlds-greatest', 1, 60, 10), t('hip-flexor', 1, 60, 10), t('hamstring-stretch', 1, 60, 10), t('childs-pose', 1, 60, 0)],
  },
]

export const ROUTINE_TAGS = ['Push', 'Pull', 'Legs', 'Upper', 'Full body', 'Conditioning']
