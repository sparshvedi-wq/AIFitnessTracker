import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'

// A field that opens a sheet of choices, in place of the browser's native
// <select>. `options` are [value, label, detail?] triples.
export default function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  className = '',
  variant = 'field',
}) {
  const [open, setOpen] = useState(false)
  const current = options.find(([v]) => v === value)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label}: ${current ? current[1] : placeholder}`}
        className={`${variant === 'chip' ? 'chip' : 'input justify-between'} flex items-center gap-2 text-left ${className}`}
        onClick={() => setOpen(true)}
      >
        <span className={`min-w-0 truncate ${current ? '' : 'text-faint'}`}>
          {current ? current[1] : placeholder}
        </span>
        <Icon name="chevronDown" size={variant === 'chip' ? 14 : 16} className="shrink-0 text-muted" />
      </button>
      {open &&
        createPortal(
          <Modal open onClose={() => setOpen(false)} title={label}>
            <div className="mt-2 divide-y divide-line" role="radiogroup" aria-label={label}>
              {options.map(([v, text, detail]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={v === value}
                  className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left"
                  onClick={() => {
                    onChange(v)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] ${v === value ? 'font-semibold text-accent' : ''}`}>
                      {text}
                    </span>
                    {detail && <span className="mt-0.5 block text-[13px] text-muted">{detail}</span>}
                  </span>
                  {v === value && <Icon name="check" size={18} className="shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  )
}
