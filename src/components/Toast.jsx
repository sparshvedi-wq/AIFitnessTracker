// Toast notifications with optional action button (e.g., "Undo" after delete).

import { useApp } from '../store/AppContext.jsx'

const KIND_STYLES = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-800 dark:bg-slate-700',
}

export default function ToastHost() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg animate-fade-in ${KIND_STYLES[t.kind] || KIND_STYLES.info}`}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action.onClick(); dismissToast(t.id) }}
              className="shrink-0 rounded-md border border-white/30 px-2 py-0.5 text-xs font-semibold hover:bg-white/10"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
