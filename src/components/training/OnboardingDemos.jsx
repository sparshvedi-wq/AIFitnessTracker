import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { SetupIllustration } from './SetupVisuals.jsx'
import { onboardingScene } from '../../lib/onboarding-art.js'
import {
  onboardingDemoPlan,
  consistencyExample,
  planningTimeExample,
  planIngredients,
  firstWeeks,
  offerPoints,
  offerPricing,
  pickedBarriers,
  barrierLabel,
  BARRIER_ANSWERS,
  DROPOUT_FACT,
} from '../../lib/onboarding-demo.js'
import { buildSportWarmup, SPORTS } from '../../lib/sports.js'
import { findExercise } from '../../lib/exercises.js'
import { exerciseThumb } from '../../lib/exercise-thumbs.js'
import { placesOf, resolvePlace, quietAt } from '../../lib/places.js'
import { movementPreferences } from '../../lib/movement-preferences.js'

// The eyebrow ties each demonstration to the answer that earned it.
function DemoHeading({ title, eyebrow = 'Your plan in action', children }) {
  return (
    <div className="funnel-heading">
      <span className="funnel-eyebrow">{eyebrow}</span>
      <h3 tabIndex={-1}>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}
function Switches({ label, options, value, onChange }) {
  return (
    <div className="demo-switches" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  )
}
function MoveList({ moves, limit = 3 }) {
  return (
    <ul className="demo-moves">
      {moves.slice(0, limit).map((m, i) => (
        <li key={`${m.exId}:${i}`}>
          <span className="demo-move-art" aria-hidden="true">
            {m.image ? <img src={m.image} alt="" decoding="async" /> : <Icon name="train" size={23} />}
          </span>
          <span className="demo-move-name">
            {m.name}
            <small>{m.muscle}</small>
          </span>
          <span className="demo-dose">
            {m.sets} × {m.sec ? `${m.sec}s` : m.reps}
          </span>
        </li>
      ))}
    </ul>
  )
}
function SessionPreview({ plan, title, shownMoves = plan.moves, limit = 3 }) {
  return (
    <div
      className="demo-session"
      key={`${plan.location}:${plan.requestedMinutes}:${plan.moves.map((m) => m.exId).join(',')}`}
    >
      <div className="demo-session-top">
        <span>{title || 'Your training'}</span>
        <span>{plan.requestedMinutes} min</span>
      </div>
      {plan.moves.length ? (
        <>
          <MoveList moves={shownMoves} limit={limit} />
          <div className="demo-session-foot">
            <span>{plan.moves.length} moves</span>
            <span>{plan.items.reduce((n, it) => n + it.sets, 0)} sets</span>
            <Icon name="check" size={16} />
          </div>
        </>
      ) : (
        <p className="demo-empty">No exercises fit these choices. Adjust your equipment or areas to avoid.</p>
      )}
    </div>
  )
}

export function ProductWelcome({ state, profile, today, now, headingRef }) {
  const [minutes, setMinutes] = useState(30)
  const plan = useMemo(
    () => onboardingDemoPlan(state, profile, { today, now, minutes }),
    [state, profile, today, now, minutes],
  )
  return (
    <div className="funnel-welcome">
      <div className="funnel-welcome-art">
        <SetupIllustration scene="welcome" />
      </div>
      <h3 ref={headingRef} tabIndex={-1}>
        The plan you’ll
        <br />
        actually stick to.
      </h3>
      <p className="funnel-welcome-copy">It fits your time, your place and how you feel. Try it.</p>
      <Switches
        label="Try a workout length"
        value={minutes}
        onChange={setMinutes}
        options={[
          [15, '15 min'],
          [30, '30 min'],
          [45, '45 min'],
        ]}
      />
      <SessionPreview plan={plan} title="Tap a time. Watch it adapt." />
      <p className="funnel-welcome-note">About 3 minutes · No sign-up</p>
    </div>
  )
}

function TimeDemo({ state, profile, today, now, eyebrow, title = 'Busy day? 15 minutes still counts.' }) {
  const [minutes, setMinutes] = useState(profile.flexibleTime ? 15 : profile.minutes)
  const options = [...new Set([15, 30, profile.minutes])].sort((a, b) => a - b).map((m) => [m, `${m} min`])
  const plan = useMemo(
    () => onboardingDemoPlan(state, profile, { today, now, minutes }),
    [state, profile, today, now, minutes],
  )
  return (
    <>
      <DemoHeading title={title} eyebrow={eyebrow}>
        Tap a shorter time. Same goal, nothing wasted.
      </DemoHeading>
      <SetupIllustration scene="time" variant="compact" />
      <Switches label="Preview workout length" options={options} value={minutes} onChange={setMinutes} />
      <SessionPreview plan={plan} />
    </>
  )
}
function EquipmentDemo({ state, profile, today, now }) {
  const [place, setPlace] = useState(profile.location)
  const locations = placesOf(profile).filter((p) =>
    ['gym', 'home', 'on-the-go', profile.location].includes(p.id),
  )
  const plan = useMemo(
    () => onboardingDemoPlan(state, profile, { today, now, location: place }),
    [state, profile, today, now, place],
  )
  return (
    <>
      <DemoHeading title="Travelling? Gym packed? Still on plan.">
        Switch place and the session rebuilds around what’s there.
      </DemoHeading>
      <SetupIllustration
        scene={onboardingScene('location', { ...profile, location: place })}
        variant="compact"
      />
      <Switches
        label="Preview training location"
        options={locations.map((p) => [p.id, p.name])}
        value={place}
        onChange={setPlace}
      />
      <SessionPreview plan={plan} title={resolvePlace(profile, place).name} />
    </>
  )
}
function GuideDemo({ state, profile, today, now, eyebrow }) {
  const [show, setShow] = useState(false)
  const plan = useMemo(() => onboardingDemoPlan(state, profile, { today, now }), [state, profile, today, now])
  const move = plan.moves.find((m) => m.image) || plan.moves[0]
  const ex = move && findExercise(move.exId, state.customExercises)
  return (
    <>
      <DemoHeading title="Never wonder what to do next." eyebrow={eyebrow}>
        Every move comes with how to do it.
      </DemoHeading>
      {move ? (
        <div className="demo-guide">
          {move.image && <img src={move.image} alt={`Start and finish positions for ${move.name}`} />}
          <h4>{move.name}</h4>
          <span className="demo-guide-dose">
            {move.sets} sets · {move.sec ? `${move.sec} sec` : `${move.reps} reps`}
          </span>
          <button className="btn-secondary w-full mt-4" onClick={() => setShow(!show)} aria-expanded={show}>
            <Icon name="play" size={16} />
            {show ? 'Hide technique' : 'Show me how'}
          </button>
          {show && (
            <ol className="demo-cues">
              {(ex?.cues || []).slice(0, 3).map((cue, i) => (
                <li key={cue}>
                  <span>{i + 1}</span>
                  {cue}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <SessionPreview plan={plan} />
      )}
    </>
  )
}
function SwapDemo({ state, profile, today, now, eyebrow }) {
  const [changed, setChanged] = useState(false)
  const original = useMemo(
    () => onboardingDemoPlan(state, profile, { today, now }),
    [state, profile, today, now],
  )
  const plan = useMemo(
    () =>
      changed && original.moves.length
        ? onboardingDemoPlan(
            state,
            {
              ...profile,
              excludedExercises: [...(profile.excludedExercises || []), original.moves[0].exId],
            },
            { today, now },
          )
        : original,
    [state, profile, today, now, changed, original],
  )
  // Put the replacement in view even when it lands later in the real plan.
  const originalIds = new Set(original.moves.map((m) => m.exId))
  const shownMoves = changed
    ? [...plan.moves].sort((a, b) => Number(originalIds.has(a.exId)) - Number(originalIds.has(b.exId)))
    : plan.moves
  return (
    <>
      <DemoHeading title="Don’t like a move? Swap it." eyebrow={eyebrow}>
        Same muscles, an exercise you’d rather do.
      </DemoHeading>
      <SessionPreview
        plan={plan}
        shownMoves={shownMoves}
        title={changed ? 'Alternative workout' : 'Your training'}
      />
      <button
        className="btn-secondary mt-4 w-full"
        disabled={!original.moves.length}
        onClick={() => setChanged(!changed)}
      >
        <Icon name="repeat" size={18} />
        {changed ? 'Show original workout' : 'Try a different exercise'}
      </button>
    </>
  )
}
function RolloverDemo({ state, profile, today, now, eyebrow }) {
  const [short, setShort] = useState(false)
  const plan = useMemo(() => onboardingDemoPlan(state, profile, { today, now }), [state, profile, today, now])
  const shown = plan.moves.slice(0, 3)
  return (
    <>
      <DemoHeading title="A bad week doesn’t break the plan." eyebrow={eyebrow}>
        Leave early and what you did still counts.
      </DemoHeading>
      <div className="rollover-demo">
        <span className="demo-example">Example session</span>
        {shown.map((m, i) => (
          <div className={`rollover-move ${i === 0 ? 'is-done' : short ? 'is-later' : ''}`} key={m.exId}>
            <Icon name={i === 0 ? 'check' : short ? 'repeat' : 'train'} size={19} />
            <span>{m.name}</span>
            <small>{i === 0 ? 'Done' : short ? 'Reconsider next time' : 'Up next'}</small>
          </div>
        ))}
        <button className="btn-secondary mt-4 w-full" onClick={() => setShort(!short)}>
          {short ? 'Replay example' : 'Try ending early'}
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
      {short && (
        <div className="demo-takeaway">
          <Icon name="check" size={18} />
          <span>Nothing is owed. Your next session is planned from where you are.</span>
        </div>
      )}
    </>
  )
}
function GoalDemo({ state, profile, today, now }) {
  const plan = useMemo(() => onboardingDemoPlan(state, profile, { today, now }), [state, profile, today, now])
  const muscles = [...new Set(plan.moves.map((m) => m.muscle))].filter(Boolean).map((muscle) => ({
    muscle,
    sets: plan.moves.filter((m) => m.muscle === muscle).reduce((n, m) => n + m.sets, 0),
  }))
  const max = Math.max(1, ...muscles.map((m) => m.sets))
  return (
    <>
      <DemoHeading
        eyebrow="Your plan is taking shape"
        title={
          {
            'Build muscle': 'Every muscle gets its share.',
            'Get stronger': 'Built around the lifts that make you stronger.',
            'Lose weight': 'Strength work you can keep coming back to.',
          }[profile.goal] || 'A bit of everything, every session.'
        }
      />
      <SetupIllustration scene={onboardingScene('goal', profile)} variant="compact" />
      <div className="demo-goal-card">
        <span className="demo-example">
          {profile.goal === 'General fitness' ? 'Feel fitter' : profile.goal}
        </span>
        <h4>Your first-session mix</h4>
        <div
          className="demo-muscle-bars"
          role="img"
          aria-label={muscles.map((m) => `${m.muscle}: ${m.sets} planned sets`).join(', ')}
        >
          {muscles.slice(0, 5).map((m) => (
            <div key={m.muscle}>
              <span>{m.muscle}</span>
              <i>
                <b style={{ width: `${(m.sets / max) * 100}%` }} />
              </i>
              <strong>{m.sets}</strong>
            </div>
          ))}
        </div>
      </div>
      <p className="demo-caption">Built from one answer. It gets sharper with every one you give.</p>
    </>
  )
}
function SportDemo({ profile }) {
  const [sport, setSport] = useState(profile.sports[0] || 'tennis')
  const [minutes, setMinutes] = useState(10)
  const warmup = useMemo(
    () =>
      buildSportWarmup(sport, minutes, {
        avoidMuscles: profile.avoidMuscles,
        movement: movementPreferences(profile, profile.location),
        lowImpact: quietAt(profile, profile.location),
      }),
    [sport, minutes, profile],
  )
  const moves = warmup.items.map((m) => ({
    ...m,
    name: findExercise(m.exId)?.name,
    muscle: m.phaseLabel,
    image: exerciseThumb(m.exId),
  }))
  const phases = moves.filter((m, i) => moves.findIndex((other) => other.muscle === m.muscle) === i)
  return (
    <>
      <DemoHeading
        title={`A warm-up built for ${(SPORTS.find((s) => s.id === sport)?.name || 'your sport').toLowerCase()}.`}
      />
      {profile.sports.length > 1 && (
        <Switches
          label="Preview sport"
          options={profile.sports.map((id) => [id, SPORTS.find((s) => s.id === id)?.name || id])}
          value={sport}
          onChange={setSport}
        />
      )}
      <Switches
        label="Preview warm-up length"
        options={[
          [5, '5 min'],
          [10, '10 min'],
          [15, '15 min'],
        ]}
        value={minutes}
        onChange={setMinutes}
      />
      <SessionPreview
        plan={{ ...warmup, requestedMinutes: minutes, moves }}
        shownMoves={phases}
        limit={4}
        title={SPORTS.find((s) => s.id === sport)?.name}
      />
    </>
  )
}
function ConsistencyDemo() {
  const { steady, occasional, steadyMinutes, occasionalMinutes } = consistencyExample()
  const path = (values) =>
    [0, ...values].map((v, i) => `${i ? 'L' : 'M'}${24 + i * 36} ${225 - (v / 240) * 180}`).join(' ')
  return (
    <>
      <DemoHeading title="Showing up beats going hard.">
        Two short sessions a week add up to more than the occasional big one.
      </DemoHeading>
      <div className="consistency-chart">
        <span className="demo-example">8-week example · training time</span>
        <svg
          viewBox="0 0 336 262"
          role="img"
          aria-label="Illustrative schedule: two 15-minute workouts each week add up to four hours over eight weeks. Three occasional hour-long sessions add up to three hours."
        >
          {[45, 105, 165, 225].map((y) => (
            <path className="chart-grid" key={y} d={`M24 ${y}H312`} />
          ))}
          <path className="chart-occasional" d={path(occasional)} />
          <path className="chart-steady" d={path(steady)} />
          <circle cx="312" cy="45" r="5" className="chart-dot" />
          <text x="24" y="251">
            Start
          </text>
          <text x="265" y="251">
            Week 8
          </text>
        </svg>
        <div className="chart-legend">
          <span>
            <i />
            15 min, twice a week<strong>{steadyMinutes / 60} hours</strong>
          </span>
          <span>
            <i />
            60 min, three in total<strong>{occasionalMinutes / 60} hours</strong>
          </span>
        </div>
      </div>
      <div className="demo-takeaway">
        <Icon name="check" size={18} />
        <span>That’s why Tally never asks for a perfect week. Just the next session.</span>
      </div>
      <p className="demo-caption">Training-time arithmetic, not a prediction of results.</p>
    </>
  )
}
function PlanningDemo({ profile }) {
  const [minutes, setMinutes] = useState(5)
  const saving = planningTimeExample(minutes, 3, 12, profile.flexibleTime ? 30 : profile.minutes)
  return (
    <>
      <DemoHeading title="Stop spending workouts deciding." />
      <div className="planning-example">
        <span className="demo-example">If choosing a workout takes…</span>
        <Switches
          label="Example planning minutes"
          value={minutes}
          onChange={setMinutes}
          options={[
            [2, '2 min'],
            [5, '5 min'],
            [10, '10 min'],
          ]}
        />
        <div className="planning-total">
          <strong>{saving.hours}</strong>
          <span>
            {saving.hours === 1 ? 'hour' : 'hours'} of deciding
            <br />
            over 12 weeks
          </span>
        </div>
        {saving.workouts >= 1 && (
          <p className="planning-equivalent">
            That’s {saving.workouts} of your {saving.workoutMinutes}-minute{' '}
            {saving.workouts === 1 ? 'session' : 'sessions'}, spent choosing what to do.
          </p>
        )}
        <div className="planning-blocks" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ height: `${26 + minutes * 3}px` }} />
          ))}
        </div>
        <p>Example: 3 workouts a week × {minutes} minutes of planning.</p>
      </div>
      <p className="demo-caption">Tally picks the exercises, sets and weights. You just start.</p>
    </>
  )
}
function RecoveryDemo({ state, profile, today, now }) {
  const [easy, setEasy] = useState(false)
  const plan = useMemo(
    () => onboardingDemoPlan(state, profile, { today, now, sore: easy ? ['Legs', 'Glutes'] : [] }),
    [state, profile, today, now, easy],
  )
  return (
    <>
      <DemoHeading title="Sore? The plan works around it.">Say how you feel before any session.</DemoHeading>
      <Switches
        label="Preview soreness adjustment"
        value={easy}
        onChange={setEasy}
        options={[
          [false, 'Feeling good'],
          [true, 'Legs feel sore'],
        ]}
      />
      <div className="recovery-demo-signal">
        <Icon name={easy ? 'sliders' : 'check'} size={22} />
        <span>{easy ? 'Leg work gets a lighter touch.' : 'Your usual training.'}</span>
      </div>
      <SessionPreview plan={plan} />
    </>
  )
}

// Why plans fail, and why this one is different: the obstacle the person
// just named is put down to the plan, not to them, and answered line by line.
function WhyDemo({ profile }) {
  const barriers = pickedBarriers(profile)
  return (
    <>
      <DemoHeading
        eyebrow="Why most plans don’t last"
        title={barriers.length ? 'It was never your willpower.' : 'Staying consistent is the whole game.'}
      />
      <div className="why-stat">
        <strong>{DROPOUT_FACT.figure}</strong>
        <span>
          {DROPOUT_FACT.text}
          <small>{DROPOUT_FACT.source}</small>
        </span>
      </div>
      <p className="why-copy">
        A fixed plan assumes a perfect week. The first time life gets in the way, it breaks, and it feels like
        you did.
      </p>
      {barriers.length > 0 ? (
        <ul className="why-answers" aria-label="What Tally does about it">
          {barriers.map((id) => (
            <li key={id}>
              <span className="why-said">“{barrierLabel(id)}”</span>
              <span className="why-answer">
                <Icon name="check" size={16} strokeWidth={3} />
                {BARRIER_ANSWERS[id]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="demo-takeaway">
          <Icon name="check" size={18} />
          <span>Tally keeps it that way: the plan bends before a bad week turns into a missed month.</span>
        </div>
      )}
    </>
  )
}

// The plan being put together, one true line at a time.
function BuildingDemo({ state, profile, today, now, name = '' }) {
  const plan = useMemo(() => onboardingDemoPlan(state, profile, { today, now }), [state, profile, today, now])
  const lines = planIngredients(profile, plan, resolvePlace(profile, profile.location).name)
  const first = name.trim().split(' ')[0]
  return (
    <>
      <DemoHeading
        eyebrow="Putting it together"
        title={first ? `Building ${first}’s plan` : 'Building your plan'}
      >
        From everything you told me.
      </DemoHeading>
      <ul className="building-list">
        {lines.map((line, i) => (
          <li key={line} style={{ animationDelay: `${180 + i * 260}ms` }}>
            <span aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={3.2} />
            </span>
            {line}
          </li>
        ))}
      </ul>
    </>
  )
}

export default function OnboardingDemo({ step, ...props }) {
  const barriers = pickedBarriers(props.profile)
  const [barrier, setBarrier] = useState(barriers[0])
  // The person's own words head the demonstration that answers them.
  const said = step === 'barrier-demo' && barrier ? `You said: “${barrierLabel(barrier)}”` : undefined
  const kind =
    step === 'barrier-demo'
      ? {
          time: 'time-demo',
          unsure: 'guide',
          schedule: 'rollover',
          enjoyment: 'swap',
          starting: 'guide',
        }[barrier] || 'guide'
      : step
  const content = useRef(null)
  useEffect(() => {
    content.current?.querySelector('h3')?.focus({ preventScroll: true })
  }, [step])
  return (
    <div className="onboarding-demo" ref={content}>
      {step === 'barrier-demo' && barriers.length > 1 && (
        <label className="demo-obstacle-switch">
          <span>See how Tally handles</span>
          <select
            className="input"
            aria-label="See how Tally handles"
            value={barrier}
            onChange={(e) => setBarrier(e.target.value)}
          >
            {barriers.map((id) => (
              <option key={id} value={id}>
                {barrierLabel(id)}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'goal-demo' && <GoalDemo {...props} />}
      {kind === 'why-demo' && <WhyDemo {...props} />}
      {kind === 'building-demo' && <BuildingDemo {...props} />}
      {kind === 'time-demo' && (
        <TimeDemo
          {...props}
          eyebrow={said}
          {...(step === 'time-demo' ? { title: 'Short on time? The plan shrinks. It doesn’t vanish.' } : {})}
        />
      )}
      {kind === 'equipment-demo' && <EquipmentDemo {...props} />}
      {kind === 'sport-demo' && <SportDemo {...props} />}
      {kind === 'guide' && <GuideDemo {...props} eyebrow={said} />}
      {kind === 'swap' && <SwapDemo {...props} eyebrow={said} />}
      {kind === 'rollover' && <RolloverDemo {...props} eyebrow={said} />}
      {kind === 'consistency-demo' && <ConsistencyDemo />}
      {kind === 'planning-demo' && <PlanningDemo {...props} />}
      {kind === 'recovery-demo' && <RecoveryDemo {...props} />}
    </div>
  )
}

export function OnboardingPlanPreview({
  plan,
  profile,
  name,
  customExercises = [],
  title = 'Your first workout',
  startingPoint = false,
  headingRef,
}) {
  const reasons = pickedBarriers(profile)
    .slice(0, 2)
    .map((id) => BARRIER_ANSWERS[id])
  const moves = plan.items.map((m) => ({
    ...m,
    name: findExercise(m.exId, customExercises)?.name,
    muscle: findExercise(m.exId, customExercises)?.muscle,
    image: exerciseThumb(m.exId),
  }))
  return (
    <div className="funnel-plan-preview">
      <span className="funnel-plan-check">
        <Icon name="check" size={30} />
      </span>
      <h3 ref={headingRef} tabIndex={-1}>
        {name.trim() ? `${name.trim().split(' ')[0]}, your plan is ready.` : 'Your plan is ready.'}
      </h3>
      <div className="funnel-plan-tags">
        <span>{profile.goal === 'General fitness' ? 'Feel fitter' : profile.goal}</span>
        <span>{resolvePlace(profile, profile.location).name}</span>
        <span>
          {profile.variety === 'familiar'
            ? 'Familiar moves'
            : profile.variety === 'more'
              ? 'More variety'
              : 'A balanced mix'}
        </span>
      </div>
      {reasons.length > 0 && (
        <ul className="funnel-plan-reasons" aria-label="Built around what you told me">
          {reasons.map((line) => (
            <li key={line}>
              <Icon name="check" size={16} strokeWidth={3} />
              {line}
            </li>
          ))}
        </ul>
      )}
      <SessionPreview plan={{ ...plan, moves }} title={title} />
      <details className="funnel-all-moves">
        <summary>All {moves.length} exercises</summary>
        <MoveList moves={moves} limit={moves.length} />
      </details>
      <section className="funnel-weeks" aria-label="Your first weeks">
        <h4>Your first weeks</h4>
        <ol>
          {firstWeeks(profile, { startingPoint }).map(([when, what]) => (
            <li key={when}>
              <span aria-hidden="true" />
              <strong>{when}</strong>
              <p>{what}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

// The offer, laid out as it will be sold but still non-functional: choosing a
// plan does not change access, call a billing SDK, start a trial or collect
// payment details, and the screen says so. Everything it claims is either
// arithmetic on the two prices or something the app already does.
const OFFER_QUESTIONS = [
  ['What if I miss a week?', 'Nothing piles up. Your next session is planned from where you are.'],
  ['What if I’m new to this?', 'Every exercise has a guide, and your first weeks start light.'],
  ['What if my week changes?', 'Pick the time and place before each workout. The plan rebuilds around it.'],
]
export function PlaceholderPaywall({ headingRef, profile = {}, name = '' }) {
  const [plan, setPlan] = useState('year')
  const pricing = offerPricing()
  const first = name.trim().split(' ')[0]
  return (
    <div className="offer">
      <h3 ref={headingRef} tabIndex={-1}>
        {first ? `${first}, keep this plan going.` : 'Keep this plan going.'}
      </h3>
      <p className="offer-copy">Everything you just built, adapting every time you train.</p>
      <ul className="offer-points">
        {offerPoints(profile).map((line) => (
          <li key={line}>
            <Icon name="check" size={16} strokeWidth={3} />
            {line}
          </li>
        ))}
      </ul>
      <div className="offer-plans" role="radiogroup" aria-label="Subscription preview">
        {[
          ['year', 'Yearly', `${pricing.year.price} a year`, pricing.year.perWeek, `Save ${pricing.saving}%`],
          ['month', 'Monthly', `${pricing.month.price} a month`, pricing.month.perWeek, null],
        ].map(([id, label, price, perWeek, badge]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={plan === id}
            className={`offer-plan ${plan === id ? 'is-on' : ''}`}
            onClick={() => setPlan(id)}
          >
            <span className={`choice-ring ${plan === id ? 'is-on' : ''}`} aria-hidden="true">
              {plan === id && <Icon name="check" size={14} strokeWidth={3} />}
            </span>
            <span className="offer-plan-name">
              {label}
              {badge && <em>{badge}</em>}
              <small>{price}</small>
            </span>
            <span className="offer-plan-week">
              <strong>{perWeek}</strong>
              <small>a week</small>
            </span>
          </button>
        ))}
      </div>
      <p className="offer-anchor">
        A year of Tally costs about what one session with a personal trainer does.
      </p>
      <div className="offer-questions">
        {OFFER_QUESTIONS.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <p className="offer-note">
        Preview: subscriptions aren’t switched on yet, so nothing is charged and no trial starts. Continue
        opens your plan.
      </p>
    </div>
  )
}
