export default function QuickAddBar({ onNewFood, onOpenLibrary }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onNewFood()}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cal px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 active:scale-[0.98] transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add food
      </button>
      <button
        onClick={onOpenLibrary}
        className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
        Library
      </button>
    </div>
  )
}
