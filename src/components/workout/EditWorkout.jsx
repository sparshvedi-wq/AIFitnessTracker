import { useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { correctWorkout } from '../../lib/workout-history.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'

export default function EditWorkout({ workout, onClose, onSaved }) {
  const { dispatch, today, toast } = useApp()
  const [date, setDate] = useState(workout.date)
  const [note, setNote] = useState(workout.note || '')
  const [exercises, setExercises] = useState(workout.exercises)
  const [error, setError] = useState('')
  const patch = (i, j, key, value) => {
    setError('')
    setExercises((all) =>
      all.map((e, n) =>
        n === i ? { ...e, sets: e.sets.map((s, m) => (m === j ? { ...s, [key]: value } : s)) } : e,
      ),
    )
  }
  // A set logged by mistake can be removed; the last set removes the exercise.
  const removeSet = (i, j) => {
    setError('')
    setExercises((all) =>
      all
        .map((e, n) => (n === i ? { ...e, sets: e.sets.filter((_, m) => m !== j) } : e))
        .filter((e) => e.sets.length > 0),
    )
  }
  const removeExercise = (i) => {
    setError('')
    setExercises((all) => all.filter((_, n) => n !== i))
  }
  const toggleWarmup = (i, j) =>
    setExercises((all) =>
      all.map((e, n) =>
        n === i ? { ...e, sets: e.sets.map((s, m) => (m === j ? { ...s, kind: s.kind === 'warmup' ? 'work' : 'warmup' } : s)) } : e,
      ),
    )
  const save = () => {
    if (!exercises.length) {
      setError('Keep at least one exercise, or delete the whole workout instead.')
      return
    }
    try {
      const updated = correctWorkout(workout, { date, note, exercises }, today)
      dispatch({ type: 'UPDATE_WORKOUT', workout: updated })
      toast('Workout corrected · stats updated')
      onSaved(updated)
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit logged workout"
      footer={
        <div>
          {error && (
            <p role="alert" className="mb-3 text-[14px] text-danger">
              {error}
            </p>
          )}
          <button className="btn-primary min-h-12 w-full" onClick={save}>
            Save corrections
          </button>
        </div>
      }
    >
      <label className="mt-4 block text-[14px]">
        Workout date
        <input
          aria-label="Workout date"
          type="date"
          max={today}
          value={date}
          onInput={(e) => setDate(e.target.value)}
          className="input mt-2"
        />
      </label>
      {exercises.map((e, i) => (
        <section key={`${e.exId}-${i}`} className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-[16px] font-semibold">{e.name}</h3>
            {exercises.length > 1 && (
              <button
                type="button"
                className="min-h-11 shrink-0 px-2 text-[13px] text-danger"
                onClick={() => removeExercise(i)}
              >
                Remove exercise
              </button>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {e.sets.map((s, j) => (
              <div key={j} className="flex items-end gap-3 rounded-2xl bg-surface2 p-3">
                <span className="flex min-h-12 min-w-8 items-center text-[13px] text-muted">{j + 1}</span>
                <label className="min-w-0 flex-1 text-[12px] text-muted">
                  {e.type === 'time' ? 'Seconds' : 'Reps'}
                  <input
                    aria-label={`${e.name} set ${j + 1} ${e.type === 'time' ? 'seconds' : 'reps'}`}
                    className="input mt-1 !bg-bg"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    value={e.type === 'time' ? s.sec : s.reps}
                    onChange={(ev) => patch(i, j, e.type === 'time' ? 'sec' : 'reps', ev.target.value)}
                  />
                </label>
                {e.weighted && (
                  <label className="min-w-0 flex-1 text-[12px] text-muted">
                    {workout.unit}
                    <input
                      aria-label={`${e.name} set ${j + 1} weight`}
                      className="input mt-1 !bg-bg"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={s.weight ?? ''}
                      onChange={(ev) => patch(i, j, 'weight', ev.target.value)}
                    />
                  </label>
                )}
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={s.kind === 'warmup'}
                    aria-label={`${e.name} set ${j + 1}: ${s.kind === 'warmup' ? 'warm-up, tap to make it a working set' : 'working set, tap to make it a warm-up'}`}
                    className={`chip min-h-8 px-2 text-[11px] ${s.kind === 'warmup' ? 'chip-active' : 'bg-bg'}`}
                    onClick={() => toggleWarmup(i, j)}
                  >
                    Warm-up
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${e.name} set ${j + 1}`}
                    className="icon-btn !h-9 !w-9 text-muted"
                    onClick={() => removeSet(i, j)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <label className="mt-6 block text-[14px]">
        Workout notes
        <textarea
          aria-label="Workout notes"
          className="input mt-2"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <p className="mt-4 text-[13px] text-muted">Your history and future plans update.</p>
    </Modal>
  )
}
