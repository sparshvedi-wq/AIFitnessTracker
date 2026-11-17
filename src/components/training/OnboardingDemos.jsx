import { recoveryTimeline } from '../../lib/recovery-view.js'
import PlanReveal from './PlanReveal.jsx'
import { buildSession } from '../../lib/workout.js'
import { shortenSession, adaptRoutineItems, replacementOptions } from '../../lib/workout-adjustments.js'
import { formGuide } from '../../lib/form.js'
import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { SetupIllustration } from './SetupVisuals.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import MannequinRegions from './MannequinRegions.jsx'
import {
  onboardingDemoPlan,
  consistencyExample,
  offerPoints,
  offerPricing,
} from '../../lib/onboarding-demo.js'
import { buildSportWarmup, SPORTS } from '../../lib/sports.js'
import { findExercise } from '../../lib/exercises.js'
import { exerciseThumb } from '../../lib/exercise-thumbs.js'
import { resolvePlace, quietAt } from '../../lib/places.js'
import { movementPreferences } from '../../lib/movement-preferences.js'

export function ProductWelcome({ headingRef }) {
  return (
    <div className="funnel-welcome opening-scene">
      <div className="funnel-welcome-art">
        <SetupIllustration scene="welcome" />
      </div>
      <h3 ref={headingRef} tabIndex={-1}>
        A workout that fits
        <br />
        the day you have.
      </h3>
    </div>
  )
}

const goalCopy = {
  'Build muscle': [
    'Build muscle in balance.',
    'Tally counts the sets you log across muscle groups to decide what to train next.',
  ],
  'Get stronger': ['Know what to lift next.', 'Logged weights and reps guide your next targets.'],
  'Lose weight': ['Make movement fit your week.', 'Keep strength work in the mix, even on shorter days.'],
  'General fitness': ['Give your whole body a turn.', 'Your sessions draw from different muscle groups.'],
}
function DemoHeading({ title }) {
  return (
    <div className="funnel-heading">
      <h3 tabIndex={-1}>{title}</h3>
    </div>
  )
}
function MoveSpot({ move, label }) {
  return (
    <figure className="proof-move">
      <img
        src={move?.image || ONBOARDING_ART.neutral}
        className={move?.image ? undefined : 'proof-placeholder'}
        alt=""
      />
      <figcaption>
        <small>{label}</small>
        <strong>{move?.name || 'No matching exercise'}</strong>
      </figcaption>
    </figure>
  )
}
function Picks({ options, value, onChange, label }) {
  return (
    <div className="story-picks" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  )
}
function TimeDemo({ state, profile, today, now, kind }) {
  const remaining = 5
  const plan = onboardingDemoPlan(state, profile, {today,now,minutes:30})
  if(kind==='time') return <><DemoHeading title="Plans change mid-workout."/>
    <div className="five-minute"><SetupIllustration scene="time"/><div className="clock-face"><b>5</b><span>minutes left</span></div></div>
    <p className="moment-line">Say you need to leave early. Here’s what Tally keeps.</p></>
  const session = shortenSession(
    buildSession(plan, { now, customExercises: state.customExercises }),
    remaining,
    now,
  )
  const kept = session.exercises.filter((ex) => ex.sets.some((s) => s.status === 'todo'))
  const deferred = session.exercises.some((ex) => ex.sets.some((s) => s.status === 'skipped'))
  return (
    <>
      <DemoHeading title={`What fits in ${remaining} minutes.`} />
      <PlanReveal>
        <div className="story-module drill-menu">
          <small>Keep today</small>
          {kept.length ? (
            kept.map((ex) => (
              <strong key={ex.exId}>{findExercise(ex.exId, state.customExercises)?.name}</strong>
            ))
          ) : (
            <strong>Finish here</strong>
          )}
        </div>
      </PlanReveal>
      <p className="proof-note">
        {deferred
          ? 'Logged sets stay saved. Unfinished work gets another look next session.'
          : 'The remaining sets already fit. Keep your workout as planned.'}
      </p>
    </>
  )
}
function FormChart() {
  return (
    <>
      <DemoHeading title="Did the last rep go as deep?" />
      <div className="story-module rep-chart">
        <p>Squat depth across eight reps</p>
        {['Same depth each rep', 'Shallower with each rep'].map((label, row) => (
          <div key={label}>
            <strong>{label}</strong>
            <div
              className="rep-bars"
              role="img"
              aria-label={
                row ? 'Eight repetitions at inconsistent depths' : 'Eight repetitions at the same depth'
              }
            >
              {(row ? [90, 87, 78, 72, 65, 63, 54, 48] : [90, 90, 90, 90, 90, 90, 90, 90]).map((v, i) => (
                <i key={i} style={{ height: v + '%', animationDelay: i * 45 + 'ms' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="proof-note">
        Use the same depth to track strength from week to week.
      </p>
    </>
  )
}
function Comparison({ state, profile, today, now, kind }) {
  const [energy, setEnergy] = useState('low')
  const [sore, setSore] = useState('Legs')
  const [swapped, setSwapped] = useState(false)
  const base = onboardingDemoPlan(state, profile, { today, now })
  if (kind === 'recovery') {
    const adjusted = onboardingDemoPlan(state, profile, { today, now, energy, sore: sore ? [sore] : [] })
    return (
      <>
        <DemoHeading title="Tell Tally how you feel." />
        <div className="story-module">
          <p>Energy today</p>
          <Picks
            label="Energy today"
            options={[
              ['normal', 'Usual'],
              ['low', 'Low'],
            ]}
            value={energy}
            onChange={setEnergy}
          />
          <p>Sore today</p>
          <Picks
            label="Sore area"
            options={[
              [null, 'None'],
              ['Legs', 'Legs'],
              ['Shoulders', 'Shoulders'],
            ]}
            value={sore}
            onChange={setSore}
          />
        </div>
        <PlanReveal key={energy + ':' + sore}>
          <div className="story-module drill-menu readiness-menu">
            <small>
              {energy === 'low' ? 'Lighter effort' : 'Usual effort'}
              {sore ? ' · ' + sore.toLowerCase() + ' feel sore' : ''}
            </small>
            {adjusted.moves.length ? (
              adjusted.moves.map((m) => <div className="readiness-move" key={m.exId}><span className="move-thumbnail" aria-hidden="true">{m.image ? <img src={m.image} alt=""/> : <Icon name="train" size={22}/>}</span><strong>{m.name}</strong></div>)
            ) : (
              <strong>Take a recovery day</strong>
            )}
          </div>
        </PlanReveal>
      </>
    )
  }
  const other =
    kind === 'equipment' ? (profile.location === 'on-the-go' ? 'gym' : 'on-the-go') : profile.location
  const ctx = { ...state, settings: { ...state.settings, training: profile } }
  const readiness = { energy: 'normal', pain: [], sore: [] }
  let pair = null
  for (const m of base.moves) {
    const item = { ...m }
    const alt =
      kind === 'equipment'
        ? adaptRoutineItems(ctx, [item], other, readiness, { today, now }).items[0]?.exId
        : replacementOptions(ctx, buildSession({ ...base, items: [item] }, { now }), { today, now }).find(
            (d) => d.muscle === m.muscle,
          )?.id
    const def = alt && findExercise(alt, state.customExercises)
    if (!def || def.muscle !== m.muscle) continue
    if (!pair || alt !== m.exId) pair = [m, { ...def, exId: alt, image: exerciseThumb(alt) }]
    if (alt !== m.exId) break
  }
  const equipment = kind === 'equipment'
  if (!equipment && pair)
    return (
      <>
        <DemoHeading title="Swap a move in one tap." />
        <PlanReveal key={String(swapped)}>
          <MoveSpot move={pair[swapped ? 1 : 0]} label={pair[0].muscle} />
        </PlanReveal>
        <button className="btn-secondary" onClick={() => setSwapped((v) => !v)}>
          {swapped ? 'Restore original' : 'Swap exercise'}
        </button>
      </>
    )
  return (
    <>
      <DemoHeading
        title={equipment ? 'New place. Same muscles.' : 'Change the move. Keep the focus.'}
      />
      {pair ? (
        <div className="swap-stack">
          <MoveSpot
            move={pair[0]}
            label={equipment ? resolvePlace(profile, profile.location).name : 'Original move'}
          />
          <div className="match-link">
            <Icon name="repeat" size={18} />
            {pair[0].muscle} · {pair[0].exId === pair[1].exId ? 'same move' : 'same focus'}
          </div>
          <MoveSpot move={pair[1]} label={equipment ? resolvePlace(profile, other).name : 'Alternative'} />
        </div>
      ) : (
        <p>No matching swap fits these settings. Tally leaves the move out.</p>
      )}
    </>
  )
}
function GoalDemo({ profile, ...context }) {
  const plan = onboardingDemoPlan(context.state, profile, context)
  const muscles = [...new Set(plan.moves.map((m) => m.muscle).filter(Boolean))]
  const [title, caption] = goalCopy[profile.goal] || goalCopy['General fitness']
  return (
    <>
      <DemoHeading title={title} />
      <div className="proof-anatomy">
        {['front', 'back'].map((view) => (
          <div className="body-mannequin" key={view}>
            <MannequinRegions view={view} selected={muscles} />
          </div>
        ))}
      </div>
      <div className="proof-caption">
        <strong>{muscles.join(' · ') || 'Your training focus'}</strong>
        <p>{caption}</p>
      </div>
    </>
  )
}
function SportDemo({ profile, kind, onPreviewChange }) {
  const sport = profile.sports[0]
  const minutes = profile.previewWarmupMinutes || 5
  const energy = profile.previewWarmupEnergy || 'normal'
  const options = {
    avoidMuscles: profile.avoidMuscles,
    movement: movementPreferences(profile, profile.location),
  }
  const quiet = quietAt(profile, profile.location)
  const sportName = SPORTS.find((s) => s.id === sport)?.name || 'Sport'
  const warmup = buildSportWarmup(sport, minutes, { ...options, lowImpact: energy === 'low' || quiet })
  if (kind === 'warmup-time')
    return (
      <>
        <DemoHeading title={`Warm up for ${sportName.toLowerCase()}.`} />
        <SetupIllustration scene={sport === 'tennis' ? 'priority' : 'sports'} />
        <div className="story-module drill-menu">
          <small>Sport-specific rehearsal</small>
          <strong>{findExercise(warmup.items.at(-1)?.exId)?.name || 'No compatible drill'}</strong>
        </div>
      </>
    )
  if (kind === 'warmup-energy') {
    const usual = buildSportWarmup(sport,minutes,{...options,lowImpact:quiet})
    const gentle = buildSportWarmup(sport,minutes,{...options,lowImpact:true})
    const changed = gentle.items.findIndex((m,i)=>usual.items[i]?.exId !== m.exId)
    const drill = warmup.items[Math.max(0,changed)]
    return (
      <>
        <DemoHeading title="Low energy? Ease into practice." />
        <PlanReveal key={energy}>
          <MoveSpot
            move={drill && { name: findExercise(drill.exId)?.name, image: exerciseThumb(drill.exId) }}
            label={energy==='low' ? 'Low-impact drill' : 'Usual drill'}
          />
        </PlanReveal>
        <Picks
          label="Preview effort"
          value={energy}
          options={[
            ['normal', 'Usual warm-up'],
            ['low', 'Use low impact'],
          ]}
          onChange={(previewWarmupEnergy) => onPreviewChange({ previewWarmupEnergy })}
        />
      </>
    )
  }
  return (
    <>
      <DemoHeading
        title={`Your ${(SPORTS.find((s) => s.id === sport)?.name || 'sport').toLowerCase()} warm-up.`}
      />
      <label className="warmup-dial">
        <span>
          Warm-up length <strong>{minutes} min</strong>
        </span>
        <input
          type="range"
          min="5"
          max="20"
          step="1"
          value={minutes}
          aria-label="Warm-up minutes"
          onChange={(e) => onPreviewChange({ previewWarmupMinutes: Number(e.target.value) })}
        />
      </label>
      <PlanReveal key={minutes + energy}>
        <div className="story-module drill-menu">
          {warmup.items.map((m, i) => (
            <div key={i}>
              <strong>{findExercise(m.exId)?.name || m.exId}</strong>
              <small>{m.sec}s</small>
            </div>
          ))}
          {!warmup.items.length && <strong>No drills fit these settings.</strong>}
        </div>
      </PlanReveal>
    </>
  )
}
function BarrierStory({ kind, profile, ...context }) {
  const plan = onboardingDemoPlan(context.state, profile, context)
  if (kind === 'schedule')
    return (
      <>
        <DemoHeading title="Leave early. Keep your progress." />
        <div className="proof-list">
          {plan.moves.slice(0, 3).map((m, i) => (
            <div key={m.exId}>
              <Icon name={i ? 'repeat' : 'check'} size={20} />
              <strong>{m.name}</strong>
              <small>{i ? 'Reconsider later' : 'Set logged'}</small>
            </div>
          ))}
        </div>
        <p className="proof-note">Example interrupted session. Finished sets still count.</p>
      </>
    )
  const restart = kind === 'starting'
  const move = plan.moves.find((m) => m.image) || plan.moves[0]
  return (
    <>
      <DemoHeading title={restart ? 'Pick up after a break.' : 'Your form guide is right here.'} />
      <MoveSpot move={move} label={restart ? 'A fresh starting point' : 'Exercise guide'} />
      {!restart && move && (
        <div className="story-module">
          <small>Common mistake</small>
          <strong>{formGuide(move.exId, move.muscle).mistakes[0]}</strong>
          <small>Form cue</small>
          <strong>{findExercise(move.exId)?.cues?.[0] || 'Keep the movement controlled.'}</strong>
        </div>
      )}
      {restart && (
        <p className="proof-note">
          {restart ? 'Tally uses your recent training to plan your return.' : null}
        </p>
      )}
    </>
  )
}
function RecentTraining({state,profile,today,now,kind}) {
  // A local example, never written to workout history.
  const at = now - 12*3600000
  const date = new Date(at)
  const day = [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')
  const example = {...state,settings:{...state.settings,training:profile},workouts:[{id:'demo-press',date:day,startedAt:at-1800000,endedAt:at,unit:'lb',kind:'adaptive',
    exercises:[{exId:'bench-press',type:'reps',weighted:true,sets:Array.from({length:4},()=>({weight:100,reps:8,feel:'hard',status:'done'}))}]}]}
  const chest=recoveryTimeline(example,today,now).find(r=>r.muscle==='chest')
  if(kind==='recent') return <><DemoHeading title="Your last workout still counts."/>
    <div className="story-module forecast"><small>Example · after bench press</small><strong>Estimated chest readiness</strong>
    <div className="forecast-bars">{chest?.values.map((v,i)=><div key={i}><i style={{height:v+'%'}}/><span>{['Now','Tomorrow','In two days'][i]}</span></div>)}</div></div>
    <p className="moment-line">Even when you feel fine, Tally remembers yesterday’s sets.</p></>
  const next=onboardingDemoPlan(example,profile,{today,now})
  const other=next.moves.find(m=>!['Chest','Triceps','Shoulders'].includes(m.muscle)) || next.moves[0]
  return <><DemoHeading title="Give another muscle a turn."/><div className="rotation-strip"><span>Last session<strong>Chest</strong></span><Icon name="arrowRight" size={22}/><span>Next session<strong>{other?.muscle || 'Rest'}</strong></span></div>
    {other && <PlanReveal><MoveSpot move={other} label="From the example plan"/></PlanReveal>}
    <p className="moment-line">Recent work helps decide what comes next.</p></>
}
function ConsistencyDemo() {
  const { steady, occasional, steadyMinutes, occasionalMinutes } = consistencyExample()
  const path = (values) =>
    [0, ...values].map((v, i) => `${i ? 'L' : 'M'}${24 + i * 36} ${225 - (v / 240) * 180}`).join(' ')
  return (
    <>
      <DemoHeading title="Short sessions add up." />
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
          <path className="chart-steady" pathLength="1" d={path(steady)} />
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
    </>
  )
}
function PhotoIntro({ kind }) {
  const privacy = kind === 'photo-privacy'
  if (kind === 'photo-use')
    return (
      <>
        <DemoHeading title="From photos to training." />
        <div className="photo-path">
          {[
            ['camera', 'Compare your views'],
            ['train', 'Choose a training focus'],
            ['repeat', 'Revisit at your next check-in'],
          ].map(([icon, label]) => (
            <div key={icon}>
              <Icon name={icon} size={28} />
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </>
    )

  return (
    <>
      <DemoHeading
        title={privacy ? 'You choose who sees your photos.' : 'Give your plan a starting point.'}
      />
      {privacy ? (
        <div className="privacy-route">
          <Icon name="you" size={40} />
          <i />
          <Icon name="camera" size={42} />
          <i />
          <Icon name="check" size={40} />
        </div>
      ) : (
        <div className="angle-sequence">
          {['front', 'side', 'back'].map((a) => (
            <figure key={a}>
              <img alt="" src={a === 'front' ? ONBOARDING_ART.neutral : `/onboarding/m1-photo-${a}.webp`} />
              <figcaption>{a}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {privacy && (
        <p className="proof-note">
          {privacy
            ? 'Photos stay off your public profile. With your permission, our server sends them to OpenAI for review. You can use measurements instead.'
            : null}
        </p>
      )}
    </>
  )
}
export default function OnboardingDemo({ step, ...props }) {
  const content = useRef(null)
  useEffect(() => {
    content.current?.querySelector('h3')?.focus({ preventScroll: true })
  }, [step])
  const kind = step.replace(/^barrier-/, '').replace(/-demo$/, '')
  return (
    <div className="onboarding-demo proof-story" ref={content}>
      {kind === 'goal' && <GoalDemo {...props} />}
      {['sport', 'warmup-time', 'warmup-energy'].includes(kind) && <SportDemo {...props} kind={kind} />}
      {['time', 'compress'].includes(kind) && <TimeDemo {...props} kind={kind} />}
      {kind === 'form' && <FormChart />}
      {kind.startsWith('photo-') && <PhotoIntro kind={kind} />}
      {['recent','rotation'].includes(kind) && <RecentTraining {...props} kind={kind}/>}
      {kind === 'consistency' && <ConsistencyDemo />}
      {['equipment', 'recovery', 'enjoyment'].includes(kind) && <Comparison {...props} kind={kind} />}
      {['schedule', 'unsure', 'starting'].includes(kind) && <BarrierStory {...props} kind={kind} />}
    </div>
  )
}

export function OnboardingPlanPreview({ profile, name, headingRef }) {
  return (
    <div className="funnel-plan-preview reveal-finale">
      <PlanReveal>
        <SetupIllustration scene="review" />
      </PlanReveal>
      <div className="ready-seal"><Icon name="check" size={17}/>{name.trim() ? 'Ready for '+name.trim().split(' ')[0] : 'Your plan is ready'}</div>
      <h3 ref={headingRef} tabIndex={-1}>
        {(goalCopy[profile.goal] || goalCopy['General fitness'])[0]}
      </h3>
    </div>
  )
}

// The offer, laid out as it will be sold but still non-functional: choosing a
// plan does not change access, call a billing SDK, start a trial or collect
// payment details, and the screen says so. Everything it claims is either
// arithmetic on the two prices or something the app already does.
export function PlaceholderPaywall({ headingRef, profile = {}, name = '' }) {
  const [plan, setPlan] = useState('year')
  const pricing = offerPricing()
  const first = name.trim().split(' ')[0]
  return (
    <div className="offer">
      <h3 ref={headingRef} tabIndex={-1}>
        {first ? `${first}, keep this plan going.` : 'Keep this plan going.'}
      </h3>
      <p className="offer-copy">{(goalCopy[profile.goal] || goalCopy['General fitness'])[1]}</p>
      <ul className="offer-points">
        {offerPoints(profile)
          .slice(0, 2)
          .map((line) => (
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
      <p className="offer-note">Pricing preview. Continue for free.</p>
    </div>
  )
}
