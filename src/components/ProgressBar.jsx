export default function ProgressBar({ label, value, goal, unit = 'g', color = 'rgb(var(--accent))', compact = false }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const over = goal > 0 && value > goal
  if (compact) {
    return (
      <div className="min-w-0">
        <p className="eyebrow truncate" style={{ color }}>{label}</p>
        <p className="mt-1 text-ink">
          <span className="num text-[24px]">{Math.round(value)}</span>
          <span className="text-[12px] font-medium text-muted"> / {Math.round(goal)}{unit}</span>
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: over ? 'rgb(var(--danger))' : color }}
          />
        </div>
      </div>
    )
  }
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink2">{label}</span>
        <span className="tabular-nums font-semibold text-ink">
          {Math.round(value)}
          <span className="font-medium text-muted"> / {Math.round(goal)} {unit}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink/[0.08]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: over ? 'rgb(var(--danger))' : color }}
        />
      </div>
    </div>
  )
}
