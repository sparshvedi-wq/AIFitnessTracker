// Equipment for one place (see lib/places.js): what's there, which dumbbell
// sizes, and whether training there should be quiet.
import { useEffect, useState } from 'react'
import { HOME_EQUIPMENT } from '../../lib/planner.js'
import { parseLoads } from '../../lib/preferences.js'
import { Choice, Field } from './Fields.jsx'
import { Toggle } from '../Ink.jsx'

export default function EnvironmentFields({ place, onChange, unit, onValidityChange, compact = false }) {
  const [error, setError] = useState('')
  useEffect(() => {
    onValidityChange?.(!error)
  }, [error, onValidityChange])
  const [text, setText] = useState(() => place.dumbbells.map((v) => Math.round(v * 10) / 10).join(', '))
  const equipped = place.type === 'equipment'
  return (
    <>
      {equipped && (
        <Field
          label={
            compact
              ? 'Leave blank for bodyweight'
              : `Equipment at ${place.name.toLowerCase() === 'home' ? 'home' : place.name}`
          }
          hint={compact ? null : 'Choose none for bodyweight.'}
        >
          <div className="grid grid-cols-2 gap-2">
            {HOME_EQUIPMENT.map((value) => (
              <Choice
                key={value}
                value={value}
                selected={place.equipment.includes(value)}
                onClick={() =>
                  onChange({
                    equipment: place.equipment.includes(value)
                      ? place.equipment.filter((v) => v !== value)
                      : [...place.equipment, value],
                  })
                }
              />
            ))}
          </div>
        </Field>
      )}
      {(place.type === 'gym' || place.equipment.includes('Dumbbells')) && (
        <Field
          label={`Dumbbell sizes (${unit}, per hand)`}
          hint={compact ? null : 'Optional. Suggestions never go above what you list.'}
        >
          <input
            aria-label={`Dumbbell sizes at ${place.name} in ${unit}`}
            className="input"
            inputMode="text"
            value={text}
            placeholder="5, 10, 15, 20"
            onChange={(e) => {
              const value = e.target.value
              setText(value)
              try {
                onChange({ dumbbells: parseLoads(value) })
                setError('')
              } catch (err) {
                setError(err.message)
              }
            }}
            aria-invalid={Boolean(error)}
          />
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {error}
            </p>
          )}
        </Field>
      )}
      {place.type !== 'gym' && (
        <div className="mt-5 flex min-h-12 items-start gap-3">
          <span className="min-w-0 flex-1 text-[14px] font-semibold">
            Keep it quiet
            <span className="mt-1 block text-[13px] font-normal leading-relaxed text-muted">
              No jumping. Good for apartments and hotels.
            </span>
          </span>
          <Toggle checked={place.quiet} onChange={(quiet) => onChange({ quiet })} label="Keep it quiet" />
        </div>
      )}
    </>
  )
}
