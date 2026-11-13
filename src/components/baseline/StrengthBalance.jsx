// How each body area compares with the rest of this person's own lifts, and
// what the plan does about the ones that are behind. Shown after a starting
// point and on the You tab. An early read that keeps updating.
import { balanceNotes } from '../../lib/baseline.js'

// A bar from the centre: left is behind, right is ahead. ±30% fills a side.
function Bar({ percent, behind }) {
  const share = Math.min(1, Math.abs(percent) / 30) * 50
  return (
    <span className="relative block h-2 min-w-0 flex-1 rounded-full bg-surface2" aria-hidden="true">
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-outline" />
      {share > 0 && (
        <span
          className={`absolute inset-y-0 rounded-full ${behind ? 'bg-accent' : 'bg-ink2'}`}
          style={percent < 0 ? { right: '50%', width: `${share}%` } : { left: '50%', width: `${share}%` }}
        />
      )}
    </span>
  )
}

const signed = (n) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : 'even')

export default function StrengthBalance({ balance, className = '' }) {
  if (!balance) return null
  const measured = balance.areas.filter((a) => a.status !== 'unknown')
  const unknown = balance.areas.filter((a) => a.status === 'unknown')
  const notes = balanceNotes(balance)
  if (measured.length < 2)
    return (
      <p className={`text-[14px] leading-relaxed text-muted ${className}`}>
        Not enough lifts to compare yet. This fills in as you train.
      </p>
    )
  const machines = balance.areas.some((a) => a.status === 'behind' && a.machinesOnly)
  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {measured.map((a) => (
          <li key={a.id} className="flex items-center gap-3 text-[14px]">
            <span className="w-[76px] shrink-0 font-medium text-ink2">{a.id}</span>
            <Bar percent={a.percent} behind={a.status === 'behind'} />
            <span
              className={`num w-[52px] shrink-0 text-right ${a.status === 'behind' ? 'font-semibold text-accent' : 'text-muted'}`}
              aria-label={`${a.id}: ${a.percent === 0 ? 'even with' : `${Math.abs(a.percent)} percent ${a.percent < 0 ? 'behind' : 'ahead of'}`} your other lifts`}
            >
              {signed(a.percent)}
            </span>
          </li>
        ))}
      </ul>
      {notes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.area} className="rounded-[16px] border border-accent/30 bg-accent/10 px-4 py-3">
              <p className="text-[15px] font-semibold">{n.text}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink2">{n.fix}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[14px] leading-relaxed text-ink2">
          {measured.some((a) => a.percent <= -12)
            ? 'Nothing is clearly behind yet. A gap seen on one lift, or on a machine, needs a few more sessions before it means much.'
            : 'Nothing stands out: your lifts are in proportion.'}
        </p>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Compared with your own lifts, not other people. An early read that sharpens as you train.
        {machines ? ' Machines differ between gyms, so a gap measured on one is less certain.' : ''}
        {unknown.length > 0 ? ` Not measured yet: ${unknown.map((a) => a.id.toLowerCase()).join(', ')}.` : ''}
      </p>
    </div>
  )
}
