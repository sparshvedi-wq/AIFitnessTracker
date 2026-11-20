// The story screens of onboarding: the promise, the personal numbers, the
// live demos of the real planner, the commitment and the paywall. Each one is
// one headline and one visual; the work is shown, not described.
import './onboarding-story.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Lede,
  Thumb,
  Title,
  delay,
  money,
  reducedMotion,
  useTimers,
} from './story-kit.jsx'
import { STORY_SCREENS } from './OnboardingStoryMore.jsx'
import OnboardingIntro from './OnboardingIntro.jsx'
import Icon from '../Icon.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import {
  OFFER_PRICES,
  TRIAL_DAYS,
  offerPricing,
  saveOfferPrice,
  SAVE_OFFER_PERCENT,
} from '../../lib/onboarding-demo.js'
import {
  ROLLOVER_STORY,
  feelChange,
  feelDemo,
  midWorkoutDemo,
} from '../../lib/onboarding-story.js'

/* ── Act 1 ─────────────────────────────────────────────────────────── */

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

function Restart({ headingRef }) {
  return (
    <div className="story">
      <Title headingRef={headingRef}>Pick up after a break.</Title>
      <img className="restart-figure" src={ONBOARDING_ART.movement} alt="" />
      <Lede>Your first session back can be lighter. The next one builds on what you finish.</Lede>
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
      <Title headingRef={headingRef}>Out of time mid-workout?</Title>
      <Lede>Choose the time left. Your finished sets stay saved.</Lede>
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
                  <button key={m} type="button" className={hot === m ? `is-hot ${touched.current ? '' : 'is-autotap'}` : ''} onClick={() => pick(m)}>
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
          Your finished sets are saved.
        </span>
      )}
    </div>
  )
}

// The same two moves, followed over three sessions: cut today, held while
// those muscles recover, then back. Plays once, top to bottom.
const ROLL_ICON = { cut: 'timer', wait: 'clock', back: 'repeat' }
function Rollover({ headingRef }) {
  const { cut, sessions } = ROLLOVER_STORY
  return (
    <div className="story">
      <Title headingRef={headingRef}>Finish early? Some moves can wait.</Title>
      <Lede>Here’s how a shortened session can carry into a later workout.</Lede>
      <ol className="roll-line" aria-label="Two moves cut today, over your next sessions">
        {sessions.map((s, i) => (
          <li key={s.state} className={`roll-step is-${s.state}`} style={{ '--d': `${0.15 + i * 1.1}s` }}>
            <span className="roll-node" aria-hidden="true">
              <Icon name={ROLL_ICON[s.state]} size={16} strokeWidth={2.4} />
            </span>
            <div className="roll-body">
              <small>
                {s.when} · {s.title}
              </small>
              <b>{s.text}</b>
              <div className="roll-moves">
                {cut.map((m, j) => (
                  <span key={m.exId} className="roll-move" style={{ '--j': j }}>
                    <Thumb src={m.image} />
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
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
function Feel({ headingRef, state, profile, today, now }) {
  const unit = state.settings.weightUnit === 'kg' ? 'kg' : 'lb'
  const demo = useMemo(() => feelDemo(unit, { today, now, goal: profile.goal, experience: profile.experience }), [unit, today, now, profile.goal, profile.experience])
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
      <Title headingRef={headingRef}>Rate the set. Tally picks your next weight.</Title>
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
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={feel === id}
            className={`${feel === id ? 'is-on' : ''} ${feel === id && !touched.current ? 'is-autotap' : ''}`}
            onClick={() => pick(id)}
          >
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

function PayBack({ onBack }) {
  return (
    <button type="button" className="pay-back" aria-label="Back" onClick={onBack}>
      <Icon name="chevronLeft" size={22} />
    </button>
  )
}

function membershipBenefit(profile) {
  const reasons = {
    time: 'A shorter workout when the day gets busy. Your completed sets still count.',
    schedule: 'A session ready whenever you train, even when last week went differently.',
    unsure: 'Your exercises, sets and form guides together in each workout.',
    enjoyment: 'Swap a move and keep working toward the same goal.',
    starting: 'Come back after a break with a session that fits your recent training.',
  }
  for (const barrier of profile.onboardingBarriers || []) {
    if (reasons[barrier]) return reasons[barrier]
  }
  if (profile.sports?.length) return 'Your workouts and sport warm-ups, together in one plan.'
  return 'A workout for today, and a next session shaped by the sets you log.'
}

function Plans({ headingRef, profile, set, onBack, onSubscribe }) {
  const pricing = offerPricing()
  const [plan, setPlan] = useState('year')
  const [trial, setTrial] = useState(true)
  const [sheet, setSheet] = useState(null)
  const [offer, setOffer] = useState(false)
  const [showOfferLink, setShowOfferLink] = useState(false)
  const purchaseButton = useRef(null)
  const year = trial ? OFFER_PRICES.year : OFFER_PRICES.yearNow
  const selectedPricing = offerPricing({ ...OFFER_PRICES, year })
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
    setShowOfferLink(!profile.saveOfferShown)
    purchaseButton.current?.focus()
  }
  return (
    <div className="story story-pay">
      <PayBack onBack={onBack} />
      <div className="pay-body pay-body--top">
        <Title headingRef={headingRef}>Tally membership</Title>
        <p className="membership-lede">{membershipBenefit(profile)}</p>
        <div className="pay-plans" role="radiogroup" aria-label="Plan">
          {[
            ['year', 'Yearly', money(year), 'year', `Save ${selectedPricing.saving}%`],
            ['month', 'Monthly', pricing.month.price, 'month', null],
          ].map(([id, label, price, period, badge], i) => (
            <button key={id} type="button" role="radio" aria-checked={plan === id} className={`pay-plan ${plan === id ? 'is-on' : ''}`} style={delay(0.1 + i * 0.08)} onClick={() => setPlan(id)}>
              {badge && <span className="pay-badge">{badge}</span>}
              <span className="pay-ring" aria-hidden="true">{plan === id && <Check size={14} />}</span>
              <span className="pay-name">{label}</span>
              <span className="membership-price"><b>{price}</b><small> / {period}</small></span>
            </button>
          ))}
        </div>
        {plan === 'year' && <div className="pay-trial">
          <div>
            <b>{TRIAL_DAYS}-day free trial</b>
            <small>{trial ? '$0 today' : `Pay ${money(year)} today`}</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={trial}
            aria-label="Free trial"
            className={`pay-switch ${trial ? 'is-on' : ''}`}
            onClick={() => {
              setTrial(!trial)
            }}
          >
            <i />
          </button>
        </div>}
      </div>
      <div className="pay-foot">
        {showOfferLink && (
          <button type="button" className="btn-ghost min-h-11" onClick={() => {
            setShowOfferLink(false)
            set({ saveOfferShown: true })
            setOffer(true)
          }}>View welcome offer</button>
        )}
        <button ref={purchaseButton} type="button" className="pay-cta" onClick={() => open({ plan, trial: freeYear, price: plan === 'year' ? year : OFFER_PRICES.month })}>
          {freeYear ? `Try ${TRIAL_DAYS} days free` : plan === 'year' ? 'Continue yearly' : 'Continue monthly'}
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
          onDecline={() => { setOffer(false); purchaseButton.current?.focus() }}
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
    ? choice.offer ? `${TRIAL_DAYS} days free, then ${money(choice.price)} for year one. Renews at ${money(OFFER_PRICES.year)}/year.` : `${TRIAL_DAYS} days free, then ${money(choice.price)}/yr`
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
          Preview membership
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
          Your welcome offer
        </h3>
        <div className="offer-plans" role="radiogroup" aria-label="Offer">
          <button type="button" role="radio" aria-checked={plan === 'year'} className={plan === 'year' ? 'is-on' : ''} onClick={() => setPlan('year')}>
            <span className="pay-ring" aria-hidden="true">{plan === 'year' && <Check size={14} />}</span>
            <span>
              <b>Yearly · try free</b>
              <small>
                <s>{pricing.year.price}</s> {money(price)} first year · then {pricing.year.price}/yr
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
  ...STORY_SCREENS,
  welcome: OnboardingIntro,
  rhythm: Rhythm,
  'fix-demo': Restart,
  'midworkout-demo': MidWorkout,
  'rollover-demo': Rollover,
  'feel-demo': Feel,
  'paywall-plans': Plans,
}
export default function OnboardingStory({ step, ...props }) {
  const Screen = SCREENS[step]
  return Screen ? <Screen {...props} /> : null
}
