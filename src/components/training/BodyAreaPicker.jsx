import { useState } from 'react'
import Icon from '../Icon.jsx'
import { BODY_AREAS, toggleBodyArea } from '../../lib/body-areas.js'
import './body-mannequin.css'

import { BODY_REGIONS } from '../../lib/body-regions.js'
import MannequinRegions from './MannequinRegions.jsx'

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
        <MannequinRegions view={view} selected={value} onToggle={toggle} locked={locked} />
        {BODY_REGIONS[view].map(({ area, label: [y, side] }) => (
          <button
            key={area}
            type="button"
            className={`body-label body-label--${side} ${value.includes(area) ? 'is-selected' : ''}`}
            style={{ top: `${y}%` }}
            aria-label={area}
            aria-pressed={value.includes(area)}
            disabled={locked.includes(area)}
            onClick={() => toggle(area)}
          >
            {area}
            {/* Space is reserved so choosing an area doesn't shift the label. */}
            <Icon name="check" size={12} className={value.includes(area) ? '' : 'invisible'} />
          </button>
        ))}
      </div>
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
