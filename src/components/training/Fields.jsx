export function Choice({ value, selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={selected}
      className={`min-h-11 rounded-[16px] border px-3.5 py-2.5 text-left text-[14px] transition-colors ${selected ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface2 text-ink2'}`}
    >
      {children || value}
    </button>
  )
}
export function Field({ label, children, hint }) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-[14px] font-semibold">{label}</legend>
      {children}
      {hint && <p className="mt-2 text-[12px] leading-relaxed text-muted">{hint}</p>}
    </fieldset>
  )
}
