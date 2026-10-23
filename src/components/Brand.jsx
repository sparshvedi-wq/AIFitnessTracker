// Tally's brand pieces: the mark (four strokes and a volt slash), the
// wordmark, and TallyMarks, which counts anything as hand-drawn strokes.

export function TallyMark({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
        <path d="M8 6v20M13.3 6v20M18.7 6v20M24 6v20" />
      </g>
      <path d="M4 21.5L28 10.5" stroke="rgb(var(--accent))" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-ink ${className}`}>
      <TallyMark size={24} />
      <span className="font-display text-[22px] font-black uppercase leading-none tracking-[0.04em]">Tally</span>
    </span>
  )
}

// Count shown as tally marks: groups of five, the fifth a volt slash.
// Strokes past `count` but within `goal` are drawn faint, so you can see
// what's left to earn.
export function TallyMarks({ count, goal = 0, height = 34, className = '' }) {
  const total = Math.max(count, goal, 1)
  const groups = []
  for (let g = 0; g * 5 < total; g++) groups.push(g)
  const strokeW = Math.max(2.5, height / 11)
  const gap = height * 0.26

  return (
    <span className={`inline-flex items-end gap-3 ${className}`} role="img" aria-label={`${count}${goal ? ` of ${goal}` : ''}`}>
      {groups.map((g) => {
        const inGroup = Math.min(5, total - g * 5)
        const verticals = Math.min(4, inGroup)
        const width = (verticals - 1) * gap + strokeW * 2
        return (
          <svg key={g} width={Math.max(width, strokeW * 2) + (inGroup === 5 ? gap * 0.6 : 0)} height={height} className="overflow-visible">
            {Array.from({ length: verticals }, (_, i) => {
              const n = g * 5 + i
              const x = strokeW + (inGroup === 5 ? gap * 0.3 : 0) + i * gap
              // Slight hand-drawn lean, different per stroke
              const lean = ((n * 7) % 5 - 2) * 0.5
              return (
                <line
                  key={i}
                  x1={x + lean}
                  y1={strokeW}
                  x2={x - lean}
                  y2={height - strokeW}
                  stroke={n < count ? 'rgb(var(--ink))' : 'rgb(var(--ink) / 0.16)'}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  className={n < count ? 'origin-bottom animate-stroke-in' : ''}
                  style={{ animationDelay: `${n * 70}ms`, transformBox: 'fill-box' }}
                />
              )
            })}
            {inGroup === 5 && (
              <line
                x1={0}
                y1={height * 0.72}
                x2={width + gap * 0.6}
                y2={height * 0.3}
                stroke={g * 5 + 4 < count ? 'rgb(var(--accent))' : 'rgb(var(--ink) / 0.16)'}
                strokeWidth={strokeW * 1.15}
                strokeLinecap="round"
              />
            )}
          </svg>
        )
      })}
    </span>
  )
}
