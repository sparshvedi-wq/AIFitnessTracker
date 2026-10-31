import { movementAllowed, movementSummary, SEATED_EXERCISES } from './movement-preferences.js'
// Original drill instructions; durations include easy resets, never all-out effort.
// Include secondary loading and footwork, not just the display muscle group.
const DRILL_USES = {
  'wu-racket': ['Shoulders', 'Back', 'Biceps', 'Triceps', 'Core', 'Legs', 'Glutes'],
  'wu-racket-still': ['Shoulders', 'Back', 'Biceps', 'Triceps', 'Core'],
  'wu-basketball': ['Legs', 'Glutes', 'Core', 'Shoulders', 'Triceps'],
  'wu-basketball-still': ['Shoulders', 'Triceps', 'Core', 'Legs'],
  'wu-volley': ['Legs', 'Glutes', 'Core', 'Shoulders', 'Triceps'],
  'wu-volley-still': ['Shoulders', 'Triceps', 'Core'],
  'wu-throw': ['Shoulders', 'Back', 'Biceps', 'Triceps', 'Core'],
  'wu-swim': ['Shoulders', 'Back', 'Chest', 'Triceps', 'Core'],
  'wu-golf': ['Core', 'Legs', 'Glutes', 'Shoulders', 'Back'],
  'wu-combat': ['Core', 'Legs', 'Glutes', 'Shoulders', 'Triceps'],
  'wu-box-still': ['Core', 'Shoulders', 'Triceps'],
  'wu-cricket': ['Core', 'Legs', 'Glutes', 'Shoulders', 'Back', 'Triceps'],
  'wu-rotation': ['Core', 'Back'],
  'wu-lunge': ['Legs', 'Glutes', 'Core', 'Shoulders'],
  'wu-march': ['Legs', 'Glutes', 'Core', 'Shoulders'],
  'wu-wrists': ['Biceps', 'Triceps'],
}
const drill = (id, name, muscle, cues) => ({
  id,
  name,
  muscle,
  uses:
    DRILL_USES[id] ||
    (['Legs', 'Glutes', 'Cardio'].includes(muscle)
      ? ['Legs', 'Glutes', 'Core']
      : muscle === 'Shoulders'
        ? ['Shoulders', 'Back', 'Biceps', 'Triceps']
        : [muscle]),
  type: 'time',
  weighted: false,
  cues,
})
export const SPORT_DRILLS = [
  drill('wu-racket-still', 'Stationary shadow strokes', 'Shoulders', [
    'Keep both feet grounded and check the space around your arms. No racket is needed.',
    'Alternate slow forehand and backhand patterns within a comfortable range. No split-step jumps or forceful serves.',
  ]),
  drill('wu-basketball-still', 'Stationary basketball rehearsal', 'Shoulders', [
    'Keep your feet in place. Rehearse gentle dribbling and passing motions without a ball.',
    'Add a comfortable shallow knee bend if it feels good. Do not jump or extend into nearby furniture.',
  ]),
  drill('wu-footwork-still', 'Controlled football foot taps', 'Legs', [
    'Stay in one spot and lightly tap one foot a short distance forward, then return it.',
    'Alternate feet slowly. No ball, hopping or turning space is required; use support if needed.',
  ]),
  drill('wu-volley-still', 'Standing volleyball rehearsal', 'Shoulders', [
    'Keep both feet planted and rehearse a gentle passing platform, then a comfortable upward reach.',
    'Move slowly without a ball. Do not jump, snap the arms or force overhead range.',
  ]),
  drill('wu-skate-still', 'Stationary skating stance', 'Legs', [
    'Keep your feet planted and soften your knees into a comfortable, shallow stance.',
    'Shift weight gently from one foot to the other without sliding or hopping. Stand tall between repetitions.',
  ]),
  drill('wu-box-still', 'Stationary boxing rehearsal', 'Shoulders', [
    'Stand comfortably with both feet planted and enough clear arm space.',
    'Rehearse short, slow punches without locking the elbows. Keep this easy; no bouncing or fast pivots.',
  ]),
  drill('wu-jog', 'Easy jog or brisk march', 'Cardio', [
    'Start at a conversational pace; marching is fine.',
    'Keep steps relaxed. Build warmth, not fatigue.',
  ]),
  drill('wu-ankles', 'Ankle rocks & calf raises', 'Legs', [
    'Rock your knee gently over your toes, heel down.',
    'Alternate sides, then add slow, unweighted calf raises.',
  ]),
  drill('wu-leg-swings', 'Controlled leg swings', 'Legs', [
    'Use a wall for balance if needed.',
    'Swing forward/back, then side to side; switch halfway. Keep the range comfortable.',
  ]),
  drill('wu-lunge', 'Reverse lunge & reach', 'Legs', [
    'Step back into a shallow lunge, then reach upward.',
    'Alternate legs. Use a smaller range if you feel stiff.',
  ]),
  drill('wu-lateral', 'Lateral weight shifts', 'Legs', [
    'Stand wide and shift gently from hip to hip.',
    'Keep your feet grounded; do not force depth.',
  ]),
  drill('wu-hips', 'Hip gates', 'Legs', [
    'Lift one knee, rotate outward gently, and step down.',
    'Alternate sides; reverse the motion halfway.',
  ]),
  drill('wu-arms', 'Arm circles & shoulder sweeps', 'Shoulders', [
    'Begin with small, slow circles and gradually widen.',
    'Alternate forward/backward circles and relaxed arm hugs.',
  ]),
  drill('wu-rotation', 'Standing trunk rotations', 'Core', [
    'Turn through your upper back with relaxed arms.',
    'Let your feet pivot; keep rotations smooth and comfortable.',
  ]),
  drill('wu-scapula', 'Wall shoulder slides', 'Shoulders', [
    'Place forearms against a wall and slide upward comfortably.',
    'Keep ribs down. If no wall is available, reach upward gently while standing.',
  ]),
  drill('wu-wrists', 'Wrist & forearm circles', 'Shoulders', [
    'Open and close your hands, then circle wrists both ways.',
    'Move gently without forcing wrist extension.',
  ]),
  drill('wu-balance', 'Single-leg balance & reach', 'Glutes', [
    'Balance near a wall, knee soft; reach the other foot a short distance.',
    'Switch sides halfway; use fingertip support if needed.',
  ]),
  drill('wu-march', 'March into easy skips', 'Legs', [
    'March tall with opposite arm and knee.',
    'Only progress to small skips if comfortable; stay relaxed.',
  ]),
  drill('wu-shuffle', 'Side shuffle & controlled stop', 'Legs', [
    'Take a few easy side steps, then slow to a balanced stop.',
    'Use a clear, nonslip space. No room? Step side to side in place.',
  ]),
  drill('wu-landing', 'Small jump & quiet landing', 'Legs', [
    'Try 3–5 small jumps, resetting fully between each.',
    'Land softly with knees tracking over toes. Replace jumps with calf raises if needed.',
  ]),
  drill('wu-strides', 'Progressive strides', 'Cardio', [
    'Use short, relaxed runs with a walk-back reset.',
    'Build from easy to moderate, never a maximum sprint. No space? Brisk march in place.',
  ]),
  drill('wu-cut', 'Gentle approach & direction change', 'Legs', [
    'Jog a few steps, slow down, then change direction.',
    'Start with wide turns. No sharp cuts or full-speed sprints.',
  ]),
  drill('wu-football', 'Ball touches & short passing', 'Legs', [
    'Use gentle touches with both feet, then short passes.',
    'No ball? Rehearse the footwork slowly. Keep your head up and build pace gradually.',
  ]),
  drill('wu-basketball', 'Dribble, shuffle & close-range finish', 'Legs', [
    'Begin with easy dribbles, lateral steps and close-range shots.',
    'No ball or hoop? Rehearse controlled footwork. Save hard jumps for after the warmup.',
  ]),
  drill('wu-racket', 'Split steps & shadow strokes', 'Shoulders', [
    'Alternate small split steps with easy forehand/backhand motions.',
    'Begin with half-speed swings. Rehearse serves gently, without forcing overhead range.',
  ]),
  drill('wu-volley', 'Approach steps & easy arm swings', 'Shoulders', [
    'Rehearse approach footwork slowly, then add gentle arm swings.',
    'Use low, controlled reaches before adding small jumps. No max-effort spikes.',
  ]),
  drill('wu-throw', 'Throwing pattern rehearsal', 'Shoulders', [
    'Start with slow, unloaded throwing motions.',
    'If you have a partner, add short, easy tosses and gradually increase distance; never start with hard throws.',
  ]),
  drill('wu-swim', 'Easy stroke rehearsal', 'Shoulders', [
    'Rehearse smooth alternating strokes on land with relaxed shoulders.',
    'Then begin in water with easy lengths before faster work; do not force shoulder range.',
  ]),
  drill('wu-cycle', 'Easy spin progression', 'Legs', [
    'On your bike, begin in a light gear at an easy cadence.',
    'Gradually increase cadence without a hard resistance effort. No bike yet? Use easy marching.',
  ]),
  drill('wu-golf', 'Hip turns & half swings', 'Core', [
    'Start with slow hip turns and relaxed practice swings.',
    'Progress from short to half swings; leave full-speed drives until warm.',
  ]),
  drill('wu-combat', 'Footwork & light shadowboxing', 'Core', [
    'Move lightly through your normal stance and simple combinations.',
    'Keep strikes at half speed, no contact, and avoid locked-out elbows.',
  ]),
  drill('wu-skate', 'Skating stance & lateral steps', 'Legs', [
    'Use a comfortable shallow stance and controlled side steps.',
    'On ice, start with easy glides; on land, keep both feet grounded until warm.',
  ]),
  drill('wu-cricket', 'Batting footwork & easy bowling rehearsal', 'Core', [
    'Rehearse forward/back footwork and relaxed bat swings.',
    'Begin bowling with slow approach steps and easy, unloaded arm motions before short, easy deliveries.',
  ]),
  drill('wu-hinge', 'Standing hip hinge', 'Glutes', [
    'Soften your knees and send hips back, keeping your spine long.',
    'Stand tall without leaning backward; keep this unweighted and easy.',
  ]),
]

const sport = (id, name, focus, mobility, activation, rehearsal, muscles) => ({
  id,
  name,
  focus,
  mobility,
  activation,
  rehearsal,
  muscles,
})
export const SPORTS = [
  sport(
    'basketball',
    'Basketball',
    'Ankles, controlled landings & court footwork',
    ['wu-ankles', 'wu-hips', 'wu-arms'],
    ['wu-shuffle', 'wu-landing'],
    ['wu-basketball', 'wu-cut'],
    ['Legs', 'Glutes', 'Core'],
  ),
  sport(
    'soccer',
    'Soccer / football',
    'Hip mobility, changes of direction & ball control',
    ['wu-leg-swings', 'wu-hips', 'wu-lateral'],
    ['wu-march', 'wu-shuffle'],
    ['wu-football', 'wu-cut'],
    ['Legs', 'Glutes', 'Core'],
  ),
  sport(
    'running',
    'Running / track',
    'Ankle movement, running rhythm & relaxed strides',
    ['wu-ankles', 'wu-leg-swings', 'wu-lunge'],
    ['wu-march', 'wu-balance'],
    ['wu-strides'],
    ['Legs', 'Glutes', 'Core'],
  ),
  sport(
    'tennis',
    'Tennis',
    'Shoulder movement, rotation & split-step timing',
    ['wu-arms', 'wu-rotation', 'wu-wrists'],
    ['wu-shuffle', 'wu-balance'],
    ['wu-racket'],
    ['Shoulders', 'Back', 'Core', 'Legs'],
  ),
  sport(
    'badminton',
    'Badminton',
    'Overhead movement, lunging & light court footwork',
    ['wu-arms', 'wu-wrists', 'wu-lunge'],
    ['wu-shuffle', 'wu-balance'],
    ['wu-racket'],
    ['Shoulders', 'Core', 'Legs'],
  ),
  sport(
    'pickleball',
    'Pickleball',
    'Wrists, lateral steps & controlled paddle movements',
    ['wu-wrists', 'wu-arms', 'wu-rotation'],
    ['wu-shuffle', 'wu-balance'],
    ['wu-racket'],
    ['Shoulders', 'Core', 'Legs'],
  ),
  sport(
    'volleyball',
    'Volleyball',
    'Shoulder preparation, approach rhythm & soft landings',
    ['wu-arms', 'wu-scapula', 'wu-ankles'],
    ['wu-shuffle', 'wu-landing'],
    ['wu-volley'],
    ['Shoulders', 'Legs', 'Core'],
  ),
  sport(
    'baseball',
    'Baseball / softball',
    'Shoulder movement, trunk rotation & gradual throwing',
    ['wu-arms', 'wu-rotation', 'wu-wrists'],
    ['wu-scapula', 'wu-lunge'],
    ['wu-throw'],
    ['Shoulders', 'Back', 'Core'],
  ),
  sport(
    'swimming',
    'Swimming',
    'Comfortable shoulder range & easy stroke progression',
    ['wu-arms', 'wu-rotation', 'wu-scapula'],
    ['wu-hinge', 'wu-wrists'],
    ['wu-swim'],
    ['Back', 'Shoulders', 'Core'],
  ),
  sport(
    'cycling',
    'Cycling',
    'Hips, ankles & gradual cadence',
    ['wu-hips', 'wu-ankles', 'wu-hinge'],
    ['wu-lunge', 'wu-balance'],
    ['wu-cycle'],
    ['Legs', 'Glutes', 'Core'],
  ),
  sport(
    'golf',
    'Golf',
    'Hip rotation, upper-back movement & easy swings',
    ['wu-rotation', 'wu-arms', 'wu-hips'],
    ['wu-hinge', 'wu-balance'],
    ['wu-golf'],
    ['Core', 'Back', 'Glutes'],
  ),
  sport(
    'combat',
    'Boxing / martial arts',
    'Shoulders, hip turns & controlled footwork',
    ['wu-arms', 'wu-wrists', 'wu-hips'],
    ['wu-shuffle', 'wu-rotation'],
    ['wu-combat'],
    ['Shoulders', 'Core', 'Legs'],
  ),
  sport(
    'hockey',
    'Hockey',
    'Hip movement, lateral control & skating stance',
    ['wu-hips', 'wu-lateral', 'wu-rotation'],
    ['wu-shuffle', 'wu-balance'],
    ['wu-skate'],
    ['Legs', 'Glutes', 'Core'],
  ),
  sport(
    'cricket',
    'Cricket',
    'Shoulders, rotation & batting / bowling preparation',
    ['wu-arms', 'wu-rotation', 'wu-wrists'],
    ['wu-lunge', 'wu-scapula'],
    ['wu-cricket', 'wu-throw'],
    ['Shoulders', 'Core', 'Legs'],
  ),
  sport(
    'rugby',
    'Rugby / American football',
    'Hip movement, footwork & controlled acceleration',
    ['wu-hips', 'wu-leg-swings', 'wu-arms'],
    ['wu-shuffle', 'wu-landing'],
    ['wu-strides', 'wu-cut'],
    ['Legs', 'Back', 'Core'],
  ),
]
export const sportById = (id) => SPORTS.find((s) => s.id === id) || SPORTS[0]
export function orderedSports(profile = {}, lastSport) {
  return [...SPORTS].sort(
    (a, b) =>
      (b.id === lastSport ? 100 : 0) +
      (profile.sports?.includes(b.id) ? 10 : 0) -
      ((a.id === lastSport ? 100 : 0) + (profile.sports?.includes(a.id) ? 10 : 0)),
  )
}

export function buildSportWarmup(
  sportId,
  minutes = 10,
  { lowImpact = false, movement = null, avoidMuscles = [] } = {},
) {
  const s = sportById(sportId)
  minutes = Math.min(20, Math.max(5, Math.round(Number(minutes) || 10)))
  // Every duration keeps all four phases. Longer options add variety and rehearsal.
  const count = minutes <= 5 ? 1 : minutes <= 10 ? 2 : 3
  const phases = [
    { name: 'Build warmth', ratio: 0.25, ids: ['wu-jog'] },
    {
      name: 'Move through range',
      ratio: 0.25,
      ids: s.mobility.slice(0, count),
    },
    {
      name: 'Activate & control',
      ratio: 0.22,
      ids: s.activation.slice(0, count),
    },
    {
      name: 'Rehearse your sport',
      ratio: 0.28,
      ids: s.rehearsal.slice(0, count),
    },
  ]
  const items = []
  const preferences =
    movement || lowImpact
      ? {
          space: 'open',
          position: 'any',
          noFloor: false,
          wall: true,
          ...movement,
          noJumping: lowImpact || Boolean(movement?.noJumping),
        }
      : null
  let adjusted = false
  let allocated = 0
  phases.forEach((p, phaseIndex) => {
    const budget = phaseIndex === 3 ? minutes * 60 - allocated : Math.floor((minutes * 60 * p.ratio) / 5) * 5
    allocated += budget
    const each = Math.floor(budget / p.ids.length / 5) * 5
    p.ids.forEach((id, index) => {
      if (!movementAllowed(id, preferences)) {
        adjusted = true
        const stationary = {
          'wu-jog': 'quiet-march',
          'wu-march': 'quiet-march',
          'wu-shuffle': 'wu-lateral',
          'wu-landing': 'wu-ankles',
          'wu-cut': 'wu-lateral',
          'wu-strides': 'quiet-march',
          'wu-racket': 'wu-racket-still',
          'wu-basketball': 'wu-basketball-still',
          'wu-football': 'wu-footwork-still',
          'wu-volley': 'wu-volley-still',
          'wu-skate': 'wu-skate-still',
          'wu-cricket': 'wu-throw',
          'wu-combat': 'wu-box-still',
          'wu-cycle': 'quiet-march',
        }[id]
        id =
          preferences.position === 'seated'
            ? ['seated-heel-raise', 'seated-reach', 'seated-brace', 'seated-scapular'][
                (phaseIndex + index) % 4
              ]
            : stationary && movementAllowed(stationary, preferences)
              ? stationary
              : phaseIndex === 0
                ? 'quiet-march'
                : s.muscles.includes('Shoulders') && index % 2 === 0
                  ? 'wu-arms'
                  : 'wu-ankles'
      }
      const slot = index === p.ids.length - 1 ? budget - each * index : each
      items.push({
        exId: id,
        sets: 1,
        sec: slot - 10,
        restSec: 10,
        phaseLabel: adjusted && phaseIndex === 3 ? 'Easy preparation' : p.name,
        note: `${adjusted && phaseIndex === 3 ? 'Easy preparation' : p.name}. ${phaseIndex === 3 && !adjusted ? 'Build to moderate speed; stay fresh.' : 'Easy and controlled.'}`,
      })
    })
  })
  // No rest after the final drill: add its reset time to the drill itself.
  items.at(-1).sec += 10
  items.at(-1).restSec = 0
  const kept = items.filter((item) => {
    const def = [...SPORT_DRILLS, ...SEATED_EXERCISES].find((e) => e.id === item.exId)
    const uses =
      def?.uses ||
      (['Legs', 'Glutes', 'Cardio'].includes(def?.muscle)
        ? ['Legs', 'Glutes', 'Core']
        : [def?.muscle || 'Legs'])
    return movementAllowed(item.exId, preferences) && !uses.some((m) => avoidMuscles.includes(m))
  })
  return {
    id: `sport-${s.id}`,
    name: 'Your warmup',
    kind: 'sport',
    sport: s.id,
    focus: adjusted
      ? `${s.name} prep, fitted to your space.`
      : `${s.name} prep: ${s.focus.charAt(0).toLowerCase() + s.focus.slice(1)}.`,
    requestedMinutes: minutes,
    estimatedSeconds: kept.reduce((n, i) => n + i.sec + i.restSec, 0),
    lockedTargets: true,
    items: kept,
    movement,
    reasons: [
      ...(kept.length < items.length ? ['Some drills omitted for areas you’re avoiding.'] : []),
      'Easy movement → mobility → control → sport rehearsal.',
      'Drills start when you tap.',
      ...(movement ? [movementSummary(movement)] : []),
      ...(adjusted ? ['Gentler drills here; this does not rehearse every sport movement.'] : []),
      ...(minutes === 5 ? ['Short prep. Add easy practice if you still feel stiff.'] : []),
    ],
  }
}
