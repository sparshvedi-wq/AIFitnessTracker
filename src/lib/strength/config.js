// Every number the adaptive strength model uses, in one place.
//
// The model (see model.js) keeps a per-exercise belief about how strong someone
// is, learns from every logged set and the one-tap "how did it feel" answers,
// and works backwards to a weight and rep count. These values are planning
// heuristics anchored to published rep–load relationships and RIR research;
// they are not measurements of physiology. See docs/RECOMMENDATION_ENGINE.md.

export const STRENGTH_VERSION = 'strength-3'

// ── Rep–load relationship ────────────────────────────────────────────────
// Fraction of a one-rep max that can be lifted for R reps to failure:
//   f(R) = 1 / (1 + (R − 1) / k)
// k is "rep endurance": Epley-like curves sit near 29–30. Isolation and
// machine work usually allows a few more reps at the same share of a max.
// The model starts from these priors and learns a personal k per exercise.
export const ENDURANCE = { compound: 28, accessory: 30, isolation: 32, control: 32, drill: 32, stretch: 32 }
export const ENDURANCE_DEFAULT = 29
export const ENDURANCE_PRIOR_SD = 0.15 // log scale: k is believed within about ±15%
export const ENDURANCE_LIMITS = [20, 42]
// Rep counts the load model trusts. Very long sets say little about a max.
export const MAX_MODEL_REPS = 30
// How far the rep–load formula itself can be off (log scale), growing with reps.
export const FORMULA_SD = { base: 0.015, perRepAbove6: 0.004, max: 0.12 }

// ── What a tap means: reps in reserve (RIR) ─────────────────────────────
// Answers carry a mean and spread. "Easy" also proves at least `atLeast` were
// left. Beginners judge reps-in-reserve less accurately and tend to report
// sets as harder than they were, so their answers are wider and shifted.
export const FEEL_RIR = {
  experienced: {
    failed: { mean: 0, sd: 0.35 },
    hard: { mean: 1, sd: 0.8 },
    good: { mean: 2, sd: 1.2 },
    easy: { mean: 4.5, sd: 1.5, atLeast: 3 },
  },
  beginner: {
    failed: { mean: 0, sd: 0.45 },
    hard: { mean: 1.5, sd: 1.2 },
    good: { mean: 2.5, sd: 1.6 },
    easy: { mean: 5, sd: 2, atLeast: 3 },
  },
}
// "Easy" can say how many more were possible ("a few", "about 5", "8 or more").
// That turns a vague "easy" into a real measurement, so a weight that is far
// too light is corrected in one or two sets instead of creeping up.
export const RESERVE = {
  3: { mean: 3, sd: 1.0, atLeast: 2 },
  5: { mean: 5, sd: 1.3, atLeast: 4 },
  8: { mean: 9, sd: 2.5, atLeast: 7 },
}
// Without an answer, completing the logged reps only proves "at least 0 left".
// Bounds act only when the belief contradicts them, so silence never inflates
// (or deflates) an estimate on its own.
export const IMPLICIT = {
  completed: { atLeast: 0, sd: 0.5 },
  // More reps than planned and no answer: they kept going, likely near the end.
  exceeded: { mean: 1, sd: 1.2 },
  // Fewer reps than planned and no answer: probably close to failure.
  missed: { mean: 0.5, sd: 1.0 },
  // Session effort (1 easy … 4 very hard) adds weak bounds to unanswered sets.
  easySession: { atLeast: 2, sd: 1.2 },
  veryHardSession: { atMost: 2, sd: 1.2 },
  // "Too heavy to start": not even one clean rep at that load.
  tooHeavy: { atMost: 0, sd: 0.5 },
}
// Before any answers, people usually stop a planned set with 2–3 reps left.
// This is a prior for the very first session only, never treated as data.
export const FIRST_SESSION_PRIOR = { rir: 2.5, rirSd: 2, extraSd: 0.03 }

// ── Day-to-day and set-to-set variation ─────────────────────────────────
// Sets on one day share that day's form: they are not independent evidence.
export const DAY_SD = 0.04
// Fatigue from earlier working sets of the same exercise in one session:
// δ(r) = FATIGUE.perSet · e^(−FATIGUE.decay · RIR), capped in total.
export const FATIGUE = { perSet: 0.03, decay: 0.4, cap: 0.15 }
// Rep capacity falls faster than load capacity with the same fatigue.
export const REP_FATIGUE_SCALE = 2.5

// ── How beliefs change over time ─────────────────────────────────────────
// Expected improvement per session, by experience; the learned trend reverts
// toward it, so a long run of answers can speed it up or slow it down.
export const TREND_PRIOR = { 'Starting out': 0.01, 'Some experience': 0.005, Experienced: 0.0025 }
export const TREND_PRIOR_REPS = { 'Starting out': 0.02, 'Some experience': 0.01, Experienced: 0.005 }
export const TREND_DAMPING = 0.85
export const TREND_LIMITS = [-0.03, 0.04]
export const TREND_PRIOR_SD = 0.006
export const PROCESS = {
  perDay: 0.0035, // level drift (sd) per day without training
  perSession: 0.01, // level drift (sd) per new session day
  trendPerSession: 0.003, // trend drift (sd) per new session day
  endurancePerSession: 0.01, // rep-endurance drift (log sd) per new session day
}
// Detraining: nothing for the first 10 days, then about 1.2% a week, at most 12%.
export const DETRAINING = { graceDays: 10, perWeek: 0.012, max: 0.12, trendResetDays: 21 }
// Upper limits on belief spread (log scale), so long gaps never explode it.
export const SD_LIMITS = { level: 0.6, trend: 0.02, endurance: 0.25 }
export const NEW_EXERCISE_SD = 0.2
export const ANCHOR_SD = 0.06 // "this is my working weight" from the person

// ── Robustness ───────────────────────────────────────────────────────────
// Sets that disagree wildly with an established belief are almost always typos.
export const OUTLIER = { establishedSd: 0.12, rejectZ: 4, softZ: 2.5, rejectRatio: 2.5 }
// Absolute ceilings (lb) above which a logged load is treated as a typo.
export const LOAD_CEILING_LB = { hand: 250, one: 250, bar: 1300, landmine: 600, stack: 700, plate: 3000, other: 1500 }

// ── Prescription ─────────────────────────────────────────────────────────
// Plans aim slightly below the best estimate while the model is unsure:
// weight from (level − CONSERVATISM · sd), with sd capped.
export const CONSERVATISM = { weight: 0.5, sdFloor: 0.015, sdCap: 0.1, transferWeight: 1.0, transferSdCap: 0.2 }
// Reps in reserve to aim for.
export const TARGET_RIR = {
  'Starting out': 3,
  'Some experience': 2,
  Experienced: 2,
  challengingBonus: -1, // "challenging" days for experienced people
  easyBonus: 2,
  returningBonus: 1,
  max: 5,
  min: 1,
}
// Rep ranges for double progression: reps rise to the top, then the load rises.
export const REP_RANGES = {
  'Build muscle': { compound: [8, 12], accessory: [8, 12], isolation: [10, 15], control: [10, 15] },
  'Get stronger': { compound: [5, 8], accessory: [8, 12], isolation: [10, 15], control: [10, 15] },
  'General fitness': { compound: [8, 12], accessory: [8, 12], isolation: [10, 15], control: [10, 15] },
  'Lose weight': { compound: [10, 15], accessory: [10, 15], isolation: [12, 15], control: [10, 15] },
  'Sport performance': { compound: [6, 10], accessory: [8, 12], isolation: [10, 15], control: [10, 15] },
}
// Beginners keep compound lifts at 6+ reps while learning them.
export const BEGINNER_MIN_REPS = 6
// Bodyweight and band work progresses in reps within these ranges.
export const BODYWEIGHT_RANGE = { compound: [3, 15], accessory: [5, 20], default: [6, 20] }
export const MAX_REP_INCREASE_BODYWEIGHT = 3
// Loads: at most +10% in one step, except the smallest real step up, which is
// allowed up to +25% (or more when the model is confident and reps allow it).
export const JUMP = { free: 0.1, smallestStepMax: 0.25, confidentSd: 0.06, bigDropFloor: 0.75, roomy: 0.3, roomyExternal: 0.6 }
// When the next weight is too big a jump, reps may rise this far above the range.
export const EXTRA_REPS_BEFORE_JUMP = 3
// In a live workout, change the remaining sets only when it matters.
export const MATERIAL_REP_CHANGE = 2
