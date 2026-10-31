// Exercise guide: real technique cues, muscle information and common mistakes.

import { useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { formGuide } from '../../lib/form.js'
import { useApp } from '../../store/AppContext.jsx'
import { atPlace, exerciseNote, withExerciseNote } from '../../lib/exercise-notes.js'

const TABS = ['Technique', 'Muscles', 'Mistakes']

export default function FormSheet(props) {
  return props.open && props.exercise ? <GuideContent key={props.exercise.exId} {...props} /> : null
}
function GuideContent({
  open,
  onClose,
  exercise,
  location,
  placeName,
  closeLabel = 'Back to workout',
  onStart,
}) {
  const { state, dispatch, toast } = useApp()
  const [tab, setTab] = useState(0)
  const [note, setNote] = useState(() => exerciseNote(state.settings.exerciseNotes, exercise.exId, location))
  if (!exercise) return null
  const guide = formGuide(exercise.exId, exercise.muscle)
  const excluded = (state.settings.training.excludedExercises || []).includes(exercise.exId)
  const items =
    tab === 0
      ? exercise.cues.map((c) => ({ t: c }))
      : tab === 1
        ? [
            { t: guide.muscles.primary, s: 'Main muscles' },
            guide.muscles.secondary && { t: guide.muscles.secondary, s: 'Also working' },
          ].filter(Boolean)
        : guide.mistakes.map((m) => ({ t: m }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exercise guide"
      subtitle={exercise.name}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className={`${onStart ? 'btn-secondary' : 'btn-primary'} min-h-12 flex-1`}
          >
            {closeLabel}
          </button>
          {onStart && (
            <button className="btn-primary min-h-12 flex-1" onClick={onStart}>
              Review session
            </button>
          )}
        </div>
      }
    >
      <div className="no-scrollbar -mx-[22px] mt-4 flex gap-1.5 overflow-x-auto px-[22px]">
        {TABS.map((t, i) => (
          <button
            key={t}
            aria-pressed={tab === i}
            onClick={() => setTab(i)}
            className={`chip ${tab === i ? 'chip-active' : 'bg-surface2'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <ol className="mt-4 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-surface2 px-4 py-4">
            <span
              className={`dot mt-0.5 h-7 w-7 ${tab === 2 ? 'text-muted' : 'num text-[16px] text-accent'}`}
            >
              {tab === 2 ? (
                <Icon name="info" size={17} />
              ) : tab === 1 ? (
                <Icon name={i === 0 ? 'target' : 'train'} size={19} />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0 flex-1">
              {it.s && <span className="mb-1 block text-[12px] text-muted">{it.s}</span>}
              <span className="block text-[14px] leading-relaxed">{it.t}</span>
            </span>
          </li>
        ))}
      </ol>
      {exercise.note && (
        <details className="mt-4 border-t border-line text-[13px] text-muted">
          <summary className="min-h-11 cursor-pointer py-3">Why this exercise</summary>
          <p className="pb-3 leading-relaxed">{exercise.note}</p>
        </details>
      )}
      <details className="mt-4 border-t border-line">
        <summary className="min-h-12 cursor-pointer py-3 text-[14px] font-semibold">
          Your notes & saved exercises
        </summary>
        <label className="block text-[13px] text-muted">
          {location && placeName
            ? `A reminder for next time ${atPlace(placeName)}`
            : 'A reminder for next time'}
          <textarea
            aria-label="Exercise note"
            className="input mt-2"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Seat height, grip, or a cue that helps"
          />
        </label>
        <button
          className="btn-secondary mt-3 w-full"
          onClick={() => {
            dispatch({
              type: 'UPDATE_SETTINGS',
              patch: {
                exerciseNotes: withExerciseNote(state.settings.exerciseNotes, exercise.exId, location, note),
              },
            })
            toast('Exercise note saved')
          }}
        >
          Save note
        </button>
        <button
          className="btn-ghost mt-2 w-full"
          aria-pressed={(state.settings.favoriteExercises || []).includes(exercise.exId)}
          onClick={() => {
            const favorites = state.settings.favoriteExercises || []
            dispatch({
              type: 'UPDATE_SETTINGS',
              patch: {
                favoriteExercises: favorites.includes(exercise.exId)
                  ? favorites.filter((id) => id !== exercise.exId)
                  : [...favorites, exercise.exId],
              },
            })
          }}
        >
          {(state.settings.favoriteExercises || []).includes(exercise.exId)
            ? 'Remove from saved exercises'
            : 'Save exercise'}
        </button>
        <button
          className="btn-ghost w-full"
          aria-pressed={excluded}
          onClick={() => {
            const list = state.settings.training.excludedExercises || []
            dispatch({
              type: 'UPDATE_SETTINGS',
              patch: {
                training: {
                  ...state.settings.training,
                  excludedExercises: excluded
                    ? list.filter((id) => id !== exercise.exId)
                    : [...list, exercise.exId],
                },
              },
            })
            toast(
              excluded
                ? `${exercise.name} can be suggested again`
                : `${exercise.name} won’t be suggested. You can still add it yourself.`,
              'info',
            )
          }}
        >
          {excluded ? 'Suggest this exercise again' : 'Don’t suggest this exercise'}
        </button>
      </details>
    </Modal>
  )
}
