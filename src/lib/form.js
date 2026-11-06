// Extra form-guide content: which muscles a move works and the mistakes to
// watch for. Exercises without their own entry use their catalog metadata and
// the common mistakes for their movement family.
import { metaOf } from './catalog/index.js'
import { MUSCLE_LABEL } from './catalog/vocabulary.js'

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
  'seated-knee-extension': {
    muscles: { primary: 'Quads', secondary: 'Gentle knee movement; no added load' },
    mistakes: [
      'Kicking or swinging the leg',
      'Forcing the knee straight',
      'Using a rolling or unstable chair',
    ],
  },
  'seated-heel-raise': {
    muscles: { primary: 'Calves', secondary: 'Gentle ankle control' },
    mistakes: ['Bouncing the heels', 'Rushing the lowering phase', 'Using a chair that moves'],
  },
  'seated-scapular': {
    muscles: { primary: 'Upper-back control', secondary: 'Light shoulder movement' },
    mistakes: ['Shrugging toward the ears', 'Forcing the shoulder blades together', 'Arching the back'],
  },
  'seated-reach': {
    muscles: { primary: 'Gentle shoulder movement', secondary: 'Upper-back control' },
    mistakes: ['Forcing overhead range', 'Leaning backward to reach higher', 'Moving through discomfort'],
  },
  'seated-brace': {
    muscles: { primary: 'Abdominal control', secondary: 'Upright seated posture' },
    mistakes: [
      'Holding your breath',
      'Bracing as hard as possible',
      'Leaning or slumping instead of sitting comfortably',
    ],
  },
  'standing-brace': {
    muscles: { primary: 'Abdominal control', secondary: 'Upright standing posture' },
    mistakes: ['Holding your breath', 'Locking the knees', 'Leaning backward'],
  },
  'standing-w': {
    muscles: { primary: 'Upper-back control', secondary: 'Light shoulder movement' },
    mistakes: ['Shrugging the shoulders', 'Forcing the arms backward', 'Arching the lower back'],
  },
  'db-rdl': {
    muscles: { primary: 'Hamstrings and glutes', secondary: 'Back, core and grip help keep control' },
    mistakes: [
      'Reaching down by rounding your back',
      'Letting the dumbbells drift away',
      'Using more range or weight than you can control',
    ],
  },
  'db-overhead-press': {
    muscles: { primary: 'Shoulders', secondary: 'Triceps and core' },
    mistakes: [
      'Arching your back to move the weights',
      'Rushing the lowering phase',
      'Pressing through discomfort',
    ],
  },
  'quiet-march': {
    muscles: { primary: 'Gentle whole-body movement', secondary: 'Legs and balance' },
    mistakes: [
      'Stamping instead of placing each foot softly',
      'Holding your breath',
      'Rushing beyond a comfortable pace',
    ],
  },
  'quiet-step': {
    muscles: { primary: 'Gentle leg movement and balance', secondary: 'Hip control' },
    mistakes: [
      'Hopping instead of stepping',
      'Taking steps wider than you can control',
      'Rushing a direction change',
    ],
  },
  'quiet-squat': {
    muscles: { primary: 'Quads and glutes', secondary: 'Core and balance' },
    mistakes: ['Jumping between repetitions', 'Lifting your heels', 'Using an uncomfortable depth'],
  },
  rdl: {
    muscles: { primary: 'Hamstrings and glutes', secondary: 'Lower back and grip' },
    mistakes: [
      'Rounding your back to reach lower',
      'Bending the knees into a squat',
      'Letting the bar drift away from your legs',
    ],
  },
  'back-squat': {
    muscles: { primary: 'Quads and glutes', secondary: 'Hamstrings, adductors and core' },
    mistakes: [
      'Knees caving in on the way up',
      'Heels lifting off the floor',
      'Cutting depth short as you tire',
    ],
  },
  'bench-press': {
    muscles: { primary: 'Chest', secondary: 'Front shoulders and triceps' },
    mistakes: [
      'Bouncing the bar off your chest',
      'Flaring elbows straight out',
      'Hips lifting off the bench',
    ],
  },
  deadlift: {
    muscles: { primary: 'Glutes, hamstrings and back', secondary: 'Quads, traps and grip' },
    mistakes: ['Jerking the bar off the floor', 'Hips shooting up first', 'Leaning back at the top'],
  },
  ohp: {
    muscles: { primary: 'Shoulders', secondary: 'Triceps and upper chest' },
    mistakes: [
      'Arching your lower back',
      'Pressing the bar out in front',
      'Not finishing with arms straight overhead',
    ],
  },
  'pull-up': {
    muscles: { primary: 'Lats', secondary: 'Biceps and mid back' },
    mistakes: [
      'Kicking or swinging for momentum',
      'Stopping short of a full hang',
      'Shrugging shoulders to your ears',
    ],
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

// Common mistakes for each substitution family (catalog metadata).
const FAMILY_MISTAKES = {
  'horizontal-press': ['Flaring elbows straight out to the sides', 'Bouncing at the bottom', 'Letting your hips sag or lift'],
  'incline-press': ['Setting the incline steeper than you need', 'Flaring elbows straight out', 'Bouncing at the bottom'],
  'vertical-press': ['Arching your lower back to finish the press', 'Pressing forward instead of up', 'Rushing the lowering phase'],
  'chest-fly': ['Locking the elbows straight', 'Going deeper than your shoulders like', 'Using more weight than you can control'],
  'horizontal-row': ['Jerking the weight with your torso', 'Shrugging toward your ears', 'Cutting the stretch short'],
  'vertical-pull': ['Swinging or leaning far back', 'Stopping short of the stretch at the top', 'Shrugging instead of drawing elbows down'],
  'straight-arm-pull': ['Bending the elbows into a row', 'Arching the lower back', 'Rushing the return'],
  'rear-delt': ['Shrugging the shoulders', 'Swinging the weight', 'Using a load heavy enough to change your form'],
  'lateral-raise': ['Swinging the weight up', 'Lifting well above shoulder height', 'Shrugging as you raise'],
  'front-raise': ['Leaning back to lift', 'Swinging the weight', 'Raising well above shoulder height'],
  shrug: ['Rolling the shoulders', 'Bending the elbows', 'Rushing without a pause at the top'],
  curl: ['Swinging your torso', 'Letting the elbows drift forward', 'Dropping the weight quickly'],
  'triceps-extension': ['Letting the elbows flare wide', 'Moving the shoulders instead of the elbows', 'Rushing the lowering phase'],
  dip: ['Lowering deeper than your shoulders allow', 'Shrugging at the bottom', 'Bouncing out of the bottom'],
  squat: ['Knees caving inward', 'Heels lifting off the floor', 'Rounding forward as you stand'],
  lunge: ['Front knee caving inward', 'A stance too short or narrow for balance', 'Pushing off the back foot instead of the front'],
  hinge: ['Rounding your back to reach lower', 'Turning it into a squat', 'Leaning back at the top'],
  'single-leg-hinge': ['Letting the hips twist open', 'Rounding your back to reach lower', 'Rushing the balance'],
  'hip-thrust': ['Arching the lower back at the top', 'Pushing through the toes', 'Skipping the pause at the top'],
  calf: ['Bouncing at the bottom', 'Cutting the range short', 'Rushing the lowering'],
  'knee-flexion': ['Lifting the hips', 'Using momentum', 'Rushing the return'],
  'knee-extension': ['Snapping into locked knees', 'Using momentum', 'Lifting off the seat'],
  'hip-abduction': ['Leaning your torso to move further', 'Using momentum', 'Rushing the return'],
  'hip-adduction': ['Using momentum', 'Starting wider than is comfortable', 'Rushing the return'],
  'glute-kickback': ['Arching the lower back', 'Swinging the leg', 'Rushing the return'],
  'core-anti-extension': ['Letting the lower back arch', 'Holding your breath', 'Moving faster than you can control'],
  'core-anti-rotation': ['Letting your torso turn', 'Holding your breath', 'Shrugging the shoulders'],
  'core-flexion': ['Pulling on your neck', 'Swinging the legs', 'Holding your breath'],
  'core-rotation': ['Twisting with the arms only', 'Rushing the turn', 'Holding your breath'],
  'core-lateral': ['Letting your hips drop or lean', 'Holding your breath', 'Shrugging the shoulders'],
  'back-extension': ['Forcing a big arch in the lower back', 'Jerking upward', 'Holding your breath'],
  'scapular-control': ['Shrugging toward your ears', 'Arching the lower back', 'Forcing the range'],
  'rotator-cuff': ['Letting the elbow drift away from your side', 'Using a band that is too strong', 'Rushing the return'],
  'shoulder-mobility': ['Forcing overhead range', 'Leaning to reach further', 'Holding your breath'],
}
const label = (list) => {
  const words = list.map((m) => MUSCLE_LABEL[m] || m)
  if (words.length <= 1) return words[0] || ''
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1).toLowerCase()}`
}

const GENERIC_MISTAKES = [
  'Rushing the lowering half of each rep',
  'Losing your brace as you tire',
  'Adding weight before the reps look clean',
]

export function formGuide(exId, muscle) {
  if (exId?.startsWith('wu-'))
    return {
      muscles: {
        primary: 'Easy sport preparation',
        secondary: 'Movement and control, rather than maximum effort',
      },
      mistakes: [
        'Rushing into high-speed movement',
        'Forcing a range that feels uncomfortable',
        'Holding your breath instead of moving easily',
      ],
    }
  const own = BY_EXERCISE[exId] || {}
  const meta = metaOf(exId)
  const fromMeta =
    meta && !own.muscles && meta.primary.length
      ? { primary: label(meta.primary), secondary: label(meta.secondary) }
      : null
  return {
    muscles: own.muscles || fromMeta || MUSCLES[muscle] || { primary: muscle, secondary: '' },
    mistakes: own.mistakes || (meta && FAMILY_MISTAKES[meta.family]) || GENERIC_MISTAKES,
  }
}
