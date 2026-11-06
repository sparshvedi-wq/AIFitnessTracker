import { useState } from 'react'
import Icon from '../Icon.jsx'
import { BODY_AREAS, toggleBodyArea } from '../../lib/body-areas.js'
import './body-mannequin.css'

// Coordinates are tied to the M1 front/back renders, not inferred anatomy.
const REGIONS = {
  front: [
    ['Shoulders', 32, 25, 18, 9, 'left'],
    ['Chest', 50, 29, 25, 10, 'right'],
    ['Biceps', 28, 35, 13, 11, 'left'],
    ['Core', 50, 39, 22, 11, 'right'],
    ['Legs', 47, 69, 28, 35, 'left'],
  ],
  back: [
    ['Shoulders', 32, 25, 18, 9, 'left'],
    ['Back', 50, 34, 26, 19, 'right'],
    ['Triceps', 28, 35, 13, 11, 'left'],
    ['Glutes', 50, 49, 25, 12, 'right'],
    ['Legs', 47, 71, 28, 33, 'left'],
  ],
}
export default function BodyAreaPicker({ value, onChange, label = 'Sore or tired areas', locked = [] }) {
  const [view, setView] = useState('front')
  const toggle = (area) => {
    if (!locked.includes(area)) onChange(toggleBodyArea(value, area))
  }
  return (
    <section className="body-picker" aria-label={label}>
      <div className="segmented mx-auto max-w-[240px]" role="group" aria-label="Body view">
        {['front', 'back'].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`segment capitalize ${view === v ? 'segment-active' : ''}`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="body-mannequin" role="group" aria-label={`${label}, ${view} view`}>
        <img
          key={view}
          src={view === 'front' ? '/onboarding/m1-neutral.webp' : '/onboarding/m1-photo-back.webp'}
          alt=""
          aria-hidden="true"
        />
        {REGIONS[view].map(([area, x, y, w, h, side]) => (
          <div key={area}>
            <button
              type="button"
              className={`body-hotspot ${value.includes(area) ? 'is-selected' : ''}`}
              aria-label={`Select ${area} on mannequin`}
              aria-pressed={value.includes(area)}
              disabled={locked.includes(area)}
              onClick={() => toggle(area)}
              style={{
                left: `${50 + (x - 50) * 0.6857}%`,
                top: `${y}%`,
                width: `${w * 0.6857}%`,
                height: `${h}%`,
              }}
            />
            {['Shoulders', 'Biceps', 'Triceps'].includes(area) && (
              <button
                type="button"
                className={`body-hotspot ${value.includes(area) ? 'is-selected' : ''}`}
                aria-label={`Select ${area} on opposite side of mannequin`}
                aria-pressed={value.includes(area)}
                disabled={locked.includes(area)}
                onClick={() => toggle(area)}
                style={{
                  left: `${50 - (x - 50) * 0.6857}%`,
                  top: `${y}%`,
                  width: `${w * 0.6857}%`,
                  height: `${h}%`,
                }}
              />
            )}
            <button
              type="button"
              className={`body-label body-label--${side} ${value.includes(area) ? 'is-selected' : ''}`}
              style={{ top: `${y + (['Biceps', 'Triceps', 'Core'].includes(area) ? 8 : 0)}%` }}
              aria-label={area}
              aria-pressed={value.includes(area)}
              disabled={locked.includes(area)}
              onClick={() => toggle(area)}
            >
              {area}
              {value.includes(area) && <Icon name="check" size={12} />}
            </button>
          </div>
        ))}
      </div>
      <p className="text-center text-[12px] text-muted">Tap the mannequin or a label · both sides</p>
      <div aria-live="polite" className="sr-only">
        {value.length ? `Selected: ${value.join(', ')}` : 'No areas selected'}
      </div>
      <details className="mt-3 border-t border-line">
        <summary className="min-h-11 cursor-pointer py-3 text-[14px]">All areas</summary>
        <div className="grid grid-cols-2 gap-2 pb-3">
          {BODY_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              aria-pressed={value.includes(area)}
              disabled={locked.includes(area)}
              onClick={() => toggle(area)}
              className={`min-h-12 rounded-2xl border px-3 py-2 text-left text-[14px] ${value.includes(area) ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface2'}`}
            >
              {area}
              {value.includes(area) && <Icon name="check" size={14} className="ml-2 inline" />}
            </button>
          ))}
        </div>
      </details>
      {locked.length > 0 && (
        <p className="mt-2 text-[12px] text-muted">
          Saved exclusions stay selected. Edit them in Preferences.
        </p>
      )}
      {value.some((area) => !locked.includes(area)) && (
        <button
          type="button"
          className="btn-ghost mt-1 w-full"
          onClick={() => onChange(value.filter((area) => locked.includes(area)))}
        >
          Clear selection
        </button>
      )}
    </section>
  )
}
