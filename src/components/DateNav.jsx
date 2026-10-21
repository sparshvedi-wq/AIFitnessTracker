import { addDays, labelForKey, fromKey, toKey, todayKey } from '../lib/date.js'

export default function DateNav({ date, onChange, onCopy }) {
  const isToday = date === todayKey()
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(addDays(date, -1))}
        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        aria-label="Previous day"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <label className="relative flex flex-1 cursor-pointer flex-col items-center">
        <span className="text-base font-semibold text-slate-800 dark:text-slate-100">{labelForKey(date)}</span>
        {!isToday && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onChange(todayKey()) }}
            className="text-xs font-medium text-cal hover:underline"
          >
            Jump to today
          </button>
        )}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(toKey(fromKey(e.target.value)))}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick a date"
        />
      </label>

      <button
        onClick={() => onChange(addDays(date, 1))}
        className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        aria-label="Next day"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Copy from another day */}
      {onCopy && (
        <button
          onClick={onCopy}
          className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
          title="Copy entries from another day"
          aria-label="Copy from another day"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
      )}
    </div>
  )
}
