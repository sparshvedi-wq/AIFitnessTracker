// Create or edit a routine: name, style (straight sets or circuit), and the
// exercises with sets, reps or seconds, starting weight and rest.

import { useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { findExercise } from '../../lib/exercises.js'
import { estimateMinutes } from '../../lib/workout.js'
import { uid } from '../../lib/id.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import ExercisePicker from './ExercisePicker.jsx'
import { MuscleTag } from './Controls.jsx'
import { DUMBBELL_MOVES } from '../../lib/preferences.js'

const blank = () => ({ id: uid(), name: '', circuit: false, items: [] })

// `routine` may be an existing routine, a template to copy, or null for a new one.
export default function RoutineEditor(props) {
  return props.open ? <RoutineDraft key={props.routine?.id || 'new'} {...props} /> : null
}
function RoutineDraft({ open, routine, onClose }) {
  const { state, dispatch, toast } = useApp()
  const [draft, setDraft] = useState(() => {
    if (!routine) return blank()
    if (state.routines.some((r) => r.id === routine.id)) return structuredClone(routine)
    const { blurb, level, ...rest } = routine
    return { ...structuredClone(rest), id: uid(), name: routine.name }
  })
  const [initialDraft] = useState(() => JSON.stringify(draft))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const close = () => (JSON.stringify(draft) !== initialDraft ? setConfirmDiscard(true) : onClose())
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [itemActions, setItemActions] = useState(null)
  const itemButtons = useRef(new Map())
  const addButton = useRef(null)
  const closeItemActions = (index = itemActions) => {
    setItemActions(null)
    requestAnimationFrame(() =>
      (itemButtons.current.get(index) || addButton.current)?.focus({ preventScroll: true }),
    )
  }
  const unit = state.settings.weightUnit
  const isExisting = Boolean(routine && state.routines.some((r) => r.id === routine.id))

  const setItem = (i, patch) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))
  const move = (i, dir) =>
    setDraft((d) => {
      const items = d.items.slice()
      const j = i + dir
      if (j < 0 || j >= items.length) return d
      ;[items[i], items[j]] = [items[j], items[i]]
      return { ...d, items }
    })
  const remove = (i) => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))

  function addExercise(def) {
    const item =
      def.type === 'time'
        ? { exId: def.id, sets: 3, sec: 30, restSec: draft.circuit ? 15 : 45 }
        : { exId: def.id, sets: 3, reps: 10, restSec: draft.circuit ? 15 : 90 }
    setDraft((d) => ({ ...d, items: [...d.items, item] }))
  }

  function save() {
    const name = draft.name.trim() || 'My workout'
    dispatch({ type: 'SAVE_ROUTINE', routine: { ...draft, name } })
    toast(isExisting ? 'Routine updated' : 'Routine saved')
    onClose()
  }

  const canSave = draft.items.length > 0

  return (
    <>
      <Modal
        open={open}
        onClose={picking || confirmDelete || confirmDiscard || itemActions !== null ? () => {} : close}
        title={isExisting ? 'Edit routine' : 'New routine'}
        footer={
          <div className="flex gap-2">
            {isExisting && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="btn-danger-ghost px-3"
                aria-label="Delete routine"
              >
                <Icon name="trash" size={18} />
              </button>
            )}
            <button onClick={save} disabled={!canSave} className="btn-primary flex-1">
              Save routine
            </button>
          </div>
        }
      >
        <label className="block">
          <span className="field-label">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="input"
            placeholder="e.g. Push day"
          />
        </label>

        <div className="mt-4">
          <span className="field-label">Order</span>
          <div className="segmented">
            <button
              onClick={() => setDraft((d) => ({ ...d, circuit: false }))}
              className={`segment ${!draft.circuit ? 'segment-active' : ''}`}
            >
              Straight sets
            </button>
            <button
              onClick={() => setDraft((d) => ({ ...d, circuit: true }))}
              className={`segment ${draft.circuit ? 'segment-active' : ''}`}
            >
              Circuit
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[13px] text-muted">
            {draft.circuit
              ? 'One set of each, round after round.'
              : 'All sets of one exercise, then the next.'}
          </p>
        </div>

        <div className="mb-2 mt-5 flex items-center justify-between">
          <h3 className="section-title px-0">Exercises</h3>
          {canSave && <span className="text-[13px] text-muted">About {estimateMinutes(draft)} min</span>}
        </div>

        {draft.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Add your first exercise to get started.
          </div>
        )}

        <ul className="space-y-2.5">
          {draft.items.map((item, i) => {
            const def = findExercise(item.exId, state.customExercises)
            if (!def) return null
            const timed = def.type === 'time'
            return (
              <li key={`${item.exId}-${i}`} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface2 text-[12px] font-bold text-ink2">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-ink">{def.name}</p>
                    <MuscleTag muscle={def.muscle} />
                  </div>
                  <button
                    ref={(node) => {
                      if (node) itemButtons.current.set(i, node)
                      else itemButtons.current.delete(i)
                    }}
                    onClick={() => setItemActions(i)}
                    className="icon-btn -mr-1 -mt-1"
                    aria-label={`Options for ${def.name}`}
                  >
                    <Icon name="more" size={20} />
                  </button>
                </div>
                <fieldset
                  className={`mt-3 grid gap-2 ${def.weighted ? 'grid-cols-2 min-[380px]:grid-cols-4' : 'grid-cols-3'}`}
                >
                  <legend className="sr-only">Targets for {def.name}</legend>
                  <MiniField
                    label="Sets"
                    value={item.sets}
                    onChange={(v) => setItem(i, { sets: Math.max(1, v) })}
                  />
                  {timed ? (
                    <MiniField
                      label="Seconds"
                      value={item.sec}
                      onChange={(v) => setItem(i, { sec: Math.max(5, v) })}
                    />
                  ) : (
                    <MiniField
                      label="Reps"
                      value={item.reps}
                      onChange={(v) => setItem(i, { reps: Math.max(1, v) })}
                    />
                  )}
                  {def.weighted && (
                    <MiniField
                      label={DUMBBELL_MOVES.includes(def.id) ? `${unit} each` : `Weight · ${unit}`}
                      decimals
                      value={item.weight ?? ''}
                      placeholder="—"
                      onChange={(v) => setItem(i, { weight: v || null })}
                    />
                  )}
                  <MiniField
                    label="Rest (s)"
                    value={item.restSec}
                    onChange={(v) => setItem(i, { restSec: v })}
                  />
                </fieldset>
              </li>
            )
          })}
        </ul>

        <button ref={addButton} onClick={() => setPicking(true)} className="btn-secondary mt-3 w-full">
          <Icon name="plus" size={18} strokeWidth={2.5} />
          Add exercise
        </button>
      </Modal>

      {itemActions !== null && (
        <Modal
          open
          title="Exercise options"
          subtitle={findExercise(draft.items[itemActions]?.exId, state.customExercises)?.name}
          onClose={() => closeItemActions()}
        >
          <div className="mt-2 divide-y divide-line">
            {[
              [-1, 'Move earlier', 'arrowUp'],
              [1, 'Move later', 'arrowDown'],
            ].map(([direction, label, icon]) => (
              <button
                key={label}
                disabled={itemActions + direction < 0 || itemActions + direction >= draft.items.length}
                className="list-row disabled:opacity-35"
                onClick={() => {
                  move(itemActions, direction)
                  closeItemActions(itemActions + direction)
                }}
              >
                <Icon name={icon} size={20} />
                <span className="font-semibold">{label}</span>
              </button>
            ))}
            <button
              className="list-row text-danger"
              onClick={() => {
                remove(itemActions)
                closeItemActions(Math.min(itemActions, draft.items.length - 2))
              }}
            >
              <Icon name="trash" size={20} />
              <span className="font-semibold">Remove from routine</span>
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard routine changes?"
        message="Your saved routine stays unchanged."
        confirmLabel="Discard changes"
        onConfirm={onClose}
        onClose={() => setConfirmDiscard(false)}
      />
      <ExercisePicker
        open={picking}
        onClose={() => {
          setPicking(false)
          requestAnimationFrame(() => addButton.current?.focus({ preventScroll: true }))
        }}
        onPick={addExercise}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete routine?"
        message={`"${draft.name || 'This routine'}" will be removed. Past workouts stay in your history.`}
        onConfirm={() => {
          dispatch({ type: 'DELETE_ROUTINE', id: draft.id })
          toast('Routine deleted', 'info')
          onClose()
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}

function MiniField({ label, value, onChange, placeholder, decimals = false }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-center text-[12px] font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode={decimals ? 'decimal' : 'numeric'}
        step={decimals ? 'any' : '1'}
        min="0"
        value={value}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const parsed = Number(e.target.value)
          const n = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
          onChange(decimals ? n : Math.round(n))
        }}
        className="input px-2 py-2 text-center tabular-nums"
      />
    </label>
  )
}
