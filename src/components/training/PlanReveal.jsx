import './plan-reveal.css'

// Restart the optical reveal by keying this component to the decision that changed.
// The plan stays in normal document flow, so its height and controls remain usable.
const motes = Array.from({ length: 28 }, (_, i) => {
  const a = i * 2.39996
  const radius = 33 + (i % 5) * 4
  return {
    '--x': Math.cos(a) * radius + '%',
    '--y': Math.sin(a) * radius + '%',
    '--dx': -Math.cos(a) * (28 + (i % 4) * 9) + 'px',
    '--dy': -Math.sin(a) * (28 + (i % 4) * 9) + 'px',
    '--lag': (i % 7) * 65 + 'ms',
    '--dot': 2 + (i % 3) + 'px',
  }
})
export default function PlanReveal({ children, ongoing = false }) {
  return (
    <div className={'plan-reveal' + (ongoing ? ' plan-reveal--working' : '')}>
      <div className="plan-reveal-content">{children}</div>
      <div className="plan-optics" aria-hidden="true">
        <div className="plan-spectrum" />
        <div className="plan-glint" />
        {motes.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </div>
    </div>
  )
}
