import { useEffect, useState } from 'react'
import { SPORTS, sportById } from '../../lib/sports.js'
import { sportOccurrences, validSportEvent, EVENT_TYPES, EVENT_EFFORTS } from '../../lib/sport-schedule.js'
import { DAYS, addDays, todayKey, labelForKey } from '../../lib/date.js'
import { uid } from '../../lib/id.js'
import { Choice, Field } from './Fields.jsx'
import Icon from '../Icon.jsx'
import Select from '../Select.jsx'
import usePlanningTime from './usePlanningTime.js'
import { DateTile } from '../Ink.jsx'

export default function SportScheduleFields({ value = [], sports = [], onChange, onValidityChange }) {
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const today = todayKey()
  const now = usePlanningTime()
  const upcoming = sportOccurrences(value, today, addDays(today, 13))
    .filter((e) => e.endsAt > now)
    .slice(0, 4)
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
  }
  useEffect(() => {
    onValidityChange?.(!draft)
  }, [draft, onValidityChange])
  const edit = (event) => {
    setDraft({ ...event, days: [...(event.days || [])] })
    setError('')
  }
  const save = () => {
    if (!validSportEvent(draft)) {
      setError('Add a sport, day, start time and length.')
      return
    }
    onChange([
      ...value.filter((e) => e.id !== draft.id),
      {
        ...draft,
        days: [1, 2, 3, 4, 5, 6, 0].filter((d) => draft.days.includes(d)),
        skippedDates: draft.skippedDates || [],
      },
    ])
    setDraft(null)
  }
  return (
    <div>
      <details className="mt-1 text-[13px] text-muted">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2">
          <Icon name="info" size={16} />
          How your schedule affects training
        </summary>
        <p className="pb-3 leading-relaxed">Training eases off around practices and matches.</p>
      </details>
      {!draft && (
        <>
          {value.length > 0 && (
            <div className="mt-2 divide-y divide-line">
              {value.map((e) => (
                <button type="button" key={e.id} onClick={() => edit(e)} className="list-row">
                  <span className="icon-tile">
                    <Icon name="sport" size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{sportById(e.sport).name}</span>
                    <span className="mt-1 block text-[12px] text-muted">
                      {e.repeat === 'weekly' ? e.days.map((d) => DAYS[d]).join(', ') : labelForKey(e.date)} ·{' '}
                      {e.time}
                    </span>
                  </span>
                  <span className="tag">{e.type === 'match' ? 'Match' : 'Practice'}</span>
                  <Icon name="chevronRight" size={15} className="text-faint" />
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="btn-secondary mt-3 min-h-12 w-full"
            disabled={value.length >= 40}
            onClick={() =>
              edit({
                id: uid(),
                sport: sports[0] || 'basketball',
                type: 'practice',
                effort: 'normal',
                repeat: 'weekly',
                days: [new Date().getDay()],
                date: today,
                startsOn: today,
                time: '18:00',
                minutes: 60,
                skippedDates: [],
              })
            }
          >
            <Icon name="plus" size={17} />
            Add event
          </button>
          {upcoming.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[14px] font-semibold">Upcoming</h3>
              {upcoming.map((e) => (
                <div key={e.key} className="list-row border-b border-line last:border-0">
                  <DateTile date={e.date} />
                  <p className="min-w-0 flex-1 text-[14px] font-semibold">
                    {e.name}
                    <span className="mt-1 block text-[12px] font-normal text-muted">
                      {e.time} · {e.minutes} min
                    </span>
                  </p>
                  <button
                    type="button"
                    className="btn-ghost !min-h-11 shrink-0 px-2 text-[12px]"
                    aria-label={`Skip ${e.name} on ${e.date}`}
                    onClick={() =>
                      onChange(
                        value.map((row) =>
                          row.id === e.id
                            ? { ...row, skippedDates: [...new Set([...(row.skippedDates || []), e.date])] }
                            : row,
                        ),
                      )
                    }
                  >
                    Skip
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {draft && (
        <div className="mt-4 rounded-tuck border border-line p-4">
          <Field label="Sport">
            <Select
              label="Sport"
              value={draft.sport}
              onChange={(sport) => set({ sport })}
              options={SPORTS.map((s) => [s.id, s.name])}
            />
          </Field>
          <Field label="Event">
            <div className="flex flex-wrap gap-2">
              {Object.entries(EVENT_TYPES).map(([v, label]) => (
                <Choice key={v} value={v} selected={draft.type === v} onClick={(type) => set({ type })}>
                  {label}
                </Choice>
              ))}
            </div>
          </Field>
          <Field label="When">
            <div className="flex gap-2">
              {[
                ['weekly', 'Each week'],
                ['once', 'One date'],
              ].map(([v, label]) => (
                <Choice key={v} value={v} selected={draft.repeat === v} onClick={(repeat) => set({ repeat })}>
                  {label}
                </Choice>
              ))}
            </div>
            {draft.repeat === 'weekly' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <Choice
                    key={d}
                    value={d}
                    selected={draft.days.includes(d)}
                    onClick={() =>
                      set({
                        days: draft.days.includes(d) ? draft.days.filter((v) => v !== d) : [...draft.days, d],
                      })
                    }
                  >
                    {DAYS[d]}
                  </Choice>
                ))}
              </div>
            ) : (
              <input
                aria-label="Event date"
                className="input mt-3 min-w-0"
                type="date"
                value={draft.date}
                onInput={(e) => set({ date: e.currentTarget.value })}
                onChange={(e) => set({ date: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <label className="mt-5 min-w-0 text-[14px] font-semibold">
              Start time
              <input
                aria-label="Event start time"
                type="time"
                className="input mt-2 min-w-0"
                value={draft.time}
                onInput={(e) => set({ time: e.currentTarget.value })}
                onChange={(e) => set({ time: e.target.value })}
              />
            </label>
            <label className="mt-5 min-w-0 text-[14px] font-semibold">
              Minutes
              <input
                aria-label="Event duration"
                type="number"
                min="10"
                max="360"
                className="input mt-2"
                value={draft.minutes || ''}
                onChange={(e) => set({ minutes: Number(e.target.value) })}
              />
            </label>
          </div>
          <Field label="Expected effort">
            <div className="flex flex-wrap gap-2">
              {Object.entries(EVENT_EFFORTS).map(([v, label]) => (
                <Choice key={v} value={v} selected={draft.effort === v} onClick={(effort) => set({ effort })}>
                  {label}
                </Choice>
              ))}
            </div>
          </Field>
          {draft.skippedDates?.length > 0 && (
            <button
              type="button"
              className="btn-ghost mt-3 min-h-12 w-full"
              onClick={() => set({ skippedDates: [] })}
            >
              Restore skipped dates ({draft.skippedDates.length})
            </button>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-accent">
              {error}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary min-h-12 flex-1" onClick={save}>
              Save event
            </button>
          </div>
          {value.some((e) => e.id === draft.id) && (
            <button
              type="button"
              className="btn-ghost mt-2 min-h-12 w-full"
              onClick={() => {
                onChange(value.filter((e) => e.id !== draft.id))
                setDraft(null)
              }}
            >
              Remove event
            </button>
          )}
        </div>
      )}
    </div>
  )
}
