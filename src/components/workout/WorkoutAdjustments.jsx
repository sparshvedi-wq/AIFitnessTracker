import { useState } from 'react'
import Modal from '../Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { currentSet, lastPerformance, describeSets } from '../../lib/workout.js'
import { replacementOptions, replaceCurrentExercise, shortenSession } from '../../lib/workout-adjustments.js'

export default function WorkoutAdjustments({ mode, session, onClose, onApply }) {
  const { state, dispatch, toast } = useApp()
  const [remember, setRemember] = useState(false)
  const [minutes, setMinutes] = useState(10)
  const cur = currentSet(session)
  const choices = replacementOptions(state, session)
  const swap = (def) => {
    if (remember && cur)
      dispatch({
        type: 'UPDATE_SETTINGS',
        patch: {
          training: {
            ...state.settings.training,
            replacements: { ...state.settings.training.replacements, [cur.ex.exId]: def.id },
          },
        },
      })
    onApply((s, now) => replaceCurrentExercise(s, def, state, now))
    toast(remember ? 'Exercise swapped · preference remembered' : 'Swapped for this session')
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'swap' ? 'Use another exercise' : 'Less time today?'}
      subtitle={mode === 'swap' ? cur?.ex.name : 'Keep what you logged. Shorten only what is left.'}
      footer={
        mode === 'shorten' ? (
          <button
            className="btn-primary min-h-12 w-full"
            onClick={() => {
              onApply((s, now) => shortenSession(s, minutes, now))
              toast('Remaining work shortened · no catch-up required', 'info')
            }}
          >
            Fit remaining work to {minutes} min
          </button>
        ) : null
      }
    >
      {mode === 'swap' ? (
        <>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            These fit your equipment and comfort. Logged sets stay saved.
          </p>
          <div className="mt-4 divide-y divide-line">
            {choices.map((def) => {
              const last = lastPerformance(
                state.workouts.filter((w) => w.unit === session.unit),
                def.id,
              )
              return (
                <button key={def.id} onClick={() => swap(def)} className="min-h-16 w-full py-4 text-left">
                  <span className="block text-[16px] font-semibold">{def.name}</span>
                  <span className="mt-1 block text-[13px] text-muted">
                    {last
                      ? 'Last: ' + describeSets({ ...def, sets: last.sets }, session.unit)
                      : def.weighted
                        ? 'First time · choose a comfortable starting weight'
                        : def.type === 'time'
                          ? 'Timed movement · no added load'
                          : 'Bodyweight · no added load'}
                  </span>
                </button>
              )
            })}
          </div>
          {!choices.length && (
            <p className="mt-5 rounded-tuck bg-surface2 p-4 text-[14px]">
              Nothing fits here. Skip it, or change your preferences.
            </p>
          )}
          <label className="mt-4 flex min-h-12 items-center gap-3 text-[14px]">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Use this swap next time too
          </label>
        </>
      ) : (
        <>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Only the work that’s left changes. Your logged sets stay as they are.
          </p>
          <fieldset className="mt-5">
            <legend className="mb-3 text-[14px] font-semibold">Time you have left</legend>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((n) => (
                <button
                  key={n}
                  aria-pressed={minutes === n}
                  className={
                    'min-h-14 rounded-2xl border text-[18px] ' +
                    (minutes === n ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface2')
                  }
                  onClick={() => setMinutes(n)}
                >
                  {n} min
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </Modal>
  )
}
