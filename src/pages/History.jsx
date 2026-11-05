import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { addDays, shortLabel, labelForKey } from '../lib/date.js'
import { LOGGED_WORKOUT, fmtNum, personalBests } from '../lib/workout.js'
import { historyTimeline, exerciseTrend } from '../lib/history-insights.js'
import Icon from '../components/Icon.jsx'
import { PageTitle, SectionHead, LineChart, Segmented } from '../components/Ink.jsx'
import SessionRow from '../components/SessionRow.jsx'
import WorkoutDetail from '../components/workout/WorkoutDetail.jsx'
import useStartWorkout from '../components/workout/useStartWorkout.js'
import Modal from '../components/Modal.jsx'
import Select from '../components/Select.jsx'
import { historyVolumeView } from '../lib/history-view.js'

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
  const bests = personalBests(state.workouts.filter((w) => w.date <= today && !w.sample)).filter(
    (b) => b.weight || b.reps || b.sec,
  )
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
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          [view.days, 'Training days'],
          [view.sets, 'Sets logged'],
          [view.activities, 'Activities'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-tuck bg-surface px-3 py-4">
            <p className="num text-[28px]">{value}</p>
            <p className="mt-2 text-[12px] leading-snug text-muted">{label}</p>
          </div>
        ))}
      </div>
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
                    <span className="block text-[15px] font-semibold">{r.title}</span>
                    <span className="mt-1 block text-[12px] text-muted">
                      {shortLabel(r.date)} ·{' '}
                      {r.type === 'photo' ? 'Saved check-in' : `${r.data.minutes} min · Reported activity`}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} />
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
          {trend.length > 1 && sameDefinition && <LineChart values={trend.map((r) => r.value)} height={84} />}
          <p className="mt-3 text-[12px] text-muted">
            {!trend.length
              ? 'Nothing logged in this period.'
              : !sameDefinition
                ? 'Shown separately: the exercise changed.'
                : trend[0]?.type === 'time'
                  ? 'Longest set, seconds'
                  : trend[0]?.weighted
                    ? `Heaviest set, ${unit}`
                    : 'Most reps in a set'}
          </p>
          <div className="mt-3 divide-y divide-line">
            {trend
              .slice(-3)
              .reverse()
              .map((r) => (
                <button
                  key={r.id}
                  className="flex min-h-12 w-full items-center gap-3 text-left text-[13px]"
                  onClick={() => setDetail(state.workouts.find((w) => w.id === r.id))}
                >
                  <span className="flex-1 text-muted">{shortLabel(r.date)}</span>
                  <span>
                    {fmtNum(r.value)}
                    {r.type === 'time' ? ' sec' : r.weighted ? ` ${unit} × ${r.reps}` : ' reps'}
                  </span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
          </div>
        </section>
      )}
      <details className="page-section border-t border-line">
        <summary className="min-h-14 cursor-pointer py-4 text-[14px] font-semibold">Bests</summary>
        <p className="text-[13px] text-muted">
          This month: {fmtNum(volume.now)} {unit} lifted.
        </p>
        <div className="mt-4 divide-y divide-line">
          {bests.map((b) => (
            <div key={b.exId} className="flex gap-3 py-4 text-[13px]">
              <span className="flex-1">{b.name}</span>
              <span>
                {b.type === 'time'
                  ? `${b.sec}s`
                  : b.weighted
                    ? `${fmtNum(b.weight)} ${b.unit || unit} × ${b.reps}`
                    : `${b.reps} reps`}
              </span>
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
