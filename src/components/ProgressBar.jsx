export default function ProgressBar({ label, value, goal, unit = 'g', color = 'rgb(var(--brand))', compact = false }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const over = goal > 0 && value > goal
  if (compact) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-[13px] font-medium text-ink2">{label}</span>
        </div>
        <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink">
          {Math.round(value)}
          <span className="text-[13px] font-medium text-muted">/{Math.round(goal)}{unit}</span>
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: over ? 'rgb(var(--danger))' : color }}
        />
      </div>
    </div>
  )
}
