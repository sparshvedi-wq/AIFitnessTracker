// Search the exercise catalog by name or muscle, or add your own exercise.

import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { allExercises, MUSCLES } from '../../lib/exercises.js'
import { uid } from '../../lib/id.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { MuscleTag, Toggle } from './Controls.jsx'
import { matchesExercise } from '../../lib/exercise-search.js'
import { MOVEMENTS, availableMovement } from '../../lib/planner.js'

export default function ExercisePicker({ open, onClose, onPick, filterExercise, browse = false }) {
  const { state, dispatch, toast } = useApp()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState(null)
  const [creating, setCreating] = useState(false)
  const [scope, setScope] = useState('all')
  const favorites = useMemo(() => state.settings.favoriteExercises || [], [state.settings.favoriteExercises])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const recent = [
      ...new Set(
        state.workouts
          .filter((w) => !w.sample)
          .slice()
          .reverse()
          .flatMap((w) => w.exercises.map((e) => e.exId)),
      ),
    ]
    return allExercises(state.customExercises)
      .filter((e) => {
        const meta = MOVEMENTS.find((m) => m.id === e.id)
        return (
          (!filterExercise || filterExercise(e)) &&
          (!muscle || e.muscle === muscle) &&
          (!q || matchesExercise(e, q)) &&
          (scope === 'all' ||
            (scope === 'favorites' && favorites.includes(e.id)) ||
            (scope === 'recent' && recent.includes(e.id)) ||
            (scope === 'home' &&
              (meta
                ? availableMovement(meta, 'home', state.settings.training.equipment)
                : !e.weighted && !['pull-up', 'dip'].includes(e.id))))
        )
      })
      .sort(
        (a, b) =>
          Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) ||
          (recent.includes(b.id) ? 1 : 0) - (recent.includes(a.id) ? 1 : 0) ||
          a.name.localeCompare(b.name),
      )
  }, [state.customExercises, state.workouts, state.settings, favorites, query, muscle, filterExercise, scope])

  function close() {
    setQuery('')
    setMuscle(null)
    setCreating(false)
    setScope('all')
    onClose()
  }

  function pick(e) {
    onPick(e)
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={creating ? 'New exercise' : browse ? 'Exercise library' : 'Add exercise'}
      headerAction={
        !creating && !filterExercise ? (
          <button className="icon-btn" aria-label="Create custom exercise" onClick={() => setCreating(true)}>
            <Icon name="plus" size={20} />
          </button>
        ) : null
      }
    >
      {creating ? (
        <NewExerciseForm
          initialName={query}
          onCancel={() => setCreating(false)}
          onSave={(ex) => {
            dispatch({ type: 'SAVE_EXERCISE', exercise: ex })
            toast(`${ex.name} added`)
            pick(ex)
          }}
        />
      ) : (
        <>
          <div className="relative">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises"
              className="input pl-10"
              autoFocus
            />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {[
              ['all', 'All'],
              ['recent', 'Recent'],
              ['favorites', 'Saved'],
              ['home', 'My home setup'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`chip ${scope === id ? 'chip-active' : 'bg-surface2'}`}
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            <button onClick={() => setMuscle(null)} className={`chip ${!muscle ? 'chip-active' : ''}`}>
              All
            </button>
            {MUSCLES.map((m) => (
              <button
                key={m}
                onClick={() => setMuscle(muscle === m ? null : m)}
                className={`chip ${muscle === m ? 'chip-active' : ''}`}
              >
                {m}
              </button>
            ))}
          </div>

          <ul className="mt-3 divide-y divide-line">
            {list.map((e) => (
              <li key={e.id}>
                <button onClick={() => pick(e)} className="flex w-full items-center gap-3 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{e.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                      <MuscleTag muscle={e.muscle} />
                      {e.type === 'time' ? 'Timed' : e.weighted ? 'Weight × reps' : 'Bodyweight reps'}
                    </div>
                  </div>
                  <Icon name={browse ? 'chevronRight' : 'plus'} size={20} className="shrink-0 text-accent" />
                </button>
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="py-6 text-center text-sm text-muted">No exercises match.</p>}

          {!filterExercise && (
            <button onClick={() => setCreating(true)} className="btn-secondary mt-3 w-full">
              <Icon name="pencil" size={17} />
              Create your own exercise
            </button>
          )}
        </>
      )}
    </Modal>
  )
}

function NewExerciseForm({ initialName, onSave, onCancel }) {
  const [name, setName] = useState(initialName)
  const [muscle, setMuscle] = useState('Legs')
  const [type, setType] = useState('reps')
  const [weighted, setWeighted] = useState(true)
  const [cue, setCue] = useState('')

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="field-label">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="e.g. Hip thrust"
          autoFocus
        />
      </label>
      <div>
        <span className="field-label">Muscle group</span>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <button
              key={m}
              onClick={() => setMuscle(m)}
              className={`chip ${muscle === m ? 'chip-active' : ''}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="field-label">Tracked by</span>
        <div className="segmented">
          <button
            onClick={() => setType('reps')}
            className={`segment ${type === 'reps' ? 'segment-active' : ''}`}
          >
            Reps
          </button>
          <button
            onClick={() => setType('time')}
            className={`segment ${type === 'time' ? 'segment-active' : ''}`}
          >
            Time
          </button>
        </div>
      </div>
      {type === 'reps' && (
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium text-ink">Uses weight</span>
          <Toggle checked={weighted} onChange={setWeighted} label="Uses weight" />
        </div>
      )}
      <label className="block">
        <span className="field-label">Form tip (optional)</span>
        <input
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          className="input"
          placeholder="Shown during the set"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary">
          Back
        </button>
        <button
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              id: `custom-${uid()}`,
              name: name.trim(),
              muscle,
              type,
              weighted: type === 'reps' && weighted,
              cues: cue.trim() ? [cue.trim()] : [],
              custom: true,
            })
          }
          className="btn-primary"
        >
          Add exercise
        </button>
      </div>
    </div>
  )
}
