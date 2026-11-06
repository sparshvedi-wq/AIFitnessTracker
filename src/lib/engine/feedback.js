// When to ask one short, optional question, and which one.
//
// Questions are asked only at a natural stopping point (after saving), at
// most once per session, and only when the answer could materially change
// future recommendations. Each candidate gets an expected decision value;
// the best one is asked if it clears the bar. Repeated questions cool down,
// and after several dismissals in a row questions pause. A dismissal is
// recorded only to respect that pause; it is never read as an answer.
import { allMeta, metaOf } from '../catalog/index.js'

const FAMILY_SIZE = {}
for (const m of allMeta()) if (m.kinds.includes('strength')) FAMILY_SIZE[m.family] = (FAMILY_SIZE[m.family] || 0) + 1
const metaFamilySize = (family) => FAMILY_SIZE[family] || 0
import { FEEDBACK } from './config.js'
import { QUESTIONS, exerciseSignals, normalizeLearning } from './learning.js'
import { recordOutcome, recordTime } from './ledger.js'

const DAY = 86400000

/**
 * @param state   app state after the record was saved
 * @param record  the saved workout record
 * @returns {null | { exId, question, prompt, answers, reason, value, workoutId }}
 */
export function chooseQuestion(state, record, { now = Date.now(), today } = {}) {
  if (!record || ['sport', 'recovery', 'manual'].includes(record.kind) || record.sample) return null
  const learning = normalizeLearning(state.learning)
  const touches = learning.events.filter((e) => e.kind === 'answer' || e.kind === 'dismiss')
  // One question per session.
  if (touches.some((e) => e.workoutId === record.id)) return null
  // Several dismissals in a row: pause for a while.
  const recent = touches.slice(-FEEDBACK.dismissalsBeforePause)
  if (
    recent.length === FEEDBACK.dismissalsBeforePause &&
    recent.every((e) => e.kind === 'dismiss') &&
    now - recent.at(-1).at < FEEDBACK.pauseDays * DAY
  )
    return null
  // Interruption cost: questions in the last few saved sessions raise the bar.
  const recentIds = new Set(
    (state.workouts || [])
      .filter((w) => !w.sample && w.id !== record.id && !['sport', 'recovery'].includes(w.kind))
      .slice(-FEEDBACK.recentSessions)
      .map((w) => w.id),
  )
  const recentQuestions = touches.filter((e) => recentIds.has(e.workoutId)).length
  const bar = FEEDBACK.minimumValue + FEEDBACK.interruptionPerRecentQuestion * recentQuestions
  const askedRecently = (exId, question) =>
    touches.some((e) => e.exId === exId && e.question === question && now - e.at < FEEDBACK.repeatCooldownDays * DAY)

  const signals = exerciseSignals(state, { now, today, place: record.location || null })
  const outcome = recordOutcome(record)
  const familiar = new Set(
    [...signals.values()].filter((s) => s.completions >= 2).map((s) => metaOf(s.exId)?.family),
  )
  const candidates = []
  const consider = (exId, question, value, reason) => {
    if (!QUESTIONS[question] || askedRecently(exId, question)) return
    candidates.push({ exId, question, value, reason })
  }
  for (const o of outcome.exercises) {
    const meta = metaOf(o.exId)
    if (!meta || !meta.reviewed) continue
    const s = signals.get(o.exId)
    // How likely the exercise is to come up again in automatic plans.
    const relevance = meta.kinds.includes('strength') ? (meta.staple ? 1 : 0.8) : 0.4
    if (o.doneWork > 0) {
      if (o.retry || s?.retryActive) consider(o.exId, 'feel', 0.95, 'retry')
      if (s?.completions === 1) {
        // Worth asking mostly when there is a real choice to make in this family.
        const choices = metaFamilySize(meta.family) >= 3 ? 1 : 0.6
        if (familiar.has(meta.family)) consider(o.exId, 'again', 0.7 * relevance * choices, 'unfamiliar-variation')
        else consider(o.exId, 'again', 0.45 * relevance * choices, 'new-exercise')
      }
      if (o.swappedFrom && (s?.chosenAsSubstituteHere || 0) <= 1)
        consider(o.exId, 'again', 0.55 * relevance, 'chosen-substitute')
      if (s?.enjoyment.explicit === 'no') consider(o.exId, 'again', 0.75, 'conflicting')
    }
    if (o.status === 'skipped' || (o.status === 'partial' && o.deliberate)) {
      const unknown = (s?.skips.unknown || 0) + (s?.skips.equipment || 0)
      if (o.reason === 'unknown' && unknown >= 2) consider(o.exId, 'setup', 0.8 * relevance, 'repeated-skips')
      if (o.reason === 'dislike' && s?.enjoyment.explicit === 'yes') consider(o.exId, 'again', 0.75, 'conflicting')
    }
  }
  // A meaningful load change is worth one effort check, if nothing better.
  const planned = record.planning?.decision?.items || []
  for (const p of planned) {
    if (!p.codes?.includes('progression')) continue
    const o = outcome.exercises.find((x) => x.exId === p.exId)
    if (o?.doneWork) consider(p.exId, 'effort', 0.45, 'progression-change')
  }
  candidates.sort((a, b) => b.value - a.value || a.exId.localeCompare(b.exId))
  const best = candidates[0]
  if (!best || best.value < bar) return null
  const q = QUESTIONS[best.question]
  return {
    ...best,
    workoutId: record.id,
    place: record.location || null,
    prompt: q.prompt,
    answers: q.answers,
    at: recordTime(record),
  }
}

/** How many questions were shown vs answered: the feedback burden, for evaluation. */
export function feedbackBurden(state) {
  const learning = normalizeLearning(state.learning)
  const answered = learning.events.filter((e) => e.kind === 'answer').length
  const dismissed = learning.events.filter((e) => e.kind === 'dismiss').length
  return { asked: answered + dismissed, answered, dismissed }
}
