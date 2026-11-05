import { useState } from 'react'
import ConfirmDialog from '../ConfirmDialog.jsx'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { displayOf } from '../../lib/preferences.js'
import { Toggle } from '../Ink.jsx'
import { profileOf } from '../../lib/planner.js'
import PlaceEditor from './PlaceEditor.jsx'
import { MAX_PLACES, placeSummary, placesOf } from '../../lib/places.js'
import { Choice, Field } from './Fields.jsx'
import { MUSCLES, findExercise } from '../../lib/exercises.js'
import { count } from '../../lib/presentation.js'

export default function PersonalSettings({ onClose, onEvents, onSetup }) {
  const { state, dispatch, toast } = useApp()
  const [display, setDisplay] = useState(() => displayOf(state))
  const [training, setTraining] = useState(() => profileOf(state))
  const [editingPlace, setEditingPlace] = useState(null)
  const places = placesOf(training)
  const [discarding, setDiscarding] = useState(false)
  const save = (after = onClose) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { display, training },
    })
    toast('Preferences saved')
    after()
  }
  const dirty =
    JSON.stringify(display) !== JSON.stringify(displayOf(state)) ||
    JSON.stringify(training) !== JSON.stringify(profileOf(state))
  const close = () => (dirty ? setDiscarding(true) : onClose())
  return (
    <>
      <Modal
        open
        onClose={close}
        title="Training preferences"
        footer={
          <button className="btn-primary w-full" onClick={() => save()}>
            Save changes
          </button>
        }
      >
        <div className="mt-2 divide-y divide-line">
          <button className="list-row" onClick={() => (dirty ? save(onSetup) : onSetup())}>
            <span className="icon-tile">
              <Icon name="target" size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Your setup</span>
              <span className="mt-1 block text-[12px] text-muted">Goal, sport, usual time</span>
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
          <button className="list-row" onClick={() => (dirty ? save(onEvents) : onEvents())}>
            <span className="icon-tile">
              <Icon name="sport" size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Your events</span>
              <span className="mt-1 block text-[12px] text-muted">Games, trips and busy days</span>
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
          <Panel
            icon="home"
            title="Places"
            detail={`${places.length} places · usual: ${places.find((x) => x.id === training.location)?.name || 'Gym'}`}
          >
            <p className="text-[13px] leading-relaxed text-muted">Plans only use what each place has.</p>
            <div className="mt-3 divide-y divide-line rounded-2xl bg-surface2 px-3">
              {places.map((place) => (
                <button
                  key={place.id}
                  className="list-row min-h-16"
                  onClick={() => setEditingPlace(place.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[15px] font-semibold">
                      {place.name}
                      {place.id === training.location && <span className="badge">Usual</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">
                      {placeSummary(place)}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
                </button>
              ))}
            </div>
            {places.length < MAX_PLACES + 3 && (
              <button className="btn-secondary mt-3 w-full" onClick={() => setEditingPlace('new')}>
                <Icon name="plus" size={16} />
                Add a place
              </button>
            )}
          </Panel>
          <Panel
            icon="settings"
            title="Movement comfort"
            detail={
              training.avoidMuscles.length
                ? `${count(training.avoidMuscles.length, 'area')} to avoid`
                : 'Nothing flagged'
            }
          >
            <Field label="Areas to avoid loading">
              <div className="grid grid-cols-2 gap-2">
                {MUSCLES.filter((m) => !['Cardio', 'Mobility'].includes(m)).map((m) => (
                  <Choice
                    key={m}
                    value={m}
                    selected={training.avoidMuscles.includes(m)}
                    onClick={() =>
                      setTraining((p) => ({
                        ...p,
                        avoidMuscles: p.avoidMuscles.includes(m)
                          ? p.avoidMuscles.filter((v) => v !== m)
                          : [...p.avoidMuscles, m],
                      }))
                    }
                  />
                ))}
              </div>
            </Field>
            <p className="mt-3 text-[12px] text-muted">These areas stay out of every plan.</p>
            <Option
              label="Quiet training everywhere"
              detail="No jumping anywhere. Or set it per place."
              checked={Boolean(training.quiet)}
              onChange={(quiet) => setTraining((p) => ({ ...p, quiet }))}
            />
          </Panel>
          <Panel icon="monitor" title="Display" detail="Text, motion & metrics">
            <Option
              label="Hide body metrics"
              detail="Hides score, bodyweight and photo prompts."
              checked={display.metricLight}
              onChange={(metricLight) => setDisplay({ ...display, metricLight })}
            />
            <Option
              label="Larger text"
              detail="Larger text and touch controls."
              checked={display.largeText}
              onChange={(largeText) => setDisplay({ ...display, largeText })}
            />
            <Option
              label="Reduce motion"
              detail="Also follows your device’s motion setting."
              checked={display.reducedMotion}
              onChange={(reducedMotion) => setDisplay({ ...display, reducedMotion })}
            />
          </Panel>
          {(Object.keys(training.replacements || {}).length > 0 ||
            training.excludedExercises?.length > 0) && (
            <Panel
              icon="repeat"
              title="Exercise choices"
              detail={[
                training.excludedExercises?.length &&
                  count(training.excludedExercises.length, 'exercise') + ' not suggested',
                Object.keys(training.replacements || {}).length &&
                  count(Object.keys(training.replacements).length, 'swap') + ' remembered',
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              {training.excludedExercises?.length > 0 && (
                <Field label="Not suggested">
                  <div className="divide-y divide-line rounded-2xl bg-surface2 px-3">
                    {training.excludedExercises.map((id) => (
                      <div key={id} className="flex min-h-12 items-center gap-3">
                        <span className="min-w-0 flex-1 text-[14px]">{findExercise(id)?.name || id}</span>
                        <button
                          className="text-link"
                          onClick={() =>
                            setTraining((p) => ({
                              ...p,
                              excludedExercises: p.excludedExercises.filter((v) => v !== id),
                            }))
                          }
                        >
                          Allow again
                        </button>
                      </div>
                    ))}
                  </div>
                </Field>
              )}
              {Object.keys(training.replacements || {}).length > 0 && (
                <>
                  <p className="mt-4 text-[13px] text-muted">Swaps you chose to keep for future plans.</p>
                  <button
                    className="btn-secondary mt-3 w-full"
                    onClick={() => setTraining({ ...training, replacements: {} })}
                  >
                    Clear swaps
                  </button>
                </>
              )}
            </Panel>
          )}
        </div>
      </Modal>
      {editingPlace && (
        <PlaceEditor
          profile={training}
          placeId={editingPlace === 'new' ? null : editingPlace}
          unit={state.settings.weightUnit}
          onClose={() => setEditingPlace(null)}
          onSave={(next) => {
            setTraining(next)
            setEditingPlace(null)
          }}
        />
      )}
      <ConfirmDialog
        open={discarding}
        title="Discard preference changes?"
        message="Your saved preferences will stay as they are."
        confirmLabel="Discard changes"
        onConfirm={onClose}
        onClose={() => setDiscarding(false)}
      />
    </>
  )
}
function Panel({ icon, title, detail, children }) {
  return (
    <details className="preference-panel">
      <summary className="list-row cursor-pointer list-none">
        <span className="icon-tile">
          <Icon name={icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="mt-1 block text-[12px] text-muted">{detail}</span>
        </span>
        <Icon name="chevronDown" size={16} className="text-faint" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  )
}
function Option({ label, detail, checked, onChange }) {
  return (
    <div className="flex min-h-16 items-start gap-3 py-3">
      <span className="min-w-0 flex-1 text-[14px] font-semibold">
        {label}
        <span className="mt-1 block text-[12px] font-normal leading-relaxed text-muted">{detail}</span>
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
