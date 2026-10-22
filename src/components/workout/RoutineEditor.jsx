// Create or edit a routine: name, style (straight sets or circuit), and the
// exercises with sets, reps or seconds, starting weight and rest.

import { useEffect, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { findExercise } from '../../lib/exercises.js'
import { estimateMinutes } from '../../lib/workout.js'
import { uid } from '../../lib/id.js'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import ExercisePicker from './ExercisePicker.jsx'
import { MuscleTag } from './Controls.jsx'

const blank = () => ({ id: uid(), name: '', circuit: false, items: [] })

// `routine` may be an existing routine, a template to copy, or null for a new one.
export default function RoutineEditor({ open, routine, onClose }) {
  const { state, dispatch, toast } = useApp()
  const [draft, setDraft] = useState(blank)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const unit = state.settings.weightUnit
  const isExisting = Boolean(routine && state.routines.some((r) => r.id === routine.id))

  useEffect(() => {
    if (!open) return
    if (!routine) setDraft(blank())
    else if (isExisting) setDraft(structuredClone(routine))
    else {
      // Copy of a starter routine
      const { blurb, level, ...rest } = routine
      setDraft({ ...structuredClone(rest), id: uid(), name: routine.name })
    }
  }, [open, routine, isExisting])

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
    const item = def.type === 'time'
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
        onClose={picking || confirmDelete ? () => {} : onClose}
        title={isExisting ? 'Edit routine' : 'New routine'}
        footer={
          <div className="flex gap-2">
            {isExisting && (
              <button onClick={() => setConfirmDelete(true)} className="btn-danger-ghost px-3" aria-label="Delete routine">
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
            <button onClick={() => setDraft((d) => ({ ...d, circuit: false }))} className={`segment ${!draft.circuit ? 'segment-active' : ''}`}>
              Straight sets
            </button>
            <button onClick={() => setDraft((d) => ({ ...d, circuit: true }))} className={`segment ${draft.circuit ? 'segment-active' : ''}`}>
              Circuit
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[13px] text-muted">
            {draft.circuit
              ? 'One set of each exercise per round, then start the next round.'
              : 'Finish every set of an exercise before moving to the next.'}
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
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface2 text-[12px] font-bold text-ink2">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{def.name}</p>
                    <MuscleTag muscle={def.muscle} />
                  </div>
                  <div className="-mr-1 -mt-1 flex">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="icon-btn h-8 w-8 disabled:opacity-30" aria-label="Move up">
                      <Icon name="arrowUp" size={16} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === draft.items.length - 1} className="icon-btn h-8 w-8 disabled:opacity-30" aria-label="Move down">
                      <Icon name="arrowDown" size={16} />
                    </button>
                    <button onClick={() => remove(i)} className="icon-btn h-8 w-8 hover:text-danger" aria-label={`Remove ${def.name}`}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
                <div className={`mt-3 grid gap-2 ${def.weighted ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <MiniField label="Sets" value={item.sets} onChange={(v) => setItem(i, { sets: Math.max(1, v) })} />
                  {timed ? (
                    <MiniField label="Seconds" value={item.sec} onChange={(v) => setItem(i, { sec: Math.max(5, v) })} />
                  ) : (
                    <MiniField label="Reps" value={item.reps} onChange={(v) => setItem(i, { reps: Math.max(1, v) })} />
                  )}
                  {def.weighted && (
                    <MiniField label={unit} value={item.weight ?? ''} placeholder="—" onChange={(v) => setItem(i, { weight: v || null })} />
                  )}
                  <MiniField label="Rest s" value={item.restSec} onChange={(v) => setItem(i, { restSec: v })} />
                </div>
              </li>
            )
          })}
        </ul>

        <button onClick={() => setPicking(true)} className="btn-secondary mt-3 w-full">
          <Icon name="plus" size={18} strokeWidth={2.5} />
          Add exercise
        </button>
      </Modal>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addExercise} />
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

function MiniField({ label, value, onChange, placeholder }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block truncate text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="input px-2 py-2 text-center tabular-nums"
      />
    </label>
  )
}
