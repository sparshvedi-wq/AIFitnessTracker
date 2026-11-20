// Act 1 story screens: the restart loop in their own words, then one live demo
// for each answer, each running the real planner on temporary data. Also the
// research proof before the price, and session 1 after the plan is built.
import { useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import MannequinRegions from './MannequinRegions.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import { barrierLabel } from '../../lib/onboarding-demo.js'
import {
  energyDemo,
  goalMuscles,
  guideDemo,
  placesDemo,
  recentDemo,
  swapDemo,
  warmupDemo,
} from '../../lib/onboarding-story.js'
import { BASELINE_MINUTES } from '../../lib/baseline.js'
import { findExercise } from '../../lib/exercises.js'
import { exerciseThumb } from '../../lib/exercise-thumbs.js'
import {
  Check,
  Lede,
  Lock,
  MoveList,
  Thumb,
  Title,
  YouSaid,
  delay,
  useAutoplay,
} from './story-kit.jsx'

/* ── The restart loop ─────────────────────────────────────────────── */

const GOAL_ECHO = {
  'Build muscle': ['Give each muscle a turn.', 'Here’s what a session can cover.'],
  'Get stronger': ['Stronger, one set at a time.', 'The reps you log guide your next weight.'],
  'Lose weight': ['Make room for strength.', 'Strength stays in, even on short days.'],
  'General fitness': ['Start with a mix of moves.', 'Your whole body, in rotation.'],
}
function GoalEcho({ headingRef, state, profile, today, now }) {
  const muscles = useMemo(() => goalMuscles(state, profile, { today, now }), [state, profile, today, now])
  const [title, lede] = GOAL_ECHO[profile.goal] || GOAL_ECHO['General fitness']
  return (
    <div className="story">
      <Title headingRef={headingRef}>{title}</Title>
      <Lede>{lede}</Lede>
      <div className="goal-body story-in" style={delay(0.2)} role="img" aria-label={`Sample session ${muscles.join(', ')}`}>
        {['front', 'back'].map((view) => (
          <div className="goal-fig" key={view}>
            <MannequinRegions view={view} selected={muscles} />
          </div>
        ))}
      </div>
      <div className="goal-chips">
        <small>Sample session</small>
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
      <Title headingRef={headingRef}>See your first move.</Title>

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
      {!pair && <Lede>Your current setup has no matching swap for this example.</Lede>}
      {pair && swapped && (
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
  const drills = demo[mins] || []
  return (
    <div className="story">
      <Title headingRef={headingRef}>A warm-up made for {demo.name.toLowerCase()}.</Title>
      <div className="story-seg story-in" style={delay(0.1)} role="radiogroup" aria-label="Warm-up length">
        {[5, 10, 15].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === mins}
            className={m === mins ? 'is-on' : ''}
            onClick={() => {
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
  const place = places[at] || places[0]
  return (
    <div className="story">
      <Title headingRef={headingRef}>Same goal, different place.</Title>
      <Lede>Try another place to see the exercises change.</Lede>
      <div className="story-seg story-in" style={delay(0.1)} role="radiogroup" aria-label="Where are you today?">
        {places.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={i === at}
            className={i === at ? 'is-on' : ''}
            onClick={() => {
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
        <div className="recent-bars" role="img" aria-label={`Estimated chest recovery: ${demo.chest.map((v) => `${v}%`).join(', ')} over the next three days`}>
          {demo.chest.map((v, i) => (
            <div key={i} className="recent-bar">
              <span className="recent-fill" style={{ height: `${v}%`, ...delay(0.4 + i * 0.15) }} />
              <b>{v}%</b>
              <small>{['Now', 'Tomorrow', 'Day after'][i]}</small>
            </div>
          ))}
          <span className="recent-cap">Estimated recovery</span>
        </div>
      </div>
      <MoveList className="story-in" moves={demo.moves.slice(0, 3)} head="So today" />
      {!demo.chestToday && (
        <span className="story-chip pop-in" style={delay(1.1)}>
          <Check size={15} />
          Chest gets a break today.
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
      <Title headingRef={headingRef}>Keep a starting photo.</Title>
      <Lede>Compare the same three views at your next check-in.</Lede>
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
      <p className="photo-permission-note">
        <Lock size={16} /> AI review sends photos to OpenAI with your permission.
      </p>
    </div>
  )
}

/* The preview uses the same movements as the first workout. */

export function FirstSession({ headingRef, state, profile, name, plan, baseline }) {
  const first = name.trim().split(/\s+/)[0]
  const calibration = baseline.length > 0
  const items = calibration ? baseline : plan.items
  const moves = items.map((item) => {
    const exercise = findExercise(item.exId, state.customExercises)
    return {
      exId: item.exId, name: exercise?.name || item.exId, image: exerciseThumb(item.exId),
      detail: calibration ? '1 starting set' : item.sec ? `${item.sets} × ${item.sec} sec` :
        item.reps ? `${item.sets} × ${item.reps}` : `${item.sets} sets`,
    }
  })
  return (
    <div className="story story--flush first-session">
      <Title headingRef={headingRef}>{first ? `${first}, here’s your first session.` : 'Your first session is ready.'}</Title>
      <Lede>{calibration ? 'Start with one easy set of each move. Tally learns from what you log.' :
        profile.flexibleTime ? 'This is your starting plan. Change the time whenever you train.' :
        'Log the sets you finish. Tally uses them to plan your next session.'}</Lede>
      <MoveList moves={moves.slice(0, 2)} head={calibration ? 'Starting point' : plan.name}
        minutes={calibration ? BASELINE_MINUTES : plan.requestedMinutes} />
      {moves.length > 2 && <details className="session-more">
        <summary>See {moves.length - 2} more {moves.length === 3 ? 'exercise' : 'exercises'}</summary>
        <MoveList moves={moves.slice(2)} />
      </details>}
    </div>
  )
}

export const STORY_SCREENS = {
  'goal-demo': GoalEcho,
  'barrier-unsure-demo': Guide,
  'barrier-enjoyment-demo': Swap,
  'sport-demo': Warmup,
  'equipment-demo': Places,
  'recent-demo': Recent,
  'recovery-demo': Energy,
  'photo-demo': Photos,
}
