import { BODY_REGIONS, BODY_RENDER } from '../../lib/body-regions.js'
import './body-mannequin.css'
export default function MannequinRegions({ view = 'front', selected = [], onToggle, locked = [] }) {
  const src = BODY_RENDER[view]
  // The mirrored side is a second pointer target for the same area; keyboard
  // and screen-reader users get one stop per area (labels sit beside it too).
  const controls = (area, otherSide = false) =>
    onToggle
      ? {
          role: 'button',
          tabIndex: locked.includes(area) || otherSide ? -1 : 0,
          ...(otherSide ? { 'aria-hidden': true } : {}),
          'aria-label': `Select ${area} on ${otherSide ? 'other side' : 'mannequin'}`,
          'aria-pressed': selected.includes(area),
          'aria-disabled': locked.includes(area) || undefined,
          onClick: () => !locked.includes(area) && onToggle(area),
          onKeyDown: (e) => {
            if (['Enter', ' '].includes(e.key)) {
              e.preventDefault()
              if (!locked.includes(area)) onToggle(area)
            }
          },
        }
      : {}
  return (
    <div className="mannequin-render">
      <img src={src} alt="" width="1024" height="1536" />
      <svg
        viewBox="0 0 1024 1536"
        preserveAspectRatio="none"
        className="mannequin-regions"
        style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
        aria-hidden={!onToggle || undefined}
        role={onToggle ? 'group' : undefined}
        aria-label={onToggle ? 'Selectable mannequin' : undefined}
      >
        {BODY_REGIONS[view].map(({ area, paths, mirror }) => (
          <g
            key={area}
            className={`mannequin-region ${selected.includes(area) ? 'is-selected' : ''} ${onToggle ? 'is-interactive' : ''}`}
          >
            {paths.map((d) => (
              <path key={d} d={d} {...controls(area)} />
            ))}
            {mirror &&
              paths.map((d) => (
                <path
                  key={`mirror${d}`}
                  d={d}
                  transform="translate(1024 0) scale(-1 1)"
                  {...controls(area, true)}
                />
              ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
