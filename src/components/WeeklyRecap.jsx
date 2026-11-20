import { useState } from 'react'
import { defaultRecapPeriod, weeklyRecap } from '../lib/week.js'
import { addDays, shortLabel, WEEKDAY_INITIALS } from '../lib/date.js'
import { fmtNum } from '../lib/workout.js'
import Icon from './Icon.jsx'
import { MuscleBars, StatTile } from './Ink.jsx'
import Modal from './Modal.jsx'
import { buildDailyPlan } from '../lib/planner.js'
import { count } from '../lib/presentation.js'

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
      <span className="block text-[16px] font-semibold">{progress.name}</span>
      <span className="row-meta">
        {progress.kind === 'load'
          ? `+${fmtNum(progress.delta)} ${progress.unit} · ${progress.reps} reps`
          : progress.kind === 'assist'
            ? `${fmtNum(progress.delta)} ${progress.unit} less assistance · ${progress.reps} reps`
            : `+${progress.delta} reps${progress.load != null ? ` at ${fmtNum(progress.load)} ${progress.unit}${progress.assisted ? ' assistance' : ''}` : ''}`}{' '}
        vs {shortLabel(progress.previousDate)}
      </span>
    </>
  )
}
export default function WeeklyRecap({ state, today, now, nav }) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState(() => defaultRecapPeriod(state, today))
  const recap = weeklyRecap(state, today, period)
  const dates = `${shortLabel(recap.start)}–${shortLabel(recap.end)}`
  const nextPlan = open && !state.activeWorkout ? buildDailyPlan(state, { today, now }) : null
  const summaryStats = recap.strength.length
    ? [
        [recap.days, recap.days === 1 ? 'day' : 'days'],
        [recap.sets, recap.sets === 1 ? 'set' : 'sets'],
      ]
    : [
        [recap.warmups, 'warmups'],
        [recap.movement, 'light'],
      ]
  const act = (callback) => {
    setOpen(false)
    callback()
  }
  return (
    <section className="page-section">
      <div className="section-heading">
        <h2 className="section-title">Weekly recap</h2>
        {period !== 'current' && <span className="text-[14px] font-semibold text-ink2">{dates}</span>}
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
          <span className="min-w-0 flex-1 text-[16px] font-semibold">No sessions yet</span>
          <Icon name="chevronRight" size={16} className="text-faint" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 block w-full rounded-tuck bg-surface p-5 text-left"
          aria-label="Open weekly recap"
        >
          <div className="flex items-center gap-5">
            <div className="flex flex-1 gap-6">
              {summaryStats.map(([value, label]) => (
                <StatTile key={label} value={value} unit={label} className="stat-tile--bare" />
              ))}
            </div>
            <Rhythm workouts={state.workouts} today={today} />
          </div>
          <div className="panel mt-4 flex items-center gap-3 !p-3">
            <span className="icon-tile !h-9 !w-9 !rounded-xl !bg-surface">
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
                  <span className="block text-[16px] font-semibold">
                    {recap.sessions.length
                      ? recap.muscles[0]
                        ? `Most work: ${recap.muscles[0].name.toLowerCase()}`
                        : `${recap.warmups + recap.movement} movement sessions`
                      : 'No sessions yet'}
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
            [recap.days, 'Days'],
            [recap.sets, 'Sets'],
            [recap.warmups, 'Warmups'],
          ].map(([value, label]) => (
            <StatTile key={label} value={value} label={label} className="!bg-surface2" />
          ))}
        </div>
        <div className="panel mt-2">
          <h3 className="mb-4 text-[16px] font-semibold">Sets by day</h3>
          <Bars bars={recap.bars} />
          <div
            className="mt-2 flex gap-1.5 text-center text-[13px] font-semibold text-ink2"
            aria-hidden="true"
          >
            {WEEKDAY_INITIALS.map((d, i) => (
              <span key={i} className="flex-1">
                {d}
              </span>
            ))}
          </div>
          {recap.hasComparison && (
            <p className="mt-4 text-[15px] text-ink2">
              {recap.sets === recap.priorSets
                ? 'Same number of sets as'
                : `${Math.abs(recap.sets - recap.priorSets)} ${recap.sets > recap.priorSets ? 'more' : 'fewer'} sets than`}{' '}
              {period === 'current' ? 'the same days last week' : 'the previous week'}.
            </p>
          )}
        </div>
        {recap.progress && (
          <div className="panel mt-2">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-accent-ink">
              <Icon name="trend" size={17} />
              Progress
            </div>
            <span className="block text-[16px] font-semibold">{recap.progress.name}</span>
            <p className="num mt-2 text-[24px]">
              {fmtNum(recap.progress.from)} → {fmtNum(recap.progress.to)}
              <span className="stat-tile-unit">
                {recap.progress.kind === 'load'
                  ? recap.progress.unit
                  : recap.progress.kind === 'assist'
                    ? `${recap.progress.unit} assistance`
                    : 'reps'}
              </span>
            </p>
          </div>
        )}
        {recap.muscles.length > 0 && (
          <div className="panel mt-2">
            <h3 className="mb-4 text-[16px] font-semibold">Sets by muscle</h3>
            <MuscleBars rows={recap.muscles.map((m) => [m.name, m.sets])} />
          </div>
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
            className="list-row mt-2 rounded-[22px] bg-surface2 px-4"
            onClick={() => act(state.activeWorkout ? nav.openPlayer : () => nav.go('train'))}
          >
            <span className="icon-tile !bg-surface">
              <Icon name="train" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-accent-ink">
                {state.activeWorkout ? 'In progress' : 'Next'}
              </span>
              <span className="mt-0.5 block truncate text-[16px] font-semibold">
                {state.activeWorkout
                  ? state.activeWorkout.name
                  : nextPlan
                    ? nextPlan.name
                    : 'Today’s session'}
              </span>
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
      </Modal>
    </section>
  )
}
