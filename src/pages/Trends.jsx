// Progress tab: headline stats, training (workouts per week, muscle focus,
// personal bests), nutrition this week vs last, charts (calories, macros,
// weight) and achievements.

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, Legend,
} from 'recharts'
import { useApp } from '../store/AppContext.jsx'
import {
  dailySeries, deficitSeries, macroStackSeries, averageMacros,
  weightSeries, computeStreak, weeklyStats, computeAchievements,
} from '../lib/calc.js'
import { addDays, shortLabel } from '../lib/date.js'
import { fmtNum, muscleSets, personalBests, weekStreak, weeklyCounts, workoutAchievements } from '../lib/workout.js'
import { MuscleTag } from '../components/workout/Controls.jsx'
import { useIsDark } from '../lib/useTheme.js'
import { chartColors } from '../lib/palette.js'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import ShareWeek from '../components/ShareWeek.jsx'

const tooltipStyle = (c) => ({
  borderRadius: 14,
  border: `1px solid ${c.grid}`,
  backgroundColor: c.surface,
  color: c.ink,
  fontSize: 13,
  boxShadow: '0 12px 28px rgb(0 0 0 / 0.25)',
})

const BADGE_ICONS = {
  first: 'sprout', week: 'flame', month: 'trophy',
  dedicated: 'barChart', hydrated: 'droplet', precision: 'target',
}

function StatCard({ icon, iconClass, label, value, unit, sub }) {
  return (
    <div className="card p-4">
      <div className={`eyebrow flex items-center gap-1.5 ${iconClass}`}>
        <Icon name={icon} size={14} strokeWidth={2.4} />
        {label}
      </div>
      <p className="mt-2 truncate text-ink">
        <span className="num text-[44px]">{value}</span>
        {unit && <span className="text-[13px] font-semibold text-muted"> {unit}</span>}
      </p>
      {sub && <p className="mt-1 truncate text-[12px] text-muted">{sub}</p>}
    </div>
  )
}

function EmptyChart({ icon, children }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center rounded-2xl bg-surface2 px-6 text-center">
      <Icon name={icon} size={22} className="mb-2 text-muted" />
      <p className="text-sm text-muted">{children}</p>
    </div>
  )
}

const CHART_TABS = [
  { id: 'calories', label: 'Calories' },
  { id: 'macros', label: 'Macros' },
  { id: 'weight', label: 'Weight' },
]

export default function Trends() {
  const { state, today } = useApp()
  const isDark = useIsDark()
  const [range, setRange] = useState(7)
  const [chartTab, setChartTab] = useState('calories')

  const series = useMemo(() => dailySeries(state, range), [state, range])
  const defSeries = useMemo(() => deficitSeries(state, range), [state, range])
  const stackSeries = useMemo(() => macroStackSeries(state, range), [state, range])

  const chartData = useMemo(
    () => series.map((d, i) => ({ ...d, label: shortLabel(d.date), def: defSeries[i]?.deficit })),
    [series, defSeries],
  )
  const stackData = useMemo(
    () => stackSeries.map((d) => ({ ...d, label: shortLabel(d.date) })),
    [stackSeries],
  )

  const avg = useMemo(() => averageMacros(series), [series])
  const weights = useMemo(() => weightSeries(state), [state])
  const weightData = useMemo(() => weights.map((w) => ({ ...w, label: shortLabel(w.date) })), [weights])
  const streak = useMemo(() => computeStreak(state, today), [state, today])
  const weekly = useMemo(() => weeklyStats(state, today), [state, today])
  const weeklyGoal = state.settings.workout.weeklyGoal
  const achievements = useMemo(
    () => [
      ...workoutAchievements(state.workouts, weeklyGoal, today),
      // The food library is gone from the app, so its badge would be unreachable
      ...computeAchievements(state, today).filter((b) => b.id !== 'library'),
    ],
    [state, today, weeklyGoal],
  )

  // Training
  const rangeStart = addDays(today, -(range - 1))
  const rangeWorkouts = useMemo(() => state.workouts.filter((w) => w.date >= rangeStart), [state.workouts, rangeStart])
  const rangeMinutes = Math.round(rangeWorkouts.reduce((s, w) => s + (w.durationSec || 0), 0) / 60)
  const weeks = useMemo(
    () => weeklyCounts(state.workouts, 8, today).map((w) => ({ ...w, label: shortLabel(w.start) })),
    [state.workouts, today],
  )
  const weeksOnGoal = useMemo(() => weekStreak(state.workouts, weeklyGoal, today), [state.workouts, weeklyGoal, today])
  const muscles = useMemo(() => muscleSets(state.workouts, rangeStart), [state.workouts, rangeStart])
  const bests = useMemo(() => personalBests(state.workouts).slice(0, 5), [state.workouts])
  const latestWeight = weights.length ? weights[weights.length - 1].weight : null
  const firstWeight = weights.find((w) => w.date >= rangeStart)?.weight
  const weightChange = latestWeight != null && firstWeight != null ? Math.round((latestWeight - firstWeight) * 10) / 10 : null

  const goal = state.settings.goals.calories
  const unit = state.settings.weightUnit || 'lb'
  const daysLogged = series.filter((d) => d.calories > 0).length

  const c = chartColors(isDark)
  const tickProps = { fontSize: 11, fill: c.tick }
  const gridProps = { strokeDasharray: '3 3', vertical: false, stroke: c.grid }
  const axisProps = { axisLine: false, tickLine: false }
  const tStyle = tooltipStyle(c)
  const xInterval = range === 7 ? 0 : 'preserveStartEnd'
  // Calorie axes: always include the goal line and use evenly spaced round ticks
  const calTicks = useMemo(() => {
    const peak = Math.max(
      goal || 0,
      ...series.map((d) => d.calories),
      ...stackSeries.map((d) => d.proteinCal + d.carbsCal + d.fatCal),
    )
    const step = peak > 3000 ? 1000 : 500
    const top = Math.max(step, Math.ceil((peak * 1.05) / step) * step)
    return Array.from({ length: top / step + 1 }, (_, i) => i * step)
  }, [series, stackSeries, goal])
  const calAxis = { domain: [0, calTicks[calTicks.length - 1]], ticks: calTicks }

  // Weight axis: whole numbers, four even steps around the data
  const weightTicks = useMemo(() => {
    if (weights.length === 0) return [0]
    const vals = weights.map((w) => w.weight)
    const lo = Math.floor(Math.min(...vals) - 1)
    const step = Math.max(1, Math.ceil((Math.max(...vals) + 1 - lo) / 4))
    return Array.from({ length: 5 }, (_, i) => lo + i * step)
  }, [weights])

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle={`Last ${range} days`}
        right={
          <div className="segmented w-28 shrink-0">
            {[7, 30].map((n) => (
              <button key={n} onClick={() => setRange(n)} className={`segment py-1 ${range === n ? 'segment-active' : ''}`}>
                {n}d
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4">
        <ShareWeek />
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon="dumbbell" iconClass="text-brand" label="Workouts"
          value={rangeWorkouts.length} sub={rangeMinutes ? `${rangeMinutes} min trained` : 'None yet in this range'}
        />
        <StatCard
          icon="flame" iconClass="text-protein" label="Streak"
          value={streak} unit={`day${streak === 1 ? '' : 's'}`} sub="logged in a row"
        />
        <StatCard
          icon="target" iconClass="text-carbs" label="Avg calories"
          value={avg.calories ? avg.calories.toLocaleString() : '—'} sub={`${daysLogged} of ${range} days logged`}
        />
        <StatCard
          icon="scale" iconClass="text-fat" label="Weight"
          value={latestWeight != null ? fmtNum(latestWeight) : '—'} unit={latestWeight != null ? unit : null}
          sub={latestWeight == null ? 'Log it on the Today tab' : weightChange == null ? 'Latest logged' : weightChange === 0 ? `No change in ${range} days` : `${weightChange > 0 ? '+' : '−'}${fmtNum(Math.abs(weightChange))} ${unit} in ${range} days`}
        />
      </div>

      {/* Training */}
      <h2 className="section-title mb-2 mt-7">Training</h2>
      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="font-display text-[20px] font-extrabold uppercase text-ink">Workouts per week</p>
          {weeksOnGoal > 0 && (
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-protein">
              <Icon name="flame" size={14} />
              {weeksOnGoal} week{weeksOnGoal === 1 ? '' : 's'} on goal
            </p>
          )}
        </div>
        {state.workouts.length === 0 ? (
          <EmptyChart icon="dumbbell">Finish a workout to start tracking your weeks.</EmptyChart>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={weeks} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={tickProps} {...axisProps} interval="preserveStartEnd" />
                <YAxis tick={tickProps} {...axisProps} allowDecimals={false} domain={[0, (max) => Math.max(max, weeklyGoal)]} />
                <Tooltip
                  contentStyle={tStyle}
                  cursor={{ fill: c.grid }}
                  labelFormatter={(l) => `Week of ${l}`}
                  formatter={(v, _n, p) => [`${v} workout${v === 1 ? '' : 's'} · ${p.payload.minutes} min`, '']}
                  separator=""
                />
                {weeklyGoal > 0 && <ReferenceLine y={weeklyGoal} stroke={c.ink} strokeOpacity={0.5} strokeDasharray="4 4" />}
                <Bar dataKey="count" radius={[13, 13, 13, 13]} maxBarSize={26}>
                  {weeks.map((w, i) => (
                    <Cell key={i} fill={w.count >= weeklyGoal ? c.accent : c.accentSoft} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-[13px] text-muted">Dashed line is your goal of {weeklyGoal} a week</p>
          </>
        )}

        {muscles.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-display text-[20px] font-extrabold uppercase text-ink">Muscle focus</p>
              <p className="text-[13px] text-muted">sets, last {range} days</p>
            </div>
            <ul className="space-y-2.5">
              {muscles.map((m) => (
                <li key={m.muscle} className="flex items-center gap-3">
                  <span className="w-[84px] shrink-0"><MuscleTag muscle={m.muscle} /></span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                    <span
                      className="block h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${(m.sets / muscles[0].sets) * 100}%` }}
                    />
                  </span>
                  <span className="w-7 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">{m.sets}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {bests.length > 0 && (
        <>
          <h2 className="section-title mb-2 mt-7">Personal bests</h2>
          <section className="card divide-y divide-line/70 overflow-hidden">
            {bests.map((b, i) => (
              <div key={b.exId} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    i === 0 ? 'bg-accent text-on-accent' : 'bg-surface2 text-ink2'
                  }`}
                >
                  {i === 0 ? <Icon name="trophy" size={15} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{b.name}</p>
                  <p className="text-[13px] text-muted">{shortLabel(b.date)}</p>
                </div>
                <p className="num shrink-0 text-[24px] text-ink">
                  {b.type === 'time' ? `${b.sec}s` : b.weighted ? `${fmtNum(b.weight)} ${b.unit}` : `${b.reps} reps`}
                  {b.weighted && b.type !== 'time' && <span className="text-[13px] font-medium text-muted"> × {b.reps}</span>}
                </p>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Weekly summary */}
      <h2 className="section-title mb-2 mt-7">Nutrition this week</h2>
      <section className="card p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="eyebrow">Avg calories</p>
            <p className="num mt-1 text-[36px] text-ink">{weekly.avgCalories ? weekly.avgCalories.toLocaleString() : '—'}</p>
            {weekly.avgLast > 0 && (
              <p className="flex items-center gap-1 text-[13px] font-medium text-muted">
                <Icon name={weekly.avgCalories <= weekly.avgLast ? 'arrowDown' : 'arrowUp'} size={13} strokeWidth={2.5} />
                vs {weekly.avgLast.toLocaleString()} last week
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow">{weekly.totalDeficit >= 0 ? 'Under goal' : 'Over goal'}</p>
            {weekly.daysLogged ? (
              <p className={`num mt-1 text-[36px] ${weekly.totalDeficit >= 0 ? 'text-brand' : 'text-danger'}`}>
                {Math.abs(weekly.totalDeficit).toLocaleString()} <span className="text-sm font-semibold">cal</span>
              </p>
            ) : (
              <p className="num mt-1 text-[36px] text-ink">—</p>
            )}
            {weekly.daysLogged > 0 && <p className="text-[13px] text-muted">total this week</p>}
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 flex justify-between text-[13px]">
            <span className="font-medium text-ink2">Days on target</span>
            <span className="font-semibold tabular-nums text-ink">
              {weekly.daysLogged ? `${weekly.onTarget} of ${weekly.daysLogged}` : '—'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${weekly.daysLogged ? Math.round((weekly.onTarget / weekly.daysLogged) * 100) : 0}%` }}
            />
          </div>
        </div>
      </section>

      {/* Charts */}
      <h2 className="section-title mb-2 mt-7">Charts</h2>
      <section className="card p-4">
        <div className="segmented mb-4">
          {CHART_TABS.map((t) => (
            <button key={t.id} onClick={() => setChartTab(t.id)} className={`segment ${chartTab === t.id ? 'segment-active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        {chartTab === 'calories' && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 font-display text-[20px] font-extrabold uppercase text-ink">Calories per day</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" tick={tickProps} {...axisProps} interval={xInterval} />
                  <YAxis tick={tickProps} {...axisProps} {...calAxis} />
                  <Tooltip contentStyle={tStyle} cursor={{ fill: c.grid }} formatter={(v) => [`${v.toLocaleString()} cal`, 'Calories']} />
                  {goal > 0 && <ReferenceLine y={goal} stroke={c.ink} strokeOpacity={0.5} strokeDasharray="4 4" />}
                  <Bar dataKey="calories" fill={c.accent} radius={[14, 14, 14, 14]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              {goal > 0 && <p className="mt-1 text-center text-[13px] text-muted">Dashed line is your {goal.toLocaleString()} cal goal</p>}
            </div>

            <div className="border-t border-line pt-4">
              <p className="mb-3 font-display text-[20px] font-extrabold uppercase text-ink">Under / over goal</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" tick={tickProps} {...axisProps} interval={xInterval} />
                  <YAxis tick={tickProps} {...axisProps} />
                  <Tooltip
                    contentStyle={tStyle}
                    cursor={{ fill: c.grid }}
                    formatter={(v) =>
                      v == null ? ['—', 'no data'] : [`${Math.abs(v)} cal`, v > 0 ? 'under goal' : 'over goal']
                    }
                  />
                  <ReferenceLine y={0} stroke={c.tick} />
                  <Bar dataKey="def" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.def == null ? c.empty : d.def >= 0 ? c.accent : c.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-1 text-center text-[13px] text-muted">Volt is under goal, red is over</p>
            </div>
          </div>
        )}

        {chartTab === 'macros' && (
          <div className="space-y-4">
            <p className="font-display text-[20px] font-extrabold uppercase text-ink">Calories from each macro</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stackData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" tick={tickProps} {...axisProps} interval={xInterval} />
                <YAxis tick={tickProps} {...axisProps} {...calAxis} />
                <Tooltip contentStyle={tStyle} cursor={{ fill: c.grid }} formatter={(v) => `${v.toLocaleString()} cal`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: c.tick }} />
                {goal > 0 && <ReferenceLine y={goal} stroke={c.ink} strokeOpacity={0.5} strokeDasharray="4 4" />}
                <Bar dataKey="proteinCal" name="Protein" stackId="a" fill={c.protein} maxBarSize={28} />
                <Bar dataKey="carbsCal" name="Carbs" stackId="a" fill={c.carbs} maxBarSize={28} />
                <Bar dataKey="fatCal" name="Fat" stackId="a" fill={c.fat} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Protein', value: avg.protein, color: 'text-protein' },
                { label: 'Carbs', value: avg.carbs, color: 'text-carbs' },
                { label: 'Fat', value: avg.fat, color: 'text-fat' },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl bg-surface2 p-3 text-center">
                  <p className={`num text-[32px] ${m.color}`}>{m.value}g</p>
                  <p className="text-[13px] text-muted">avg {m.label.toLowerCase()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {chartTab === 'weight' && (
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-display text-[20px] font-extrabold uppercase text-ink">Weight ({unit})</p>
              {latestWeight != null && (
                <p className="text-[13px] text-muted">Latest <span className="font-semibold text-ink">{latestWeight} {unit}</span></p>
              )}
            </div>
            {weightData.length < 2 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl bg-surface2 px-6 text-center">
                <Icon name="scale" size={22} className="mb-2 text-muted" />
                <p className="text-sm text-muted">Log your weight on at least two days to see the trend.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weightData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" tick={tickProps} {...axisProps} />
                  <YAxis domain={[weightTicks[0], weightTicks[weightTicks.length - 1]]} ticks={weightTicks} tick={tickProps} {...axisProps} />
                  <Tooltip contentStyle={tStyle} formatter={(v) => [`${v} ${unit}`, 'Weight']} />
                  <Line
                    type="monotone" dataKey="weight"
                    stroke={c.fat}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: c.fat, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </section>

      {/* Achievements */}
      <div className="mb-2 mt-7 flex items-baseline justify-between">
        <h2 className="section-title">Achievements</h2>
        <span className="text-[13px] font-medium tabular-nums text-muted">
          {achievements.filter((b) => b.earned).length} of {achievements.length}
        </span>
      </div>
      <section className="card divide-y divide-line/70 overflow-hidden">
        {achievements.map((badge) => (
          <div key={badge.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                badge.earned ? 'bg-accent text-on-accent' : 'bg-surface2 text-muted'
              }`}
            >
              <Icon name={BADGE_ICONS[badge.id] || badge.icon || 'trophy'} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-display text-[19px] font-extrabold uppercase leading-tight ${badge.earned ? 'text-ink' : 'text-ink2'}`}>{badge.label}</p>
              <p className="text-[13px] text-muted">{badge.desc}</p>
            </div>
            {badge.earned ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-on-accent">
                <Icon name="check" size={14} strokeWidth={3} />
              </span>
            ) : (
              <span className="h-6 w-6 rounded-full border-2 border-line" />
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
