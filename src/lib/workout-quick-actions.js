import { finish, skipExercise, enterWork, openRest } from './workout.js'
import { sessionFingerprint } from './engine/replan.js'

export const SKIP_REASONS = [
  ['time', 'Short on time'],
  ['soreness', 'Sore or feels overworked'],
  ['pain', 'Pain or discomfort'],
  ['equipment', 'Equipment unavailable'],
  ['dislike', 'Prefer something else'],
  ['other', 'Just this time'],
]

// The reason must reach the saved outcome, not just change the screen.
export function finishForTime(session, now = Date.now()) {
  const protectedReason = [session.summaryDraft?.finishReason, session.finishReason].find((r) =>
    ['pain', 'soreness', 'unwell', 'dislike'].includes(r),
  )
  const reason = protectedReason || 'time'
  return finish(
    { ...session, finishReason: reason, summaryDraft: { ...session.summaryDraft, finishReason: reason } },
    now,
  )
}

const controlsOf = (s) => JSON.stringify([s.cursor, s.phase, s.pausedAt, s.summaryDraft])
export function skipWithUndo(session, now, reason = 'other') {
  const after = skipExercise(session, now, reason)
  return { before: session, after, fingerprint: sessionFingerprint(after), controls: controlsOf(after) }
}

// Refuse stale undo rather than erase newer sets, target edits or a pause.
// A running timed set returns to an explicit Start, never an auto-restart.
export function undoQuickSkip(current, change, now = Date.now()) {
  if (
    !current ||
    sessionFingerprint(current) !== change.fingerprint ||
    controlsOf(current) !== change.controls
  )
    return null
  const before = change.before
  if (before.phase === 'rest') return openRest(before)
  if (before.phase === 'prepared' || before.pausedAt) return before
  return enterWork({ ...before, phase: 'work', phaseEndsAt: null, phaseLeft: null, phaseTotal: 0 }, now)
}
