// Home's top band: this week at a glance, the running tally, and the next photo check-in.
// Everything here is counted from real saved sessions; samples and future dates never count.
import Icon from './Icon.jsx'
import { TallyStrokes } from './training/SetupVisuals.jsx'
import { weekOverview } from '../lib/week.js'
import { fromKey, shortLabel } from '../lib/date.js'
import { weekStart } from '../lib/workout.js'

const daysUntil = (from, to) => Math.round((fromKey(to) - fromKey(from)) / 86400000)

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function WeekStrip({ state, today }) {
  const week = weekOverview(state, today)
  const trained = week.days.filter((d) => d.workouts.length).length
  return (
    <div
      className="week-dots"
      role="img"
      aria-label={`This week: trained on ${trained} ${trained === 1 ? 'day' : 'days'} so far`}
    >
      {week.days.map((d) => {
        const done = d.workouts.length > 0
        const future = d.date > today
        return (
          <span key={d.date} className="week-dot-col">
            <span className={`week-dot-day ${d.today ? 'is-today' : future ? 'is-future' : ''}`}>
              {d.today ? 'Today' : DAY[(fromKey(d.date).getDay() + 6) % 7]}
            </span>
            <span
              className={`week-dot ${done ? 'is-done' : ''} ${d.today ? 'is-today' : ''} ${future ? 'is-future' : ''}`}
            >
              {done ? (
                <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true">
                  <path d="M6 3v12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              ) : d.today ? (
                <span className="text-[15px] font-bold">{d.number}</span>
              ) : null}
            </span>
            {d.events.length > 0 && <span className="week-dot-event" aria-hidden="true" />}
          </span>
        )
      })}
    </div>
  )
}

export function TallyCard({ workouts, today }) {
  const total = workouts.length
  const start = weekStart(today)
  const thisWeek = workouts.filter((w) => w.date >= start && w.date <= today).length
  return (
    <div className="stat-card" aria-label={`Your tally: ${total} ${total === 1 ? 'session' : 'sessions'}`}>
      <span className="stat-card-label">Your tally</span>
      <span className="stat-card-number">{total}</span>
      {total > 0 ? (
        <span className="flex items-center gap-2 text-ink">
          <TallyStrokes
            count={Math.min(total, 15)}
            highlightFrom={Math.min(total, 15) - Math.min(thisWeek, 15)}
            height={18}
          />
          {total > 15 && <span className="text-[12px] text-muted">+{total - 15}</span>}
        </span>
      ) : (
        <span className="text-[13px] leading-snug text-muted">Each session adds a mark</span>
      )}
    </div>
  )
}

export function CheckinCard({ checkin, today, everyDays, manual, onOpen }) {
  if (manual)
    return (
      <button className="stat-card text-left" onClick={onOpen}>
        <span className="stat-card-label">Starting point</span>
        <Icon name="user" size={26} className="text-ink2" />
        <span className="text-[13px] font-semibold text-ink2">Manual profile</span>
      </button>
    )
  const left = checkin.due ? 0 : Math.max(0, daysUntil(today, checkin.next))
  const share = checkin.latest && everyDays ? Math.min(1, Math.max(0.04, 1 - left / everyDays)) : 1
  const r = 28
  const c = 2 * Math.PI * r
  return (
    <button
      className="stat-card stat-card--row text-left"
      onClick={onOpen}
      aria-label={
        !checkin.latest
          ? 'Starting photos: add them now'
          : checkin.due
            ? 'Photo check-in is ready'
            : `Next photo check-in on ${shortLabel(checkin.next)}`
      }
    >
      <span className="relative h-[66px] w-[66px] shrink-0" aria-hidden="true">
        <svg width="66" height="66" viewBox="0 0 66 66">
          <circle cx="33" cy="33" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="7" />
          <circle
            cx="33"
            cy="33"
            r={r}
            fill="none"
            stroke="rgb(var(--accent))"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${share * c} ${c}`}
            transform="rotate(-90 33 33)"
          />
        </svg>
        <Icon name="camera" size={22} className="absolute left-[22px] top-[22px] text-ink" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="stat-card-label">{checkin.latest ? 'Check-in' : 'Photos'}</span>
        {checkin.due ? (
          <span className="text-[17px] font-bold leading-tight text-accent-ink">
            {checkin.latest ? 'Ready' : 'Add yours'}
          </span>
        ) : (
          <>
            <span className="font-display text-[26px] leading-none">{left}</span>
            <span className="text-[13px] text-ink2">{left === 1 ? 'day' : 'days'}</span>
          </>
        )}
      </span>
    </button>
  )
}
