// Search the exercise catalog by name or muscle, or add your own exercise.

import { useMemo, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { allExercises, MUSCLES } from '../../lib/exercises.js'
import { uid } from '../../lib/id.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import Select from '../Select.jsx'
import { MuscleTag, Toggle } from './Controls.jsx'
import { matchesExercise } from '../../lib/exercise-search.js'
import { MOVEMENTS, availableMovement } from '../../lib/planner.js'
import { metaOf } from '../../lib/catalog/index.js'
import { count } from '../../lib/presentation.js'

const MUSCLE_ICONS = {
  Legs: 'legs',
  Glutes: 'legs',
  Chest: 'push',
  Back: 'pull',
  Shoulders: 'upper',
  Biceps: 'train',
  Triceps: 'train',
  Core: 'full',
  Cardio: 'heart',
  Mobility: 'repeat',
}

export default function ExercisePicker({ open, onClose, onPick, filterExercise, browse = false }) {
  const { state, dispatch, toast } = useApp()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState(null)
  const [creating, setCreating] = useState(false)
  const [scope, setScope] = useState('all')
  const searchInput = useRef(null)
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
                : !e.weighted && !metaOf(e.id))))
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
          <div className="library-filters">
            <div className="relative">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={searchInput}
                value={query}
                aria-label="Search exercises by name or muscle"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises"
                className="input pl-10 pr-12"
                autoFocus={!browse}
              />
              {query && (
                <button
                  className="search-clear"
                  aria-label="Clear exercise search"
                  onClick={() => {
                    setQuery('')
                    searchInput.current?.focus()
                  }}
                >
                  <Icon name="x" size={17} />
                </button>
              )}
            </div>
            <div className="segmented mt-3 !bg-surface2" role="group" aria-label="Exercise collections">
              {[
                ['all', 'All'],
                ['favorites', 'Saved'],
                ['recent', 'Recent'],
                ['home', 'At home'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`segment ${scope === id ? 'segment-active' : ''}`}
                  aria-pressed={scope === id}
                  onClick={() => setScope(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 pb-2">
              <p className="text-[13px] text-muted" role="status">
                {count(list.length, 'exercise')}
              </p>
              <Select
                label="Muscle group"
                variant="chip"
                value={muscle}
                onChange={setMuscle}
                options={[[null, 'All muscles'], ...MUSCLES.map((m) => [m, m])]}
              />
            </div>
          </div>

          <ul className="mt-3 divide-y divide-line">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => pick(e)}
                  className="flex min-h-[76px] w-full items-center gap-3 py-3 text-left"
                >
                  <span className="icon-tile !h-10 !w-10">
                    <Icon name={MUSCLE_ICONS[e.muscle] || 'train'} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-ink">{e.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                      <MuscleTag muscle={e.muscle} />
                      {e.type === 'time' ? 'Timed' : e.weighted ? 'Weight × reps' : 'Reps'}
                    </div>
                  </div>
                  <Icon name={browse ? 'chevronRight' : 'plus'} size={20} className="shrink-0 text-accent" />
                </button>
              </li>
            ))}
          </ul>
          {list.length === 0 && (
            <div className="library-empty">
              <span className="icon-tile mx-auto mb-3">
                <Icon
                  name={scope === 'favorites' ? 'star' : scope === 'recent' ? 'history' : 'search'}
                  size={23}
                />
              </span>
              <h3 className="text-[17px] font-semibold">
                {query || muscle
                  ? 'No matches for those filters'
                  : scope === 'favorites'
                    ? 'Your saved exercises go here'
                    : scope === 'recent'
                      ? 'Your recent exercises go here'
                      : 'No exercises fit this setup'}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {scope === 'favorites' && !query && !muscle
                  ? 'Save one from its exercise guide.'
                  : scope === 'recent' && !query && !muscle
                    ? 'They appear after you log a session.'
                    : 'Try another muscle group or search term.'}
              </p>
              <button
                className="btn-secondary mt-4"
                onClick={() => {
                  setQuery('')
                  setMuscle(null)
                  setScope('all')
                }}
              >
                Browse all exercises
              </button>
            </div>
          )}

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
