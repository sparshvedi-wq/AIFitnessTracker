// History: volume over time, a calendar of trained days, personal bests and
// every session.

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { DAYS, MONTHS, MONTHS_LONG, addDays, fromKey, toKey } from '../lib/date.js'
import { fmtDuration, fmtNum, personalBests, weekStart } from '../lib/workout.js'
import { monthlyVolume, volumeBetween, weeklyVolume } from '../lib/derive.js'
import Icon from '../components/Icon.jsx'
import { DateTile, PageTitle, SectionHead, corner } from '../components/Ink.jsx'
import WorkoutDetail from '../components/workout/WorkoutDetail.jsx'
import useStartWorkout from '../components/workout/useStartWorkout.js'

const RANGES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

// Bars and headline for the chosen range.
function volumeView(workouts, range, today) {
  if (range === 'week') {
    const start = weekStart(today)
    const bars = DAYS.slice(1).concat(DAYS[0]).map((l, i) => {
      const key = addDays(start, i)
      return { label: l[0], volume: volumeBetween(workouts, key, key), current: key === today, future: key > today }
    })
    const prev = volumeBetween(workouts, addDays(start, -7), addDays(today, -7))
    const now = volumeBetween(workouts, start, today)
    return { title: 'Volume this week', now, prev, bars }
  }
  if (range === 'month') {
    const weeks = weeklyVolume(workouts, 8, today)
    const bars = weeks.map((w, i) => ({ label: String(fromKey(w.start).getDate()), volume: w.volume, current: i === weeks.length - 1 }))
    return { title: 'Weekly volume', now: weeks[weeks.length - 1].volume, prev: volumeBetween(workouts, addDays(weekStart(today), -7), addDays(today, -7)), bars }
  }
  const months = monthlyVolume(workouts, 12, today)
  const bars = months.map((m, i) => ({ label: MONTHS[m.month][0], volume: m.volume, current: i === months.length - 1 }))
  return { title: 'Monthly volume', now: months[months.length - 1].volume, prev: months[months.length - 2].volume, bars }
}

export default function History({ nav }) {
  const { state, today } = useApp()
  const { workouts, settings } = state
  const unit = settings.weightUnit
  const start = useStartWorkout(nav)
  const [range, setRange] = useState('month')
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [detail, setDetail] = useState(null)
  const [allBests, setAllBests] = useState(false)
  const [allSessions, setAllSessions] = useState(false)

  const view = useMemo(() => volumeView(workouts, range, today), [workouts, range, today])
  const maxBar = Math.max(1, ...view.bars.map((b) => b.volume))
  const change = view.prev ? Math.round((view.now / view.prev - 1) * 100) : null

  const byDate = useMemo(() => {
    const m = new Map()
    for (const w of workouts) m.set(w.date, w)
    return m
  }, [workouts])

  const [y, mo] = month.split('-').map(Number)
  const first = new Date(y, mo - 1, 1)
  const blanks = (first.getDay() + 6) % 7
  const daysIn = new Date(y, mo, 0).getDate()
  const cells = [...Array(blanks).fill(null), ...Array.from({ length: daysIn }, (_, i) => toKey(new Date(y, mo - 1, i + 1)))]
  const monthCount = workouts.filter((w) => w.date.startsWith(month)).length
  const shiftMonth = (n) => {
    const d = new Date(y, mo - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const bests = useMemo(() => personalBests(workouts).filter((b) => b.weight || b.reps || b.sec), [workouts])
  const recentBest = new Set(workouts.filter((w) => w.date >= addDays(today, -14)).flatMap((w) => (w.records || []).map((r) => r.exId)))
  const sessions = workouts.slice().reverse()

  return (
    <div className="animate-fade-in">
      <PageTitle title="History" />

      <div className="segmented mt-4">
        {RANGES.map((r) => (
          <button key={r.value} onClick={() => setRange(r.value)} className={`segment ${range === r.value ? 'segment-active' : ''}`}>{r.label}</button>
        ))}
      </div>

      <section className="mt-4 rounded-hero bg-surface p-5">
        <p className="text-[13px] text-muted">{view.title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num text-[40px]">{fmtNum(view.now)}</span>
          <span className="text-[14px] text-muted">{unit}</span>
          {change != null && (
            <span className={`ml-auto text-[13px] font-semibold ${change >= 0 ? 'text-accent' : 'text-muted'}`}>
              {Math.abs(change)}% {change >= 0 ? 'up' : 'down'}
            </span>
          )}
        </div>
        <div className="mt-4 flex h-[120px] items-end gap-2">
          {view.bars.map((b, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span
                className={`w-full rounded-[8px_8px_3px_3px] ${b.current ? 'bg-accent' : b.future ? 'bg-surface2' : 'bg-[#34363C]'}`}
                style={{ height: `${Math.max(b.volume ? 6 : 3, (b.volume / maxBar) * 96)}px` }}
              />
              <span className={`text-[10px] ${b.current ? 'text-ink' : 'text-faint'}`}>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Calendar */}
      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="section-title">{MONTHS_LONG[mo - 1]}{y !== fromKey(today).getFullYear() ? ` ${y}` : ''}</h2>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[13px] text-muted">{monthCount} session{monthCount === 1 ? '' : 's'}</span>
            <button onClick={() => shiftMonth(-1)} className="icon-btn h-8 w-8" aria-label="Previous month"><Icon name="chevronLeft" size={16} /></button>
            <button onClick={() => shiftMonth(1)} disabled={month >= today.slice(0, 7)} className="icon-btn h-8 w-8 disabled:opacity-30" aria-label="Next month"><Icon name="chevronRight" size={16} /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-y-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i} className="text-center text-[11px] text-faint">{l}</span>)}
          {cells.map((key, i) => {
            if (!key) return <span key={i} />
            const w = byDate.get(key)
            const isToday = key === today
            const future = key > today
            return (
              <span key={i} className="flex justify-center">
                <button
                  onClick={() => w && setDetail(w)}
                  disabled={!w}
                  className={`dot num h-[38px] w-[38px] text-[15px] ${
                    w ? 'bg-ink text-on-paper' : isToday ? 'border-2 border-accent text-accent' : future ? 'text-[#4A4B50]' : 'text-muted'
                  }`}
                  aria-label={w ? `${w.name} on ${key}` : key}
                >
                  {fromKey(key).getDate()}
                </button>
              </span>
            )
          })}
        </div>
      </section>

      {/* Bests */}
      {bests.length > 0 && (
        <section className="mt-7">
          <SectionHead title="Personal bests" right={bests.length > 4 ? (allBests ? 'Show less' : 'See all') : null} onRight={() => setAllBests((v) => !v)} />
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {(allBests ? bests : bests.slice(0, 4)).map((b, i) => (
              <div key={b.exId} className={`bg-surface px-4 py-3.5 ${corner(i)}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] text-muted">{b.name}</span>
                  {recentBest.has(b.exId) && <span className="badge">New</span>}
                </div>
                <p className="num mt-2 text-[26px]">
                  {b.type === 'time' ? `${b.sec}s` : b.weighted ? <>{fmtNum(b.weight)}<span className="text-[18px] text-muted"> × </span>{b.reps}</> : `${b.reps} reps`}
                </p>
                <p className="mt-1 text-[12px] text-faint">{MONTHS[fromKey(b.date).getMonth()]} {fromKey(b.date).getDate()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sessions */}
      <section className="mt-7">
        <SectionHead title="Sessions" right={sessions.length || null} />
        {sessions.length === 0 ? (
          <p className="mt-2.5 rounded-tuck bg-surface p-4 text-[14px] text-muted">Your finished workouts land here, with every set and record.</p>
        ) : (
          <div className="mt-2.5 rounded-tuck bg-surface px-4 py-1">
            {(allSessions ? sessions : sessions.slice(0, 6)).map((w, i) => (
              <button key={w.id} onClick={() => setDetail(w)} className={`flex w-full items-center gap-3.5 py-3 text-left ${i ? 'border-t border-line' : ''}`}>
                <DateTile date={w.date} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{w.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">
                    {fmtDuration(w.durationSec)} · {w.totals.volume > 0 ? `${fmtNum(w.totals.volume)} ${w.unit}` : `${w.totals.sets} sets`}
                  </span>
                </span>
                {w.records?.length > 0 && <span className="badge">Best</span>}
                <Icon name="chevronRight" size={16} className="text-faint" />
              </button>
            ))}
            {sessions.length > 6 && (
              <button onClick={() => setAllSessions((v) => !v)} className="w-full border-t border-line py-3 text-center text-[13px] font-medium text-accent">
                {allSessions ? 'Show less' : `Show all ${sessions.length}`}
              </button>
            )}
          </div>
        )}
      </section>

      <WorkoutDetail workout={detail} onClose={() => setDetail(null)} onRepeat={(r) => { setDetail(null); start(r) }} />
    </div>
  )
}
