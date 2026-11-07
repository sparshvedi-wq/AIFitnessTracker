// Toast notifications with an optional action (e.g. "Undo" after delete).
// They sit at the top so they never cover a screen's primary action.

import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

const DOT = {
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-muted',
}

export default function ToastHost() {
  const { toasts, dismissToast, storageError, retrySave } = useApp()
  return (
    <div
      data-dialog-exempt
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-50 flex flex-col items-center gap-2 px-4">
      {storageError && (
        <div
          role="alert"
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-danger bg-surface p-4 text-[14px]"
        >
          <span className="flex-1">Changes aren’t saved yet.</span>
          <button className="btn-secondary min-h-11" onClick={retrySave}>
            Retry
          </button>
        </div>
      )}
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-outline bg-raised px-4 py-2 text-[14px] font-medium text-ink shadow-float animate-fade-in"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[t.kind] || DOT.info}`} />
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action.onClick()
                dismissToast(t.id)
              }}
              className="min-h-11 shrink-0 rounded-lg px-2 py-1 text-[14px] font-semibold text-accent hover:bg-surface2"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className="-mr-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center opacity-60 hover:opacity-100"
          >
            <Icon name="x" size={16} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  )
}
