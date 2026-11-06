import { useMemo, useRef, useState } from 'react'
import Modal from '../Modal.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { currentSet, lastPerformance, describeSets } from '../../lib/workout.js'
import { replacementOptions, replaceCurrentExercise, shortenSession } from '../../lib/workout-adjustments.js'
import { applyReplan, previewReplan } from '../../lib/engine/replan.js'
import { profileOf } from '../../lib/planner.js'
import { placeSummary, placesOf } from '../../lib/places.js'

export default function WorkoutAdjustments({ mode, session, onClose, onApply }) {
  const { state, dispatch, toast } = useApp()
  const [remember, setRemember] = useState(false)
  const [minutes, setMinutes] = useState(10)
  const cur = currentSet(session)
  const choices = mode === 'swap' ? replacementOptions(state, session) : []
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
  if (mode === 'place') return <PlaceChange session={session} onClose={onClose} />
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
              toast('Remaining work shortened · reassessed next time, not owed', 'info')
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

// Change where the rest of this workout happens. Shows what would change,
// then applies it only if the workout hasn't changed in the meantime.
function PlaceChange({ session, onClose }) {
  const { state, dispatch, toast, today } = useApp()
  const profile = profileOf(state)
  const places = placesOf(profile)
  const [location, setLocation] = useState(session.location || profile.location)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const applying = useRef(false)
  const live = state.activeWorkout || session
  const preview = useMemo(
    () => previewReplan(state, live, { location }, { today, now: Date.now(), profile }),
    // Recompute when the workout changes or after a stale apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.activeWorkout, location, attempt],
  )
  const apply = () => {
    if (applying.current || !preview.ok) return
    applying.current = true
    const result = applyReplan(state.activeWorkout, preview)
    if (result.status === 'stale') {
      applying.current = false
      setNotice('Your workout changed, so the preview was updated. Check it and apply again.')
      setAttempt((n) => n + 1)
      return
    }
    if (result.status === 'applied') dispatch({ type: 'SET_ACTIVE_WORKOUT', session: result.session })
    toast(`Rest of the workout set for ${preview.placeName}`, 'info')
    onClose()
  }
  const d = preview.ok ? preview.diff : null
  return (
    <Modal
      open
      onClose={onClose}
      title="Training somewhere else?"
      subtitle="Logged sets stay exactly as they are."
      footer={
        <div className="flex gap-2">
          <button className="btn-secondary min-h-12 flex-1" onClick={onClose}>
            Keep as is
          </button>
          <button className="btn-primary min-h-12 flex-1" disabled={!preview.ok || !preview.changed} onClick={apply}>
            Apply
          </button>
        </div>
      }
    >
      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Where are you now?">
        {places.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={location === p.id}
            onClick={() => {
              setLocation(p.id)
              setNotice('')
            }}
            className={`location-choice ${location === p.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}
          >
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[16px] font-semibold">{p.name}</span>
              <span className="mt-0.5 block truncate text-[12px] text-muted">{placeSummary(p)}</span>
            </span>
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="mt-4 rounded-2xl border border-accent/40 p-3 text-[13px]">
          {notice}
        </p>
      )}
      {d && (
        <section className="mt-5" aria-live="polite">
          <h3 className="text-[14px] font-semibold">What changes</h3>
          {!preview.changed && <p className="mt-2 text-[13px] text-muted">Everything left already fits here.</p>}
          <ul className="mt-2 space-y-2 text-[13px] text-ink2">
            {d.replaced.map((r) => (
              <li key={`r-${r.from}`}>
                {r.fromName} → <span className="font-semibold">{r.toName}</span>
              </li>
            ))}
            {d.removed.map((r) => (
              <li key={`x-${r.exId}`}>{r.name}: left out; nothing suitable here</li>
            ))}
            {d.kept.length > 0 && (
              <li className="text-muted">
                {d.kept.length} {d.kept.length === 1 ? 'exercise stays' : 'exercises stay'} as planned
              </li>
            )}
          </ul>
        </section>
      )}
    </Modal>
  )
}
