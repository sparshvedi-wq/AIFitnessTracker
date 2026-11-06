// Today's adjustments in one sheet: time, place, energy and a free-text ask.
// Changes apply to today only; the usual setup is untouched.
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import AskAdjust from './AskAdjust.jsx'
import { ONBOARDING_ART } from '../lib/onboarding-art.js'

const TIMES = [10, 15, 20, 30, 45, 60, 75, 90]
const ENERGY = [
  ['low', 'Low', 1],
  ['normal', 'Usual', 2],
  ['high', 'High', 3],
]
const PLACE_ICON = { gym: 'dumbbell', equipment: 'home', space: 'minimize' }

function Battery({ level }) {
  return (
    <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true">
      <rect x="1" y="1" width="19" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="20.5" y="4.5" width="2" height="5" rx="1" fill="currentColor" />
      {Array.from({ length: level }, (_, i) => (
        <rect key={i} x={3.5 + i * 5.2} y="3.5" width="4" height="7" rx="1.2" fill="currentColor" />
      ))}
    </svg>
  )
}

export default function AdjustSheet({
  open,
  onClose,
  plan,
  minutes,
  location,
  places,
  readiness,
  onChange,
  nav,
  scene,
}) {
  const unwell = Boolean(readiness.unwell)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Today"
      footer={
        <button className="btn-primary w-full" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="adjust-preview" aria-live="polite">
        <span className="adjust-preview-art" aria-hidden="true">
          <img src={ONBOARDING_ART[scene] || ONBOARDING_ART.neutral} alt="" decoding="async" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[21px] leading-tight">{plan.name}</span>
          <span className="mt-1 block truncate text-[14px] font-semibold text-ink2">
            {plan.items.length} {plan.items.length === 1 ? 'exercise' : 'exercises'} · {minutes} min ·{' '}
            {places.find((p) => p.id === location)?.name}
          </span>
        </span>
      </div>

      <fieldset className="adjust-group">
        <legend>Time</legend>
        <div className="grid grid-cols-4 gap-2">
          {TIMES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutes === m}
              aria-label={`${m} minutes`}
              className="tile adjust-time"
              onClick={() => onChange({ todayMinutes: m })}
            >
              <span className="font-display text-[21px] leading-none">{m}</span>
              <span className="text-[12px] font-semibold opacity-75">min</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="adjust-group">
        <legend>Place</legend>
        <div className="grid grid-cols-3 gap-2">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={location === p.id}
              className="tile adjust-place"
              onClick={() => onChange({ todayLocation: p.id })}
            >
              <Icon name={p.id === 'home' ? 'home' : PLACE_ICON[p.type] || 'train'} size={22} />
              <span className="w-full truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="adjust-group">
        <legend>Energy</legend>
        <div className="grid grid-cols-3 gap-2">
          {ENERGY.map(([value, label, level]) => (
            <button
              key={value}
              type="button"
              aria-pressed={!unwell && readiness.energy === value}
              className="tile adjust-energy"
              onClick={() => onChange({ energy: value, unwell: false })}
            >
              <Battery level={level} />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={unwell}
          className="tile adjust-unwell"
          onClick={() =>
            onChange(unwell ? { energy: 'normal', unwell: false } : { energy: 'low', unwell: true })
          }
        >
          <Icon name="heart" size={18} />
          Not feeling well
        </button>
      </fieldset>

      <div className="adjust-group">
        <p className="adjust-legend">Anything else?</p>
        <AskAdjust nav={nav} plan={plan} />
      </div>
    </Modal>
  )
}
