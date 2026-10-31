// Add or edit one training place. Works on a training-profile draft and hands
// back the whole updated profile, so callers decide when it's saved.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from '../Modal.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { Segmented, Toggle } from '../Ink.jsx'
import EnvironmentFields from './EnvironmentFields.jsx'
import MovementFields from './MovementFields.jsx'
import {
  MAX_PLACE_NAME,
  PLACE_TYPES,
  newPlace,
  placeNameError,
  removePlace,
  resolvePlace,
  updatePlace,
} from '../../lib/places.js'

export default function PlaceEditor({ profile, placeId = null, unit, onSave, onClose }) {
  const existing = placeId ? resolvePlace(profile, placeId) : null
  const [place, setPlace] = useState(() => existing || { ...newPlace('equipment'), builtIn: false })
  const [usual, setUsual] = useState(profile.location === place.id)
  const [valid, setValid] = useState(true)
  const [touched, setTouched] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nameError = place.builtIn ? '' : placeNameError(profile, place.name, place.id)
  const patch = (next) => setPlace((p) => ({ ...p, ...next }))
  const typeInfo = PLACE_TYPES.find(([t]) => t === place.type)

  const save = () => {
    const { id, name, type, equipment, dumbbells, movement, quiet } = place
    let next = updatePlace(profile, id, { name, type, equipment, dumbbells, movement, quiet })
    if (usual) next = { ...next, location: id }
    onSave(next, id)
  }

  return createPortal(
    <>
      <Modal
        open
        onClose={onClose}
        title={existing ? place.name || 'Place' : 'New place'}
        subtitle={existing?.builtIn ? typeInfo?.[2] : null}
        footer={
          <button
            className="btn-primary h-12 w-full"
            disabled={Boolean(nameError) || !valid}
            onClick={() => (nameError ? setTouched(true) : save())}
          >
            {existing ? 'Save place' : 'Add place'}
          </button>
        }
      >
        {!place.builtIn && (
          <>
            <label className="field-label mt-2" htmlFor="place-name">
              Name
            </label>
            <input
              id="place-name"
              autoFocus={!existing}
              className="input"
              value={place.name}
              maxLength={MAX_PLACE_NAME}
              placeholder="Hotel, office, Mum’s garage"
              onBlur={() => setTouched(true)}
              onChange={(e) => patch({ name: e.target.value })}
              aria-invalid={Boolean(touched && nameError)}
            />
            {touched && nameError && (
              <p role="alert" className="mt-2 text-[13px] text-danger">
                {nameError}
              </p>
            )}
            <p className="field-label mt-5">What’s there</p>
            <Segmented
              label="What’s there"
              value={place.type}
              onChange={(type) => patch({ type })}
              options={PLACE_TYPES.map(([t, label]) => [t, label])}
            />
            <p className="mt-2 text-[13px] text-muted">{typeInfo?.[2]}</p>
          </>
        )}
        {place.type !== 'space' && (
          <EnvironmentFields
            key={place.type}
            place={place}
            unit={unit}
            onChange={patch}
            onValidityChange={setValid}
          />
        )}
        {place.type === 'space' && (
          <>
            <MovementFields value={place.movement} onChange={(movement) => patch({ movement })} />
            <EnvironmentFields key="space" place={place} unit={unit} onChange={patch} />
          </>
        )}
        {profile.location === place.id ? (
          <p className="mt-6 border-t border-line pt-4 text-[13px] text-muted">Your usual place.</p>
        ) : (
          <div className="mt-6 flex min-h-12 items-center gap-3 border-t border-line pt-4">
            <span className="min-w-0 flex-1 text-[14px] font-semibold">
              Make this my usual place
              <span className="mt-1 block text-[13px] font-normal text-muted">
                Plans start here by default.
              </span>
            </span>
            <Toggle checked={usual} onChange={setUsual} label="Make this my usual place" />
          </div>
        )}
        {existing && !place.builtIn && (
          <button className="btn-danger-ghost mt-4 w-full" onClick={() => setDeleting(true)}>
            Delete this place
          </button>
        )}
      </Modal>
      <ConfirmDialog
        open={deleting}
        title={`Delete ${place.name}?`}
        message="Past workouts keep its name."
        confirmLabel="Delete"
        onConfirm={() => onSave(removePlace(profile, place.id), null)}
        onClose={() => setDeleting(false)}
      />
    </>,
    document.body,
  )
}
