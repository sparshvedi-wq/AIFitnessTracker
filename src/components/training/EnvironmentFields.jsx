// Equipment for one place (see lib/places.js): what's there, which dumbbell
// sizes, and whether training there should be quiet.
import { useEffect, useId, useState } from 'react'
import { HOME_EQUIPMENT } from '../../lib/planner.js'
import { GYM_EXTRAS, MORE_EQUIPMENT } from '../../lib/catalog/vocabulary.js'
import { parseLoads } from '../../lib/preferences.js'
import { Choice, Field } from './Fields.jsx'
import { Toggle } from '../Ink.jsx'
import { EQUIPMENT_ICON } from './SetupVisuals.jsx'
import Icon from '../Icon.jsx'

export default function EnvironmentFields({
  place,
  onChange,
  unit,
  onValidityChange,
  compact = false,
  section = 'all',
  variant = 'list',
}) {
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [quietHelp, setQuietHelp] = useState(false)
  const errorId = useId()
  const equipped = place.type === 'equipment'
  const showLoads = place.type === 'gym' || place.equipment.includes('Dumbbells')
  useEffect(() => {
    onValidityChange?.(section === 'equipment' || !showLoads || (!error && !text.trim()))
  }, [error, text, showLoads, onValidityChange, section])
  const presets = unit === 'kg' ? [2.5, 5, 7.5, 10, 12.5, 15] : [5, 10, 15, 20, 25, 30]
  const sizes = [...new Set([...presets, ...place.dumbbells])].sort((a, b) => a - b)
  const toggleSize = (size) =>
    onChange({
      dumbbells: place.dumbbells.includes(size)
        ? place.dumbbells.filter((v) => v !== size)
        : [...place.dumbbells, size].sort((a, b) => a - b),
    })
  const addSizes = () => {
    if (!text.trim()) return
    try {
      onChange({ dumbbells: [...new Set([...place.dumbbells, ...parseLoads(text)])].sort((a, b) => a - b) })
      setText('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <>
      {equipped && section !== 'loads' && (
        <Field
          hideLabel={compact}
          label={
            compact
              ? 'Your home equipment'
              : `Equipment at ${place.name.toLowerCase() === 'home' ? 'home' : place.name}`
          }
        >
          {variant === 'icons' ? (
            <div className="equipment-icons" role="group" aria-label="Home equipment">
              {HOME_EQUIPMENT.map((value) => {
                const on = place.equipment.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    className={`equipment-icon ${on ? 'is-on' : ''}`}
                    onClick={() =>
                      onChange({
                        equipment: on
                          ? place.equipment.filter((v) => v !== value)
                          : [...place.equipment, value],
                      })
                    }
                  >
                    <span className="equipment-icon-disc" aria-hidden="true">
                      <Icon name={EQUIPMENT_ICON[value]} size={28} strokeWidth={1.9} />
                      {on && (
                        <span className="equipment-icon-check">
                          <Icon name="check" size={12} strokeWidth={3.4} />
                        </span>
                      )}
                    </span>
                    <span className="equipment-icon-label">{value}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="equipment-options grid grid-cols-2 gap-2">
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
                >
                  <span className="flex items-center gap-2.5">
                    <Icon name={EQUIPMENT_ICON[value]} size={22} className="shrink-0" />
                    <span className="equipment-name">{value}</span>
                  </span>
                </Choice>
              ))}
            </div>
          )}
          <p className="equipment-status mt-3 text-[13px] text-muted">
            {!place.equipment.length
              ? 'Nothing selected? We’ll use bodyweight.'
              : `${place.equipment.length} selected`}
          </p>
          <ExtraEquipment
            label="More equipment"
            options={MORE_EQUIPMENT}
            selected={place.equipment}
            onChange={(equipment) => onChange({ equipment })}
          />
        </Field>
      )}
      {place.type === 'gym' && section !== 'loads' && (
        <ExtraEquipment
          label="Also at this gym"
          hint="A full gym is assumed. Add anything more specialised."
          options={GYM_EXTRAS}
          selected={place.equipment}
          onChange={(equipment) => onChange({ equipment })}
        />
      )}
      {showLoads && section !== 'equipment' && (
        <Field
          hideLabel={compact && section === 'loads'}
          label={compact && section === 'loads' ? 'Available sizes' : 'Which dumbbells can you use?'}
          hint={
            compact && section === 'loads'
              ? null
              : place.dumbbells.length
                ? `${place.dumbbells.length} sizes saved · weight per hand`
                : 'Optional. Leave empty if you’re not sure.'
          }
        >
          <div
            className="mb-3 grid grid-cols-3 gap-2"
            role="group"
            aria-label={`Available dumbbells in ${unit}, per hand`}
          >
            {sizes.map((size) => (
              <Choice key={size} value={size} selected={place.dumbbells.includes(size)} onClick={toggleSize}>
                <span className="font-semibold">{Math.round(size * 10) / 10}</span>
                <span className="ml-1 text-[12px]">{unit}</span>
              </Choice>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              aria-label={`Dumbbell sizes at ${place.name} in ${unit}`}
              className="input"
              inputMode="decimal"
              value={text}
              placeholder={`Other size in ${unit}`}
              onChange={(e) => {
                setText(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSizes()
                }
              }}
              aria-describedby={error || text.trim() ? errorId : undefined}
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              className="btn-secondary shrink-0 !px-4"
              disabled={!text.trim()}
              onClick={addSizes}
            >
              Add
            </button>
          </div>
          {(error || text.trim()) && (
            <p
              id={errorId}
              role={error ? 'alert' : 'status'}
              className={`mt-2 text-[13px] ${error ? 'text-danger' : 'text-muted'}`}
            >
              {error || 'Tap Add to save this size. You can also paste a list.'}
            </p>
          )}
        </Field>
      )}
      {place.type !== 'gym' && section !== 'loads' && (
        <div className="mt-5 flex min-h-12 items-start gap-3">
          <div className="min-w-0 flex-1 text-[14px] font-semibold">
            <span className="inline-flex items-center gap-1">
              Keep it quiet{' '}
              <button
                type="button"
                className="icon-btn !h-11 !w-11"
                aria-label="About quiet workouts"
                aria-expanded={quietHelp}
                onClick={() => setQuietHelp(!quietHelp)}
              >
                <Icon name="info" size={17} />
              </button>
            </span>
            {quietHelp && (
              <p className="mt-1 text-[13px] font-normal leading-relaxed text-muted">
                Skip jumping and noisy movements. Useful for apartments, shared rooms or early starts.
              </p>
            )}
          </div>
          <Toggle checked={place.quiet} onChange={(quiet) => onChange({ quiet })} label="Keep it quiet" />
        </div>
      )}
    </>
  )
}

// Less common equipment stays folded away until it's needed.
function ExtraEquipment({ label, hint, options, selected, onChange }) {
  const count = options.filter((o) => selected.includes(o)).length
  return (
    <details className="mt-4 border-t border-line" open={count > 0}>
      <summary className="min-h-12 cursor-pointer py-3 text-[14px] font-semibold">
        {label}
        {count > 0 ? ` · ${count}` : ''}
      </summary>
      {hint && <p className="mb-3 text-[13px] text-muted">{hint}</p>}
      <div className="grid grid-cols-2 gap-2 pb-2">
        {options.map((value) => (
          <Choice
            key={value}
            value={value}
            selected={selected.includes(value)}
            onClick={() =>
              onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
            }
          >
            {value}
          </Choice>
        ))}
      </div>
    </details>
  )
}
