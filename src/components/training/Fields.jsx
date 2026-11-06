export function Choice({ value, selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={selected}
      className={`tile min-h-12 !rounded-[16px] px-3.5 py-2.5 text-left text-[15px] font-semibold ${selected ? '' : 'text-ink2'}`}
    >
      {children || value}
    </button>
  )
}
export function Field({ label, children, hint, hideLabel = false }) {
  return (
    <fieldset className="mt-5">
      <legend className={hideLabel ? 'sr-only' : 'mb-2.5 text-[14px] font-bold text-muted'}>{label}</legend>
      {children}
      {hint && <p className="mt-2 text-[12px] leading-relaxed text-muted">{hint}</p>}
    </fieldset>
  )
}
