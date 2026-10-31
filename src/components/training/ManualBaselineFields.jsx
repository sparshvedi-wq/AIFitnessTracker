import { useState } from 'react'
import { Field, Choice } from './Fields.jsx'
import { BASELINE_FOCUS, MUSCLE_ESTIMATES, readManualBaseline } from '../../lib/starting-profile.js'
import { convertWeight } from '../../lib/units.js'

export default function ManualBaselineFields({ value, onChange }) {
  const [touched, setTouched] = useState({})
  const set = (patch) => onChange({ ...value, ...patch })
  const { errors } = readManualBaseline(value)
  const heightUnit = (unit) => {
    if (unit === value.heightUnit) return
    const cm =
      value.heightUnit === 'ft'
        ? (Number(value.feet) * 12 + Number(value.inches || 0)) * 2.54
        : Number(value.height)
    const tenths = Math.round((cm / 2.54) * 10)
    set({
      heightUnit: unit,
      ...(cm > 0
        ? unit === 'cm'
          ? { height: String(Math.round(cm)) }
          : { feet: String(Math.floor(tenths / 120)), inches: String((tenths % 120) / 10) }
        : {}),
    })
  }
  return (
    <>
      <Field label="Height">
        <div className="mb-3 flex gap-2">
          {[
            ['cm', 'cm'],
            ['ft', 'ft / in'],
          ].map(([v, label]) => (
            <Choice key={v} value={v} selected={value.heightUnit === v} onClick={heightUnit}>
              {label}
            </Choice>
          ))}
        </div>
        {value.heightUnit === 'ft' ? (
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              aria-label="Height in feet"
              type="number"
              inputMode="decimal"
              placeholder="Feet"
              value={value.feet || ''}
              onBlur={() => setTouched((t) => ({ ...t, height: true }))}
              onChange={(e) => set({ feet: e.target.value })}
            />
            <input
              className="input"
              aria-label="Height in inches"
              type="number"
              inputMode="decimal"
              placeholder="Inches"
              value={value.inches || ''}
              onBlur={() => setTouched((t) => ({ ...t, height: true }))}
              onChange={(e) => set({ inches: e.target.value })}
            />
          </div>
        ) : (
          <input
            className="input"
            aria-label="Height in cm"
            type="number"
            inputMode="decimal"
            placeholder="Height in cm"
            value={value.height || ''}
            onBlur={() => setTouched((t) => ({ ...t, height: true }))}
            onChange={(e) => set({ height: e.target.value })}
          />
        )}{' '}
        {touched.height && errors.height && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {errors.height}
          </p>
        )}
      </Field>
      <Field label="Current weight">
        <div className="mb-3 flex gap-2">
          {['lb', 'kg'].map((unit) => (
            <Choice
              key={unit}
              value={unit}
              selected={value.weightUnit === unit}
              onClick={() =>
                set({
                  weightUnit: unit,
                  weight:
                    Number(value.weight) > 0
                      ? String(
                          Math.round(convertWeight(Number(value.weight), value.weightUnit, unit) * 10) / 10,
                        )
                      : '',
                })
              }
            />
          ))}
        </div>
        <input
          className="input"
          aria-label={`Current weight in ${value.weightUnit}`}
          type="number"
          inputMode="decimal"
          placeholder={`Weight in ${value.weightUnit}`}
          value={value.weight || ''}
          onBlur={() => setTouched((t) => ({ ...t, weight: true }))}
          onChange={(e) => set({ weight: e.target.value })}
        />
        {touched.weight && errors.weight && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {errors.weight}
          </p>
        )}
      </Field>
      <Field label="Muscle estimate (optional)">
        <div className="grid grid-cols-2 gap-2">
          {MUSCLE_ESTIMATES.map((v) => (
            <Choice
              key={v}
              value={v}
              selected={value.muscleEstimate === v}
              onClick={(muscleEstimate) => set({ muscleEstimate })}
            />
          ))}
        </div>
      </Field>
      <details className="mt-5 border-t border-line">
        <summary className="min-h-11 cursor-pointer py-3 text-[14px] font-semibold">
          Add a training focus
        </summary>
        <div className="grid grid-cols-2 gap-2">
          {BASELINE_FOCUS.map((v) => (
            <Choice
              key={v}
              value={v}
              selected={value.focusAreas.includes(v)}
              onClick={() =>
                set({
                  focusAreas: value.focusAreas.includes(v)
                    ? value.focusAreas.filter((a) => a !== v)
                    : [...value.focusAreas, v],
                })
              }
            >
              <span className="capitalize">{v}</span>
            </Choice>
          ))}
        </div>
      </details>
    </>
  )
}
