// Bottom sheet on phones, centered dialog on wider screens.

import { useRef, useId } from 'react'
import useDialogAccessibility from './useDialogAccessibility.js'
import Icon from './Icon.jsx'

export default function Modal({
  open,
  onClose,
  title,
  subtitle = null,
  children,
  maxWidth = 'max-w-lg',
  footer = null,
  bodyKey,
  fullScreen = false,
  dismissible = true,
  headerAction = null,
  header = null,
  className = '',
  bodyClassName = '',
  hideHandle = false,
  footerClassName = '',
  animate = true,
}) {
  const dialog = useRef(null)
  const titleId = useId()
  const subtitleId = useId()
  useDialogAccessibility(dialog, open, dismissible ? onClose : null)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className={`absolute inset-0 bg-black/60 ${animate ? 'animate-fade-in' : ''}`}
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle && !header ? subtitleId : undefined}
        className={`relative z-10 flex w-full ${maxWidth} ${fullScreen ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:h-[90vh] sm:rounded-[30px]' : 'max-h-[92vh] rounded-t-[30px] sm:rounded-[30px]'} flex-col bg-surface shadow-float ${animate ? 'animate-slide-up' : ''} ${className}`}
      >
        {/* Grab handle (phones) */}
        {!hideHandle && (
          <div className="flex justify-center pt-2.5 sm:hidden">
            <span className="h-1 w-10 rounded-full bg-outline" />
          </div>
        )}
        {header ? (
          <header className="shrink-0">
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {header}
          </header>
        ) : (
          <div className="flex items-start justify-between gap-3 px-[22px] pb-2 pt-3 sm:pt-5">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-[26px] leading-tight text-ink">
                {title}
              </h2>
              {subtitle && (
                <p id={subtitleId} className="mt-1 text-[13px] text-muted">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction}
            {dismissible && (
              <button onClick={onClose} className="icon-btn h-9 w-9 bg-surface2" aria-label="Close">
                <Icon name="x" size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        )}
        <div
          key={bodyKey}
          className={`min-h-0 overflow-y-auto px-[22px] pb-5 pt-1 ${fullScreen ? 'flex-1' : ''} ${bodyClassName}`}
        >
          {children}
        </div>
        {footer && (
          <div
            className={`shrink-0 border-t border-line px-[22px] pb-[max(env(safe-area-inset-bottom),14px)] pt-3 ${footerClassName}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
