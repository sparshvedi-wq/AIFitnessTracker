import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import Modal from '../Modal.jsx'
import { fmtNum } from '../../lib/workout.js'

// The icon stays quiet; its touch target and explanation are fully accessible.
export function WorkoutInfo({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
        aria-label={`About ${title.toLowerCase()}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="info" size={16} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} maxWidth="max-w-sm">
        <p className="py-3 text-[16px] leading-relaxed text-ink2">{children}</p>
      </Modal>
    </>
  )
}

// Reps and load can be changed with one tap. Tapping the number opens direct entry.
export function SetNumberCard({ label, value, display, onEdit, onChange, stepTo }) {
  const previous = stepTo(value || 0, -1)
  const next = stepTo(value || 0, 1)
  return (
    <div className="min-w-0 flex-1 rounded-[20px] bg-surface2 p-[8px]">
      <button
        className="flex min-h-[112px] w-full flex-col items-center justify-center gap-2 rounded-2xl py-3"
        onClick={onEdit}
        aria-label={`Edit ${label}: ${display ?? value ?? 'not set'}`}
        aria-haspopup="dialog"
      >
        <span className="num block max-w-full text-[length:var(--workout-dose-size)] leading-none">
          {display ?? fmtNum(value || 0)}
        </span>
        <span className="inline-flex items-center justify-center gap-1.5 text-[14px] text-ink2">
          {label}
          <Icon name="edit" size={12} />
        </span>
      </button>
      <div className="mt-1 flex justify-between gap-[4px]">
        <NumberStep
          label={`Decrease ${label}`}
          disabled={previous === (value || 0)}
          onClick={() => onChange(previous)}
        />
        <NumberStep
          label={`Increase ${label}`}
          plus
          disabled={next === (value || 0)}
          onClick={() => onChange(next)}
        />
      </div>
    </div>
  )
}

export function SetNumberField({ label, value, onChange, stepTo, decimal = false, info, focus = false }) {
  const id = useId()
  const input = useRef(null)
  useEffect(() => {
    if (focus) input.current?.focus({ preventScroll: true })
  }, [focus])
  const numeric = Number(String(value).replace(',', '.')) || 0
  return (
    <div className="rounded-[20px] bg-surface2 px-4 pb-4 pt-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <label className="text-[15px] font-semibold" htmlFor={id}>
          {label}
        </label>
        {info && <WorkoutInfo title={label}>{info}</WorkoutInfo>}
      </div>
      <div className="flex items-center gap-3">
        <NumberStep
          label={`Decrease ${label}`}
          disabled={stepTo(numeric, -1) === numeric}
          onClick={() => onChange(String(stepTo(numeric, -1)))}
        />
        <input
          ref={input}
          id={id}
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          className="num min-h-16 min-w-0 flex-1 rounded-xl border border-outline bg-bg px-2 text-center text-[40px] leading-none outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <NumberStep
          label={`Increase ${label}`}
          plus
          disabled={stepTo(numeric, 1) === numeric}
          onClick={() => onChange(String(stepTo(numeric, 1)))}
        />
      </div>
    </div>
  )
}

function NumberStep({ label, plus = false, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border border-outline bg-bg text-ink disabled:opacity-30"
      {...props}
    >
      <Icon name={plus ? 'plus' : 'minus'} size={19} />
    </button>
  )
}
