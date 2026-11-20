import { DEFAULT_ON_THE_GO } from '../../lib/movement-preferences.js'
import { Choice, Field } from './Fields.jsx'
import Icon from '../Icon.jsx'
import { Toggle as Switch } from '../Ink.jsx'

export default function MovementFields({ value, onChange }) {
  const p = { ...DEFAULT_ON_THE_GO, ...value }
  const set = (patch) => onChange({ ...p, ...patch })
  return (
    <>
      <Field label="Space">
        <div className="grid grid-cols-2 gap-2">
          <Choice value="small" selected={p.space === 'small'} onClick={(space) => set({ space })}>
            <span className="mb-3 block">
              <Icon name="minimize" size={22} />
            </span>
            Small space
          </Choice>
          <Choice value="open" selected={p.space === 'open'} onClick={(space) => set({ space })}>
            <span className="mb-3 block">
              <Icon name="monitor" size={22} />
            </span>
            Room to move
          </Choice>
        </div>
      </Field>
      <Field label="Movement positions">
        <div className="flex flex-wrap gap-2">
          {[
            ['any', 'Any position'],
            ['standing', 'Standing only'],
            ['seated', 'Seated only'],
          ].map(([v, label]) => (
            <Choice key={v} value={v} selected={p.position === v} onClick={(position) => set({ position })}>
              {label}
            </Choice>
          ))}
        </div>
      </Field>
      {p.position === 'any' && (
        <Toggle checked={p.noFloor} onChange={(noFloor) => set({ noFloor })}>
          No floor exercises
        </Toggle>
      )}
      {p.position !== 'seated' && (
        <>
          <Toggle checked={p.noJumping} onChange={(noJumping) => set({ noJumping })}>
            No jumping
          </Toggle>
          <Toggle checked={p.wall} onChange={(wall) => set({ wall })}>
            Stable wall available
          </Toggle>
        </>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        {p.position === 'seated'
          ? 'Stable chair, feet on the floor.'
          : 'Bodyweight only. Keep your movement area clear.'}
      </p>
    </>
  )
}
function Toggle({ children, checked, onChange }) {
  return (
    <div className="mt-2 flex min-h-12 items-center gap-3 text-[14px]">
      <span className="min-w-0 flex-1">{children}</span>
      <Switch checked={checked} onChange={onChange} label={children} />
    </div>
  )
}
