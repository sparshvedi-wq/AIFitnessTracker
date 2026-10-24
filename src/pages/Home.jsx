// Home: greeting, Tally score, this week, what's up next, key stats, recent
// workouts and muscle balance.

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { TEMPLATES, findExercise } from '../lib/exercises.js'
import { estimateMinutes, fmtDuration, fmtNum, pickNextRoutine, weekStreak } from '../lib/workout.js'
import { DAYS_LONG, MONTHS, MONTHS_LONG, fromKey } from '../lib/date.js'
import { avgSessionMin, greeting, muscleBalance, weekDays, weekVolume } from '../lib/derive.js'
import { scoreParts, scoreSeries } from '../lib/score.js'
import Icon from '../components/Icon.jsx'
import { DateTile, LineChart, SectionHead, TallyLogo, corner } from '../components/Ink.jsx'
import WorkoutDetail from '../components/workout/WorkoutDetail.jsx'
import useStartWorkout, { bodyweights } from '../components/workout/useStartWorkout.js'

const BALANCE = ['bg-accent', 'bg-accent-2', 'bg-ink2', 'bg-faint', 'bg-outline']

export default function Home({ nav }) {
  const { state, today } = useApp()
  const { workouts, routines, settings } = state
  const goal = settings.workout.weeklyGoal
  const unit = settings.weightUnit
  const start = useStartWorkout(nav)
  const [showList, setShowList] = useState(false)
  const [detail, setDetail] = useState(null)

  const d = useMemo(() => {
    const series = scoreSeries(workouts, goal, 8, today)
    const days = weekDays(workouts, today)
    return {
      series,
      score: series[series.length - 1].score,
      change: series[series.length - 1].score - series[Math.max(0, series.length - 5)].score,
      growth: Math.round(scoreParts(workouts, goal, today).ratio * 100),
      consistency: Math.round(scoreParts(workouts, goal, today).consistency * 100),
      days,
      done: workouts.filter((w) => w.date >= days[0].date && w.date <= today).length,
      vol: weekVolume(workouts, today),
      streak: weekStreak(workouts, goal, today),
      avg: avgSessionMin(workouts),
      balance: muscleBalance(workouts, today).slice(0, 5),
      next: pickNextRoutine(routines.length ? routines : TEMPLATES, workouts),
    }
  }, [workouts, routines, goal, today])

  const weights = useMemo(() => bodyweights(state.metrics), [state.metrics])
  const bw = weights[weights.length - 1]
  const bwPrev = weights.length > 1 ? weights[Math.max(0, weights.length - 3)] : null
  const bwChange = bw && bwPrev ? Math.round((bw.value - bwPrev.value) * 10) / 10 : null

  const has = workouts.length > 0
  const date = fromKey(today)
  const left = Math.max(0, goal - d.done)
  const label = (k) => `${MONTHS[fromKey(k).getMonth()]} ${fromKey(k).getDate()}`
  const scores = d.series.map((p) => p.score)
  const totalSets = d.balance.reduce((s, m) => s + m.sets, 0)
  const next = d.next

  const stats = [
    { label: 'Streak', icon: 'flame', v: d.streak, u: d.streak === 1 ? 'week' : 'weeks', note: d.streak ? `${goal}+ sessions a week` : 'Hit your weekly goal' },
    { label: 'Volume', icon: 'trend', v: fmtNum(d.vol.now), u: unit, note: d.vol.change == null ? 'This week' : `${Math.abs(d.vol.change)}% ${d.vol.change >= 0 ? 'more' : 'less'} than last week`, accent: d.vol.change > 0 },
    { label: 'Bodyweight', icon: 'weigh', v: bw ? fmtNum(bw.value) : '–', u: bw ? unit : '', note: bwChange == null ? 'Log it on the You tab' : bwChange === 0 ? 'Holding steady' : `${fmtNum(Math.abs(bwChange))} ${unit} ${bwChange < 0 ? 'down' : 'up'}`, onClick: () => nav.go('you') },
    { label: 'Avg session', icon: 'timer', v: d.avg ?? '–', u: d.avg ? 'min' : '', note: 'Last 10 workouts' },
  ]

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <TallyLogo width={30} />
        <button onClick={() => nav.go('you')} className="dot h-[38px] w-[38px] bg-surface2 font-display text-[18px] text-ink" aria-label="Your profile">
          {(settings.name || 'Y')[0].toUpperCase()}
        </button>
      </header>

      <h1 className="mt-5 font-display text-[40px] leading-[1.1] text-ink">
        {greeting()}{settings.name ? `, ${settings.name}` : ''}.
      </h1>
      <p className="mt-1 text-[15px] text-muted">{DAYS_LONG[date.getDay()]}, {MONTHS_LONG[date.getMonth()]} {date.getDate()}</p>

      {/* Tally score */}
      <section className="mt-6 rounded-hero bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">Tally score</span>
          {has && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-accent/15 px-2.5 text-[13px] font-semibold text-accent">
              <Icon name={d.change >= 0 ? 'arrowUp' : 'arrowDown'} size={13} strokeWidth={2.6} />
              {Math.abs(d.change)} this month
            </span>
          )}
        </div>
        <p className="mt-2 flex items-end gap-1.5">
          <span className="num text-[64px] text-ink">{has ? d.score : '–'}</span>
          <span className="mb-2 text-[15px] text-faint">/ 100</span>
        </p>
        {has ? (
          <>
            <div className="mt-3">
              <LineChart values={scores} height={110} min={Math.min(...scores) - 8} max={Math.max(...scores) + 4} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-faint">
              <span>{label(d.series[0].date)}</span>
              <span>{label(d.series[4].date)}</span>
              <span>{label(today)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 border-t border-line pt-4">
              <div>
                <p className="text-[13px] text-muted">Growth</p>
                <p className="num mt-1.5 text-[22px]">{d.growth >= 0 ? '+' : ''}{d.growth}%</p>
              </div>
              <div className="border-l border-line pl-4">
                <p className="text-[13px] text-muted">Consistency</p>
                <p className="num mt-1.5 text-[22px]">{d.consistency}%</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Your score grows with how often you train and how your lifts climb. Finish a workout to start it.</p>
        )}
      </section>

      {/* This week */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-[24px] leading-tight">
          <span className="num">{d.done} of {goal}</span> this week
        </h2>
        <span className="text-[13px] text-muted">{left ? `${left} to go` : 'Goal hit'}</span>
      </div>
      <div className="mt-3.5 flex justify-between">
        {d.days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className={`text-[12px] ${day.today ? 'font-bold text-accent' : 'font-medium text-muted'}`}>{day.l}</span>
            <span
              className={`dot h-[38px] w-[38px] ${
                day.done ? 'bg-ink text-on-paper' : day.today ? 'border-2 border-dashed border-accent' : 'border-[1.5px] border-line'
              }`}
            >
              {day.done && <Icon name="check" size={16} strokeWidth={2.6} />}
            </span>
          </div>
        ))}
      </div>

      {/* Up next */}
      {state.activeWorkout ? (
        <button onClick={nav.openPlayer} className="mt-7 flex w-full items-center gap-3 rounded-hero bg-accent p-5 text-left text-on-accent">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] opacity-75">In progress</span>
            <span className="block truncate font-display text-[30px] leading-tight">{state.activeWorkout.name}</span>
          </span>
          <span className="dot h-12 w-12 bg-on-accent text-accent"><Icon name="play" size={18} filled /></span>
        </button>
      ) : next && (
        <section className="mt-7 rounded-hero bg-paper p-5 text-on-paper">
          <p className="text-[13px] text-paper-muted">Up next</p>
          <h2 className="mt-0.5 font-display text-[34px] leading-[1.1]">{next.name}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="pill-paper">{next.items.length} exercises</span>
            <span className="pill-paper">{next.items.reduce((s, it) => s + it.sets, 0)} sets</span>
            <span className="pill-paper">{estimateMinutes(next)} min</span>
          </div>
          {showList && (
            <ul className="mt-3.5">
              {next.items.map((it, i) => (
                <li key={i} className={`flex items-center justify-between py-2.5 ${i ? 'border-t border-[#D3CFC5]' : ''}`}>
                  <span className="text-[15px] font-medium">{findExercise(it.exId, state.customExercises)?.name}</span>
                  <span className="num text-[15px] text-paper-muted">{it.sets} × {it.sec ? `${it.sec}s` : it.reps}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2.5">
            <button onClick={() => start(next)} className="btn h-[52px] flex-1 bg-on-paper text-paper">Begin</button>
            <button onClick={() => setShowList((v) => !v)} className="btn h-[52px] rounded-full border-[1.5px] border-[#C9C5BA] px-[18px] font-semibold">
              Exercises
              <Icon name="chevronDown" size={15} strokeWidth={2.4} className={`transition-transform ${showList ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </section>
      )}

      {/* Stats */}
      <div className="mt-7 grid grid-cols-2 gap-2.5">
        {stats.map((s, i) => (
          <button key={s.label} onClick={s.onClick} disabled={!s.onClick} className={`bg-surface p-4 text-left ${corner(i)}`}>
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <Icon name={s.icon} size={15} strokeWidth={2} className="text-accent" />
              {s.label}
            </span>
            <span className="mt-3 flex items-baseline gap-1">
              <span className="num truncate text-[30px] text-ink">{s.v}</span>
              <span className="text-[13px] text-muted">{s.u}</span>
            </span>
            <span className={`mt-2 block truncate text-[12px] ${s.accent ? 'text-accent' : 'text-muted'}`}>{s.note}</span>
          </button>
        ))}
      </div>

      {/* Recent */}
      <SectionHead title="Recent" right={has ? 'See all' : null} onRight={() => nav.go('history')} className="mt-8" />
      {has ? (
        <div className="mt-3 rounded-tuck bg-surface px-4 py-1">
          {workouts.slice(-3).reverse().map((w, i) => (
            <button key={w.id} onClick={() => setDetail(w)} className={`flex w-full items-center gap-3.5 py-3 text-left ${i ? 'border-t border-line' : ''}`}>
              <DateTile date={w.date} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{w.name}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{fmtDuration(w.durationSec)} · {fmtNum(w.totals.volume)} {w.unit}</span>
              </span>
              {w.records?.length > 0 && <span className="text-[12px] font-semibold text-accent">New best</span>}
              <Icon name="chevronRight" size={16} className="text-faint" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-tuck bg-surface p-4 text-[14px] text-muted">Finished workouts show up here.</p>
      )}

      {/* Muscle balance */}
      {totalSets > 0 && (
        <>
          <SectionHead title="Muscle balance" right="Last 4 weeks" className="mt-8" />
          <div className="mt-3.5 flex gap-1">
            {d.balance.map((m, i) => (
              <span key={m.name} className={`h-3 rounded-full ${BALANCE[i]}`} style={{ flex: m.sets }} />
            ))}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2">
            {d.balance.map((m, i) => (
              <span key={m.name} className="flex items-center gap-1.5 text-[13px] text-ink2">
                <span className={`h-2 w-2 rounded-full ${BALANCE[i]}`} />
                {m.name}
                <span className="num text-[14px] text-ink">{m.sets}</span>
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] text-faint">Sets per muscle group</p>
        </>
      )}

      <WorkoutDetail workout={detail} onClose={() => setDetail(null)} onRepeat={(r) => { setDetail(null); start(r) }} />
    </div>
  )
}
