import { useState } from 'react'
import { weekOverview } from '../lib/week.js'
import { fromKey, labelForKey, shortLabel, WEEKDAY_INITIALS } from '../lib/date.js'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import SessionRow from './SessionRow.jsx'
import { trainingDays } from '../lib/preferences.js'

export default function WeekView({ state, today, nav, onWorkout }) {
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(today)
  const [open, setOpen] = useState(false)
  const week = weekOverview(state, today, offset)
  const progress = trainingDays(state.workouts, state.settings, today)
  const day = week.days.find((d) => d.date === selected) || week.days[0]
  const changeWeek = (direction) => {
    const next = offset + direction
    setOffset(next)
    setSelected(next === 0 ? today : '')
  }
  const count = day.workouts.length + day.events.length + day.photos.length + Number(day.photoDue)
  const firstWorkout = day.workouts[0]
  const firstEvent = day.events[0]
  const mainLabel = firstEvent
    ? `${firstEvent.name} · ${firstEvent.time}`
    : firstWorkout
      ? firstWorkout.name
      : day.photos.length
        ? 'Photos saved'
        : day.photoDue
          ? 'Photo check-in'
          : 'No plans'
  const mainIcon = firstEvent
    ? 'sport'
    : firstWorkout
      ? 'train'
      : day.photos.length || day.photoDue
        ? 'camera'
        : 'today'
  const act = (callback) => {
    setOpen(false)
    callback()
  }
  return (
    <section className="page-section" aria-label="Weekly schedule">
      <div className="section-heading">
        <h2 className="section-title">
          {offset === 0 ? 'This week' : `${shortLabel(week.start)}–${shortLabel(week.end)}`}
        </h2>
        <div className="flex items-center gap-1">
          {offset !== 0 && (
            <button
              className="text-link px-2"
              onClick={() => {
                setOffset(0)
                setSelected(today)
              }}
            >
              Today
            </button>
          )}
          <button
            className="icon-btn !bg-transparent"
            onClick={() => changeWeek(-1)}
            aria-label="Previous week"
            disabled={offset <= -52}
          >
            <Icon name="chevronLeft" size={17} />
          </button>
          <button
            className="icon-btn !bg-transparent"
            onClick={() => changeWeek(1)}
            aria-label="Next week"
            disabled={offset >= 12}
          >
            <Icon name="chevronRight" size={17} />
          </button>
        </div>
      </div>
      <div className="week-strip mt-2" role="group" aria-label="Choose a day">
        {week.days.map((d, i) => (
          <button
            key={d.date}
            aria-pressed={d.date === day.date}
            aria-current={d.today ? 'date' : undefined}
            aria-label={`${labelForKey(d.date)}, ${d.workouts.length} saved sessions, ${d.events.length} sport events${d.photoDue ? ', photo check-in' : ''}${d.photos.length ? ', photos saved' : ''}`}
            className={`week-day ${d.date === day.date ? 'week-day-selected' : ''}`}
            onClick={() => setSelected(d.date)}
          >
            <span className="text-[11px] text-muted">{WEEKDAY_INITIALS[i]}</span>
            <span className={`num mt-2 text-[21px] ${d.today ? 'text-accent' : ''}`}>{d.number}</span>
            <span className="mt-2 flex h-2 items-center gap-1" aria-hidden="true">
              {d.workouts.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {d.events.length > 0 && <span className="h-1.5 w-1.5 rounded-full border border-ink2" />}
              {(d.photos.length > 0 || d.photoDue) && <span className="h-1.5 w-1.5 rotate-45 bg-ink2" />}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Saved session
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full border border-ink2" />
          Sport
        </span>
        {!state.settings.display?.metricLight && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rotate-45 bg-ink2" />
            Photos
          </span>
        )}
      </div>
      {offset === 0 && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-muted">
          <span className="flex h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.min(100, (progress.count / Math.max(1, state.settings.workout.weeklyGoal)) * 100)}%`,
              }}
            />
          </span>
          <span>
            {progress.count}/{state.settings.workout.weeklyGoal} days · last 7
          </span>
        </p>
      )}
      {(day.workouts.length > 0 || day.events.length > 0 || day.date !== today) && (
        <button
          className="list-row mt-3 rounded-tuck bg-surface px-4"
          onClick={() => setOpen(true)}
          aria-label={`View ${labelForKey(day.date)}: ${mainLabel}`}
        >
          <span className="icon-tile">
            <Icon name={mainIcon} size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] text-muted">{labelForKey(day.date)}</span>
            <span className="mt-0.5 block truncate text-[14px] font-semibold">
              {mainLabel}
              {count > 1 ? ` +${count - 1}` : ''}
            </span>
          </span>
          <Icon name="chevronRight" size={16} className="text-faint" />
        </button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={labelForKey(day.date)}
        subtitle={fromKey(day.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
      >
        {!count && (
          <div className="empty-state">
            <span className="icon-tile">
              <Icon name="today" size={23} />
            </span>
            <p>No plans</p>
            <button className="btn-secondary mt-3" onClick={() => act(nav.openSportSchedule)}>
              Add sport event
            </button>
          </div>
        )}
        {day.workouts.map((w, i) => (
          <SessionRow key={w.id} workout={w} divider={i > 0} onClick={() => act(() => onWorkout(w))} />
        ))}
        {day.events.map((e) => (
          <button
            key={e.key}
            className="list-row border-t border-line"
            onClick={() => act(nav.openSportSchedule)}
          >
            <span className="icon-tile">
              <Icon name="sport" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{e.name}</span>
              <span className="mt-1 block text-[13px] text-muted">
                {e.time} · {e.minutes} min · {e.type === 'match' ? 'Match' : 'Practice'}
              </span>
            </span>
            <span className="tag">Scheduled</span>
          </button>
        ))}
        {(day.photos.length > 0 || day.photoDue) && (
          <button className="list-row border-t border-line" onClick={() => act(nav.openCheckins)}>
            <span className="icon-tile">
              <Icon name="camera" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">
                {day.photos.length ? 'Photos saved' : 'Photo check-in'}
              </span>
              <span className="mt-1 block text-[13px] text-muted">
                {day.photos.length ? 'View check-in' : 'Optional · front, side and back'}
              </span>
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
        )}
      </Modal>
    </section>
  )
}
