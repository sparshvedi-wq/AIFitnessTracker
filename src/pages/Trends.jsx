// Trends: calorie bars, deficit/surplus bars, stacked macro bars,
// weight line chart, weekly summary, and achievement badges.

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
import { shortLabel } from '../lib/date.js'
import { useIsDark } from '../lib/useTheme.js'

// ── Chart colour helpers ──────────────────────────────────────────────
const gridColor = (dark) => (dark ? '#334155' : '#f1f5f9')
const tickColor = (dark) => (dark ? '#64748b' : '#94a3b8')
const tooltipStyle = (dark) => ({
  borderRadius: 12,
  border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
  backgroundColor: dark ? '#1e293b' : '#fff',
  color: dark ? '#f1f5f9' : '#1e293b',
  fontSize: 13,
})

function StatCard({ label, value, sub, accent = '' }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent || 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

// Donut-style chart for the weekly "on target" stat
function OnTargetBar({ value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300">On target days</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{value}/{total}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
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
  const achievements = useMemo(() => computeAchievements(state, today), [state, today])

  const goal = state.settings.goals.calories
  const unit = state.settings.weightUnit || 'lb'
  const daysLogged = series.filter((d) => d.calories > 0).length
  const latestWeight = weights.length ? weights[weights.length - 1].weight : null

  const tickProps = { fontSize: 11, fill: tickColor(isDark) }
  const gridProps = { strokeDasharray: '3 3', vertical: false, stroke: gridColor(isDark) }
  const tStyle = tooltipStyle(isDark)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Trends</h2>
        <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5">
          {[7, 30].map((n) => (
            <button
              key={n}
              onClick={() => setRange(n)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                range === n
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Streak" value={`${streak} 🔥`} sub="days logged in a row" accent="text-orange-500" />
        <StatCard label="Avg cal" value={avg.calories || '—'} sub={`${daysLogged} logged days`} accent="text-cal" />
        <StatCard label="Days logged" value={`${daysLogged}/${range}`} sub="this period" />
        <StatCard
          label="Latest weight"
          value={latestWeight != null ? latestWeight : '—'}
          sub={latestWeight != null ? unit : 'not logged yet'}
        />
      </div>

      {/* Weekly summary */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">This week</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Avg calories</p>
            <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{weekly.avgCalories || '—'}</p>
            {weekly.avgLast > 0 && (
              <p className={`text-xs font-medium ${weekly.avgCalories <= weekly.avgLast ? 'text-emerald-500' : 'text-red-400'}`}>
                {weekly.avgCalories <= weekly.avgLast ? '↓' : '↑'} vs last week ({weekly.avgLast})
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Weekly deficit</p>
            <p className={`text-xl font-bold tabular-nums ${weekly.totalDeficit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {weekly.totalDeficit >= 0 ? '-' : '+'}{Math.abs(weekly.totalDeficit)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">cal vs goal</p>
          </div>
        </div>
        <div className="mt-3">
          <OnTargetBar value={weekly.onTarget} total={weekly.daysLogged} />
        </div>
      </div>

      {/* Chart tabs */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 dark:border-slate-700">
          {CHART_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setChartTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                chartTab === t.id
                  ? 'border-b-2 border-cal text-cal'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ── Calories tab ── */}
          {chartTab === 'calories' && (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Calories per day</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={tickProps} interval={range === 7 ? 0 : 'preserveStartEnd'} />
                    <YAxis tick={tickProps} />
                    <Tooltip contentStyle={tStyle} formatter={(v) => [`${v} cal`, 'Calories']} />
                    {goal > 0 && <ReferenceLine y={goal} stroke="#ef4444" strokeDasharray="4 4" />}
                    <Bar dataKey="calories" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {goal > 0 && <p className="mt-1 text-center text-xs text-slate-400 dark:text-slate-500">Red dashed = {goal} cal goal</p>}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Daily deficit / surplus vs goal</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={tickProps} interval={range === 7 ? 0 : 'preserveStartEnd'} />
                    <YAxis tick={tickProps} />
                    <Tooltip
                      contentStyle={tStyle}
                      formatter={(v, _n, props) =>
                        v == null ? ['—', 'no data'] : [`${v > 0 ? '-' : '+'}${Math.abs(v)} cal`, v > 0 ? 'deficit' : 'surplus']
                      }
                    />
                    <ReferenceLine y={0} stroke={tickColor(isDark)} />
                    <Bar dataKey="def" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.def == null ? '#cbd5e1' : d.def >= 0 ? '#10b981' : '#f87171'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-center text-xs text-slate-400 dark:text-slate-500">
                  Green = under goal (deficit) · Red = over goal (surplus)
                </p>
              </div>
            </div>
          )}

          {/* ── Macros tab ── */}
          {chartTab === 'macros' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Daily macros (calories from each)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stackData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" tick={tickProps} interval={range === 7 ? 0 : 'preserveStartEnd'} />
                  <YAxis tick={tickProps} />
                  <Tooltip contentStyle={tStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: tickColor(isDark) }} />
                  {goal > 0 && <ReferenceLine y={goal} stroke="#ef4444" strokeDasharray="4 4" />}
                  <Bar dataKey="proteinCal" name="Protein" stackId="a" fill="#ef4444" />
                  <Bar dataKey="carbsCal" name="Carbs" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="fatCal" name="Fat" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Average macro cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Protein', value: avg.protein, color: 'text-protein' },
                  { label: 'Carbs', value: avg.carbs, color: 'text-carbs' },
                  { label: 'Fat', value: avg.fat, color: 'text-fat' },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-slate-50 dark:bg-slate-700 p-3 text-center">
                    <p className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}g</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">avg {m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Weight tab ── */}
          {chartTab === 'weight' && (
            <div>
              <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Weight over time ({unit})</p>
              {weightData.length < 2 ? (
                <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Log your weight on at least two days to see the trend.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weightData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" tick={tickProps} />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={tickProps} />
                    <Tooltip contentStyle={tStyle} formatter={(v) => [`${v} ${unit}`, 'Weight']} />
                    <Line
                      type="monotone" dataKey="weight"
                      stroke={isDark ? '#f1f5f9' : '#0f172a'}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: isDark ? '#f1f5f9' : '#0f172a' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Achievements */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Achievements</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {achievements.map((badge) => (
            <div
              key={badge.id}
              className={`flex flex-col items-center rounded-xl p-3 text-center transition-all ${
                badge.earned
                  ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-700'
                  : 'bg-slate-50 dark:bg-slate-700 opacity-40 grayscale'
              }`}
            >
              <span className="text-2xl">{badge.icon}</span>
              <p className={`mt-1 text-xs font-semibold ${badge.earned ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'}`}>
                {badge.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">{badge.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
