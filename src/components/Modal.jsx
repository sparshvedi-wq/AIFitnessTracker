// Bottom sheet on phones, centered dialog on wider screens.

import { useEffect } from 'react'
import Icon from './Icon.jsx'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', footer = null }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex w-full ${maxWidth} max-h-[92vh] flex-col rounded-t-3xl bg-surface shadow-float sm:rounded-3xl animate-slide-up`}
      >
        {/* Grab handle (phones) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between px-5 pb-2 pt-2 sm:pt-4">
          <h2 className="font-display text-[26px] font-black uppercase leading-none tracking-[0.01em] text-ink">{title}</h2>
          <button onClick={onClose} className="icon-btn -mr-2 h-9 w-9" aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div>}
      </div>
    </div>
  )
}
