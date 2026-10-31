import { useState } from 'react'
import { defaultRecapPeriod, weeklyRecap } from '../lib/week.js'
import { addDays, shortLabel, WEEKDAY_INITIALS } from '../lib/date.js'
import { fmtNum } from '../lib/workout.js'
import { eventOccurrences } from '../lib/training-events.js'
import Icon from './Icon.jsx'
import usePlanningTime from './training/usePlanningTime.js'
import Modal from './Modal.jsx'
import { buildDailyPlan } from '../lib/planner.js'
import { planSummary, count } from '../lib/presentation.js'

function Bars({ bars }) {
  const max = Math.max(1, ...bars.map((b) => b.sets))
  return (
    <div className="flex h-14 items-end gap-1.5" aria-hidden="true">
      {bars.map((b) => (
        <span
          key={b.date}
          className={`min-h-1 flex-1 rounded-[4px] ${b.sets ? 'bg-accent' : 'bg-outline'}`}
          style={{
            height: `${b.sets ? Math.max(10, (b.sets / max) * 100) : 6}%`,
            opacity: b.future ? 0.35 : 1,
          }}
        />
      ))}
    </div>
  )
}
// The last four weeks, one row per week (this week at the bottom), so a
// flexible schedule still shows its rhythm without a streak.
function Rhythm({ workouts, today }) {
  const trained = new Set(
    workouts
      .filter(
        (w) =>
          !w.sample &&
          w.date <= today &&
          !['sport', 'recovery', 'pump'].includes(w.kind) &&
          w.exercises.some((e) => e.sets?.some((s) => s.kind !== 'warmup')),
      )
      .map((w) => w.date),
  )
  const start = addDays(today, -((new Date(today + 'T12:00:00').getDay() + 6) % 7) - 21)
  const days = Array.from({ length: 28 }, (_, i) => addDays(start, i))
  const total = days.filter((d) => trained.has(d)).length
  return (
    <span
      className="grid shrink-0 grid-cols-7 gap-1"
      role="img"
      aria-label={`${count(total, 'training day')} in the last four weeks`}
    >
      {days.map((d) => (
        <span
          key={d}
          className={`h-2.5 w-2.5 rounded-full ${trained.has(d) ? 'bg-accent' : d > today ? 'bg-line/40' : 'bg-line'} ${d === today ? 'ring-1 ring-ink2 ring-offset-1 ring-offset-surface' : ''}`}
        />
      ))}
    </span>
  )
}

function ProgressFact({ progress }) {
  return (
    <>
      <span className="block text-[14px] font-semibold">{progress.name}</span>
      <span className="mt-1 block text-[13px] text-muted">
        {progress.kind === 'load'
          ? `+${fmtNum(progress.delta)} ${progress.unit} · ${progress.reps} reps`
          : `+${progress.delta} reps${progress.load ? ` at ${fmtNum(progress.load)} ${progress.unit}` : ''}`}{' '}
        vs {shortLabel(progress.previousDate)}
      </span>
    </>
  )
}
export default function WeeklyRecap({ state, today, now, nav }) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState(() => defaultRecapPeriod(state, today))
  const liveNow = usePlanningTime()
  const recap = weeklyRecap(state, today, period)
  const nextEvent = eventOccurrences(state.settings.training?.lifeEvents, today, addDays(today, 7)).find(
    (e) => e.endsAt > (now ?? liveNow),
  )
  const dates = `${shortLabel(recap.start)}–${shortLabel(recap.end)}`
  const nextPlan = open && !state.activeWorkout ? buildDailyPlan(state, { today, now }) : null
  const summaryStats = recap.strength.length
    ? [
        [recap.days, 'Training days'],
        [recap.sets, 'Sets'],
      ]
    : [
        [recap.warmups, 'Warmups'],
        [recap.movement, 'Light sessions'],
      ]
  const act = (callback) => {
    setOpen(false)
    callback()
  }
  return (
    <section className="page-section">
      <div className="section-heading">
        <h2 className="section-title">Weekly recap</h2>
        <span className="text-[12px] text-muted">{period === 'current' ? 'So far' : dates}</span>
      </div>
      {!recap.sessions.length ? (
        <button
          onClick={() => setOpen(true)}
          className="list-row mt-3 rounded-tuck bg-surface px-4"
          aria-label="Open weekly recap"
        >
          <span className="icon-tile">
            <Icon name="barChart" size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">No sessions recorded</span>
            <span className="mt-1 block text-[12px] text-muted">
              {state.sample ? 'Sample history is excluded' : 'View dates'}
            </span>
          </span>
          <Icon name="chevronRight" size={16} className="text-faint" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 block w-full rounded-tuck bg-surface p-5 text-left"
          aria-label="Open weekly recap"
        >
          <div className="flex items-end gap-5">
            <div className="flex flex-1 gap-6">
              {summaryStats.map(([value, label]) => (
                <div key={label}>
                  <span className="num text-[32px]">{value}</span>
                  <span className="mt-2 block text-[12px] text-muted">{label}</span>
                </div>
              ))}
            </div>
            <Rhythm workouts={state.workouts} today={today} />
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            <span className="icon-tile !h-9 !w-9 !rounded-xl">
              <Icon
                name={recap.progress ? 'trend' : recap.sessions.length ? 'train' : 'barChart'}
                size={17}
              />
            </span>
            <span className="min-w-0 flex-1">
              {recap.progress ? (
                <ProgressFact progress={recap.progress} />
              ) : (
                <>
                  <span className="block text-[14px] font-semibold">
                    {recap.sessions.length
                      ? recap.muscles[0]
                        ? `${recap.muscles[0].name} · ${count(recap.muscles[0].sets, 'set')}`
                        : `${recap.warmups + recap.movement} movement sessions`
                      : 'No sessions recorded'}
                  </span>
                  <span className="mt-1 block text-[12px] text-muted">
                    {recap.sessions.length ? 'View breakdown' : 'Your recap starts with a saved session'}
                  </span>
                </>
              )}
            </span>
            <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
          </div>
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Weekly recap" subtitle={dates}>
        <div className="segmented mt-3" role="group" aria-label="Recap period">
          {[
            ['last', 'Last week'],
            ['current', 'This week'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={period === value}
              className={`segment ${period === value ? 'segment-active' : ''}`}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            [recap.days, 'Training days'],
            [recap.sets, 'Sets'],
            [recap.warmups, 'Warmups'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl bg-surface2 px-3 py-4">
              <p className="num text-[30px]">{value}</p>
              <p className="mt-2 text-[12px] text-muted">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Bars bars={recap.bars} />
          <div className="mt-2 flex gap-1.5 text-center text-[12px] text-muted" aria-hidden="true">
            {WEEKDAY_INITIALS.map((d, i) => (
              <span key={i} className="flex-1">
                {d}
              </span>
            ))}
          </div>
        </div>
        {recap.hasComparison && (
          <p className="mt-4 text-[13px] text-muted">
            {recap.sets === recap.priorSets
              ? 'Same number of sets as'
              : `${Math.abs(recap.sets - recap.priorSets)} ${recap.sets > recap.priorSets ? 'more' : 'fewer'} sets than`}{' '}
            {period === 'current' ? 'the same days last week' : 'the previous week'}.
          </p>
        )}
        {recap.progress && (
          <div className="mt-5 rounded-tuck bg-surface2 p-4">
            <div className="mb-3 flex items-center gap-2 text-[12px] text-accent">
              <Icon name="trend" size={16} />
              Exercise progress
            </div>
            <ProgressFact progress={recap.progress} />
            <p className="mt-3 text-[12px] text-muted">
              {recap.progress.kind === 'load'
                ? `${fmtNum(recap.progress.from)} → ${fmtNum(recap.progress.to)} ${recap.progress.unit}`
                : `${recap.progress.from} → ${recap.progress.to} reps`}{' '}
              · {shortLabel(recap.progress.previousDate)} to {shortLabel(recap.progress.date)}
            </p>
          </div>
        )}
        {recap.muscles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[14px] font-semibold">Sets by muscle group</h3>
            <div className="mt-3 space-y-3">
              {recap.muscles.map((m) => (
                <div key={m.name} className="flex items-center gap-3 text-[13px]">
                  <span className="w-20 shrink-0 text-muted">{m.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-accent/70"
                      style={{ width: `${(m.sets / recap.muscles[0].sets) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right">{m.sets}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {recap.movement > 0 && (
          <p className="mt-4 text-[13px] text-muted">
            {recap.movement} light movement session{recap.movement === 1 ? '' : 's'} saved separately.
          </p>
        )}
        {recap.skips[0]?.reason === 'equipment' && (
          <button className="list-row mt-4 border-t border-line" onClick={() => act(nav.openPersonal)}>
            <Icon name="settings" size={19} />
            <span className="min-w-0 flex-1 text-[14px]">
              Equipment limited {recap.skips[0].count} exercise{recap.skips[0].count === 1 ? '' : 's'}. Update
              setup
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
        )}
        {recap.sessions.length > 0 && (
          <button
            className="list-row mt-5 rounded-tuck bg-surface2 px-4"
            onClick={() => act(state.activeWorkout ? nav.openPlayer : () => nav.go('train'))}
          >
            <span className="icon-tile">
              <Icon name="train" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-muted">
                {state.activeWorkout ? 'Current session' : 'Next session'}
              </span>
              <span className="mt-1 block text-[14px] font-semibold">
                {state.activeWorkout
                  ? state.activeWorkout.name
                  : nextPlan
                    ? `${nextPlan.name} · ${planSummary(nextPlan)}`
                    : 'Recommended for today'}
              </span>
              {nextEvent && (
                <span className="mt-1 block text-[12px] text-muted">
                  {nextEvent.name} · {shortLabel(nextEvent.date)}
                </span>
              )}
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
        )}
        {!recap.sessions.length && (
          <div className="empty-state">
            <Icon name="barChart" size={30} />
            <p>No sessions recorded for these dates.</p>
            <button className="btn-secondary mt-3" onClick={() => act(() => nav.go('train'))}>
              Go to Train
            </button>
          </div>
        )}
        <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
          Working sets only. Warm-ups are counted separately.
        </p>
      </Modal>
    </section>
  )
}
