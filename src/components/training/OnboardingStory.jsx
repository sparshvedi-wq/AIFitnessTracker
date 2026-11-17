// The story screens of onboarding: the promise, the personal numbers, the
// live demos of the real planner, the commitment and the paywall. Each one is
// one headline and one visual; the work is shown, not described.
import './onboarding-story.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import {
  BARRIER_ANSWERS,
  DROPOUT_FACT,
  FIRST_SESSION_OPTIONS,
  OFFER_PRICES,
  TRIAL_DAYS,
  barrierLabel,
  offerPricing,
  onboardingDemoPlan,
  planIngredients,
  saveOfferPrice,
  SAVE_OFFER_PERCENT,
} from '../../lib/onboarding-demo.js'
import {
  PROBLEM_OPTIONS,
  ROLLOVER_STORY,
  TRAINER_ANCHOR,
  feelChange,
  feelDemo,
  fixCards,
  midWorkoutDemo,
  pathWeeks,
  planChips,
  squeezeDemo,
  tallyMonthly,
  yearSessions,
} from '../../lib/onboarding-story.js'
import { resolvePlace } from '../../lib/places.js'

const money = (n) => `$${n.toFixed(2)}`
// Whole amounts read better without cents: $5/mo, not $5.00/mo.
const roundMoney = (n) => (Number.isInteger(n) ? `$${n}` : money(n))
const delay = (s) => ({ animationDelay: `${s}s` })

// Timers that stop when the screen goes away.
function useTimers() {
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t) || clearInterval(t)), [])
  return {
    later: (fn, ms) => timers.current.push(setTimeout(fn, ms)),
    every: (fn, ms) => timers.current.push(setInterval(fn, ms)),
    clear: () => {
      timers.current.forEach((t) => clearTimeout(t) || clearInterval(t))
      timers.current = []
    },
  }
}
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('tally-reduce-motion'))

// A number that counts up once, easing out. Reduced motion shows the total.
function useCountUp(to, ms = 1500, start = true) {
  const [value, setValue] = useState(() => (reducedMotion() ? to : 0))
  useEffect(() => {
    if (!start) return undefined
    if (reducedMotion()) {
      setValue(to)
      return undefined
    }
    let frame
    const t0 = performance.now()
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      setValue(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [to, ms, start])
  return value
}

function Title({ headingRef, children, className = '' }) {
  return (
    <h3 ref={headingRef} tabIndex={-1} className={`story-title story-in ${className}`}>
      {children}
    </h3>
  )
}
function Thumb({ src, className = '' }) {
  return (
    <span className={`story-thumb ${className}`} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <Icon name="dumbbell" size={20} />}
    </span>
  )
}
const Check = ({ size = 14 }) => <Icon name="check" size={size} strokeWidth={3.2} />
const Lock = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
const TallyMark = () => (
  <svg viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 3v18M10 3v18M16 3v18M22 3v18M1 17L27 6" />
  </svg>
)

/* ── Act 1 ─────────────────────────────────────────────────────────── */

function Welcome({ headingRef }) {
  return (
    <div className="story story-welcome">
      <div className="welcome-stage" aria-hidden="true">
        <span className="welcome-disc" />
        <span className="welcome-orbit" />
        <img className="welcome-hero" src={ONBOARDING_ART.welcome} alt="" decoding="async" />
        <span className="float-tag" style={{ left: '2%', top: '17%', ...delay(0.5) }}>
          <i><Icon name="clock" size={14} strokeWidth={2.6} /></i>20 min
        </span>
        <span className="float-tag" style={{ right: '1%', top: '38%', ...delay(0.75) }}>
          <i><Icon name="home" size={14} strokeWidth={2.6} /></i>At home
        </span>
        <span className="float-tag" style={{ left: '5%', top: '66%', ...delay(1) }}>
          <i><Icon name="trendUp" size={14} strokeWidth={2.6} /></i>+2 reps
        </span>
      </div>
      <div className="welcome-copy story-in" style={delay(0.2)}>
        <h3 ref={headingRef} tabIndex={-1} className="story-title story-title--hero">
          Training that fits your week.
        </h3>
        <p>Planned around your time, gear and energy.</p>
      </div>
    </div>
  )
}

const PROBLEM_ICONS = {
  often: 'M4 7l6 6 4-4 6 6M20 11v4h-4',
  some: 'M3 12h4l3-6 4 12 3-6h4',
  no: 'M5 12.5l4.5 4.5L19 7.5',
  new: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
}
function Problem({ headingRef, profile, set }) {
  return (
    <div className="story">
      <Title headingRef={headingRef}>Ever had a plan fall apart?</Title>
      <div className="story-tiles" role="radiogroup" aria-label="Ever had a plan fall apart?">
        {PROBLEM_OPTIONS.map(([id, label], i) => {
          const on = profile.onboardingProblem === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`story-tile story-in ${on ? 'is-on' : ''}`}
              style={delay(0.12 + i * 0.07)}
              onClick={() => set({ onboardingProblem: id })}
            >
              <span className="story-tile-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={PROBLEM_ICONS[id]} />
                </svg>
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Solution({ headingRef }) {
  return (
    <div className="story">
      <Title headingRef={headingRef}>Tally re-plans around real life.</Title>
      <div className="solution-trigger story-in" style={delay(0.15)}>
        <span>
          <Icon name="clock" size={18} strokeWidth={2.4} />
          Only 20 minutes today
        </span>
      </div>
      <div
        className="solution-card story-in"
        style={delay(0.3)}
        role="img"
        aria-label="A 45-minute session with six moves shrinks to a 20-minute session with three"
      >
        <div className="solution-head">
          <span>Today’s session</span>
          <span className="solution-min" aria-hidden="true">
            <b className="is-long">45 min</b>
            <b className="is-short">20 min</b>
          </span>
        </div>
        <div className="solution-rows" aria-hidden="true">
          {[46, 58, 40, 52, 36, 48].map((w, i) => (
            <div key={i} className={`solution-row ${i > 2 ? 'is-drop' : ''}`}>
              <span className="sq" />
              <span className="ln" style={{ width: `${w}%` }} />
              <span className="ln ln--end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// No set days: a count in any seven days, or no target at all.
function Rhythm({ headingRef, goalMode, weeklyGoal, setGoalMode, setWeeklyGoal }) {
  const free = goalMode !== 'target'
  const [tick, setTick] = useState(0)
  const timers = useTimers()
  useEffect(() => {
    if (reducedMotion()) return undefined
    timers.every(() => setTick((t) => t + 1), 1900)
    return timers.clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const count = free ? 1 + (tick % 4) : weeklyGoal
  const lit = useMemo(() => {
    let seed = (tick + 1) * 9301 + (free ? 7 : weeklyGoal) * 49297
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const order = [0, 1, 2, 3, 4, 5, 6].map((i) => [i, rand()]).sort((a, b) => a[1] - b[1])
    return new Set(order.slice(0, count).map(([i]) => i))
  }, [tick, free, weeklyGoal, count])
  return (
    <div className="story">
      <Title headingRef={headingRef}>How often can you train?</Title>
      <div className="story-in" style={delay(0.1)} role="radiogroup" aria-label="Sessions a week">
        <div className="rhythm-nums">
          {[2, 3, 4, 5, 6].map((n) => {
            const on = !free && weeklyGoal === n
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${n} a week`}
                className={`rhythm-num ${on ? 'is-on' : ''}`}
                onClick={() => {
                  setGoalMode('target')
                  setWeeklyGoal(n)
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          role="radio"
          aria-checked={free}
          className={`rhythm-free ${free ? 'is-on' : ''}`}
          onClick={() => setGoalMode('flexible')}
        >
          <Icon name="repeat" size={19} strokeWidth={2.4} />
          Whenever I’m free
        </button>
      </div>
      <div
        className="rhythm-strip story-in"
        style={delay(0.2)}
        role="img"
        aria-label={free ? 'Train any time, no weekly target' : `${weeklyGoal} sessions in any seven days, on whichever days you are free`}
      >
        <div className="rhythm-slots" aria-hidden="true">
          {[40, 52, 46, 58, 44, 50, 54].map((h, i) => (
            <span key={i} className="rhythm-slot">
              {lit.has(i) && (
                <>
                  <span key={`c${tick}`} className="rhythm-clock">
                    <Icon name="clock" size={15} strokeWidth={2.4} />
                  </span>
                  <span key={`m${tick}`} className="rhythm-mark" style={{ height: h }} />
                </>
              )}
            </span>
          ))}
        </div>
        <p className="rhythm-cap">
          <Icon name="repeat" size={15} strokeWidth={2.6} className="spin-slow" />
          {free ? 'No target. Just show up.' : `Any ${weeklyGoal} days. No set schedule.`}
        </p>
      </div>
    </div>
  )
}

function Year({ headingRef, goalMode, weeklyGoal }) {
  const { count, example } = yearSessions({ goalMode, weeklyGoal })
  const shown = useCountUp(count, 1500)
  const groups = Math.ceil(count / 5)
  const lit = Math.ceil(shown / 5)
  return (
    <div className="story story-year">
      <span className="year-count" aria-hidden="true">{shown}</span>
      <h3 ref={headingRef} tabIndex={-1} className="year-line story-in" style={delay(0.4)}>
        <span className="sr-only">{count} </span>
        {example ? 'sessions a year at twice a week.' : 'sessions this year.'}
        <br />
        <span>Tally plans every one.</span>
      </h3>
      <div className="year-marks" role="img" aria-label="Tally marks for the year, in groups of five">
        {Array.from({ length: groups }, (_, i) => (
          <span key={i} className={`year-mark ${i < lit ? 'is-lit' : ''}`} style={delay(0.3 + i * 0.035)}>
            <TallyMark />
          </span>
        ))}
      </div>
      <span className="year-fact story-in" style={delay(1.6)}>
        <b>{DROPOUT_FACT.figure}</b> quit within six months
      </span>
    </div>
  )
}

const FIX = {
  time: ['Short on time', 'Real sessions in as little as 15 min'],
  unsure: ['Not sure what to do', 'A guide for every single move'],
  schedule: ['Changing schedule', 'Miss a day. Nothing piles up.'],
  enjoyment: ['Repetitive workouts', 'Swap any move. It stays out.'],
  starting: ['Getting started again', 'Lighter restarts after a break'],
  weights: ['And every session', 'Weights set from how it felt'],
}
function FixArt({ id }) {
  if (id === 'time')
    return (
      <div className="fix-ring" aria-hidden="true">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="38" className="fix-ring-track" />
          <circle cx="48" cy="48" r="38" className="fix-ring-arc" transform="rotate(-90 48 48)" />
        </svg>
        <span className="fix-a">45</span>
        <span className="fix-b">15</span>
      </div>
    )
  if (id === 'unsure')
    return (
      <div className="fix-guide" aria-hidden="true">
        <img src={ONBOARDING_ART.strength} alt="" />
        <span className="fix-play">
          <Icon name="play" size={14} />
        </span>
      </div>
    )
  const icon = { schedule: 'repeat', enjoyment: 'repeat', starting: 'sprout', weights: 'trendUp' }[id] || 'check'
  return (
    <div className={`fix-icon ${icon === 'repeat' ? 'is-spin' : ''}`} aria-hidden="true">
      <Icon name={icon} size={38} strokeWidth={2.2} />
    </div>
  )
}
function Fix({ headingRef, profile }) {
  // One obstacle still gets two answers: theirs, then the weights that learn.
  const picked = fixCards(profile)
  const ids = picked.length === 1 ? [...picked, 'weights'] : picked
  return (
    <div className="story">
      <Title headingRef={headingRef}>Got it. Here’s the fix.</Title>
      {ids.map((id, i) => (
        <div key={id} className={`fix-card story-in ${i % 2 ? 'is-ink' : ''}`} style={delay(0.15 + i * 0.15)}>
          <FixArt id={id} />
          <div className="fix-copy">
            <span className="fix-said">{FIX[id]?.[0] || barrierLabel(id)}</span>
            <p>{FIX[id]?.[1] || BARRIER_ANSWERS[id]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Act 2 ─────────────────────────────────────────────────────────── */

function Building({ headingRef, state, profile, today, now, onNext }) {
  const lines = useMemo(() => {
    const plan = onboardingDemoPlan(state, profile, { today, now })
    return planIngredients(profile, plan, resolvePlace(profile, profile.location)?.name).slice(0, 5)
    // The list is read once, as the plan is built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pct = useCountUp(100, 3600)
  const done = pct >= 100
  const shown = lines.filter((_, i) => pct >= 12 + i * (80 / lines.length))
  return (
    <div className="story story-building">
      <div className="build-ring">
        <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r="92" className="build-disc" />
          <circle cx="110" cy="110" r="92" className="build-track" />
          <circle
            cx="110"
            cy="110"
            r="92"
            className="build-arc"
            style={{ strokeDashoffset: 578 * (1 - pct / 100) }}
            transform="rotate(-90 110 110)"
          />
          {!done && (
            <g className="build-orbit">
              <circle cx="110" cy="18" r="5" />
            </g>
          )}
        </svg>
        <span className="build-pct" aria-live="off">{pct}%</span>
      </div>
      <Title headingRef={headingRef} className="text-center">
        {done ? 'Your plan is built.' : 'Building your plan'}
      </Title>
      <div className="build-lines" aria-live="polite">
        {shown.map((line) => (
          <div key={line} className="build-line">
            <span className="build-ok"><Check /></span>
            {line}
          </div>
        ))}
      </div>
      <div className="story-own-cta">
        {done && (
          <button type="button" className="btn-primary story-cta-in min-h-12 w-full" onClick={onNext}>
            See my plan
          </button>
        )}
      </div>
    </div>
  )
}

function Squeeze({ headingRef, state, profile, today, now }) {
  const plans = useMemo(() => squeezeDemo(state, profile, { today, now }), [state, profile, today, now])
  const [mins, setMins] = useState(45)
  const touched = useRef(false)
  const timers = useTimers()
  useEffect(() => {
    timers.later(() => {
      if (!touched.current) setMins(20)
    }, 1600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const moves = plans[mins] || []
  return (
    <div className="story">
      <Title headingRef={headingRef}>Short on time? Squeeze it.</Title>
      <div className="story-seg story-in" style={delay(0.1)} role="radiogroup" aria-label="Session length">
        {[20, 30, 45].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === mins}
            className={m === mins ? 'is-on' : ''}
            onClick={() => {
              touched.current = true
              setMins(m)
            }}
          >
            {m} min
          </button>
        ))}
      </div>
      <div className="story-card story-in" style={delay(0.2)}>
        <div className="story-card-head">
          <span>Today</span>
          <b key={mins} className="tick-in">{mins} min</b>
        </div>
        <div aria-live="polite">
          {moves.map((m) => (
            <div key={m.exId} className="story-move">
              <Thumb src={m.image} />
              <div className="min-w-0">
                <div className="story-move-name">{m.name}</div>
                <div className="story-move-detail">{m.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {mins !== 45 && (
        <span key={mins} className="story-chip pop-in">
          <Icon name="repeat" size={15} strokeWidth={2.6} />
          Rebuilt for {mins} min
        </span>
      )}
    </div>
  )
}

const FIT_CHOICES = [5, 10, 15]
function MidWorkout({ headingRef, state, profile, today, now }) {
  const demo = useMemo(() => midWorkoutDemo(state, profile, { today, now }), [state, profile, today, now])
  const [phase, setPhase] = useState('live')
  const [left, setLeft] = useState(null)
  const [hot, setHot] = useState(null)
  const touched = useRef(false)
  const timers = useTimers()
  useEffect(() => {
    timers.later(() => !touched.current && setPhase('sheet'), 1800)
    timers.later(() => !touched.current && setHot(5), 2700)
    timers.later(() => {
      if (touched.current) return
      setPhase('fitted')
      setLeft(5)
    }, 3300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const fitted = phase === 'fitted'
  const rows = fitted ? demo.after[left] : demo.before
  const pick = (m) => {
    touched.current = true
    setHot(m)
    setLeft(m)
    setPhase('fitted')
  }
  return (
    <div className="story">
      <Title headingRef={headingRef}>Mid-workout and out of time?</Title>
      <div className="mid-phone story-in" style={delay(0.15)}>
        <div className="mid-top">
          <div>
            <small>Workout in progress</small>
            <b>{fitted ? `${left} min left` : '45 min'}</b>
          </div>
          {fitted && (
            <span key={left} className="mid-fits pop-in">
              <Check size={13} />
              Fits {left} min
            </span>
          )}
        </div>
        <div className="mid-list" aria-live="polite">
          {rows.map((r) => (
            <div key={r.exId} className={`mid-row ${fitted && r.state === 'cut' ? 'is-cut' : ''}`}>
              <Thumb src={r.image} />
              <div className="min-w-0 flex-1">
                <span key={`${r.exId}${left}`} className="mid-name">{r.name}</span>
                <div className="mid-sets" aria-label={`${r.sets.filter((s) => s === 'done').length} sets done, ${r.kept} to go`}>
                  {r.sets.map((s, i) => (
                    <i key={i} className={`is-${s}`} />
                  ))}
                </div>
              </div>
              {fitted && r.state !== 'kept' && (
                <span key={`${r.exId}-${left}`} className={`mid-tag is-${r.state} pop-in`}>
                  {r.state === 'saved' ? 'Saved' : r.state === 'cut' ? 'Cut' : `${r.kept} of ${r.sets.length}`}
                </span>
              )}
            </div>
          ))}
        </div>
        {phase !== 'sheet' && (
          <button
            type="button"
            className={`mid-fab ${fitted ? '' : 'is-pulse'}`}
            onClick={() => {
              touched.current = true
              setHot(null)
              setPhase('sheet')
            }}
          >
            <Icon name="timer" size={18} strokeWidth={2.4} />
            Less time left
          </button>
        )}
        {phase === 'sheet' && (
          <>
            <div className="mid-scrim" aria-hidden="true" />
            <div className="mid-sheet" role="group" aria-label="How long is left">
              <b>How long’s left?</b>
              <div className="mid-opts">
                {FIT_CHOICES.map((m) => (
                  <button key={m} type="button" className={hot === m ? 'is-hot' : ''} onClick={() => pick(m)}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {fitted && (
        <span key={left} className="story-chip story-chip--ink pop-in" style={delay(0.4)}>
          <Check size={15} />
          Logged sets stay. Cuts aren’t owed.
        </span>
      )}
    </div>
  )
}

function Rollover({ headingRef }) {
  const [step, setStep] = useState(reducedMotion() ? 2 : 0)
  const [loop, setLoop] = useState(0)
  const auto = useRef(!reducedMotion())
  const timers = useTimers()
  useEffect(() => {
    timers.every(() => {
      if (!auto.current) return
      setStep((s) => {
        const n = (s + 1) % 3
        if (!n) setLoop((l) => l + 1)
        return n
      })
    }, 2600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [pulldown, curl] = ROLLOVER_STORY.cut
  const tray = step < 2 ? ROLLOVER_STORY.cut : []
  return (
    <div className="story">
      <Title headingRef={headingRef}>Cut moves wait for the right day.</Title>
      <div className="roll-tray story-in" style={delay(0.1)}>
        <span className="roll-label">Cut today</span>
        {tray.map((m) => (
          <span key={m.exId + loop} className="roll-chip">
            <Thumb src={m.image} />
            {m.name}
          </span>
        ))}
        {!tray.length && <span className="roll-empty">Nothing left</span>}
      </div>
      <div className={`roll-session ${step === 1 ? 'is-live' : ''}`} aria-live="polite">
        <div className="roll-head">
          <div>
            <small>{ROLLOVER_STORY.next.when}</small>
            <b>{ROLLOVER_STORY.next.title}</b>
          </div>
          <div className="roll-base">{ROLLOVER_STORY.next.base.map((b) => <span key={b}>{b}</span>)}</div>
        </div>
        {step >= 1 && (
          <p key={`a${loop}`} className="roll-why">
            <span className="roll-ic is-wait"><Icon name="clock" size={14} strokeWidth={2.6} /></span>
            Back and arms still recovering. They wait.
          </p>
        )}
      </div>
      <div className={`roll-session ${step === 2 ? 'is-live' : ''}`}>
        <div className="roll-head">
          <div>
            <small>{ROLLOVER_STORY.after.when}</small>
            <b>{ROLLOVER_STORY.after.title}</b>
          </div>
          <div className="roll-base">{ROLLOVER_STORY.after.base.map((b) => <span key={b}>{b}</span>)}</div>
        </div>
        {step === 2 && (
          <>
            <p key={`b${loop}`} className="roll-why">
              <span className="roll-ic is-ok"><Check size={13} /></span>
              Pull-ups cover the {pulldown.name.toLowerCase()}. Not owed.
            </p>
            <div key={`c${loop}`} className="roll-land">
              <Thumb src={curl.image} />
              <div className="min-w-0 flex-1">
                <b>{curl.name}</b>
                <small>Back in: arms are fresh</small>
              </div>
              <Icon name="repeat" size={19} strokeWidth={2.6} />
            </div>
          </>
        )}
      </div>
      <div className="story-dots" role="group" aria-label="Steps">
        {['Cut today', 'Next time', 'The time after'].map((label, i) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-pressed={i === step}
            className={i === step ? 'is-on' : ''}
            onClick={() => {
              auto.current = false
              setStep(i)
              setLoop((l) => l + 1)
            }}
          />
        ))}
      </div>
    </div>
  )
}

const FEELS = [
  ['easy', 'Easy'],
  ['good', 'Good'],
  ['hard', 'Hard'],
]
const FEEL_WHY = {
  easy: 'Easy, so it asks for more.',
  good: 'Right on target. Hold it.',
  hard: 'Hard. Same weight, fewer reps.',
  heavy: 'Too heavy. Dropped right away.',
}
function Feel({ headingRef, state, today, now }) {
  const unit = state.settings.weightUnit === 'kg' ? 'kg' : 'lb'
  const demo = useMemo(() => feelDemo(unit, { today, now }), [unit, today, now])
  const [feel, setFeel] = useState(null)
  const touched = useRef(false)
  const timers = useTimers()
  useEffect(() => {
    timers.later(() => !touched.current && setFeel('easy'), 1700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pick = (f) => {
    touched.current = true
    setFeel(f)
  }
  const next = feel ? demo[feel] : null
  const change = next ? feelChange(demo.start, next, unit) : ''
  return (
    <div className="story">
      <Title headingRef={headingRef}>Tap how it felt. Tally sets the next one.</Title>
      <div className="feel-done story-in" style={delay(0.1)}>
        <Thumb src={ROLLOVER_STORY.cut[0].image} className="is-lg" />
        <div>
          <small>Lat pulldown · set 1</small>
          <b>
            {demo.start.weight} {unit} × {demo.start.reps}
          </b>
        </div>
        <span className="feel-check"><Check size={16} /></span>
      </div>
      <div className="feel-picks story-in" style={delay(0.2)} role="radiogroup" aria-label="How did set 1 feel?">
        {FEELS.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={feel === id} className={feel === id ? 'is-on' : ''} onClick={() => pick(id)}>
            {label}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={feel === 'heavy'} className={`feel-heavy ${feel === 'heavy' ? 'is-on' : ''}`} onClick={() => pick('heavy')}>
          Too heavy
        </button>
      </div>
      <div className="feel-next story-in" style={delay(0.3)} aria-live="polite">
        <small>Set 2</small>
        {next ? (
          <>
            <div className="feel-row">
              <span key={feel} className="feel-big">
                {next.weight}
                <span>
                  {' '}
                  {unit} × {next.reps}
                </span>
              </span>
              <span key={`${feel}d`} className={`feel-delta ${change.startsWith('+') ? 'is-up' : feel === 'heavy' ? 'is-down' : ''}`}>
                {change}
              </span>
            </div>
            <span key={`${feel}w`} className="feel-why">{FEEL_WHY[feel]}</span>
          </>
        ) : (
          <span className="feel-wait">
            <i />
            <i />
            <i />
            Waiting for your tap
          </span>
        )}
      </div>
    </div>
  )
}

function FirstTally({ headingRef, goalMode, weeklyGoal }) {
  const { count } = yearSessions({ goalMode, weeklyGoal })
  return (
    <div className="story story-tally">
      <div className="tally-art">
        <span className="tally-glow" aria-hidden="true" />
        <svg width="260" height="260" viewBox="0 0 260 260" role="img" aria-label="Your first tally mark">
          <g className="tally-burst">
            {[[130, 22, 130, 6], [208, 52, 220, 40], [238, 130, 254, 130], [208, 208, 220, 220], [130, 238, 130, 254], [52, 208, 40, 220], [22, 130, 6, 130], [52, 52, 40, 40]].map(([a, b, c, d]) => (
              <line key={`${a}${b}`} x1={a} y1={b} x2={c} y2={d} />
            ))}
          </g>
          <path className="tally-ghost" d="M102 70v120M150 70v120M174 70v120M198 70v120" />
          <path className="tally-first" d="M78 62v136" />
        </svg>
      </div>
      <div className="story-in" style={delay(1.3)}>
        <h3 ref={headingRef} tabIndex={-1} className="tally-title">Mark one.</h3>
        <p className="tally-sub">Your tally has started.</p>
      </div>
      <span className="tally-of story-in" style={delay(1.5)}>1 of {count}</span>
    </div>
  )
}

/* ── Act 3 ─────────────────────────────────────────────────────────── */

function Path({ headingRef, name, goalMode, weeklyGoal }) {
  const first = name.trim().split(' ')[0]
  const target = goalMode === 'target'
  return (
    <div className="story story-path">
      <div className="path-night dark">
        <h3 ref={headingRef} tabIndex={-1} className="story-title">
          {first ? `${first}’s first month` : 'Your first month'}
        </h3>
        <svg viewBox="0 0 390 190" className="path-chart" role="img" aria-label="Four weeks, building step by step">
          <defs>
            <linearGradient id="story-path-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#345CD6" stopOpacity=".45" />
              <stop offset="1" stopColor="#345CD6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M24 170H366" className="path-axis" />
          <path className="path-area" d="M30 160 C 90 150, 110 128, 128 120 S 200 92, 216 82 S 290 52, 300 44 S 350 24, 360 20 L360 170 L30 170Z" fill="url(#story-path-fill)" />
          <path className="path-line" d="M30 160 C 90 150, 110 128, 128 120 S 200 92, 216 82 S 290 52, 300 44 S 350 24, 360 20" />
          {[[128, 120, 0.7], [216, 82, 1], [300, 44, 1.3]].map(([x, y, d]) => (
            <circle key={x} className="path-pt" cx={x} cy={y} r="9" style={delay(d)} />
          ))}
          <circle className="path-pt is-end" cx="360" cy="20" r="11" style={delay(1.6)} />
        </svg>
        <div className="path-weeks">
          {pathWeeks().map(([week, label], i) => (
            <div key={week} className="path-week" style={delay(0.8 + i * 0.3)}>
              <span>{week}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="path-stats">
        <div className="path-stat" style={delay(1.8)}>
          <b>{target ? weeklyGoal * 4 : 4}</b>
          <span>{target ? 'sessions planned' : 'weeks planned'}</span>
        </div>
        <div className="path-stat" style={delay(1.95)}>
          <b>{target ? `${weeklyGoal}×` : 'Any'}</b>
          <span>{target ? 'a week, any days' : 'day you’re free'}</span>
        </div>
      </div>
    </div>
  )
}

const LEVELS = [
  ['some', 'Kind of', 30],
  ['fair', 'Fairly', 52],
  ['very', 'Very', 74],
  ['all', 'All in', 96],
]
const NEXT_SAY = { now: 'It’s ready now.', later: 'It’ll be waiting.', unsure: 'Open Tally when you’re free.' }
function Pledge({ headingRef, profile, set, onNext }) {
  const level = profile.commitment || 'very'
  const when = FIRST_SESSION_OPTIONS.some(([id]) => id === profile.firstSession) ? profile.firstSession : 'later'
  const [holding, setHolding] = useState(false)
  const [sealed, setSealed] = useState(false)
  const timers = useTimers()
  const touched = useRef(false)
  const start = () => {
    if (sealed) return
    setHolding(true)
    timers.later(() => {
      setHolding(false)
      setSealed(true)
      set({ commitment: level, firstSession: when })
      navigator.vibrate?.(30)
      timers.later(onNext, reducedMotion() ? 200 : 1100)
    }, reducedMotion() ? 0 : 1300)
  }
  const stop = () => {
    if (sealed) return
    timers.clear()
    setHolding(false)
  }
  return (
    <div className="story">
      <Title headingRef={headingRef}>How committed are you?</Title>
      <div className="pledge-levels story-in" style={delay(0.1)} role="radiogroup" aria-label="Commitment">
        {LEVELS.map(([id, label, h]) => (
          <button key={id} type="button" role="radio" aria-checked={level === id} className={level === id ? 'is-on' : ''} onClick={() => set({ commitment: id })}>
            <span className="pledge-col" style={{ height: h }} />
            {label}
          </button>
        ))}
      </div>
      <h4 className="pledge-sub story-in" style={delay(0.2)}>Next free moment?</h4>
      <div className="pledge-when story-in" style={delay(0.25)} role="radiogroup" aria-label="Next free moment">
        {FIRST_SESSION_OPTIONS.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={when === id} className={when === id ? 'is-on' : ''} onClick={() => set({ firstSession: id })}>
            {label}
          </button>
        ))}
      </div>
      <span key={when} className="story-chip story-chip--accent pop-in">
        <Check size={15} />
        {NEXT_SAY[when]}
      </span>
      <div className="story-own-cta">
        <div className="hold-wrap">
          <button
            type="button"
            className={`hold-btn ${holding ? 'is-holding' : ''} ${sealed ? 'is-sealed' : ''}`}
            onPointerDown={(e) => {
              touched.current = true
              e.currentTarget.setPointerCapture?.(e.pointerId)
              start()
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault()
                start()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') stop()
            }}
            onClick={(e) => {
              // Assistive technology activates without a press: commit at once.
              if (e.detail === 0 && !touched.current && !holding) {
                timers.clear()
                setSealed(true)
                set({ commitment: level, firstSession: when })
                timers.later(onNext, 400)
              }
            }}
            aria-label={sealed ? 'Committed' : 'Press and hold to commit'}
          >
            <i className="hold-fill" aria-hidden="true" />
            <span>
              <Icon name={sealed ? 'check' : 'heart'} size={20} strokeWidth={2.4} />
              {sealed ? 'Committed. Let’s go.' : holding ? 'Keep holding…' : 'Hold to commit'}
            </span>
          </button>
          {sealed && (
            <span className="hold-burst" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2
                return <i key={i} style={{ '--x': `${Math.round(Math.cos(a) * 150)}px`, '--y': `${Math.round(Math.sin(a) * 60)}px`, animationDelay: `${(i % 3) * 0.04}s` }} />
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Value({ headingRef }) {
  const tally = tallyMonthly()
  const share = Math.max(3, (tally / TRAINER_ANCHOR.perMonth) * 100)
  return (
    <div className="story">
      <Title headingRef={headingRef}>A coach’s brain, for a coffee a month.</Title>
      <div
        className="value-bars"
        role="img"
        aria-label={`A personal trainer once a week costs about $${TRAINER_ANCHOR.perMonth} a month. Tally costs ${roundMoney(tally)} a month.`}
      >
        <div className="value-row story-in" style={delay(0.15)}>
          <div className="value-lab">
            <span>
              Personal trainer
              <small>about ${TRAINER_ANCHOR.perSession} a session, weekly</small>
            </span>
            <b>${TRAINER_ANCHOR.perMonth}/mo</b>
          </div>
          <div className="value-track"><i style={{ width: '100%', ...delay(0.3) }} /></div>
        </div>
        <div className="value-tally">
          <div className="value-lab">
            <span>Tally</span>
            <b>{roundMoney(tally)}/mo</b>
          </div>
          <div className="value-track"><i className="is-accent" style={{ width: `${share}%`, ...delay(1.5) }} /></div>
          <div className="value-has">
            {['Plans every session', 'Sets your weights', 'Fits any time', 'Any day, any place'].map((t, i) => (
              <span key={t} style={delay(1.7 + i * 0.1)}>
                <Check size={12} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <span className="story-chip story-in" style={delay(2.2)}>Free to try first</span>
    </div>
  )
}

function Ready({ headingRef, profile, name, goalMode, weeklyGoal }) {
  const first = name.trim().split(' ')[0]
  const { count } = yearSessions({ goalMode, weeklyGoal })
  const chips = planChips(profile, { goalMode, weeklyGoal, placeName: resolvePlace(profile, profile.location)?.name })
  const used = ['Session squeezed to fit', 'Cut moves waiting smartly', 'Weights set from a tap', 'First tally marked']
  return (
    <div className="story">
      <Title headingRef={headingRef}>{first ? `${first}, your plan is ready.` : 'Your plan is ready.'}</Title>
      <div className="ready-card dark">
        <div className="ready-chips">
          {chips.map((c, i) => (
            <span key={c} style={delay(0.5 + i * 0.1)}>{c}</span>
          ))}
        </div>
        <div className="ready-count">
          <b>1</b>
          <span>of {count} this year</span>
        </div>
        <div className="ready-track" aria-hidden="true"><i /></div>
      </div>
      <div className="ready-used" aria-label="Already working for you">
        {used.map((u, i) => (
          <div key={u} className="ready-row" style={delay(1 + i * 0.2)}>
            <span className="ready-tick" style={delay(1.1 + i * 0.2)}><Check size={13} /></span>
            {u}
          </div>
        ))}
        <div className="ready-lock">
          <Lock />
          Session 2 is built and waiting
        </div>
      </div>
    </div>
  )
}

/* ── Paywall ───────────────────────────────────────────────────────── */

function PaywallDots({ at }) {
  return (
    <div className="pay-dots" aria-label={`Step ${at} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i === at ? 'is-on' : ''} />
      ))}
    </div>
  )
}
function PayBack({ onBack }) {
  return (
    <button type="button" className="pay-back" aria-label="Back" onClick={onBack}>
      <Icon name="chevronLeft" size={22} />
    </button>
  )
}

function TryFree({ headingRef, name, onNext }) {
  const first = name.trim().split(' ')[0]
  return (
    <div className="story story-pay">
      <div className="pay-hero" aria-hidden="true">
        <svg viewBox="0 0 390 340" preserveAspectRatio="xMidYMax slice">
          <circle cx="195" cy="250" r="190" className="pay-c1" />
          <circle cx="195" cy="250" r="130" className="pay-c2" />
        </svg>
        <img src={ONBOARDING_ART.strength} alt="" />
        <span className="pay-free">
          <b>$0</b>
          today
        </span>
      </div>
      <div className="pay-body">
        <h3 ref={headingRef} tabIndex={-1} className="story-title story-in" style={delay(0.2)}>
          {first ? `Start your plan free, ${first}.` : 'Start your plan free.'}
        </h3>
        <div className="pay-points">
          {[
            ['clock', 'Plans around your time'],
            ['trendUp', 'Weights set from a tap'],
            ['repeat', 'Cut moves never lost'],
          ].map(([icon, label], i) => (
            <div key={label} className="pay-point story-in" style={delay(0.35 + i * 0.1)}>
              <span><Icon name={icon} size={22} strokeWidth={2.2} /></span>
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="pay-foot">
        <PaywallDots at={1} />
        <button type="button" className="pay-cta" onClick={onNext}>
          Try for $0
        </button>
        <p className="pay-fine">No payment now. Cancel anytime.</p>
      </div>
    </div>
  )
}

function TrialReminder({ headingRef, onNext, onBack }) {
  return (
    <div className="story story-pay">
      <PayBack onBack={onBack} />
      <div className="pay-body pay-body--top">
        <Title headingRef={headingRef}>No surprises. We’ll remind you.</Title>
        <div className="pay-timeline">
          <span className="pay-rail" aria-hidden="true"><b /></span>
          {[
            ['is-accent', <Lock key="l" size={28} />, 'Today', 'Everything unlocked, free', 0.2],
            ['is-ink', <Icon key="b" name="bell" size={28} strokeWidth={2.4} className="ring-bell" />, `Day ${TRIAL_DAYS - 2}`, 'A heads-up from us', 0.8],
            ['is-quiet', <Check key="c" size={26} />, `Day ${TRIAL_DAYS}`, 'Your plan continues', 1.4],
          ].map(([cls, icon, when, what, d]) => (
            <div key={when} className="pay-stop">
              <span className={`pay-node ${cls}`} style={delay(d)}>{icon}</span>
              <div>
                <div className="pay-when" style={delay(d + 0.1)}>{when}</div>
                <div className="pay-what">{what}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pay-foot">
        <PaywallDots at={2} />
        <button type="button" className="pay-cta" onClick={onNext}>
          Try for $0
        </button>
        <p className="pay-fine">Cancel before day {TRIAL_DAYS} and pay nothing.</p>
      </div>
    </div>
  )
}

/**
 * Plans, the trial switch, and the purchase. With no store connected
 * (lib/billing.js), the purchase sheet is a labelled preview and nothing is
 * charged. Cancelling the sheet opens the one-time offer, once per install.
 */
function Plans({ headingRef, name, profile, set, onBack, onSubscribe }) {
  const first = name.trim().split(' ')[0]
  const pricing = offerPricing()
  const [plan, setPlan] = useState('year')
  const [trial, setTrial] = useState(true)
  const [sheet, setSheet] = useState(null)
  const [offer, setOffer] = useState(false)
  const year = trial ? OFFER_PRICES.year : OFFER_PRICES.yearNow
  const freeYear = plan === 'year' && trial
  const fine = freeYear
    ? `${TRIAL_DAYS} days free, then ${pricing.year.price}/yr. Cancel anytime.`
    : plan === 'year'
      ? `${money(year)} a year. Renews yearly. Cancel anytime.`
      : `${pricing.month.price} a month. Renews monthly. Cancel anytime.`
  const offerPrice = saveOfferPrice()
  const open = (choice) => setSheet(choice)
  const cancelled = () => {
    setSheet(null)
    if (!profile.saveOfferShown) {
      set({ saveOfferShown: true })
      setOffer(true)
    }
  }
  return (
    <div className="story story-pay">
      <PayBack onBack={onBack} />
      <div className="pay-body pay-body--top">
        <Title headingRef={headingRef}>{first ? `Keep ${first}’s plan going.` : 'Keep your plan going.'}</Title>
        <div className="pay-plans" role="radiogroup" aria-label="Plan">
          {[
            ['year', trial ? 'Try free' : 'Yearly', trial ? `then ${pricing.year.price}/yr` : `${money(year)}/yr`, money(Math.round((year / 52) * 100) / 100), `Save ${pricing.saving}%`],
            ['month', 'Monthly', `${pricing.month.price}/mo`, pricing.month.perWeek, null],
          ].map(([id, label, price, perWeek, badge], i) => (
            <button key={id} type="button" role="radio" aria-checked={plan === id} className={`pay-plan ${plan === id ? 'is-on' : ''}`} style={delay(0.1 + i * 0.08)} onClick={() => setPlan(id)}>
              {badge && <span className="pay-badge">{badge}</span>}
              <span className="pay-ring" aria-hidden="true">{plan === id && <Check size={14} />}</span>
              <span className="pay-name">
                {label}
                <small>{price}</small>
              </span>
              <span className="pay-week">
                <b>{perWeek}</b>
                <small>a week</small>
              </span>
            </button>
          ))}
        </div>
        <div className="pay-trial">
          <div>
            <b>Free trial</b>
            <small>{trial ? '$0 today' : 'Pay less, start now'}</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={trial}
            aria-label="Free trial"
            className={`pay-switch ${trial ? 'is-on' : ''}`}
            onClick={() => {
              setTrial(!trial)
              setPlan('year')
            }}
          >
            <i />
          </button>
        </div>
        {freeYear && (
          <div className="pay-mini" aria-label={`Today free. Reminder on day ${TRIAL_DAYS - 2}. Billed on day ${TRIAL_DAYS}.`}>
            {[
              ['Today', '$0'],
              [`Day ${TRIAL_DAYS - 2}`, 'Reminder'],
              [`Day ${TRIAL_DAYS}`, pricing.year.price],
            ].map(([when, what], i) => (
              <span key={when} style={delay(0.1 + i * 0.08)}>
                <b>{when}</b>
                {what}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="pay-foot">
        <PaywallDots at={3} />
        <button type="button" className="pay-cta" onClick={() => open({ plan, trial: freeYear, price: plan === 'year' ? year : OFFER_PRICES.month })}>
          {freeYear ? 'Try for $0' : 'Continue'}
        </button>
        <p className="pay-fine">{fine}</p>
      </div>
      {sheet && (
        <PreviewStoreSheet
          choice={sheet}
          onCancel={cancelled}
          onSubscribe={() => {
            setSheet(null)
            onSubscribe(sheet)
          }}
        />
      )}
      {offer && !sheet && (
        <SaveOffer
          price={offerPrice}
          onClaim={(choice) => {
            setOffer(false)
            open(choice)
          }}
          onDecline={() => setOffer(false)}
        />
      )}
    </div>
  )
}

// Stands in for the phone's own purchase sheet until a store is connected.
function PreviewStoreSheet({ choice, onCancel, onSubscribe }) {
  const ref = useRef(null)
  const cancel = useRef(onCancel)
  cancel.current = onCancel
  useEffect(() => {
    ref.current?.focus()
    const key = (e) => e.key === 'Escape' && cancel.current()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const label = choice.plan === 'year' ? 'Tally · Yearly' : 'Tally · Monthly'
  const terms = choice.trial
    ? `${TRIAL_DAYS} days free, then ${money(choice.price)}/yr`
    : choice.plan === 'year'
      ? `${money(choice.price)} a year`
      : `${money(choice.price)} a month`
  return (
    <div className="store-layer" role="dialog" aria-modal="true" aria-label="Confirm subscription">
      <div className="store-scrim" aria-hidden="true" onClick={onCancel} />
      <div className="store-sheet">
        <span className="store-grab" aria-hidden="true" />
        <span className="store-preview">Preview · nothing is charged</span>
        <div className="store-row">
          <span className="store-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 5v14M10 5v14M14 5v14M18 5v14M3 15l18-6" /></svg>
          </span>
          <div>
            <b>{label}</b>
            <small>{terms}</small>
          </div>
        </div>
        <button ref={ref} type="button" className="store-buy" onClick={onSubscribe}>
          Subscribe
        </button>
        <button type="button" className="store-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function SaveOffer({ price, onClaim, onDecline }) {
  const pricing = offerPricing()
  const [plan, setPlan] = useState('year')
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div className="store-layer" role="dialog" aria-modal="true" aria-labelledby="save-offer-title">
      <div className="store-scrim is-dark" aria-hidden="true" />
      <div className="offer-sheet">
        <span className="offer-tag" aria-hidden="true">
          <b>{SAVE_OFFER_PERCENT}%</b>
          off
        </span>
        <h3 id="save-offer-title" ref={ref} tabIndex={-1}>
          Your plan’s saved. Here’s a welcome gift.
        </h3>
        <span className="offer-once">One time only</span>
        <div className="offer-plans" role="radiogroup" aria-label="Offer">
          <button type="button" role="radio" aria-checked={plan === 'year'} className={plan === 'year' ? 'is-on' : ''} onClick={() => setPlan('year')}>
            <span className="pay-ring" aria-hidden="true">{plan === 'year' && <Check size={14} />}</span>
            <span>
              <b>Yearly · try free</b>
              <small>
                <s>{pricing.year.price}</s> {money(price)} first year
              </small>
            </span>
          </button>
          <button type="button" role="radio" aria-checked={plan === 'month'} className={plan === 'month' ? 'is-on' : ''} onClick={() => setPlan('month')}>
            <span className="pay-ring" aria-hidden="true">{plan === 'month' && <Check size={14} />}</span>
            <span>
              <b>Monthly</b>
              <small>{pricing.month.price}/mo</small>
            </span>
          </button>
        </div>
        <button
          type="button"
          className="pay-cta"
          onClick={() => onClaim(plan === 'year' ? { plan: 'year', trial: true, price, offer: true } : { plan: 'month', trial: false, price: OFFER_PRICES.month })}
        >
          {plan === 'year' ? 'Claim it for $0 today' : 'Continue'}
        </button>
        <button type="button" className="offer-no" onClick={onDecline}>
          No thanks
        </button>
      </div>
    </div>
  )
}

/* ── Router ────────────────────────────────────────────────────────── */

const SCREENS = {
  welcome: Welcome,
  problem: Problem,
  'solution-demo': Solution,
  rhythm: Rhythm,
  'year-demo': Year,
  'fix-demo': Fix,
  'building-demo': Building,
  'squeeze-demo': Squeeze,
  'midworkout-demo': MidWorkout,
  'rollover-demo': Rollover,
  'feel-demo': Feel,
  'tally-demo': FirstTally,
  'path-demo': Path,
  pledge: Pledge,
  'value-demo': Value,
  'ready-demo': Ready,
  paywall: TryFree,
  'paywall-reminder': TrialReminder,
  'paywall-plans': Plans,
}
export default function OnboardingStory({ step, ...props }) {
  const Screen = SCREENS[step]
  return Screen ? <Screen {...props} /> : null
}
