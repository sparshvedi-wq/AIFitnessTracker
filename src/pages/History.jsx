import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { addDays, shortLabel, labelForKey } from '../lib/date.js'
import { LOGGED_WORKOUT, fmtNum, muscleSets, personalBests } from '../lib/workout.js'
import { historyTimeline, exerciseTrend } from '../lib/history-insights.js'
import Icon from '../components/Icon.jsx'
import { LineChart, MuscleBars, PageTitle, SectionHead, Segmented, StatTile } from '../components/Ink.jsx'
import SessionRow from '../components/SessionRow.jsx'
import WorkoutDetail from '../components/workout/WorkoutDetail.jsx'
import useStartWorkout from '../components/workout/useStartWorkout.js'
import Modal from '../components/Modal.jsx'
import Select from '../components/Select.jsx'
import { historyBars, historyVolumeView } from '../lib/history-view.js'

const TYPES = [
  ['all', 'All'],
  ['training', 'Training'],
  ['warmup', 'Warmups'],
  ['focus', 'Short sessions'],
  ['movement', 'Light movement'],
  ['activity', 'Activities'],
  ['photo', 'Photos'],
]
export default function History({ nav }) {
  const { state, today } = useApp(),
    unit = state.settings.weightUnit,
    start = useStartWorkout(nav)
  const [days, setDays] = useState(30),
    [filter, setFilter] = useState('all'),
    [query, setQuery] = useState('')
  const [detail, setDetail] = useState(null),
    [event, setEvent] = useState(null),
    [exId, setExId] = useState(''),
    [limit, setLimit] = useState(12)
  const view = useMemo(
    () => historyTimeline(state, today, { days, filter, query }),
    [state, today, days, filter, query],
  )
  const exerciseOptions = [
    ...new Map(
      state.workouts
        .filter((w) => !w.sample && w.date <= today && !['sport', 'pump', 'recovery'].includes(w.kind))
        .flatMap((w) => w.exercises.filter((e) => e.sets?.length).map((e) => [e.exId, e.name])),
    ),
  ]
  const selected = exId || exerciseOptions[0]?.[0]
  const trend = exerciseTrend(
    state.workouts.filter((w) => !days || w.date >= addDays(today, -days + 1)),
    selected,
    unit,
    today,
  )
  const sameDefinition =
    trend.length && trend.every((r) => r.type === trend[0].type && r.weighted === trend[0].weighted)
  const volume = historyVolumeView(state.workouts, 'month', today, unit)
  const bars = historyBars(state.workouts, today, days)
  const muscles = muscleSets(
    state.workouts.filter(
      (w) => !w.sample && w.date <= today && !['sport', 'pump', 'recovery'].includes(w.kind),
    ),
    days ? addDays(today, -days + 1) : '2000-01-01',
  ).filter((m) => m.sets > 0)
  const bests = personalBests(state.workouts.filter((w) => w.date <= today && !w.sample)).filter(
    (b) => b.weight || b.reps || b.sec,
  )
  const topBest = Math.max(1, ...bests.filter((b) => b.weighted).map((b) => b.weight || 0))
  const hasAny = useMemo(
    () => historyTimeline(state, today, { days: 0, filter: 'all', query: '' }).rows.length > 0,
    [state, today],
  )

  if (!hasAny)
    return (
      <div className="animate-fade-in">
        <PageTitle title="History" />
        <div className="empty-state mt-6">
          <div className="history-illustration" aria-hidden="true">
            {['train', 'sport', 'camera'].map((icon) => (
              <span key={icon}>
                <Icon name={icon} size={19} />
                <i />
                <i />
              </span>
            ))}
          </div>
          <h2 className="font-display text-[25px] text-ink">Your first session goes here.</h2>
          <p>Sessions, warmups and check-ins. All in one place.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button className="btn-primary" onClick={() => nav.go('train')}>
              Find a session
            </button>
            <button
              className="btn-secondary"
              onClick={() => start({ id: 'quick', name: LOGGED_WORKOUT, items: [] })}
            >
              Log a past workout
            </button>
          </div>
        </div>
      </div>
    )
  return (
    <div className="animate-fade-in">
      <PageTitle
        title="History"
        right={
          <button className="icon-btn" aria-label="Your events" onClick={() => nav.openEvents()}>
            <Icon name="sport" size={21} />
          </button>
        }
      />
      <Segmented
        className="mt-5"
        label="Period"
        value={days}
        onChange={(v) => {
          setDays(v)
          setLimit(12)
        }}
        options={[
          [7, '7 days'],
          [30, '30 days'],
          [0, 'All time'],
        ]}
      />
      <section className="mt-4 rounded-tuck bg-surface p-5" aria-label="Training in this period">
        <div className="grid grid-cols-3 gap-2">
          {[
            [view.days, 'Days'],
            [view.sets, 'Sets'],
            [view.activities, 'Activities'],
          ].map(([value, label]) => (
            <StatTile key={label} value={value} label={label} className="stat-tile--bare" />
          ))}
        </div>
        <ActivityBars bars={bars} days={days} />
      </section>
      {muscles.length > 0 && (
        <section className="mt-3 rounded-tuck bg-surface p-5">
          <h2 className="mb-4 text-[16px] font-semibold">Muscles worked</h2>
          <MuscleBars rows={muscles.slice(0, 6).map((m) => [m.muscle, m.sets])} />
        </section>
      )}
      <section className="page-section">
        <SectionHead
          title="Your activity"
          right="Log workout"
          onRight={() => start({ id: 'quick', name: LOGGED_WORKOUT, items: [] })}
        />
        <input
          aria-label="Search history"
          type="search"
          className="input mt-4"
          placeholder="Search history"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(12)
          }}
        />
        <div className="no-scrollbar -mx-[22px] mt-3 flex gap-2 overflow-x-auto px-[22px]">
          {TYPES.filter(([id]) => id !== 'photo' || !state.settings.display.metricLight).map(
            ([id, label]) => (
              <button
                key={id}
                className={`chip ${filter === id ? 'chip-active' : ''}`}
                aria-pressed={filter === id}
                onClick={() => {
                  setFilter(id)
                  setLimit(12)
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div className="mt-4 rounded-tuck bg-surface px-4">
          {view.rows.slice(0, limit).map((r, i) => (
            <div key={`${r.type}-${r.id}`} className={i ? 'border-t border-line' : ''}>
              {r.type === 'activity' || r.type === 'photo' ? (
                <button
                  className="list-row"
                  onClick={() => (r.type === 'photo' ? nav.openCheckins(r.id) : setEvent(r.data))}
                >
                  <span className="icon-tile">
                    <Icon name={r.type === 'photo' ? 'camera' : 'sport'} size={21} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{r.title}</span>
                    <span className="row-meta">{shortLabel(r.date)}</span>
                  </span>
                  {r.type !== 'photo' && (
                    <span className="row-figure">
                      <span className="num">{r.data.minutes}</span>min
                    </span>
                  )}
                  <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
                </button>
              ) : (
                <SessionRow workout={r.data} onClick={() => setDetail(r.data)} />
              )}
            </div>
          ))}
          {view.rows.length > limit && (
            <button className="btn-ghost w-full" onClick={() => setLimit((n) => n + 12)}>
              Show more · {view.rows.length - limit} left
            </button>
          )}
        </div>
        {!view.rows.length && (
          <div className="empty-state mt-4">
            <Icon name="history" size={28} />
            <p>
              {query
                ? 'No matching history. Try another exercise or activity.'
                : 'Nothing logged for this view yet.'}
            </p>
            {!query && (
              <button className="btn-secondary" onClick={() => nav.go('train')}>
                Find a session
              </button>
            )}
          </div>
        )}
      </section>
      {exerciseOptions.length > 0 && (
        <section className="page-section rounded-tuck bg-surface p-4">
          <SectionHead title="Your exercise history" />
          <div className="mt-3">
            <Select
              label="Exercise"
              value={selected}
              onChange={setExId}
              options={exerciseOptions}
              className="mt-2"
            />
          </div>
          {trend.length > 1 && sameDefinition && (
            <LineChart
              values={trend.map((r) => (r.assisted ? -r.value : r.value))}
              height={84}
              minSpan={Math.max(...trend.map((r) => Math.abs(r.value))) * 0.25}
            />
          )}
          <p className="mt-3 text-[14px] font-semibold text-ink2">
            {!trend.length
              ? 'Nothing logged in this period.'
              : !sameDefinition
                ? 'Shown separately: the exercise changed.'
                : trend[0]?.type === 'time'
                  ? 'Longest set, seconds'
                  : trend[0]?.assisted
                    ? `Least assistance, ${unit} (the line rises as you need less)`
                    : trend[0]?.weighted
                      ? `Heaviest set, ${unit}`
                      : 'Most reps in a set'}
            {trend.length > 1 && sameDefinition && trend[0].value !== trend.at(-1).value && (
              <span className="num font-normal text-muted">
                {' '}
                · {fmtNum(trend[0].value)} → {fmtNum(trend.at(-1).value)}
              </span>
            )}
          </p>
          <div className="mt-3 divide-y divide-line">
            {trend
              .slice(-3)
              .reverse()
              .map((r) => (
                <button
                  key={r.id}
                  className="flex min-h-12 w-full items-center gap-3 text-left text-[15px]"
                  onClick={() => setDetail(state.workouts.find((w) => w.id === r.id))}
                >
                  <span className="flex-1 text-ink2">{shortLabel(r.date)}</span>
                  <span className="num text-[17px]">
                    {fmtNum(r.value)}
                    {r.type === 'time'
                      ? ' sec'
                      : r.assisted
                        ? ` ${unit} assistance × ${r.reps}`
                        : r.weighted
                          ? ` ${unit} × ${r.reps}`
                          : ' reps'}
                  </span>
                  <Icon name="chevronRight" size={15} className="text-faint" />
                </button>
              ))}
          </div>
        </section>
      )}
      <details className="page-section border-t border-line">
        <summary className="min-h-14 cursor-pointer py-4 text-[16px] font-semibold">Bests</summary>
        {volume.now > 0 && <StatTile value={fmtNum(volume.now)} unit={unit} label="Lifted this month" />}
        <div className="mt-2 divide-y divide-line">
          {bests.map((b) => (
            <div key={b.exId} className="py-3.5 text-[15px]">
              <div className="flex items-baseline gap-3">
                <span className="flex-1 font-medium">{b.name}</span>
                <span className="num text-[17px]">
                  {b.type === 'time'
                    ? `${b.sec}s`
                    : b.weighted
                      ? `${fmtNum(b.weight)} ${b.unit || unit} × ${b.reps}`
                      : `${b.reps} reps`}
                </span>
              </div>
              {b.weighted && b.weight > 0 && (
                <span
                  className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-ink/10"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(6, (b.weight / topBest) * 100)}%` }}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      </details>
      <WorkoutDetail
        workout={detail}
        onClose={() => setDetail(null)}
        onRepeat={(r) => {
          setDetail(null)
          start(r)
        }}
      />
      <Modal open={Boolean(event)} onClose={() => setEvent(null)} title={event?.title || 'Activity'}>
        {event && (
          <>
            <p className="mt-4 text-[15px]">
              {labelForKey(event.date)} · {event.time} · {event.minutes} min
            </p>
            <p className="mt-3 text-[14px] text-muted">
              Reported effort: {event.effort}. {event.impact.summary}
            </p>
            <p className="mt-4 text-[13px] text-muted">Shapes your plan; not a training day.</p>
            <button
              className="btn-secondary mt-5 w-full"
              onClick={() => {
                setEvent(null)
                nav.openEvents()
              }}
            >
              Manage events
            </button>
          </>
        )}
      </Modal>
    </div>
  )
}

// Working sets across the chosen period: a bar per day, or per week for all time.
function ActivityBars({ bars, days }) {
  const max = Math.max(1, ...bars.map((b) => b.sets))
  const total = bars.reduce((n, b) => n + b.sets, 0)
  return (
    <div className="mt-5">
      <div
        className={`flex h-24 items-end ${bars.length > 14 ? 'gap-[3px]' : 'gap-2'}`}
        role="img"
        aria-label={`${total} sets ${days ? `in the last ${days} days, by day` : 'in the last 12 weeks, by week'}`}
      >
        {bars.map((b) => (
          <span
            key={b.date}
            className={`min-w-0 flex-1 rounded-[5px] ${b.sets ? 'bg-accent' : 'bg-ink/10'}`}
            style={{ height: b.sets ? `${Math.max(12, (b.sets / max) * 100)}%` : 4 }}
          />
        ))}
      </div>
      <div
        className="mt-2.5 flex justify-between gap-2 text-[13px] font-semibold text-ink2"
        aria-hidden="true"
      >
        {bars[0].label ? (
          bars.map((b) => (
            <span key={b.date} className={`flex-1 text-center ${b.current ? 'text-accent-ink' : ''}`}>
              {b.label}
            </span>
          ))
        ) : (
          <>
            <span>{shortLabel(bars[0].date)}</span>
            <span>{days ? 'Sets per day' : 'Sets per week'}</span>
            <span className="text-accent-ink">{days ? 'Today' : 'This week'}</span>
          </>
        )}
      </div>
    </div>
  )
}
