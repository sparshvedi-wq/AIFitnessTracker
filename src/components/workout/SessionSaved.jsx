import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { nextVisitInvitation } from '../../lib/flexible-training.js'
import { nextTimeNotes } from '../../lib/next-time.js'
import { profileOf } from '../../lib/planner.js'
import { count } from '../../lib/presentation.js'
import { findExercise } from '../../lib/exercises.js'
import { chooseQuestion } from '../../lib/engine/feedback.js'
import { answerEvent, dismissEvent } from '../../lib/engine/learning.js'
import { useApp } from '../../store/AppContext.jsx'
import { firstSessionAchievement, warmupSetCount, workingSetCount } from '../../lib/milestones.js'
import { feel } from '../../lib/coach.js'
import FirstWorkoutCelebration from './FirstWorkoutCelebration.jsx'

export default function SessionSaved({ workout, onClose, onPreview }) {
  const { state, dispatch, today } = useApp()
  const [achievement] = useState(() => firstSessionAchievement(state, workout, today))
  const [celebrating, setCelebrating] = useState(Boolean(achievement))
  // The sheet replaces the full-screen milestone in place, without a fresh slide-in.
  const [fromCelebration, setFromCelebration] = useState(false)
  const felt = useRef(false)
  useEffect(() => {
    if (felt.current) return
    felt.current = true
    feel(state.settings.workout, achievement ? 'celebrate' : 'success')
  }, [achievement, state.settings.workout])
  useEffect(() => {
    if (!achievement || state.settings.milestones?.firstSession) return
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { milestones: { ...state.settings.milestones, firstSession: achievement.workoutId } },
    })
  }, [achievement, state.settings.milestones, dispatch])
  const invitation = nextVisitInvitation(workout)
  // Same counting as the tally and the milestone: working sets, warm-ups apart.
  const sets = workingSetCount(workout)
  const warmups = warmupSetCount(workout)
  // Pain or soreness means no push for more next time.
  const next = ['pain', 'soreness', 'unwell'].includes(workout.finishReason)
    ? []
    : nextTimeNotes(workout, profileOf(state), workout.unit, state.customExercises)
  // At most one optional question, chosen once when the sheet opens.
  const [question] = useState(() => {
    const saved = state.workouts.find((w) => w.id === workout.id) || workout
    return chooseQuestion(state, saved, { now: Date.now(), today })
  })
  const [answer, setAnswer] = useState(null)
  const [detail, setDetail] = useState('')
  const [hidden, setHidden] = useState(false)
  const settled = useRef(false)
  const record = (value, extra = '') => {
    settled.current = true
    dispatch({
      type: 'LEARNING_EVENT',
      event: answerEvent({
        exId: question.exId,
        question: question.question,
        value,
        place: question.place,
        workoutId: question.workoutId,
        detail: extra,
        at: Date.now(),
      }),
    })
  }
  const dismiss = () => {
    // A dismissal is never an answer; it only spaces out future questions.
    if (question && !settled.current) {
      settled.current = true
      dispatch({
        type: 'LEARNING_EVENT',
        event: dismissEvent({
          exId: question.exId,
          question: question.question,
          workoutId: question.workoutId,
          at: Date.now(),
        }),
      })
    }
  }
  const close = () => {
    if (!celebrating) dismiss()
    onClose()
  }
  const name = question ? findExercise(question.exId, state.customExercises)?.name : ''
  if (celebrating)
    return (
      <FirstWorkoutCelebration
        achievement={achievement}
        onClose={close}
        onContinue={() => {
          setFromCelebration(true)
          setCelebrating(false)
        }}
      />
    )
  return (
    <Modal
      open
      animate={!fromCelebration}
      onClose={close}
      title="Saved"
      footer={
        <button className="btn-primary min-h-12 w-full" onClick={close}>
          Done
        </button>
      }
    >
      <div className="pb-3 pt-1">
        <p className="flex items-center gap-2 text-[15px] text-ink2">
          <Icon name="check" size={18} className="text-accent" />
          {count(sets, 'set')}
          {warmups > 0 && ` + ${count(warmups, 'warm-up')}`} in History
          {workout.newBests > 0 && (
            <span className="font-semibold text-accent">· {count(workout.newBests, 'new best')}</span>
          )}
        </p>
        {question && !hidden && (
          <section className="mt-5 rounded-tuck bg-surface2 p-4" aria-labelledby="feedback-question">
            <div className="flex items-start justify-between gap-3">
              <h4 id="feedback-question" className="text-[15px] font-semibold leading-snug">
                <span className="mb-1 block text-[12px] font-normal text-muted">{name} · optional</span>
                {question.prompt}
              </h4>
              {!answer && (
                <button
                  className="icon-btn !h-9 !w-9 shrink-0"
                  aria-label="Skip this question"
                  onClick={() => {
                    dismiss()
                    setHidden(true)
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            {!answer ? (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={question.prompt}>
                {question.answers.map(([value, label]) => (
                  <button
                    key={value}
                    className="chip bg-surface"
                    onClick={() => {
                      setAnswer(value)
                      record(value)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3" role="status">
                <p className="text-[13px] text-muted">Thanks.</p>
                {answer !== 'unsure' && (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (detail.trim()) record(answer, detail)
                      setHidden(true)
                    }}
                  >
                    <input
                      className="input"
                      aria-label="Add a detail (optional)"
                      placeholder="Add a detail (optional)"
                      maxLength={140}
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                    />
                    <button className="btn-secondary shrink-0 !px-4" type="submit">
                      {detail.trim() ? 'Add' : 'Done'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        )}
        {next.length > 0 && (
          <section className="mt-6 rounded-tuck bg-surface2 p-4">
            <h4 className="text-[14px] font-semibold">Next time</h4>
            <ul className="mt-2 divide-y divide-line">
              {next.map((n) => (
                <li key={n.exId} className="py-2.5">
                  <span className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="min-w-0 truncate">{n.name}</span>
                    <span className="num shrink-0 text-[17px]">{n.change}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">{n.why}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-[15px] leading-relaxed text-ink2">{invitation.text}</p>
          <button className="btn-secondary mt-4 min-h-12 w-full" onClick={onPreview}>
            <Icon name="clock" size={17} />
            {invitation.action}
          </button>
        </div>
      </div>
    </Modal>
  )
}
