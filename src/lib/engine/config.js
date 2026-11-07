// Every number the recommendation engine uses, in one place, with its rule
// version. These are planning heuristics chosen to produce sensible sessions;
// they are not measurements of physiology, recovery or fatigue.
// See docs/RECOMMENDATION_ENGINE.md for the reasoning behind each group.

export const ENGINE_VERSION = 'daily-3.2'
export const RULES = {
  eligibility: 'elig-2',
  exposure: 'expo-1',
  rollover: 'roll-2',
  learning: 'learn-1',
  scoring: 'score-3',
  photoFocus: 'photo-1',
  exploration: 'explore-1',
  selection: 'select-4',
  dose: 'dose-2',
  progression: 'prog-3',
  feedback: 'ask-1',
  explanation: 'why-1',
}

// ── Exposure: how much completed work each set contributes ───────────────
// A completed working set adds these set-equivalents to each muscle it uses.
export const CONTRIBUTION = { primary: 1, secondary: 0.5, stabilizer: 0.15 }
// Warm-up sets add a little, since they are deliberately light.
export const WARMUP_FACTOR = 0.25
// Reported session effort (1 easy … 4 very hard) scales the dose slightly.
export const EFFORT_FACTOR = { 1: 0.8, 2: 1, 3: 1.1, 4: 1.2, 5: 1.2 }
// Recent work fades with these half-lives (hours) when judging overlap.
export const HALF_LIFE_HOURS = { muscle: 36, pattern: 48, exercise: 24 }
// Set-equivalents per broad area in one window that count as "a full dose"
// for overlap purposes, by experience. Above this, overlap penalties apply.
export const AREA_CAPACITY = { 'Starting out': 4, 'Some experience': 5, Experienced: 6 }
// Seven-day exposure per broad area that a goal aims for (set-equivalents).
export const WEEKLY_TARGET = {
  'Build muscle': 10,
  'Get stronger': 8,
  'General fitness': 6,
  'Lose weight': 6,
  'Sport performance': 6,
}
export const EXPERIENCE_TARGET_SCALE = { 'Starting out': 0.6, 'Some experience': 0.8, Experienced: 1 }
// Main areas the weekly balance considers (Core is planned as an accessory).
export const BALANCE_AREAS = ['Legs', 'Glutes', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core']

// Photo cues remain provisional even when a later check-in suggests the same
// priority. These small planning weights are heuristics, not confidence scores
// or promised increases in completed sets. Recovery and hard exclusions win.
export const PHOTO_FOCUS = {
  initialRank: 0.25,
  followupRank: 0.4,
  initialTargetBoost: 0.05,
  followupTargetBoost: 0.1,
  followupGapDays: 7,
  fullWeightDays: 14,
  expiresDays: 42,
}

// ── Rollover: unfinished work as optional candidates ─────────────────────
// Weight of an unfinished exercise as a candidate, by stated reason.
// Reasons not listed (pain, discomfort, soreness, unwell, dislike) never roll
// over; they adapt comfort, readiness or preference instead.
export const ROLLOVER_REASON_WEIGHT = { time: 1, unknown: 0.5, equipment: 0.5 }
export const ROLLOVER_HALF_LIFE_DAYS = 2
export const ROLLOVER_MAX_AGE_DAYS = 7
// A candidate offered in a later plan and not done again loses half its
// priority; offered twice and not done, it expires.
export const ROLLOVER_MAX_OFFERS = 2
// Later completed work in the same muscles that reaches this share of the
// missed dose satisfies the candidate.
export const ROLLOVER_SATISFIED_SHARE = 0.75
export const ROLLOVER_MAX_IN_PLAN = 2

// ── Learning: exercise-specific signals ─────────────────────────────────
export const LEARNING = {
  // Inferred evidence (skips, swaps) fades; explicit answers do not.
  inferredHalfLifeDays: 30,
  // A single "prefer something else" skip is weak. Two or more in 60 days
  // become a noticeable, still reversible, preference.
  inferredDislikeThreshold: 2,
  inferredWindowDays: 60,
  // How much evidence about one variant informs a close sibling (same family
  // and loading position). Only discomfort and setup are ever shared, and only
  // as soft penalties.
  siblingShare: { discomfort: 0.3, setup: 0 },
  // Explicit discomfort keeps an exercise out of automatic plans until the
  // person chooses to retry it.
  discomfortHoldDays: null,
  maxEvents: 600,
}

// ── Feedback questions ───────────────────────────────────────────────────
export const FEEDBACK = {
  perSession: 1,
  // Same question about the same exercise is not repeated within this window.
  repeatCooldownDays: 21,
  // After several dismissals in a row, questions pause for a while.
  dismissalsBeforePause: 3,
  pauseDays: 14,
  // Ask only when the expected decision value clears this bar (0..1)…
  minimumValue: 0.35,
  // …plus an interruption cost that grows with each question in the last
  // few saved sessions, so questions stay occasional.
  interruptionPerRecentQuestion: 0.15,
  recentSessions: 3,
}

// ── Scoring: normalized feature weights ─────────────────────────────────
// Each feature is scaled to 0..1 (or -1..1 for preference) before weighting.
// Hard restrictions never reach scoring.
export const WEIGHTS = {
  goal: 2.2,
  need: 2.6,
  focus: 1.6,
  sport: 1.2,
  rollover: 1.4,
  preference: 1.6,
  comfort: 1.2,
  confidence: 0.4,
  progression: 0.6,
  familiarity: 0.5,
  staple: 0.9,
  setup: 0.5,
  muscleOverlap: 2.4,
  similarRepeat: 1.4,
  patternRepeat: 1.0,
  exactRepeat: 2.2,
  sameDay: 2.5,
  replacement: 1.2,
  placeAffinity: 0.4,
}
export const SPORT_PRIORITY_SCALE = { sport: 1, balanced: 0.5, goal: 0 }

// ── Exploration ──────────────────────────────────────────────────────────
export const EXPLORATION = {
  // Evaluated in scripts/engine-evaluation.mjs: Thompson sampling, UCB and
  // epsilon-greedy added variety but also repeats, without finding liked
  // variants more often than the posterior mean. The simpler policy is the
  // default; the others stay available for future evaluation.
  defaultStrategy: 'greedy',
  // Beta prior for "accepted as planned" on an exercise never tried.
  prior: [1.5, 1],
  // At most this many exploratory (rarely tried) exercises per session.
  maxPerSession: { familiar: 0, balanced: 1, more: 2 },
  // An exercise tried fewer than this many times counts as exploratory.
  exploratoryBelow: 2,
  // Weight of the sampled acceptance relative to its mean.
  sampleWeight: 0.8,
}

// ── Selection and time ───────────────────────────────────────────────────
export const SELECTION = {
  beamWidth: 24,
  candidatePool: 40,
  maxPerPattern: 1,
  maxPerFamily: 1,
  sessionOverlapPenalty: 1.6,
  // Candidates below this score are left out unless needed for a minimal
  // session; leftover time then buys sets of better choices instead.
  minScore: 1.0,
  coverageBonus: 0.9,
  focusBonus: 1.2,
  transitionSec: { same: 10, change: 30 },
}
export const TIMING = {
  repSec: 3,
  setOverheadSec: 10,
  itemTransitionSec: 20,
  easeInSec: { normal: 180, short: 90 },
}
// Minimum useful rest by role; time is never found by cutting rest below this.
export const MIN_REST = { compound: 60, accessory: 45, isolation: 45, control: 30, drill: 10, stretch: 10 }
