import { useId, useState } from 'react'
import Icon from '../Icon.jsx'
import { BODY_AREAS, toggleBodyArea } from '../../lib/body-areas.js'

const REGIONS = {
  front: [
    ['Shoulders', ['M82 73Q66 73 61 93L76 104 89 88Z', 'M118 73Q134 73 139 93L124 104 111 88Z']],
    ['Chest', ['M85 79L100 85 115 79 121 105Q100 116 79 105Z']],
    ['Biceps', ['M60 98L74 109 67 144 53 138Z', 'M140 98L126 109 133 144 147 138Z']],
    ['Core', ['M80 112Q100 121 120 112L116 165Q100 175 84 165Z']],
    [
      'Legs',
      ['M83 171L98 177 96 235 91 293 76 293 77 235Z', 'M117 171L102 177 104 235 109 293 124 293 123 235Z'],
    ],
  ],
  back: [
    ['Shoulders', ['M82 73Q66 73 61 93L76 104 89 88Z', 'M118 73Q134 73 139 93L124 104 111 88Z']],
    ['Back', ['M86 78L100 84 114 78 120 111 115 162Q100 171 85 162L80 111Z']],
    ['Triceps', ['M60 98L74 109 67 144 53 138Z', 'M140 98L126 109 133 144 147 138Z']],
    ['Glutes', ['M85 168Q100 176 115 168L121 191Q108 201 100 193Q92 201 79 191Z']],
    [
      'Legs',
      [
        'M79 198Q92 204 98 199L96 235 91 293 76 293 77 235Z',
        'M121 198Q108 204 102 199L104 235 109 293 124 293 123 235Z',
      ],
    ],
  ],
}
const LABELS = {
  front: {
    Shoulders: [-28, 88, 64, 86],
    Chest: [165, 109, 120, 100],
    Biceps: [-28, 141, 57, 123],
    Core: [165, 163, 118, 145],
    Legs: [-28, 250, 78, 245],
  },
  back: {
    Shoulders: [-28, 88, 64, 86],
    Back: [165, 119, 120, 115],
    Triceps: [-28, 141, 57, 123],
    Glutes: [165, 191, 119, 184],
    Legs: [-28, 250, 78, 245],
  },
}

export default function BodyAreaPicker({ value, onChange, label = 'Sore or tired areas', locked = [] }) {
  const [view, setView] = useState('front')
  const helpId = useId()
  const toggle = (area) => {
    if (!locked.includes(area)) onChange(toggleBodyArea(value, area))
  }
  return (
    <div className="mt-4">
      <p id={helpId} className="text-[14px] leading-relaxed text-muted">
        Tap any areas that need a break.
      </p>
      <div className="mt-4 rounded-tuck bg-bg/60 p-3">
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
        <svg
          viewBox="-35 15 270 305"
          className="body-map mx-auto mt-3 h-[310px] max-w-full"
          role="group"
          aria-label={`${label}, ${view} view`}
          aria-describedby={helpId}
        >
          <g fill="rgb(var(--surface-2))" stroke="rgb(var(--outline))" strokeWidth="1.2" aria-hidden="true">
            <ellipse cx="100" cy="44" rx="20" ry="24" />
            <path d="M91 65V76L72 79Q62 82 58 102L49 145 43 169Q41 177 49 179L58 172 66 146 76 116 81 166 76 201 73 241 74 294 69 304Q68 309 78 309L91 306 99 242 100 209 101 242 109 306 122 309Q132 309 131 304L126 294 127 241 124 201 119 166 124 116 134 146 142 172 151 179Q159 177 157 169L151 145 142 102Q138 82 128 79L109 76V65" />
          </g>
          {REGIONS[view].map(([area, paths]) => (
            <g key={area} className={`body-map-region ${value.includes(area) ? 'is-selected' : ''}`}>
              <g aria-hidden="true" onClick={() => toggle(area)}>
                {paths.map((d) => (
                  <g key={d}>
                    <path d={d} className="body-map-hit" />
                    <path d={d} className="body-map-fill" />
                  </g>
                ))}
              </g>
              <path
                d={`M${LABELS[view][area][0] < 0 ? 30 : 160} ${LABELS[view][area][1] - 4}L${LABELS[view][area][2]} ${LABELS[view][area][3]}`}
                stroke="currentColor"
                strokeWidth=".7"
                opacity=".35"
                pointerEvents="none"
                aria-hidden="true"
              />
              <g
                role="button"
                tabIndex={0}
                aria-label={`${area}${locked.includes(area) ? ', saved area to avoid' : ''}`}
                aria-pressed={value.includes(area)}
                aria-disabled={locked.includes(area) || undefined}
                className="body-map-control"
                onClick={() => toggle(area)}
                onKeyDown={(e) => {
                  if (['Enter', ' '].includes(e.key)) {
                    e.preventDefault()
                    toggle(area)
                  }
                }}
              >
                <rect
                  x={LABELS[view][area][0] - 4}
                  y={LABELS[view][area][1] - 30}
                  width="70"
                  height="50"
                  rx="7"
                  fill="transparent"
                  pointerEvents="all"
                />
                <text
                  className="body-map-label"
                  x={LABELS[view][area][0]}
                  y={LABELS[view][area][1]}
                  pointerEvents="none"
                >
                  {area}
                </text>
              </g>
            </g>
          ))}
          <path
            d="M100 85V105M100 119V161"
            fill="none"
            stroke="rgb(var(--bg))"
            strokeWidth="2"
            pointerEvents="none"
            aria-hidden="true"
          />
        </svg>
        <p className="text-center text-[12px] text-muted">
          {view === 'front' ? 'Front' : 'Back'} · blue areas are selected
        </p>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">Either side selects the whole group.</p>
      <div aria-live="polite" className="mt-3">
        {value.length ? (
          <div className="flex flex-wrap gap-2">
            {value.map((area) => (
              <button
                key={area}
                type="button"
                disabled={locked.includes(area)}
                aria-label={`Remove ${area}`}
                onClick={() => toggle(area)}
                className="chip chip-active inline-flex min-h-11 items-center gap-2"
              >
                {area}
                <Icon name={locked.includes(area) ? 'check' : 'x'} size={13} />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted">No areas selected</p>
        )}
      </div>
      {locked.length > 0 && (
        <p className="mt-3 text-[12px] text-muted">Saved areas stay selected. Change them in Preferences.</p>
      )}
      <details className="mt-3 border-t border-line">
        <summary className="min-h-11 cursor-pointer py-3 text-[14px] font-semibold">
          Choose from a list
        </summary>
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
      {value.some((area) => !locked.includes(area)) && (
        <button
          type="button"
          onClick={() => onChange(value.filter((area) => locked.includes(area)))}
          className="btn-ghost mt-1 w-full"
        >
          Clear selections
        </button>
      )}
    </div>
  )
}
