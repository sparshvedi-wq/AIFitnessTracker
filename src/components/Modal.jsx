// Bottom sheet on phones, centered dialog on wider screens.

import { useEffect } from 'react'
import Icon from './Icon.jsx'

export default function Modal({ open, onClose, title, subtitle = null, children, maxWidth = 'max-w-lg', footer = null }) {
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
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex w-full ${maxWidth} max-h-[92vh] flex-col rounded-t-[30px] bg-surface shadow-float sm:rounded-[30px] animate-slide-up`}
      >
        {/* Grab handle (phones) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-outline" />
        </div>
        <div className="flex items-start justify-between gap-3 px-[22px] pb-2 pt-3 sm:pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-[28px] leading-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[14px] text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="icon-btn h-9 w-9 bg-surface2" aria-label="Close">
            <Icon name="x" size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="overflow-y-auto px-[22px] pb-5 pt-1">{children}</div>
        {footer && <div className="border-t border-line px-[22px] py-3 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div>}
      </div>
    </div>
  )
}
