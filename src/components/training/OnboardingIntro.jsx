// The first thing someone sees: five short slides. What Tally is, the
// problem with fixed plans, then three things Tally does about it. Swipe or
// use the footer button to move on; Skip goes straight to the questions.
import './onboarding-intro.css'
import { useEffect, useRef } from 'react'

export const INTRO_SLIDES = 5
export const INTRO_CTA = ['Get started', 'Next', 'Next', 'Next', 'Build my plan']

// The Tally mark, drawn stroke by stroke when the first slide shows.
const TallyDraw = () => (
  <svg className="intro-mark" viewBox="0 0 120 84" width="112" height="78" fill="none" strokeLinecap="round" aria-hidden="true">
    {[14, 38, 62, 86].map((x, i) => (
      <path key={x} d={`M${x} 8v68`} className="intro-mark-stroke" style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
    ))}
    <path d="M4 60L110 22" className="intro-mark-strike" />
  </svg>
)

function Week({ fixed }) {
  // Monday, Wednesday and Friday sessions. A fixed plan loses Wednesday;
  // Tally keeps it, shorter.
  const days = fixed
    ? [['full'], null, ['missed'], null, ['faded'], null, null]
    : [['full', 45], null, ['short', 20], null, ['mid', 30], null, null]
  return (
    <div className="intro-week">
      <div className="intro-week-bars">
        {days.map((d, i) => (
          <span key={i} className="intro-week-col">
            {d?.[1] && <small>{d[1]}</small>}
            <i className={d ? `is-${d[0]}` : 'is-rest'}>
              {d?.[0] === 'missed' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              )}
            </i>
          </span>
        ))}
      </div>
      <div className="intro-week-days">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className={i === 2 ? 'is-today' : ''}>
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}

function Moves({ rows }) {
  return (
    <div className="intro-card">
      {rows.map(([name, detail, was, cut]) => (
        <div key={name} className={`intro-move ${cut ? 'is-cut' : ''}`}>
          <span>
            <b>{name}</b>
            {was && <small>was {was}</small>}
          </span>
          <em>{detail}</em>
        </div>
      ))}
    </div>
  )
}

function slides(unit) {
  const kg = unit === 'kg'
  const load = kg ? '60 kg' : '135 lb'
  return [
    {
      title: 'Train around your life.',
      text: 'Workouts planned around your time, place and energy.',
      art: null,
    },
    {
      title: 'Most plans expect a perfect week.',
      text: 'Miss one day and the week falls apart. Tally plans for the week you actually have.',
      art: (
        <>
          <Week fixed />
          <span className="intro-note">Wednesday: worked late</span>
        </>
      ),
    },
    {
      title: 'Short on time?',
      text: 'Pick 20 minutes. Tally keeps the moves that matter most.',
      art: (
        <>
          <div className="intro-time">
            <s>45</s>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <b>20</b>
            <small>min</small>
          </div>
          <Moves
            rows={[
              ['Squat', '3 × 8'],
              ['Bench press', '3 × 8'],
              ['Curls', 'Next time', null, true],
            ]}
          />
        </>
      ),
    },
    {
      title: 'Not at the gym?',
      text: 'Tell Tally where you are. It swaps in moves for the kit you have.',
      art: (
        <>
          <div className="intro-seg">
            <span>Gym</span>
            <span className="is-on">Home</span>
            <span>Hotel</span>
          </div>
          <Moves
            rows={[
              ['Goblet squat', '3 × 10', 'Barbell squat'],
              ['Floor press', '3 × 10', 'Bench press'],
              ['One-arm row', '3 × 12', 'Cable row'],
            ]}
          />
        </>
      ),
    },
    {
      title: 'Never guess a weight.',
      text: 'Rate each set with one tap. Tally sets the next one.',
      art: (
        <>
          <div className="intro-card intro-set">
            <div className="intro-set-head">
              <small>Bench press · set 1</small>
              <b>{load} × 10</b>
            </div>
            <div className="intro-feel">
              <span className="is-on">Easy</span>
              <span>Good</span>
              <span>Hard</span>
            </div>
          </div>
          <div className="intro-next">
            <span>
              <small>Set 2</small>
              <b>{load} × 12</b>
            </span>
            <em>+2 reps</em>
          </div>
        </>
      ),
    },
  ]
}

export default function OnboardingIntro({ headingRef, state, introSlide = 0, setIntroSlide, onNext }) {
  const list = slides(state.settings.weightUnit)
  const at = Math.max(0, Math.min(INTRO_SLIDES - 1, introSlide))
  const drag = useRef(null)
  // Each new slide's heading takes focus, so screen readers hear it. The
  // first one is focused by the setup screen itself.
  const shown = useRef(at)
  useEffect(() => {
    if (shown.current === at) return
    shown.current = at
    headingRef?.current?.focus({ preventScroll: true })
  }, [at, headingRef])
  const go = (i) => setIntroSlide(Math.max(0, Math.min(INTRO_SLIDES - 1, i)))
  // A horizontal swipe moves one slide; a short or mostly vertical one doesn't.
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY }
    // Keep the swipe even if the finger leaves the slide before lifting.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // A pointer the browser no longer tracks; the swipe still works in place.
    }
  }
  const onPointerUp = (e) => {
    const start = drag.current
    drag.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    go(at + (dx < 0 ? 1 : -1))
  }
  return (
    <div className="story intro" aria-roledescription="carousel" aria-label="About Tally">
      <div className="intro-top">
        <button type="button" className={`intro-skip ${at === INTRO_SLIDES - 1 ? 'is-hidden' : ''}`} onClick={onNext}>
          Skip
        </button>
      </div>
      <div
        className="intro-viewport"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="intro-track" style={{ transform: `translateX(${-at * 100}%)` }}>
          {list.map((s, i) => (
            <section
              key={s.title}
              className={`intro-slide ${i === at ? 'is-active' : ''} ${s.art ? '' : 'intro-slide--cover'}`}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${INTRO_SLIDES}`}
              aria-hidden={i !== at}
              inert={i !== at ? '' : undefined}
            >
              {s.art && (
                <div className="intro-art" aria-hidden="true">
                  {s.art}
                </div>
              )}
              <div className="intro-copy">
                {!s.art && <TallyDraw />}
                <h3 ref={i === at ? headingRef : undefined} tabIndex={-1} className="story-title intro-title">
                  {s.title}
                </h3>
                <p className="intro-text">{s.text}</p>
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="intro-dots">
        {list.map((s, i) => (
          <button
            key={s.title}
            type="button"
            className={i === at ? 'is-on' : ''}
            aria-label={`Slide ${i + 1} of ${INTRO_SLIDES}`}
            aria-current={i === at ? 'step' : undefined}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  )
}
