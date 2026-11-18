// Act 1 story screens: the restart loop in their own words, then one live demo
// for each answer, each running the real planner on temporary data. Also the
// research proof before the price, and session 1 after the plan is built.
import { useEffect, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import MannequinRegions from './MannequinRegions.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import { barrierLabel, FIRST_SESSION_OPTIONS } from '../../lib/onboarding-demo.js'
import { FALLOUT_OPTIONS, PLAN_STUDY, QUESTION_COPY, falloutStep } from '../../lib/onboarding-questions.js'
import {
  energyDemo,
  firstSession,
  goalMuscles,
  guideDemo,
  placesDemo,
  planChips,
  recentDemo,
  swapDemo,
  warmupDemo,
} from '../../lib/onboarding-story.js'
import { resolvePlace } from '../../lib/places.js'
import { exerciseThumb } from '../../lib/exercise-thumbs.js'
import { StoryOptions } from './OnboardingQuestions.jsx'
import {
  Check,
  Lede,
  Lock,
  MoveList,
  Thumb,
  Title,
  YouSaid,
  delay,
  reducedMotion,
  useAutoplay,
  useCountUp,
  useTimers,
} from './story-kit.jsx'

/* ── The restart loop ─────────────────────────────────────────────── */

function Fallout({ headingRef, profile, set, onChoose }) {
  const [question, why] = QUESTION_COPY.fallout
  return (
    <div className="story">
      <Title headingRef={headingRef}>{question}</Title>
      {why && <Lede>{why}</Lede>}
      <StoryOptions
        label={question}
        options={FALLOUT_OPTIONS.map(([id, title]) => ({ id, title }))}
        value={profile.onboardingFallout}
        onSelect={(id) => set({ onboardingFallout: id })}
        onDone={(id) => onChoose({ onboardingFallout: id })}
      />
    </div>
  )
}

// Four stops round a circle; a dot runs the loop, then Tally breaks it.
function Loop({ headingRef, profile }) {
  const [broken, setBroken] = useState(reducedMotion())
  const timers = useTimers()
  useEffect(() => {
    timers.later(() => setBroken(true), 3400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const theirs = falloutStep(profile.onboardingFallout)
  const stops = [
    ['top', 'A new plan', 'sparkle'],
    ['right', 'A busy week', 'clock'],
    ['bottom', theirs, 'you'],
    ['left', 'Motivation dips', 'arrowDown'],
  ]
  return (
    <div className="story">
      {profile.onboardingFallout && (
        <YouSaid>{FALLOUT_OPTIONS.find(([id]) => id === profile.onboardingFallout)?.[1]}</YouSaid>
      )}
      <Title headingRef={headingRef}>That’s the restart loop.</Title>
      <Lede>It’s not willpower. Fixed plans break.</Lede>
      <div
        className={`loop story-in ${broken ? 'is-broken' : ''}`}
        style={delay(0.15)}
        role="img"
        aria-label={`A loop: a new plan, a busy week, ${theirs.toLowerCase()}, motivation dips, and round again. Tally breaks it.`}
      >
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="104" className="loop-track" />
          <circle cx="150" cy="150" r="104" className="loop-run" transform="rotate(-90 150 150)" />
          <g className="loop-dot">
            <circle cx="150" cy="46" r="8" />
          </g>
        </svg>
        {stops.map(([at, label, icon], i) => (
          <span key={at} className={`loop-stop loop-stop--${at} ${i === 2 ? 'is-theirs' : ''}`}>
            <i>
              <Icon name={icon} size={15} strokeWidth={2.6} />
            </i>
            {label}
          </span>
        ))}
        <span className="loop-center">
          <b>{broken ? 'Tally' : '↻'}</b>
          {broken ? 'bends the plan' : 'again'}
        </span>
      </div>
      {broken && (
        <span className="story-chip story-chip--accent pop-in">
          <Check size={15} />
          Busy week? Shorter plan, no restart.
        </span>
      )}
    </div>
  )
}

/* ── Answers, demonstrated ────────────────────────────────────────── */

const GOAL_ECHO = {
  'Build muscle': ['Muscle, built in balance.', 'Every muscle gets its share.'],
  'Get stronger': ['Stronger, one set at a time.', 'Each set picks your next weight.'],
  'Lose weight': ['Keep your muscle. Keep moving.', 'Strength stays in, even on short days.'],
  'General fitness': ['Fitter, head to toe.', 'Your whole body, in rotation.'],
}
function GoalEcho({ headingRef, state, profile, today, now }) {
  const muscles = useMemo(() => goalMuscles(state, profile, { today, now }), [state, profile, today, now])
  const [title, lede] = GOAL_ECHO[profile.goal] || GOAL_ECHO['General fitness']
  return (
    <div className="story">
      <YouSaid>{profile.goal === 'General fitness' ? 'Feel fitter' : profile.goal}</YouSaid>
      <Title headingRef={headingRef}>{title}</Title>
      <Lede>{lede}</Lede>
      <div className="goal-body story-in" style={delay(0.2)} role="img" aria-label={`Session 1 trains ${muscles.join(', ')}`}>
        {['front', 'back'].map((view) => (
          <div className="goal-fig" key={view}>
            <MannequinRegions view={view} selected={muscles} />
          </div>
        ))}
      </div>
      <div className="goal-chips">
        <small>Session 1 trains</small>
        {muscles.map((m, i) => (
          <span key={m} className="pop-in" style={delay(0.7 + i * 0.12)}>
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}

function Guide({ headingRef, state, profile, today, now }) {
  const g = useMemo(() => guideDemo(state, profile, { today, now }), [state, profile, today, now])
  return (
    <div className="story">
      <YouSaid>{barrierLabel('unsure')}</YouSaid>
      <Title headingRef={headingRef}>Never guess a move again.</Title>
      <Lede>Every move comes with a how-to.</Lede>
      {g && (
        <div className="gcard story-in" style={delay(0.2)}>
          <div className="gcard-pic">
            {g.image ? <img src={g.image} alt="" /> : <Icon name="dumbbell" size={40} />}
            <span className="gcard-tag">
              <Icon name="info" size={14} strokeWidth={2.6} />
              Guide
            </span>
          </div>
          <div className="gcard-info">
            <b>{g.name}</b>
            <small>Works {String(g.works).toLowerCase()}</small>
            <div className="gcard-row is-do" style={delay(0.6)}>
              <span><Check size={13} /></span>
              {g.cue}
            </div>
            {g.mistake && (
              <div className="gcard-row is-watch" style={delay(0.85)}>
                <span>!</span>
                Watch for: {g.mistake.charAt(0).toLowerCase() + g.mistake.slice(1)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Swap({ headingRef, state, profile, today, now }) {
  const pair = useMemo(() => swapDemo(state, profile, { today, now }), [state, profile, today, now])
  const [swapped, setSwapped] = useState(false)
  const [tap, setTap] = useState(false)
  const auto = useAutoplay([
    [1500, () => setTap(true)],
    [1900, () => setSwapped(true)],
    [2600, () => setTap(false)],
  ])
  const move = pair ? (swapped ? pair.to : pair.from) : null
  return (
    <div className="story">
      <YouSaid>{barrierLabel('enjoyment')}</YouSaid>
      <Title headingRef={headingRef}>Don’t like a move? Swap it.</Title>
      {move && (
        <div className="swap-card story-in" style={delay(0.2)}>
          <div key={move.exId} className="swap-pic">
            {move.image ? <img src={move.image} alt="" /> : <Icon name="dumbbell" size={40} />}
          </div>
          <div className="swap-info">
            <small>{swapped ? 'Swapped in' : 'In your plan'}</small>
            <b key={move.exId} className="tick-in">{move.name}</b>
            <span className="swap-muscle">{move.muscle}</span>
          </div>
          <button
            type="button"
            className={`swap-btn ${tap && !auto.touched.current ? 'is-autotap' : ''}`}
            onClick={() => {
              auto.touch()
              setSwapped((v) => !v)
            }}
          >
            <Icon name="repeat" size={17} strokeWidth={2.6} />
            {swapped ? 'Undo' : 'Swap'}
          </button>
        </div>
      )}
      {swapped && (
        <span className="story-chip pop-in">
          <Check size={15} />
          Same muscle, new move.
        </span>
      )}
    </div>
  )
}

function Warmup({ headingRef, profile }) {
  const demo = useMemo(() => warmupDemo(profile), [profile])
  const [mins, setMins] = useState(5)
  const auto = useAutoplay([[1600, () => setMins(10)]])
  const drills = demo[mins] || []
  return (
    <div className="story">
      <Title headingRef={headingRef}>A warm-up made for {demo.name.toLowerCase()}.</Title>
      <Lede>Sized to the time before you play.</Lede>
      <div className="story-seg story-in" style={delay(0.1)} role="radiogroup" aria-label="Warm-up length">
        {[5, 10, 15].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === mins}
            className={`${m === mins ? 'is-on' : ''} ${m === mins && m === 10 && !auto.touched.current ? 'is-autotap' : ''}`}
            onClick={() => {
              auto.touch()
              setMins(m)
            }}
          >
            {m} min
          </button>
        ))}
      </div>
      <div className="story-card story-in" style={delay(0.2)}>
        <div className="story-card-head">
          <span>Warm-up</span>
          <b key={mins} className="tick-in">{drills.length} drills</b>
        </div>
        <div aria-live="polite">
          {drills.map((d, i) => (
            <div key={`${mins}${d.exId}${i}`} className="story-move" style={delay(i * 0.04)}>
              <span className="drill-n" aria-hidden="true">{i + 1}</span>
              <div className="story-move-name flex-1">{d.name}</div>
              <span className="story-move-detail">{d.sec >= 60 ? `${Math.floor(d.sec / 60)}:${String(d.sec % 60).padStart(2, '0')}` : `${d.sec}s`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Places({ headingRef, state, profile, today, now }) {
  const places = useMemo(() => placesDemo(state, profile, { today, now }), [state, profile, today, now])
  const [at, setAt] = useState(0)
  const auto = useAutoplay([[1700, () => setAt(1)]])
  const place = places[at] || places[0]
  return (
    <div className="story">
      <Title headingRef={headingRef}>Gym, home or a hotel room.</Title>
      <Lede>Pick a place. The session rebuilds.</Lede>
      <div className="story-seg story-in" style={delay(0.1)} role="radiogroup" aria-label="Where are you today?">
        {places.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={i === at}
            className={`${i === at ? 'is-on' : ''} ${i === at && i === 1 && !auto.touched.current ? 'is-autotap' : ''}`}
            onClick={() => {
              auto.touch()
              setAt(i)
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <MoveList key={place.id} className="story-in" moves={place.moves} head={place.id === 'on-the-go' ? 'Today, on the go' : `Today at ${place.name}`} />
      {at > 0 && (
        <span key={at} className="story-chip pop-in">
          <Icon name="repeat" size={15} strokeWidth={2.6} />
          Rebuilt for what’s there
        </span>
      )}
    </div>
  )
}

function Recent({ headingRef, state, profile, today, now }) {
  const demo = useMemo(() => recentDemo(state, profile, { today, now }), [state, profile, today, now])
  return (
    <div className="story">
      <Title headingRef={headingRef}>It remembers yesterday.</Title>
      <Lede>Tired muscles get time off.</Lede>
      <div className="recent-card story-in" style={delay(0.15)}>
        <div className="recent-top">
          <Thumb src={exerciseThumb('bench-press')} />
          <div>
            <small>Yesterday · example</small>
            <b>Bench press · 4 hard sets</b>
          </div>
        </div>
        <div className="recent-bars" role="img" aria-label={`Chest recovery: ${demo.chest.map((v) => `${v}%`).join(', ')} over the next three days`}>
          {demo.chest.map((v, i) => (
            <div key={i} className="recent-bar">
              <span className="recent-fill" style={{ height: `${v}%`, ...delay(0.4 + i * 0.15) }} />
              <b>{v}%</b>
              <small>{['Now', 'Tomorrow', 'Day after'][i]}</small>
            </div>
          ))}
          <span className="recent-cap">Chest recovery</span>
        </div>
      </div>
      <MoveList className="story-in" moves={demo.moves.slice(0, 3)} head="So today" />
      {!demo.chestToday && (
        <span className="story-chip pop-in" style={delay(1.1)}>
          <Check size={15} />
          Chest rests. Everything else trains.
        </span>
      )}
    </div>
  )
}

function Energy({ headingRef, state, profile, today, now }) {
  const [energy, setEnergy] = useState('normal')
  const [sore, setSore] = useState(null)
  const auto = useAutoplay([
    [1400, () => setEnergy('low')],
    [2300, () => setSore('Legs')],
  ])
  const moves = useMemo(
    () => energyDemo(state, profile, { today, now, energy, sore }),
    [state, profile, today, now, energy, sore],
  )
  const pick = (fn) => (v) => {
    auto.touch()
    fn(v)
  }
  const changed = energy !== 'normal' || sore
  return (
    <div className="story">
      <Title headingRef={headingRef}>Rough day? Just say so.</Title>
      <Lede>Tap how you feel.</Lede>
      <div className="energy-picks story-in" style={delay(0.1)}>
        <div role="radiogroup" aria-label="Energy today">
          <small>Energy</small>
          {[
            ['normal', 'Usual'],
            ['low', 'Low'],
          ].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={energy === id} className={`${energy === id ? 'is-on' : ''} ${energy === id && id === 'low' && !auto.touched.current ? 'is-autotap' : ''}`} onClick={() => pick(setEnergy)(id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Sore today">
          <small>Sore</small>
          {[
            [null, 'None'],
            ['Legs', 'Legs'],
            ['Shoulders', 'Shoulders'],
          ].map(([id, label]) => (
            <button key={label} type="button" role="radio" aria-checked={sore === id} className={`${sore === id ? 'is-on' : ''} ${sore === id && id === 'Legs' && !auto.touched.current ? 'is-autotap' : ''}`} onClick={() => pick(setSore)(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <MoveList
        key={`${energy}${sore}`}
        moves={moves}
        head={changed ? [energy === 'low' && 'Lighter', sore && `no ${sore.toLowerCase()}`].filter(Boolean).join(', ') : 'Today'}
      />
    </div>
  )
}

function Photos({ headingRef }) {
  return (
    <div className="story">
      <Title headingRef={headingRef}>Start with a snapshot of you.</Title>
      <Lede>Retake in a few weeks and compare.</Lede>
      <div className="snap-row story-in" style={delay(0.15)}>
        {[
          ['Front', ONBOARDING_ART.neutral],
          ['Side', '/onboarding/m1-photo-side.webp'],
          ['Back', '/onboarding/m1-photo-back.webp'],
        ].map(([label, src], i) => (
          <figure key={label} style={delay(0.25 + i * 0.12)}>
            <img src={src} alt="" />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
      <div className="snap-pills">
        {[
          ['repeat', 'Compare later'],
          [null, 'Private'],
          ['x', 'Skip anytime'],
        ].map(([icon, text], i) => (
          <span key={text} className="snap-pill story-in" style={delay(0.5 + i * 0.08)}>
            {icon ? <Icon name={icon} size={16} strokeWidth={2.6} /> : <Lock size={16} />}
            {text}
          </span>
        ))}
      </div>
      <p className="story-fine story-in" style={delay(0.8)}>
        Reviewed by OpenAI only with your OK.
      </p>
    </div>
  )
}

/* ── Proof before the price ───────────────────────────────────────── */

const WHEN_SAY = { now: 'right now', later: 'later today' }
function Proof({ headingRef, profile }) {
  const picked = WHEN_SAY[profile.firstSession]
  const a = useCountUp(PLAN_STUDY.planned, 1400)
  const b = useCountUp(PLAN_STUDY.others, 1400)
  return (
    <div className="story">
      {picked && <YouSaid>{FIRST_SESSION_OPTIONS.find(([id]) => id === profile.firstSession)?.[1]}</YouSaid>}
      <Title headingRef={headingRef}>{picked ? 'You just did what works.' : 'Picking a time is what works.'}</Title>
      <Lede>Picking a time more than doubles your odds.</Lede>
      <div className="proof-bars story-in" style={delay(0.15)} role="img" aria-label={`${PLAN_STUDY.planned}% of people who decided when exercised that week, against ${PLAN_STUDY.others}% of others`}>
        <div className="proof-col is-win">
          <b>{a}%</b>
          <span className="proof-col-bar">
            <i style={{ height: `${PLAN_STUDY.planned}%` }} />
          </span>
          <small>Decided when</small>
        </div>
        <div className="proof-col">
          <b>{b}%</b>
          <span className="proof-col-bar">
            <i style={{ height: `${PLAN_STUDY.others}%` }} />
          </span>
          <small>Just meant to</small>
        </div>
      </div>
      <p className="story-fine">Exercised within a week. {PLAN_STUDY.source}.</p>
      <span className="story-chip story-chip--accent pop-in" style={delay(1.6)}>
        <Check size={15} />
        {picked ? `Session 1 is ready ${picked}.` : 'A session waits for you.'}
      </span>
    </div>
  )
}

/* ── Session 1 ────────────────────────────────────────────────────── */

export function FirstSession({ headingRef, state, profile, name, today, now, goalMode, weeklyGoal, startingPoint }) {
  const session = useMemo(() => firstSession(state, profile, { today, now }), [state, profile, today, now])
  const first = name.trim().split(' ')[0]
  const chips = planChips(profile, { goalMode, weeklyGoal, placeName: resolvePlace(profile, profile.location)?.name })
  return (
    <div className="story story--flush">
      <Title headingRef={headingRef}>
        {startingPoint ? 'Here’s a day of your plan.' : first ? `${first}, session 1 is ready.` : 'Session 1 is ready.'}
      </Title>
      <Lede>Built from your answers.</Lede>
      <div className="first-chips story-in" style={delay(0.12)}>
        {chips.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <MoveList className="story-in" moves={session.moves} head={`${session.name} · ${session.moves.length} moves`} />
    </div>
  )
}

export const STORY_SCREENS = {
  fallout: Fallout,
  'loop-demo': Loop,
  'goal-demo': GoalEcho,
  'barrier-unsure-demo': Guide,
  'barrier-enjoyment-demo': Swap,
  'sport-demo': Warmup,
  'equipment-demo': Places,
  'recent-demo': Recent,
  'recovery-demo': Energy,
  'photo-demo': Photos,
  'proof-demo': Proof,
}
