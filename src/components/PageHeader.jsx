// Screen title used at the top of every tab: caps scoreboard title, a small
// eyebrow above it, and an optional line in the coach's voice below.

export default function PageHeader({ title, subtitle, voice = null, right = null }) {
  return (
    <header className="mb-5 pt-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {subtitle && <p className="eyebrow">{subtitle}</p>}
          <h1 className="truncate font-display text-[44px] font-black uppercase leading-[0.9] tracking-[0.01em] text-ink">{title}</h1>
        </div>
        {right}
      </div>
      {voice && <p className="voice mt-2">{voice}</p>}
    </header>
  )
}
