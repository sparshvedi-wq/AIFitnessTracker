// Large screen title used at the top of every tab.

export default function PageHeader({ title, subtitle, right = null }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{subtitle}</p>}
        <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-tight text-ink">{title}</h1>
      </div>
      {right}
    </header>
  )
}
