// The exercise library: what every exercise trains, how much, and how hard it
// is compared with related exercises. This is what ties exercises together.
//
// For each exercise:
//   muscles   share of the work per muscle (sums to 1). Starts from the
//             catalog's primary / secondary / stabiliser lists and is refined
//             per exercise from EMG and coaching evidence (for example, a
//             flat bench press loads the chest most, then triceps and front
//             delts; inclines above ~45° shift work to the front delts; close
//             grips shift it to the triceps; a hammer curl shares the work
//             with the forearms).
//   load      how the logged number becomes the load actually moved:
//             effective = ext × logged weight + bw × bodyweight
//             (two dumbbells logged "per hand" count twice; a bodyweight
//             squat moves about 77% of bodyweight; a standard push-up about
//             64%, on the knees about 49%).
//   anchor    the reference lift of its movement, and `ratio`, this
//             exercise's typical max relative to that reference in effective
//             load (dumbbell bench ≈ 80% of barbell bench in total, ≈ 40% per
//             hand; incline ≈ 78%; front squat ≈ 85–90%; overhead press ≈ ⅔
//             of bench; a pull-up's whole-body max ≈ 1.25 × a lat pulldown's).
//   sd        how sure that ratio is (log scale). Machines and cables vary by
//             brand and pulley, so they are wide; close barbell variants are
//             narrow. The strength model learns each person's own ratios.
//
// Sources for the main numbers are listed in docs/RECOMMENDATION_ENGINE.md.
// They are planning estimates, not measurements of any one person.
import { allMeta, metaOf } from '../catalog/index.js'
import { findExercise } from '../exercises.js'
import { MUSCLE_AREA } from '../catalog/vocabulary.js'

export const MUSCLES = Object.keys(MUSCLE_AREA)

// Body regions whose strength tends to move together (shared prior).
export const MUSCLE_REGION = {
  chest: 'push',
  'front-delts': 'push',
  'side-delts': 'shoulders',
  'rear-delts': 'pull',
  'rotator-cuff': 'shoulders',
  serratus: 'push',
  triceps: 'push',
  lats: 'pull',
  'upper-back': 'pull',
  traps: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  'lower-back': 'lower',
  quads: 'lower',
  hamstrings: 'lower',
  glutes: 'lower',
  adductors: 'lower',
  abductors: 'lower',
  calves: 'lower',
  'hip-flexors': 'lower',
  abs: 'core',
  obliques: 'core',
}
export const REGIONS = ['push', 'pull', 'shoulders', 'lower', 'core']

// How quickly training fatigue in each muscle fades (half-life, hours).
// Recovery after hard sets takes roughly 24–72 h and longer after sets to
// failure; large, eccentric-heavy lower-body muscles are slowest, small
// muscles and the trunk fastest. Planning estimates, not measurements.
export const RECOVERY_HALF_LIFE_HOURS = {
  quads: 30,
  hamstrings: 32,
  glutes: 28,
  adductors: 26,
  abductors: 22,
  calves: 18,
  'hip-flexors': 18,
  'lower-back': 30,
  chest: 26,
  lats: 26,
  'upper-back': 22,
  traps: 20,
  'front-delts': 22,
  'side-delts': 18,
  'rear-delts': 18,
  'rotator-cuff': 16,
  serratus: 18,
  triceps: 20,
  biceps: 20,
  forearms: 16,
  abs: 16,
  obliques: 16,
}

// Reference lifts, as the effective load (kg) a typical recreational lifter
// with about a year of training moves for one rep. Bodyweight parts use a
// 75 kg reference person. Everyone's real level is learned from their sets;
// these only set ratios between exercises and very first guesses.
const REF_BODYWEIGHT_KG = 75
export const ANCHORS = {
  'bench-press': { ext: 70 },
  ohp: { ext: 45 },
  'back-squat': { ext: 90, bw: 0.77 },
  deadlift: { ext: 115, bw: 0.5 },
  'barbell-row': { ext: 60 },
  'lat-pulldown': { ext: 60 },
  'barbell-hip-thrust': { ext: 100, bw: 0.3 },
  'barbell-curl': { ext: 35 },
  'triceps-pushdown': { ext: 40 },
  'lateral-raise': { ext: 20 },
  'db-front-raise': { ext: 18 },
  'face-pull': { ext: 25 },
  'barbell-shrug': { ext: 110 },
  'seated-leg-curl': { ext: 50 },
  'leg-extension': { ext: 65 },
  'machine-calf-raise': { ext: 100, bw: 0.5 },
  'hip-abduction-machine': { ext: 60 },
  'hip-adduction-machine': { ext: 60 },
  'machine-glute-kickback': { ext: 30 },
  'cable-straight-arm-pulldown': { ext: 30 },
  'machine-crunch': { ext: 50 },
  'cable-pallof-press': { ext: 20 },
  'cable-wood-chop': { ext: 20 },
  'kb-suitcase-march': { ext: 24 },
}
export const anchorLoadKg = (id) => {
  const a = ANCHORS[id]
  return a ? a.ext + (a.bw || 0) * REF_BODYWEIGHT_KG : null
}

// Per-exercise load relationship: [anchor, ratio, sd, extra]
// extra: { ext: logged-weight multiplier, bw: bodyweight share, tie: false }
// `ext` defaults to 2 for bilateral "per hand" dumbbell work, else 1.
const L = (anchor, ratio, sd, extra = {}) => ({ anchor, ratio, sd, ...extra })
const LOADS = {
  // ── Horizontal press (bench press = 1) ───────────────────────────────
  'bench-press': L('bench-press', 1, 0.08),
  'paused-bench-press': L('bench-press', 0.92, 0.08),
  'close-grip-bench': L('bench-press', 0.9, 0.1),
  'barbell-floor-press': L('bench-press', 0.9, 0.1),
  'incline-bench-press': L('bench-press', 0.78, 0.1),
  'db-bench': L('bench-press', 0.8, 0.12),
  'db-neutral-bench': L('bench-press', 0.76, 0.15),
  'db-floor-press': L('bench-press', 0.74, 0.15),
  'db-squeeze-press': L('bench-press', 0.6, 0.2),
  'db-incline-press': L('bench-press', 0.66, 0.15),
  'db-alt-floor-press': L('bench-press', 0.4, 0.2),
  'db-single-arm-floor-press': L('bench-press', 0.42, 0.2),
  'kb-floor-press': L('bench-press', 0.4, 0.25),
  'machine-chest-press': L('bench-press', 0.9, 0.3),
  'machine-incline-press': L('bench-press', 0.75, 0.3),
  'machine-decline-press': L('bench-press', 0.95, 0.3),
  'cable-chest-press': L('bench-press', 0.5, 0.35),
  'push-up': L('bench-press', 0.95, 0.2, { bw: 0.64 }),
  'wide-push-up': L('bench-press', 0.95, 0.25, { bw: 0.64 }),
  'close-grip-push-up': L('bench-press', 0.85, 0.25, { bw: 0.64 }),
  'kneeling-push-up': L('bench-press', 0.95, 0.22, { bw: 0.49 }),
  'bench-push-up': L('bench-press', 0.95, 0.25, { bw: 0.55 }),
  'incline-push-up': L('bench-press', 0.95, 0.25, { bw: 0.41 }),
  // Flies relate to pressing only loosely.
  'pec-deck': L('bench-press', 0.6, 0.35),
  'cable-fly': L('bench-press', 0.25, 0.4),
  'low-high-cable-fly': L('bench-press', 0.22, 0.4),
  'high-low-cable-fly': L('bench-press', 0.25, 0.4),
  'db-floor-fly': L('bench-press', 0.3, 0.3),
  // ── Dips (bench press = 1) ───────────────────────────────────────────
  dip: L('bench-press', 1.3, 0.3, { bw: 0.95 }),
  'assisted-dip': L('bench-press', 1.3, 0.35, { bw: 0.95 }),
  'bench-dip': L('bench-press', 0.6, 0.35, { bw: 0.55 }),
  // ── Vertical press (overhead press = 1) ──────────────────────────────
  ohp: L('ohp', 1, 0.08),
  'seated-barbell-press': L('ohp', 1, 0.1),
  'db-overhead-press': L('ohp', 0.8, 0.15),
  'db-seated-press': L('ohp', 0.82, 0.15),
  'db-arnold-press': L('ohp', 0.72, 0.2),
  'kb-strict-press': L('ohp', 0.42, 0.2),
  'landmine-press': L('ohp', 0.7, 0.35),
  'machine-shoulder-press': L('ohp', 0.9, 0.3),
  'pike-push-up': L('ohp', 0.9, 0.3, { bw: 0.65 }),
  // ── Shoulder isolation ───────────────────────────────────────────────
  'lateral-raise': L('lateral-raise', 1, 0.12),
  'db-scaption': L('lateral-raise', 1, 0.2),
  'machine-lateral-raise': L('lateral-raise', 1.2, 0.4),
  'cable-lateral-raise': L('lateral-raise', 0.4, 0.35),
  'db-front-raise': L('db-front-raise', 1, 0.2),
  'cable-front-raise': L('db-front-raise', 0.9, 0.35),
  'face-pull': L('face-pull', 1, 0.3),
  'db-rear-delt-fly': L('face-pull', 0.6, 0.3),
  'cable-rear-delt-fly': L('face-pull', 0.5, 0.35),
  'reverse-pec-deck': L('face-pull', 1.4, 0.35),
  'barbell-shrug': L('barbell-shrug', 1, 0.12),
  'db-shrug': L('barbell-shrug', 0.9, 0.15),
  // ── Vertical pull (lat pulldown = 1) ─────────────────────────────────
  'lat-pulldown': L('lat-pulldown', 1, 0.2),
  'pull-up': L('lat-pulldown', 1.25, 0.15, { bw: 0.95 }),
  'assisted-pull-up': L('lat-pulldown', 1.25, 0.2, { bw: 0.95 }),
  'single-arm-pulldown': L('lat-pulldown', 0.5, 0.3),
  'machine-high-row': L('lat-pulldown', 0.9, 0.4),
  'cable-straight-arm-pulldown': L('cable-straight-arm-pulldown', 1, 0.3),
  'db-pullover': L('cable-straight-arm-pulldown', 0.8, 0.35),
  'machine-pullover': L('cable-straight-arm-pulldown', 1.4, 0.4),
  // ── Horizontal pull (barbell row = 1) ────────────────────────────────
  'barbell-row': L('barbell-row', 1, 0.1),
  'underhand-row': L('barbell-row', 1, 0.1),
  'pendlay-row': L('barbell-row', 0.9, 0.12),
  'db-row': L('barbell-row', 0.5, 0.15),
  'db-chest-supported-row': L('barbell-row', 0.75, 0.2),
  'db-bent-over-row': L('barbell-row', 0.8, 0.2),
  'db-wide-row': L('barbell-row', 0.6, 0.25),
  'kb-row': L('barbell-row', 0.5, 0.2),
  'cable-row': L('barbell-row', 1, 0.3),
  'wide-cable-row': L('barbell-row', 0.85, 0.3),
  'single-arm-cable-row': L('barbell-row', 0.5, 0.3),
  'machine-row': L('barbell-row', 1, 0.3),
  'suspension-row': L('barbell-row', 0.9, 0.35, { bw: 0.6 }),
  // ── Arms ─────────────────────────────────────────────────────────────
  'barbell-curl': L('barbell-curl', 1, 0.1),
  'barbell-reverse-curl': L('barbell-curl', 0.7, 0.2),
  'biceps-curl': L('barbell-curl', 0.5, 0.15),
  'db-hammer-curl': L('barbell-curl', 1.05, 0.2),
  'db-incline-curl': L('barbell-curl', 0.8, 0.2),
  'db-reverse-curl': L('barbell-curl', 0.7, 0.2),
  'db-cross-body-curl': L('barbell-curl', 0.52, 0.2),
  'db-concentration-curl': L('barbell-curl', 0.42, 0.2),
  'machine-curl': L('barbell-curl', 1, 0.35),
  'cable-curl': L('barbell-curl', 1, 0.35),
  'cable-hammer-curl': L('barbell-curl', 1, 0.35),
  'triceps-pushdown': L('triceps-pushdown', 1, 0.25),
  'db-overhead-triceps-extension': L('triceps-pushdown', 0.6, 0.25),
  'db-lying-triceps-extension': L('triceps-pushdown', 0.6, 0.25),
  'db-kickback': L('triceps-pushdown', 0.2, 0.3),
  'barbell-lying-triceps-extension': L('triceps-pushdown', 0.75, 0.25),
  'machine-triceps-extension': L('triceps-pushdown', 1, 0.35),
  'cable-overhead-extension': L('triceps-pushdown', 0.75, 0.35),
  // ── Squat (back squat = 1, effective load includes ~77% bodyweight) ──
  'back-squat': L('back-squat', 1, 0.08, { bw: 0.77 }),
  'front-squat': L('back-squat', 0.9, 0.1, { bw: 0.77 }),
  'box-squat': L('back-squat', 0.97, 0.1, { bw: 0.77 }),
  'paused-back-squat': L('back-squat', 0.92, 0.1, { bw: 0.77 }),
  // Held weights: for sets of 6+ reps the legs set the limit (front-squat-like),
  // though a true max is capped by how much can be held.
  'goblet-squat': L('back-squat', 0.85, 0.2, { bw: 0.77 }),
  'db-front-squat': L('back-squat', 0.85, 0.2, { bw: 0.77 }),
  'db-sumo-squat': L('back-squat', 0.85, 0.22, { bw: 0.77 }),
  'kb-front-rack-squat': L('back-squat', 0.83, 0.25, { bw: 0.77 }),
  'leg-press': L('back-squat', 1, 0.45),
  'hack-squat': L('back-squat', 0.8, 0.45, { bw: 0.5 }),
  'belt-squat': L('back-squat', 0.85, 0.45, { bw: 0.77 }),
  'pendulum-squat': L('back-squat', 0.75, 0.45, { bw: 0.5 }),
  'bodyweight-squat': L('back-squat', 1, 0.15, { bw: 0.77 }),
  'tempo-squat': L('back-squat', 0.85, 0.25, { bw: 0.77 }),
  'paused-squat': L('back-squat', 0.9, 0.25, { bw: 0.77 }),
  'sumo-squat': L('back-squat', 0.95, 0.25, { bw: 0.77 }),
  // ── Single-leg (back squat = 1; one leg ≈ 55% of two) ────────────────
  'split-squat': L('back-squat', 0.55, 0.3, { bw: 0.7 }),
  'reverse-lunge': L('back-squat', 0.55, 0.3, { bw: 0.7 }),
  'forward-lunge': L('back-squat', 0.52, 0.3, { bw: 0.7 }),
  'lateral-lunge': L('back-squat', 0.5, 0.3, { bw: 0.7 }),
  'curtsy-lunge': L('back-squat', 0.5, 0.3, { bw: 0.7 }),
  'slider-reverse-lunge': L('back-squat', 0.5, 0.3, { bw: 0.7 }),
  lunge: L('back-squat', 0.55, 0.25, { bw: 0.7 }),
  'db-split-squat': L('back-squat', 0.55, 0.25, { bw: 0.7 }),
  'db-reverse-lunge': L('back-squat', 0.55, 0.25, { bw: 0.7 }),
  'db-lateral-lunge': L('back-squat', 0.5, 0.3, { bw: 0.7 }),
  'db-step-up': L('back-squat', 0.55, 0.3, { bw: 0.8 }),
  'kb-reverse-lunge': L('back-squat', 0.55, 0.3, { bw: 0.7 }),
  'barbell-split-squat': L('back-squat', 0.58, 0.25, { bw: 0.7 }),
  // ── Hinge (deadlift = 1, effective load includes ~50% bodyweight) ────
  deadlift: L('deadlift', 1, 0.08, { bw: 0.5 }),
  'sumo-deadlift': L('deadlift', 1, 0.1, { bw: 0.5 }),
  rdl: L('deadlift', 0.81, 0.12, { bw: 0.5 }),
  'good-morning': L('deadlift', 0.58, 0.25, { bw: 0.5 }),
  'db-rdl': L('deadlift', 0.72, 0.2, { bw: 0.5 }),
  'kb-deadlift': L('deadlift', 0.6, 0.25, { bw: 0.5 }),
  'kb-rdl': L('deadlift', 0.55, 0.25, { bw: 0.5 }),
  'kb-sumo-deadlift': L('deadlift', 0.6, 0.25, { bw: 0.5 }),
  'kb-swing': L('deadlift', 0.4, 0.4, { bw: 0.5 }),
  'db-single-leg-rdl': L('deadlift', 0.38, 0.3, { bw: 0.5 }),
  'kb-single-leg-deadlift': L('deadlift', 0.38, 0.3, { bw: 0.5 }),
  // ── Hip thrust (barbell hip thrust = 1) ──────────────────────────────
  'barbell-hip-thrust': L('barbell-hip-thrust', 1, 0.12, { bw: 0.3 }),
  'barbell-glute-bridge': L('barbell-hip-thrust', 0.9, 0.15, { bw: 0.3 }),
  'db-glute-bridge': L('barbell-hip-thrust', 0.43, 0.3, { bw: 0.3 }),
  'db-hip-thrust': L('barbell-hip-thrust', 0.47, 0.3, { bw: 0.3 }),
  'hip-thrust': L('barbell-hip-thrust', 1, 0.3, { bw: 0.3 }),
  'glute-bridge': L('barbell-hip-thrust', 0.9, 0.3, { bw: 0.3 }),
  'single-leg-glute-bridge': L('barbell-hip-thrust', 0.5, 0.35, { bw: 0.3 }),
  'glute-bridge-march': L('barbell-hip-thrust', 0.5, 0.4, { bw: 0.3 }),
  // ── Leg isolation ────────────────────────────────────────────────────
  'seated-leg-curl': L('seated-leg-curl', 1, 0.3),
  'lying-leg-curl': L('seated-leg-curl', 0.85, 0.35),
  'ball-hamstring-curl': L('seated-leg-curl', 0.7, 0.4, { bw: 0.45 }),
  'leg-extension': L('leg-extension', 1, 0.3),
  'machine-calf-raise': L('machine-calf-raise', 1, 0.3, { bw: 0.5 }),
  'calf-raise': L('machine-calf-raise', 0.85, 0.3, { bw: 1 }),
  'db-seated-calf-raise': L('machine-calf-raise', 0.36, 0.35),
  'bodyweight-calf-raise': L('machine-calf-raise', 0.9, 0.3, { bw: 1 }),
  'single-leg-calf-raise': L('machine-calf-raise', 0.5, 0.3, { bw: 1 }),
  'hip-abduction-machine': L('hip-abduction-machine', 1, 0.35),
  'hip-adduction-machine': L('hip-adduction-machine', 1, 0.35),
  'machine-glute-kickback': L('machine-glute-kickback', 1, 0.4),
  // ── Trunk ────────────────────────────────────────────────────────────
  'machine-crunch': L('machine-crunch', 1, 0.4),
  'cable-pallof-press': L('cable-pallof-press', 1, 0.4),
  'cable-wood-chop': L('cable-wood-chop', 1, 0.4),
  'kb-suitcase-march': L('kb-suitcase-march', 1, 0.4),
}

// Refined work shares, where the catalog's primary/secondary split is too coarse.
const SHARES = {
  'bench-press': { chest: 0.55, triceps: 0.25, 'front-delts': 0.2 },
  'paused-bench-press': { chest: 0.57, triceps: 0.23, 'front-delts': 0.2 },
  'db-bench': { chest: 0.6, triceps: 0.2, 'front-delts': 0.2 },
  'db-floor-press': { chest: 0.5, triceps: 0.32, 'front-delts': 0.18 },
  'barbell-floor-press': { chest: 0.48, triceps: 0.34, 'front-delts': 0.18 },
  'db-alt-floor-press': { chest: 0.5, triceps: 0.3, 'front-delts': 0.15, obliques: 0.05 },
  'db-single-arm-floor-press': { chest: 0.5, triceps: 0.3, 'front-delts': 0.15, obliques: 0.05 },
  'kb-floor-press': { chest: 0.48, triceps: 0.32, 'front-delts': 0.15, obliques: 0.05 },
  'db-squeeze-press': { chest: 0.62, triceps: 0.24, 'front-delts': 0.14 },
  'db-neutral-bench': { chest: 0.45, triceps: 0.35, 'front-delts': 0.2 },
  'close-grip-bench': { triceps: 0.42, chest: 0.4, 'front-delts': 0.18 },
  'close-grip-push-up': { triceps: 0.42, chest: 0.36, 'front-delts': 0.14, abs: 0.08 },
  'incline-bench-press': { chest: 0.45, 'front-delts': 0.35, triceps: 0.2 },
  'db-incline-press': { chest: 0.47, 'front-delts': 0.35, triceps: 0.18 },
  'machine-incline-press': { chest: 0.45, 'front-delts': 0.35, triceps: 0.2 },
  'machine-decline-press': { chest: 0.6, triceps: 0.25, 'front-delts': 0.15 },
  'machine-chest-press': { chest: 0.6, triceps: 0.22, 'front-delts': 0.18 },
  'cable-chest-press': { chest: 0.58, triceps: 0.2, 'front-delts': 0.17, abs: 0.05 },
  'push-up': { chest: 0.5, triceps: 0.22, 'front-delts': 0.18, abs: 0.1 },
  'wide-push-up': { chest: 0.6, 'front-delts': 0.17, triceps: 0.13, abs: 0.1 },
  'kneeling-push-up': { chest: 0.52, triceps: 0.22, 'front-delts': 0.18, abs: 0.08 },
  'incline-push-up': { chest: 0.52, triceps: 0.22, 'front-delts': 0.18, abs: 0.08 },
  'bench-push-up': { chest: 0.52, triceps: 0.22, 'front-delts': 0.18, abs: 0.08 },
  'pec-deck': { chest: 0.85, 'front-delts': 0.15 },
  'cable-fly': { chest: 0.82, 'front-delts': 0.18 },
  'low-high-cable-fly': { chest: 0.7, 'front-delts': 0.3 },
  'high-low-cable-fly': { chest: 0.85, 'front-delts': 0.15 },
  'db-floor-fly': { chest: 0.85, 'front-delts': 0.15 },
  dip: { triceps: 0.45, chest: 0.35, 'front-delts': 0.2 },
  'assisted-dip': { triceps: 0.45, chest: 0.35, 'front-delts': 0.2 },
  'bench-dip': { triceps: 0.7, 'front-delts': 0.2, chest: 0.1 },
  ohp: { 'front-delts': 0.45, 'side-delts': 0.22, triceps: 0.25, 'upper-back': 0.04, abs: 0.04 },
  'seated-barbell-press': { 'front-delts': 0.47, 'side-delts': 0.23, triceps: 0.3 },
  'db-overhead-press': { 'front-delts': 0.45, 'side-delts': 0.27, triceps: 0.24, abs: 0.04 },
  'db-seated-press': { 'front-delts': 0.46, 'side-delts': 0.28, triceps: 0.26 },
  'db-arnold-press': { 'front-delts': 0.47, 'side-delts': 0.3, triceps: 0.23 },
  'kb-strict-press': { 'front-delts': 0.45, 'side-delts': 0.25, triceps: 0.24, obliques: 0.06 },
  'landmine-press': { 'front-delts': 0.42, chest: 0.3, triceps: 0.23, serratus: 0.05 },
  'machine-shoulder-press': { 'front-delts': 0.47, 'side-delts': 0.25, triceps: 0.28 },
  'pike-push-up': { 'front-delts': 0.5, triceps: 0.3, 'side-delts': 0.15, abs: 0.05 },
  'lateral-raise': { 'side-delts': 0.85, traps: 0.1, 'front-delts': 0.05 },
  'db-scaption': { 'side-delts': 0.55, 'front-delts': 0.35, 'rotator-cuff': 0.1 },
  'machine-lateral-raise': { 'side-delts': 0.9, traps: 0.1 },
  'cable-lateral-raise': { 'side-delts': 0.88, traps: 0.07, 'front-delts': 0.05 },
  'db-front-raise': { 'front-delts': 0.88, 'side-delts': 0.12 },
  'cable-front-raise': { 'front-delts': 0.88, 'side-delts': 0.12 },
  'face-pull': { 'rear-delts': 0.55, 'upper-back': 0.3, 'rotator-cuff': 0.15 },
  'db-rear-delt-fly': { 'rear-delts': 0.65, 'upper-back': 0.35 },
  'cable-rear-delt-fly': { 'rear-delts': 0.65, 'upper-back': 0.35 },
  'reverse-pec-deck': { 'rear-delts': 0.65, 'upper-back': 0.35 },
  'barbell-shrug': { traps: 0.88, forearms: 0.12 },
  'db-shrug': { traps: 0.85, forearms: 0.15 },
  'lat-pulldown': { lats: 0.55, biceps: 0.2, 'upper-back': 0.15, 'rear-delts': 0.1 },
  'pull-up': { lats: 0.52, biceps: 0.2, 'upper-back': 0.14, 'rear-delts': 0.08, forearms: 0.03, abs: 0.03 },
  'assisted-pull-up': { lats: 0.55, biceps: 0.2, 'upper-back': 0.15, 'rear-delts': 0.1 },
  'single-arm-pulldown': { lats: 0.6, biceps: 0.2, 'upper-back': 0.15, obliques: 0.05 },
  'machine-high-row': { lats: 0.45, 'upper-back': 0.3, biceps: 0.15, 'rear-delts': 0.1 },
  'cable-straight-arm-pulldown': { lats: 0.85, triceps: 0.05, abs: 0.1 },
  'db-pullover': { lats: 0.7, chest: 0.25, triceps: 0.05 },
  'machine-pullover': { lats: 0.85, chest: 0.15 },
  'barbell-row': { lats: 0.33, 'upper-back': 0.32, biceps: 0.13, 'rear-delts': 0.12, 'lower-back': 0.1 },
  'underhand-row': { lats: 0.38, 'upper-back': 0.27, biceps: 0.2, 'lower-back': 0.1, 'rear-delts': 0.05 },
  'pendlay-row': { lats: 0.32, 'upper-back': 0.33, biceps: 0.12, 'rear-delts': 0.12, 'lower-back': 0.11 },
  'db-row': { lats: 0.42, 'upper-back': 0.3, biceps: 0.15, 'rear-delts': 0.13 },
  'db-chest-supported-row': { lats: 0.35, 'upper-back': 0.37, biceps: 0.14, 'rear-delts': 0.14 },
  'db-bent-over-row': { lats: 0.36, 'upper-back': 0.32, biceps: 0.13, 'rear-delts': 0.11, 'lower-back': 0.08 },
  'db-wide-row': { 'upper-back': 0.4, 'rear-delts': 0.28, lats: 0.15, biceps: 0.1, 'lower-back': 0.07 },
  'kb-row': { lats: 0.42, 'upper-back': 0.3, biceps: 0.15, 'rear-delts': 0.13 },
  'cable-row': { lats: 0.4, 'upper-back': 0.33, biceps: 0.15, 'rear-delts': 0.12 },
  'wide-cable-row': { 'upper-back': 0.42, 'rear-delts': 0.26, lats: 0.17, biceps: 0.15 },
  'single-arm-cable-row': { lats: 0.42, 'upper-back': 0.3, biceps: 0.15, 'rear-delts': 0.1, obliques: 0.03 },
  'machine-row': { lats: 0.38, 'upper-back': 0.35, biceps: 0.14, 'rear-delts': 0.13 },
  'suspension-row': { lats: 0.35, 'upper-back': 0.33, biceps: 0.15, 'rear-delts': 0.12, abs: 0.05 },
  'barbell-curl': { biceps: 0.85, forearms: 0.15 },
  'biceps-curl': { biceps: 0.85, forearms: 0.15 },
  'db-incline-curl': { biceps: 0.9, forearms: 0.1 },
  'db-concentration-curl': { biceps: 0.9, forearms: 0.1 },
  'db-cross-body-curl': { biceps: 0.6, forearms: 0.4 },
  'db-hammer-curl': { biceps: 0.55, forearms: 0.45 },
  'cable-hammer-curl': { biceps: 0.55, forearms: 0.45 },
  'db-reverse-curl': { forearms: 0.6, biceps: 0.4 },
  'barbell-reverse-curl': { forearms: 0.6, biceps: 0.4 },
  'machine-curl': { biceps: 0.9, forearms: 0.1 },
  'cable-curl': { biceps: 0.87, forearms: 0.13 },
  'back-squat': { quads: 0.48, glutes: 0.32, adductors: 0.13, 'lower-back': 0.07 },
  'box-squat': { quads: 0.4, glutes: 0.35, adductors: 0.12, hamstrings: 0.06, 'lower-back': 0.07 },
  'paused-back-squat': { quads: 0.5, glutes: 0.3, adductors: 0.13, 'lower-back': 0.07 },
  'front-squat': { quads: 0.6, glutes: 0.25, adductors: 0.1, 'upper-back': 0.05 },
  'goblet-squat': { quads: 0.55, glutes: 0.3, adductors: 0.12, abs: 0.03 },
  'db-front-squat': { quads: 0.57, glutes: 0.3, adductors: 0.13 },
  'kb-front-rack-squat': { quads: 0.57, glutes: 0.28, adductors: 0.12, abs: 0.03 },
  'db-sumo-squat': { adductors: 0.3, quads: 0.35, glutes: 0.35 },
  'sumo-squat': { adductors: 0.3, quads: 0.35, glutes: 0.35 },
  'leg-press': { quads: 0.55, glutes: 0.3, adductors: 0.15 },
  'hack-squat': { quads: 0.65, glutes: 0.25, adductors: 0.1 },
  'pendulum-squat': { quads: 0.67, glutes: 0.23, adductors: 0.1 },
  'belt-squat': { quads: 0.5, glutes: 0.35, adductors: 0.15 },
  'bodyweight-squat': { quads: 0.52, glutes: 0.33, adductors: 0.15 },
  'tempo-squat': { quads: 0.52, glutes: 0.33, adductors: 0.15 },
  'paused-squat': { quads: 0.54, glutes: 0.31, adductors: 0.15 },
  'split-squat': { quads: 0.45, glutes: 0.4, adductors: 0.15 },
  'db-split-squat': { quads: 0.45, glutes: 0.4, adductors: 0.15 },
  'barbell-split-squat': { quads: 0.45, glutes: 0.4, adductors: 0.15 },
  lunge: { quads: 0.45, glutes: 0.4, adductors: 0.15 },
  'forward-lunge': { quads: 0.5, glutes: 0.35, adductors: 0.15 },
  'reverse-lunge': { quads: 0.4, glutes: 0.45, adductors: 0.15 },
  'db-reverse-lunge': { quads: 0.4, glutes: 0.45, adductors: 0.15 },
  'kb-reverse-lunge': { quads: 0.4, glutes: 0.45, adductors: 0.15 },
  'slider-reverse-lunge': { quads: 0.38, glutes: 0.42, adductors: 0.12, hamstrings: 0.08 },
  'db-step-up': { glutes: 0.45, quads: 0.45, adductors: 0.1 },
  'lateral-lunge': { adductors: 0.35, quads: 0.35, glutes: 0.3 },
  'db-lateral-lunge': { adductors: 0.35, quads: 0.35, glutes: 0.3 },
  'curtsy-lunge': { glutes: 0.45, quads: 0.35, adductors: 0.12, abductors: 0.08 },
  deadlift: { glutes: 0.3, hamstrings: 0.28, 'lower-back': 0.2, quads: 0.1, 'upper-back': 0.06, forearms: 0.06 },
  'sumo-deadlift': { glutes: 0.32, quads: 0.25, adductors: 0.18, hamstrings: 0.1, 'lower-back': 0.1, forearms: 0.05 },
  rdl: { hamstrings: 0.5, glutes: 0.33, 'lower-back': 0.12, forearms: 0.05 },
  'db-rdl': { hamstrings: 0.5, glutes: 0.33, 'lower-back': 0.12, forearms: 0.05 },
  'kb-rdl': { hamstrings: 0.5, glutes: 0.34, 'lower-back': 0.12, forearms: 0.04 },
  'good-morning': { hamstrings: 0.48, glutes: 0.25, 'lower-back': 0.27 },
  'kb-deadlift': { glutes: 0.35, hamstrings: 0.3, quads: 0.15, 'lower-back': 0.15, forearms: 0.05 },
  'kb-sumo-deadlift': { glutes: 0.35, quads: 0.25, adductors: 0.2, hamstrings: 0.12, 'lower-back': 0.08 },
  'kb-swing': { glutes: 0.5, hamstrings: 0.32, 'lower-back': 0.12, abs: 0.06 },
  'db-single-leg-rdl': { hamstrings: 0.48, glutes: 0.4, 'lower-back': 0.08, abductors: 0.04 },
  'kb-single-leg-deadlift': { hamstrings: 0.48, glutes: 0.4, 'lower-back': 0.08, abductors: 0.04 },
  'barbell-hip-thrust': { glutes: 0.78, hamstrings: 0.15, quads: 0.07 },
  'barbell-glute-bridge': { glutes: 0.8, hamstrings: 0.2 },
  'db-hip-thrust': { glutes: 0.78, hamstrings: 0.15, quads: 0.07 },
  'db-glute-bridge': { glutes: 0.8, hamstrings: 0.2 },
  'hip-thrust': { glutes: 0.78, hamstrings: 0.15, quads: 0.07 },
  'glute-bridge': { glutes: 0.8, hamstrings: 0.2 },
  'single-leg-glute-bridge': { glutes: 0.78, hamstrings: 0.2, abductors: 0.02 },
  'seated-leg-curl': { hamstrings: 0.95, calves: 0.05 },
  'lying-leg-curl': { hamstrings: 0.92, calves: 0.08 },
  'ball-hamstring-curl': { hamstrings: 0.75, glutes: 0.2, abs: 0.05 },
  'leg-extension': { quads: 1 },
  'machine-calf-raise': { calves: 1 },
  'calf-raise': { calves: 1 },
  'db-seated-calf-raise': { calves: 1 },
  'hip-abduction-machine': { abductors: 0.8, glutes: 0.2 },
  'hip-adduction-machine': { adductors: 1 },
  'machine-glute-kickback': { glutes: 0.85, hamstrings: 0.15 },
}

const ROLE_ENDURANCE = { compound: 28, accessory: 30, isolation: 32, control: 32, drill: 32, stretch: 32 }

function normalise(shares) {
  const total = Object.values(shares).reduce((a, b) => a + b, 0)
  if (!(total > 0)) return {}
  return Object.fromEntries(Object.entries(shares).filter(([, v]) => v > 0).map(([m, v]) => [m, v / total]))
}

function catalogShares(meta) {
  const out = {}
  for (const m of meta.primary) out[m] = (out[m] || 0) + 1
  for (const m of meta.secondary) out[m] = (out[m] || 0) + 0.45
  for (const m of meta.stabilizers) out[m] = (out[m] || 0) + 0.1
  return normalise(out)
}

/** How the strength model treats an exercise. */
function modeOf(meta, def) {
  if (!def || def.type !== 'reps') return null
  if (meta?.load === 'assist') return 'assist'
  if (def.weighted) return 'load'
  if (meta?.load === 'band') return 'band'
  if (LOADS[meta?.id]?.bw) return 'bodyweight'
  return 'reps'
}

const PROFILES = new Map()

/**
 * The library entry for one exercise (cached).
 * @returns null for unknown ids, otherwise {
 *   id, mode, muscles, areas, primaryMuscles, pattern, family, joints,
 *   equipmentClass, loadConvention, unilateral, ext, bw, anchor, ratio,
 *   ratioSd, tie, endurance, normKg }
 */
export function exerciseProfile(id, def = null) {
  if (PROFILES.has(id)) return PROFILES.get(id)
  const meta = metaOf(id)
  if (!meta) return null
  const d = def || findExercise(id)
  const muscles = normalise(SHARES[id] || catalogShares(meta))
  const areas = {}
  for (const [m, s] of Object.entries(muscles)) areas[MUSCLE_AREA[m]] = (areas[MUSCLE_AREA[m]] || 0) + s
  const load = LOADS[id] || null
  const mode = modeOf(meta, d)
  // Two dumbbells logged "per hand" move twice the logged number.
  const ext = load?.ext ?? (meta.load === 'hand' && !meta.perSide ? 2 : 1)
  // A reference lift always counts bodyweight the way its reference value does.
  const bw = load?.bw ?? (load?.anchor === id ? ANCHORS[id]?.bw || 0 : 0)
  const tie = Boolean(load) && load.tie !== false && !['control', 'drill', 'stretch'].includes(meta.role)
  const normKg = load && anchorLoadKg(load.anchor) !== null ? anchorLoadKg(load.anchor) * load.ratio : null
  const profile = {
    id,
    mode,
    muscles,
    areas,
    primaryMuscles: [...meta.primary],
    pattern: meta.pattern,
    family: meta.family,
    joints: [...meta.joints],
    equipmentClass: meta.equipmentClass,
    loadConvention: meta.load,
    unilateral: Boolean(meta.perSide),
    role: meta.role,
    ext,
    bw,
    anchor: load?.anchor ?? null,
    ratio: load?.ratio ?? null,
    ratioSd: load?.sd ?? 0.5,
    tie,
    machine: ['stack', 'plate'].includes(meta.load) || meta.load === 'assist',
    endurance: ROLE_ENDURANCE[meta.role] ?? 29,
    normKg,
  }
  PROFILES.set(id, profile)
  return profile
}

/** Effective load moved for a logged weight (in the same unit as `bodyweight`). */
export function effectiveLoad(profile, logged, bodyweight) {
  const w = Number.isFinite(logged) ? logged : 0
  if (profile.mode === 'assist') return profile.bw * bodyweight - w
  return profile.ext * w + profile.bw * bodyweight
}

/** The logged weight that gives an effective load (inverse of effectiveLoad). */
export function loggedFor(profile, effective, bodyweight) {
  if (profile.mode === 'assist') return profile.bw * bodyweight - effective
  if (!(profile.ext > 0)) return null
  return (effective - profile.bw * bodyweight) / profile.ext
}

const dot = (a, b) => Object.entries(a).reduce((s, [k, v]) => s + v * (b[k] || 0), 0)
const norm = (a) => Math.sqrt(dot(a, a))

/**
 * How alike two exercises are (0–1), and why: shared muscles (most of it),
 * shared joint actions, the same movement, the same equipment.
 */
export function similarity(aId, bId) {
  const a = exerciseProfile(aId)
  const b = exerciseProfile(bId)
  if (!a || !b) return { score: 0, muscles: 0, joints: 0, pattern: false, equipment: false }
  const muscles = norm(a.muscles) && norm(b.muscles) ? dot(a.muscles, b.muscles) / (norm(a.muscles) * norm(b.muscles)) : 0
  const ja = new Set(a.joints)
  const jb = new Set(b.joints)
  const union = new Set([...ja, ...jb]).size
  const joints = union ? [...ja].filter((j) => jb.has(j)).length / union : 0
  const pattern = a.pattern === b.pattern
  const equipment = a.equipmentClass === b.equipmentClass
  const score = 0.62 * muscles + 0.2 * joints + 0.1 * (pattern ? 1 : 0) + 0.08 * (equipment ? 1 : 0)
  return { score: Math.round(score * 1000) / 1000, muscles, joints, pattern, equipment }
}

/** The most similar exercises in the library (ties for the exercise sheet). */
export function relatedExercises(id, { limit = 6, filter = () => true } = {}) {
  const me = exerciseProfile(id)
  if (!me) return []
  return allMeta()
    .filter((m) => m.id !== id && m.reviewed && (m.kinds.includes('strength') || m.kinds.includes('seated')) && filter(m))
    .map((m) => ({ id: m.id, ...similarity(id, m.id) }))
    .filter((r) => r.score >= 0.45)
    .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
    .slice(0, limit)
}

/** Every exercise the strength model ties together (for checks and reports). */
export function tiedExercises() {
  return allMeta()
    .map((m) => exerciseProfile(m.id))
    .filter((p) => p && p.tie && ['load', 'bodyweight', 'assist'].includes(p.mode))
}

export { REF_BODYWEIGHT_KG }
