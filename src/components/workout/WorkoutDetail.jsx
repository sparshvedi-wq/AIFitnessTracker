// A finished workout: totals, records, every exercise, then repeat or delete.

import { useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { TEMPLATES } from '../../lib/exercises.js'
import { describeSets, fmtDuration, fmtNum } from '../../lib/workout.js'
import { DAYS_LONG, MONTHS_LONG, fromKey } from '../../lib/date.js'
import Icon from '../Icon.jsx'
import Modal from '../Modal.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { EFFORT } from './WorkoutSummary.jsx'

export default function WorkoutDetail({ workout, onClose, onRepeat }) {
  const { state, dispatch, toast } = useApp()
  const [confirm, setConfirm] = useState(false)
  if (!workout) return null
  const routine = state.routines.find((r) => r.id === workout.routineId) || TEMPLATES.find((t) => t.id === workout.routineId)
  const effort = EFFORT.find((e) => e.value === workout.effort)
  const d = fromKey(workout.date)
  const t = workout.totals
  const cells = [
    { l: 'Time', v: fmtDuration(workout.durationSec) },
    { l: 'Sets', v: t.sets },
    t.volume > 0 ? { l: 'Volume', v: `${fmtNum(t.volume)}`, u: workout.unit } : { l: 'Reps', v: t.reps },
  ]

  return (
    <>
      <Modal
        open={!confirm}
        onClose={onClose}
        title={workout.name}
        subtitle={`${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setConfirm(true)} className="icon-btn h-[50px] w-[50px] bg-surface2 text-danger" aria-label="Delete workout">
              <Icon name="trash" size={18} />
            </button>
            {routine && onRepeat && (
              <button onClick={() => onRepeat(routine)} className="btn-primary h-[50px] flex-1">
                <Icon name="repeat" size={17} />
                Do it again
              </button>
            )}
          </div>
        }
      >
        <div className="mt-2 grid grid-cols-3 gap-2">
          {cells.map((c) => (
            <div key={c.l} className="rounded-2xl bg-surface2 px-3 py-3">
              <p className="text-[12px] text-muted">{c.l}</p>
              <p className="mt-1.5 flex items-baseline gap-1">
                <span className="num text-[22px] text-ink">{c.v}</span>
                {c.u && <span className="text-[12px] text-muted">{c.u}</span>}
              </p>
            </div>
          ))}
        </div>

        {workout.records?.length > 0 && (
          <div className="mt-3 space-y-1 rounded-tuck bg-accent/10 px-4 py-3">
            {workout.records.map((r) => (
              <p key={r.exId} className="flex items-center gap-2 text-[14px]">
                <span className="badge">New best</span>
                <span className="font-semibold text-ink">{r.name}</span>
                <span className="truncate text-ink2">{r.label}</span>
              </p>
            ))}
          </div>
        )}

        <ul className="mt-3">
          {workout.exercises.map((e, i) => (
            <li key={`${e.exId}-${i}`} className={`flex items-center justify-between gap-3 py-3 ${i ? 'border-t border-line' : ''}`}>
              <span className="text-[15px] font-medium text-ink">{e.name}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-muted">{describeSets(e, workout.unit)}</span>
            </li>
          ))}
        </ul>

        {(effort || workout.note) && (
          <div className="mt-2 space-y-1 text-[14px] text-ink2">
            {effort && <p><span className="text-muted">Felt</span> {effort.label.toLowerCase()}</p>}
            {workout.note && <p className="whitespace-pre-wrap">{workout.note}</p>}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Delete this workout?"
        message="It will be removed from your history and weekly stats."
        onConfirm={() => {
          dispatch({ type: 'DELETE_WORKOUT', id: workout.id })
          toast('Workout deleted', 'info', { label: 'Undo', onClick: () => dispatch({ type: 'RESTORE_WORKOUT', workout }) })
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
