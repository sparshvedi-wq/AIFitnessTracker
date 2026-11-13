// Home: today's session, what you have today, and a quiet look back.

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { MONTHS, fromKey, shortLabel, addDays } from '../lib/date.js'
import { avgSessionMin, weekVolume } from '../lib/derive.js'
import { scoreSeries } from '../lib/score.js'
import { buildDailyPlan, readinessOf, todayChoice } from '../lib/planner.js'
import { displayOf, trainingDays, hasTrainingTarget } from '../lib/preferences.js'
import { returnMessage, shortSessionRequest } from '../lib/flexible-training.js'
import { fmtNum, muscleSets } from '../lib/workout.js'
import Icon from '../components/Icon.jsx'
import { LineChart, MuscleBars, SectionHead, StatTile, TallyLogo } from '../components/Ink.jsx'
import TrainingCard from '../components/TrainingCard.jsx'
import AskAdjust from '../components/AskAdjust.jsx'
import { TallyCard, WeekStrip, LiftedCard, useNewMarks } from '../components/HomeOverview.jsx'
import { tallySessions } from '../lib/milestones.js'
import ActiveSessionCard from '../components/ActiveSessionCard.jsx'
import EventShortcut from '../components/training/EventShortcut.jsx'
import WeeklyRecap from '../components/WeeklyRecap.jsx'
import SessionRow from '../components/SessionRow.jsx'
import WorkoutDetail from '../components/workout/WorkoutDetail.jsx'
import useStartWorkout, { bodyweights } from '../components/workout/useStartWorkout.js'
import usePlanningTime, { lastRecordedAt } from '../components/training/usePlanningTime.js'
import { ONBOARDING_VERSION } from '../lib/onboarding.js'
import { baselineDue } from '../lib/baseline.js'
import { BaselineCard } from '../components/baseline/BaselineEntry.jsx'

const strength = (w) =>
  !['sport', 'recovery', 'pump'].includes(w.kind) &&
  w.exercises.some((e) => e.sets?.some((s) => s.kind !== 'warmup'))

export default function Home({ nav }) {
  const { state, dispatch, today } = useApp()
  const now = usePlanningTime(lastRecordedAt(state.workouts))
  const { settings } = state
  const workouts = state.workouts.filter((w) => !w.sample && w.date <= today)
  const display = displayOf(state)
  const start = useStartWorkout(nav)
  const [detail, setDetail] = useState(null)
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
  const freshMarks = useNewMarks(tallySessions(workouts, today).length, settings.workout)
  const progress = trainingDays(workouts, settings, today)
  const active = state.activeWorkout
  const welcomeBack = returnMessage(workouts, today)
  const hasLogged = workouts.some((w) => w.exercises.some((e) => e.sets?.length))
  const setupPending = settings.training.onboardingVersion !== ONBOARDING_VERSION
  // Someone new starts with a short session that finds their weights.
  const startingPoint = !setupPending && baselineDue(state)

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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <TallyCard workouts={workouts} today={today} fresh={freshMarks} />
        <LiftedCard
          workouts={workouts}
          today={today}
          unit={settings.weightUnit}
          onOpen={() => nav.go('history')}
        />
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
            <p className="training-card-eyebrow">Today</p>
            <h2 className="training-card-title">Rest day</h2>
            <p className="training-card-note">
              <Icon name="moon" size={18} />
              <span>Nothing carries over.</span>
            </p>
            <button className="btn-secondary mt-5 w-full" onClick={() => setToday({ rest: false })}>
              Train anyway
            </button>
          </section>
        ) : startingPoint ? (
          <BaselineCard nav={nav} />
        ) : (
          <>
            <TrainingCard
              title="Today"
              plan={next}
              customExercises={state.customExercises}
              onStart={() => start(next)}
              startLabel="Start training"
              artworkDay={today}
            />
            {next.alternatives?.length > 0 && (
              <div className="mt-4 flex gap-2" role="group" aria-label="Other options today">
                {next.alternatives.map((alt) =>
                  alt.kind === 'movement' && next.kind !== 'recovery' ? (
                    <button
                      key={alt.kind}
                      className="chip flex-1 justify-center"
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
                      className="chip flex-1 justify-center"
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

      {setupPending && (
        <button className="list-row mt-3" onClick={nav.openProfile}>
          <span className="icon-tile">
            <Icon name="settings" size={19} />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-[15px] font-semibold">Finish your setup</span>
          </span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}
      <EventShortcut state={state} today={today} now={now} nav={nav} hideEmpty />
      <AskAdjust nav={nav} plan={next} />
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
  const average = avgSessionMin(workouts)
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
      <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
        {[
          [
            hasTrainingTarget(settings) ? `${progress.count}/${settings.workout.weeklyGoal}` : progress.count,
            'days',
            'Last 7 days',
          ],
          ...(volume.now ? [[fmtNum(volume.now), settings.weightUnit, 'Lifted this week']] : []),
          ...(average ? [[average, 'min', 'Average session']] : []),
          ...(!display.metricLight && bw ? [[fmtNum(bw.value), settings.weightUnit, 'Bodyweight']] : []),
        ].map(([value, unit, label]) => (
          <StatTile key={label} value={value} unit={unit} label={label} />
        ))}
      </div>
      {muscleTotals.length > 0 && (
        <section className="mt-3 rounded-tuck bg-surface p-5">
          <h3 className="mb-4 text-[16px] font-semibold">Sets by muscle</h3>
          <MuscleBars rows={muscleTotals.map((m) => [m.muscle, m.sets])} />
        </section>
      )}
      {!display.metricLight && hasTrainingTarget(settings) && hasStrength && (
        <section className="mt-3 rounded-tuck bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[16px] font-semibold">Consistency</h3>
            <p>
              <span className="num text-[30px]">{scores.at(-1)}</span>
              <span className="ml-1 text-[14px] font-semibold text-ink2">/ 100</span>
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
