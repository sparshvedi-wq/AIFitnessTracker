// Home: today's session, what you have today, and a quiet look back.

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { MONTHS, fromKey, shortLabel, addDays } from '../lib/date.js'
import { avgSessionMin, weekVolume } from '../lib/derive.js'
import { scoreSeries } from '../lib/score.js'
import { buildDailyPlan, checkinSchedule, profileOf, readinessOf, todayChoice } from '../lib/planner.js'
import { placesOf, resolvePlace } from '../lib/places.js'
import { displayOf, trainingDays, hasTrainingTarget } from '../lib/preferences.js'
import { returnMessage, shortSessionRequest } from '../lib/flexible-training.js'
import { fmtNum, muscleSets } from '../lib/workout.js'
import Icon from '../components/Icon.jsx'
import { LineChart, SectionHead, TallyLogo } from '../components/Ink.jsx'
import TrainingCard, { planScene } from '../components/TrainingCard.jsx'
import AdjustSheet from '../components/AdjustSheet.jsx'
import { CheckinCard, TallyCard, WeekStrip } from '../components/HomeOverview.jsx'
import { ONBOARDING_ART } from '../lib/onboarding-art.js'
import ActiveSessionCard from '../components/ActiveSessionCard.jsx'
import EventShortcut from '../components/training/EventShortcut.jsx'
import WeeklyRecap from '../components/WeeklyRecap.jsx'
import SessionRow from '../components/SessionRow.jsx'
import WorkoutDetail from '../components/workout/WorkoutDetail.jsx'
import useStartWorkout, { bodyweights } from '../components/workout/useStartWorkout.js'
import usePlanningTime from '../components/training/usePlanningTime.js'
import { ONBOARDING_VERSION } from '../lib/onboarding.js'

const strength = (w) =>
  !['sport', 'recovery', 'pump'].includes(w.kind) &&
  w.exercises.some((e) => e.sets?.some((s) => s.kind !== 'warmup'))

export default function Home({ nav }) {
  const { state, dispatch, today } = useApp()
  const now = usePlanningTime()
  const { settings } = state
  const workouts = state.workouts.filter((w) => !w.sample && w.date <= today)
  const display = displayOf(state)
  const start = useStartWorkout(nav)
  const [detail, setDetail] = useState(null)
  const [adjusting, setAdjusting] = useState(false)
  const choice = todayChoice(state, today)
  const readiness = readinessOf(state, today)
  const next = useMemo(
    () => buildDailyPlan(state, { today, now, ...todayChoice(state, today) }),
    [state, today, now],
  )
  // Choosing rest is respected for the day; nothing is owed afterwards.
  const resting = readiness.rest === true
  // Today-only answers live with today's check-in; the usual setup is untouched.
  const setToday = (patch) =>
    dispatch({ type: 'SET_READINESS', readiness: { ...readinessOf(state, today), ...patch, date: today } })
  const checkin = checkinSchedule(state, today)
  const progress = trainingDays(workouts, settings, today)
  const active = state.activeWorkout
  const manual = settings.training.baselineMode === 'manual' ? settings.training.manualBaseline : null
  const welcomeBack = returnMessage(workouts, today)
  const hasLogged = workouts.some((w) => w.exercises.some((e) => e.sets?.length))
  const minutes = choice.minutes || settings.training.minutes || 30

  const places = placesOf(profileOf(state))
  const location = choice.location || settings.training.location
  const scene = planScene(next, settings.training.goal)
  const setupPending = settings.training.onboardingVersion !== ONBOARDING_VERSION

  return (
    <div className="animate-fade-in">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-display text-[24px] leading-none tracking-[-0.04em]">
          <TallyLogo width={26} />
          tally
        </span>
        <button
          onClick={() => nav.go('you')}
          className="icon-btn !h-11 !w-11 border-2 border-line font-display text-[18px]"
          aria-label="You"
        >
          {settings.name ? [...settings.name.trim()][0]?.toUpperCase() : <Icon name="user" size={21} />}
        </button>
      </header>
      <h1 className="sr-only">Home</h1>

      <WeekStrip state={state} today={today} />

      <div className={`mt-5 grid gap-3 ${display.metricLight ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <TallyCard workouts={workouts} today={today} />
        {!display.metricLight && (
          <CheckinCard
            checkin={checkin}
            today={today}
            everyDays={settings.training.checkinDays}
            manual={Boolean(manual)}
            onOpen={manual ? nav.openProfile : () => nav.openCheckins()}
          />
        )}
      </div>

      {!active && welcomeBack && (
        <div className="mt-4 rounded-tuck border-2 border-line bg-surface p-4">
          <p className="text-[15px] leading-relaxed text-ink2">{welcomeBack}</p>
          <button className="text-link mt-1 !text-[15px]" onClick={() => start(shortSessionRequest())}>
            Start with 10 easy minutes
            <Icon name="arrowRight" size={15} className="ml-1" />
          </button>
        </div>
      )}

      <div className="mt-5">
        {active ? (
          <ActiveSessionCard session={active} onOpen={nav.openPlayer} />
        ) : resting ? (
          <section className="training-card">
            <span className="training-card-art is-wide" aria-hidden="true">
              <span className="floor-glow training-card-glow" />
              <img src={ONBOARDING_ART.movement} alt="" decoding="async" />
            </span>
            <div className="training-card-head">
              <p className="text-[14px] font-bold text-accent-ink">Today</p>
              <h2 className="font-display text-[32px] leading-tight">Rest day</h2>
            </div>
            <p className="training-card-why">Resting today is a good choice. Nothing carries over.</p>
            <button className="btn-secondary mt-4 w-full" onClick={() => setToday({ rest: false })}>
              Plan a session anyway
            </button>
          </section>
        ) : (
          <>
            <TrainingCard
              title="Your training"
              plan={next}
              place={resolvePlace(profileOf(state), next.location)}
              customExercises={state.customExercises}
              scene={scene}
              hideStart
            />
            <div className="mt-4 flex gap-3">
              <button className="btn-secondary shrink-0 !px-4" onClick={() => setAdjusting(true)}>
                <Icon name="sliders" size={18} />
                Adjust
              </button>
              <button className="btn-primary min-w-0 flex-1" onClick={() => start(next)}>
                Start training
              </button>
            </div>
            {next.alternatives?.length > 0 && (
              <div
                className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]"
                role="group"
                aria-label="Other options today"
              >
                <span className="text-muted">Or</span>
                {next.alternatives.map((alt) =>
                  alt.kind === 'movement' && next.kind !== 'recovery' ? (
                    <button
                      key={alt.kind}
                      className="text-link min-h-11 !text-[14px]"
                      onClick={() =>
                        start(
                          buildDailyPlan(state, {
                            today,
                            now,
                            ...todayChoice(state, today),
                            mode: 'movement',
                          }),
                        )
                      }
                    >
                      {alt.label}
                    </button>
                  ) : alt.kind === 'rest' ? (
                    <button
                      key={alt.kind}
                      className="text-link min-h-11 !text-[14px]"
                      onClick={() => setToday({ rest: true })}
                    >
                      {alt.label}
                    </button>
                  ) : null,
                )}
              </div>
            )}
          </>
        )}
      </div>

      <AdjustSheet
        open={adjusting}
        onClose={() => setAdjusting(false)}
        plan={next}
        minutes={minutes}
        location={location}
        places={places}
        readiness={readiness}
        onChange={setToday}
        nav={nav}
        scene={scene}
      />

      {setupPending && (
        <button className="list-row mt-3" onClick={nav.openProfile}>
          <span className="icon-tile">
            <Icon name="settings" size={19} />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-[15px] font-semibold">Finish your setup</span>
            <span className="mt-1 block text-[14px] text-muted">Your answers are saved</span>
          </span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}
      <EventShortcut state={state} today={today} now={now} nav={nav} hideEmpty />
      {hasLogged && <WeeklyRecap state={state} today={today} now={now} nav={nav} />}

      {workouts.length > 0 && (
        <>
          <SectionHead
            title="Recent sessions"
            right="View all"
            onRight={() => nav.go('history')}
            className="page-section"
          />
          <div className="mt-3 rounded-tuck bg-surface px-4">
            {workouts
              .slice(-2)
              .reverse()
              .map((w, i) => (
                <SessionRow key={w.id} workout={w} divider={i > 0} onClick={() => setDetail(w)} />
              ))}
          </div>
          <TrainingStats
            state={state}
            workouts={workouts}
            today={today}
            progress={progress}
            display={display}
          />
        </>
      )}
      <WorkoutDetail
        workout={detail}
        onClose={() => setDetail(null)}
        onRepeat={(r) => {
          setDetail(null)
          start(r)
        }}
      />
    </div>
  )
}

function TrainingStats({ state, workouts, today, progress, display }) {
  const { settings } = state
  const series = scoreSeries(workouts, settings.workout.weeklyGoal, 8, today)
  const scores = series.map((s) => s.score)
  const volume = weekVolume(workouts, today)
  const bw = bodyweights(state.metrics).at(-1)
  const hasStrength = workouts.some(strength)
  const muscleTotals = muscleSets(workouts.filter(strength), addDays(today, -27))
  return (
    <details className="page-section border-t border-line">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
        <span className="inline-flex items-center gap-2">
          <Icon name="barChart" size={18} className="text-muted" />
          Training stats
        </span>
        <Icon name="chevronDown" size={17} className="text-muted" />
      </summary>
      <div className="grid grid-cols-2 gap-3">
        {[
          [
            hasTrainingTarget(settings)
              ? `${progress.count} / ${settings.workout.weeklyGoal}`
              : progress.count,
            'Days · last 7',
          ],
          [fmtNum(volume.now), `${settings.weightUnit} lifted · this week`],
          [avgSessionMin(workouts) ?? '–', 'Average minutes'],
          ...(!display.metricLight && bw ? [[fmtNum(bw.value), `Bodyweight · ${settings.weightUnit}`]] : []),
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl bg-surface p-4">
            <p className="num text-[27px]">{value}</p>
            <p className="mt-2 text-[12px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      {muscleTotals.length > 0 && (
        <section className="mt-3 rounded-tuck bg-surface p-5">
          <h3 className="mb-4 text-[14px] font-semibold">Sets by muscle · last 4 weeks</h3>
          <div className="space-y-3">
            {muscleTotals.map((m) => (
              <div key={m.muscle} className="flex items-center gap-3 text-[13px]">
                <span className="w-20 shrink-0 text-muted">{m.muscle}</span>
                <span className="h-1.5 flex-1 rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-accent/70"
                    style={{ width: `${(m.sets / muscleTotals[0].sets) * 100}%` }}
                  />
                </span>
                <span className="w-6 text-right">{m.sets}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {!display.metricLight && hasTrainingTarget(settings) && hasStrength && (
        <section className="mt-3 rounded-tuck bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[14px] font-semibold">Consistency score</h3>
            <p>
              <span className="num text-[30px]">{scores.at(-1)}</span>
              <span className="ml-1 text-[12px] text-muted">/ 100</span>
            </p>
          </div>
          <LineChart values={scores} height={80} />
          <div className="mt-2 flex justify-between text-[12px] text-muted">
            <span>{MONTHS[fromKey(series[0].date).getMonth()]}</span>
            <span>{shortLabel(today)}</span>
          </div>
        </section>
      )}
    </details>
  )
}
