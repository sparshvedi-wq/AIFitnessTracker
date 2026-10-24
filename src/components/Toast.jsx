// Toast notifications with optional action button (e.g., "Undo" after delete).

import { useApp } from '../store/AppContext.jsx'
import Icon from './Icon.jsx'

const DOT = {
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-muted',
}

export default function ToastHost() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-surface shadow-float animate-fade-in"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[t.kind] || DOT.info}`} />
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action.onClick(); dismissToast(t.id) }}
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:bg-white/10"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
            <Icon name="x" size={16} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  )
}
