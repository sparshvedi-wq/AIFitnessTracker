import { useRef, useState, useEffect } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import Select from '../Select.jsx'
import { DateTile } from '../Ink.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { SPORTS } from '../../lib/sports.js'
import { uid } from '../../lib/id.js'
import { addDays, toKey, labelForKey } from '../../lib/date.js'
import {
  EVENT_MUSCLES,
  eventOccurrences,
  eventTime,
  presetImpact,
  validTrainingEvent,
} from '../../lib/training-events.js'
import usePlanningTime from './usePlanningTime.js'
import { Field, Choice } from './Fields.jsx'

const simple = {
  walk: { title: 'Long walk', muscles: ['Legs', 'Glutes'], effort: 'easy' },
  hike: { title: 'Hike', muscles: ['Legs', 'Glutes', 'Back'], effort: 'normal' },
  moving: { title: 'Moving / physical work', muscles: ['Legs', 'Back', 'Shoulders', 'Core'], effort: 'hard' },
}
export default function TrainingEvents({ onClose, onPrepare, initial = 'list' }) {
  const { state, dispatch, today, toast } = useApp()
  const profile = state.settings.training
  const now = usePlanningTime()
  const [screen, setScreen] = useState(initial === 'list' ? 'list' : 'kind')
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [description, setDescription] = useState('')
  const [consent, setConsent] = useState(false)
  const [manual, setManual] = useState(false)
  const request = useRef(null)
  const errorNotice = useRef(null)
  const version = useRef(0)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (error) errorNotice.current?.focus()
  }, [error])
  const allEvents = eventOccurrences(profile.lifeEvents, addDays(today, -30), addDays(today, 365))
  const events = [
    ...allEvents.filter((e) => e.status === 'planned'),
    ...allEvents
      .filter((e) => e.status === 'done')
      .reverse()
      .slice(0, 5),
  ]
  const saveEvent = (event) => dispatch({ type: 'SAVE_TRAINING_EVENT', event })
  const begin = (kind, event = null) => {
    request.current?.abort()
    version.current++
    const date = new Date(now + 3600000)
    setDraft(
      event
        ? { ...event, focus: event.focus || [] }
        : {
            id: uid(),
            title: kind === 'occasion' ? 'Special event' : '',
            kind,
            sport: '',
            date: toKey(date),
            time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            minutes: 60,
            effort: 'normal',
            status: 'planned',
            impact: presetImpact('', 'normal', kind),
            focus: ['Shoulders', 'Biceps', 'Triceps'],
            createdAt: now,
          },
    )
    setDescription(event?.description || '')
    setManual(Boolean(event?.description))
    setBusy(false)
    setError('')
    setScreen('details')
  }
  const patch = (p) => {
    setDraft((d) => ({ ...d, ...p }))
    setError('')
  }
  const chooseActivity = (value) => {
    const sport = SPORTS.find((s) => s.id === value)
    if (sport)
      patch({
        sport: value,
        title: `${sport.name} ${draft.kind === 'competition' ? 'game' : 'practice'}`,
        preset: value,
        impact: presetImpact(value, draft.effort, draft.kind),
      })
    else if (simple[value]) {
      const s = simple[value]
      patch({
        sport: '',
        preset: value,
        title: s.title,
        effort: s.effort,
        impact: { ...presetImpact('', s.effort, draft.kind), muscles: s.muscles },
      })
    } else patch({ sport: '', preset: 'custom', title: '', impact: null })
    setManual(false)
    setDescription('')
    request.current?.abort()
    version.current++
    setBusy(false)
  }
  const analyze = async () => {
    if (description.trim().length < 8 || !consent) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const seq = ++version.current
    setBusy(true)
    setError('')
    const timeout = setTimeout(() => controller.abort(), 35000)
    try {
      const response = await fetch('/api/activity-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), consent: true }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Activity could not be interpreted.')
      if (seq !== version.current) return
      patch({
        impact: {
          muscles: result.muscles,
          beforeHours: result.beforeHours,
          afterHours: result.afterHours,
          summary: result.summary,
          source: 'ai',
          uncertain: result.uncertain,
        },
        effort: result.effort,
        ...(result.durationMinutes ? { minutes: result.durationMinutes } : {}),
        description: description.trim(),
      })
    } catch (e) {
      if (seq === version.current)
        setError(
          e.name === 'AbortError' ? 'The request timed out. Try again or use manual details.' : e.message,
        )
    } finally {
      clearTimeout(timeout)
      if (seq === version.current) setBusy(false)
    }
  }
  const save = () => {
    if (!validTrainingEvent(draft)) {
      setError('Add a name, date, start time and details.')
      return
    }
    if (draft.status === 'done' && eventTime(draft) > now) {
      setError('Completed activities need a start time in the past.')
      return
    }
    if (
      draft.preset === 'custom' &&
      draft.impact?.source === 'ai' &&
      draft.description !== description.trim()
    ) {
      setError('Check the new description again, or enter details.')
      return
    }
    saveEvent(draft)
    toast('Event saved · training updated')
    setScreen('list')
    setDraft(null)
  }
  const review = () => {
    if (
      !draft.title.trim() ||
      !draft.impact ||
      (draft.kind !== 'occasion' && !draft.preset && !draft.sport)
    ) {
      setError('Choose an activity or add custom details first.')
      return
    }
    if (!validTrainingEvent(draft)) {
      setError('Check the date, time and length.')
      return
    }
    setError('')
    setScreen('review')
  }
  const editImpact = (p) => patch({ impact: { ...draft.impact, ...p, source: 'manual' } })
  const title =
    screen === 'list'
      ? 'Your events'
      : screen === 'kind'
        ? 'What’s coming up?'
        : screen === 'review'
          ? 'How training will adjust'
          : 'Add an event'
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      bodyKey={screen}
      footer={
        screen === 'details' || screen === 'review' ? (
          <div>
            {error && (
              <p
                ref={errorNotice}
                tabIndex={-1}
                role="alert"
                className="mb-3 rounded-xl bg-danger/10 p-3 text-[14px] text-danger"
              >
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="btn-secondary px-4"
                onClick={() => setScreen(screen === 'review' ? 'details' : 'kind')}
              >
                Back
              </button>
              <button
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() => (screen === 'review' ? save() : review())}
              >
                {screen === 'review' ? 'Save event' : 'Review changes'}
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {screen === 'list' && (
        <>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">Add only what matters.</p>
          <button className="btn-primary mt-5 w-full" onClick={() => setScreen('kind')}>
            <Icon name="plus" size={18} />
            Add an event
          </button>
          {events.map((e) => (
            <div key={e.id} className="mt-4 rounded-tuck bg-surface2 p-4">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => begin(e.kind, e)}>
                <DateTile date={e.date} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{e.title}</span>
                  <span className="mt-1 block text-[12px] text-muted">
                    {e.status === 'done' ? 'Completed · ' : ''}
                    {labelForKey(e.date)} · {e.time} · {e.minutes} min
                  </span>
                </span>
                <Icon name="edit" size={17} />
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.kind === 'occasion' && e.endsAt > now && (
                  <button className="btn-secondary" onClick={() => onPrepare(e)}>
                    Short focused session
                  </button>
                )}
                {e.kind === 'competition' && e.endsAt > now && (
                  <button className="btn-secondary" onClick={() => onPrepare(e)}>
                    Prepare for this
                  </button>
                )}
                {e.at <= now && e.status === 'planned' && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      saveEvent({ ...e, status: 'done' })
                      toast('Activity added to History')
                    }}
                  >
                    I did this
                  </button>
                )}
                <button
                  className="btn-ghost px-3"
                  onClick={() => {
                    saveEvent({ ...e, status: 'cancelled', cancelledFrom: e.status })
                    toast('Event cancelled', 'info', { label: 'Undo', onClick: () => saveEvent(e) })
                  }}
                >
                  {e.status === 'done' ? 'Remove activity' : 'Cancel event'}
                </button>
              </div>
            </div>
          ))}
          {!events.length && (
            <div className="empty-state mt-5">
              <Icon name="sport" size={30} />
              <p>Practice, a hike, a busy day or an occasion.</p>
            </div>
          )}
          <p className="mt-5 text-[12px] text-muted">Plans change; move or cancel this any time.</p>
        </>
      )}
      {screen === 'kind' && (
        <div className="mt-5 space-y-3">
          {[
            ['activity', 'Activity or practice', 'Tennis, a hike, physical work, or something else'],
            ['competition', 'A game or competition', 'Build up, then ease off near the day'],
            ['occasion', 'A special occasion', 'An optional short session for areas you choose'],
          ].map(([id, name, hint]) => (
            <button key={id} className="onboarding-choice border-line bg-surface2" onClick={() => begin(id)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">{name}</span>
                <span className="mt-2 block text-[13px] leading-relaxed text-muted">{hint}</span>
              </span>
              <Icon name="chevronRight" size={20} />
            </button>
          ))}
        </div>
      )}
      {screen === 'details' && draft && (
        <>
          {draft.kind !== 'occasion' && (
            <Field label="What are you doing?">
              <Select
                label="Activity"
                placeholder="Choose an activity"
                value={draft.preset || draft.sport || ''}
                onChange={chooseActivity}
                options={[
                  ...SPORTS.map((s) => [s.id, s.name]),
                  ...Object.entries(simple).map(([id, s]) => [id, s.title]),
                  ['custom', 'Something else', 'Describe it yourself'],
                ]}
              />
            </Field>
          )}
          <Field label="Event name">
            <input
              aria-label="Event name"
              maxLength={100}
              className="input"
              value={draft.title}
              placeholder={
                draft.kind === 'occasion' ? 'Party, photos, or a night out' : 'e.g. Tennis practice'
              }
              onChange={(e) => patch({ title: e.target.value })}
            />
          </Field>
          {draft.preset === 'custom' && (
            <>
              <Field label="Describe the activity" hint="Describe what you’ll do and how hard.">
                <textarea
                  className="input min-h-24"
                  aria-label="Custom activity description"
                  maxLength={700}
                  value={description}
                  placeholder="I helped move furniture upstairs for an hour; it felt fairly hard."
                  onChange={(e) => {
                    setDescription(e.target.value)
                    request.current?.abort()
                    version.current++
                    setBusy(false)
                    patch({ impact: null })
                  }}
                />
              </Field>
              <label className="mt-3 flex min-h-12 items-start gap-3 text-[13px] text-muted">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Send this description to OpenAI for a GPT-6 Luna interpretation. No photos are sent.
                </span>
              </label>
              <button
                className="btn-secondary mt-2 w-full"
                disabled={
                  busy ||
                  !consent ||
                  description.trim().length < 8 ||
                  (draft.impact?.source === 'ai' && draft.description === description.trim())
                }
                onClick={analyze}
              >
                {busy
                  ? 'Interpreting activity…'
                  : draft.impact?.source === 'ai' && draft.description === description.trim()
                    ? 'Interpretation ready'
                    : 'Interpret with GPT-6 Luna'}
              </button>
              <button
                className="btn-ghost mt-1 w-full"
                onClick={() => {
                  request.current?.abort()
                  version.current++
                  setBusy(false)
                  setManual(true)
                  patch({
                    impact: presetImpact('', draft.effort, draft.kind),
                    description: description.trim(),
                  })
                }}
              >
                Choose details myself
              </button>
              {draft.impact?.source === 'ai' && (
                <p className="mt-3 rounded-2xl bg-surface2 p-4 text-[14px] leading-relaxed">
                  {draft.impact.summary}
                  {draft.impact.uncertain ? ' Check the details below before saving.' : ''}
                </p>
              )}
            </>
          )}
          <Field label="When?">
            <div className="flex flex-wrap gap-2">
              <Choice
                value="today"
                selected={draft.date === today && draft.status === 'planned'}
                onClick={() => patch({ date: today, status: 'planned' })}
              >
                Today
              </Choice>
              <Choice
                value="tomorrow"
                selected={draft.date === addDays(today, 1)}
                onClick={() => patch({ date: addDays(today, 1), status: 'planned' })}
              >
                Tomorrow
              </Choice>
              <Choice
                value="finished"
                selected={draft.status === 'done'}
                onClick={() => {
                  const d = new Date(now - draft.minutes * 60000)
                  patch({
                    status: 'done',
                    date: toKey(d),
                    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                  })
                }}
              >
                Just finished
              </Choice>
            </div>
          </Field>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="min-w-0 text-[14px]">
              Date
              <input
                className="input mt-2 min-w-0"
                type="date"
                aria-label="Event date"
                value={draft.date}
                onInput={(e) => patch({ date: e.target.value })}
              />
            </label>
            <label className="min-w-0 text-[14px]">
              Start time
              <input
                className="input mt-2 min-w-0"
                type="time"
                aria-label="Event time"
                value={draft.time}
                onInput={(e) => patch({ time: e.target.value })}
              />
            </label>
          </div>
          <Field label="About how long?">
            <div className="flex flex-wrap gap-2">
              {[30, 60, 90, 120].map((m) => (
                <Choice
                  key={m}
                  value={m}
                  selected={draft.minutes === m}
                  onClick={(minutes) => patch({ minutes })}
                >
                  {m} min
                </Choice>
              ))}
            </div>
            <input
              aria-label="Other event duration"
              className="input mt-3"
              type="number"
              min={5}
              max={480}
              value={draft.minutes}
              onChange={(e) => patch({ minutes: Number(e.target.value) })}
            />
          </Field>
          {draft.kind === 'occasion' ? (
            <Field
              label="What would you like to focus on?"
              hint="Short sleeves? Arms and shoulders are a good start."
            >
              <div className="space-y-2">
                {[
                  ['Arms & shoulders', ['Shoulders', 'Biceps', 'Triceps']],
                  ['Upper body', ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps']],
                  ['Legs', ['Legs', 'Glutes']],
                ].map(([label, areas]) => (
                  <button
                    key={label}
                    type="button"
                    className={`min-h-14 w-full rounded-2xl border px-4 text-left text-[15px] ${areas.length === draft.focus.length && areas.every((m) => draft.focus.includes(m)) ? 'border-accent bg-accent/10' : 'border-line bg-surface2'}`}
                    aria-pressed={
                      areas.length === draft.focus.length && areas.every((m) => draft.focus.includes(m))
                    }
                    onClick={() => patch({ focus: areas })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <details className="mt-3">
                <summary className="min-h-12 cursor-pointer py-3 text-[13px] text-muted">
                  Choose individual areas
                </summary>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_MUSCLES.map((m) => (
                    <Choice
                      key={m}
                      value={m}
                      selected={draft.focus.includes(m)}
                      onClick={() =>
                        patch({
                          focus: draft.focus.includes(m)
                            ? draft.focus.filter((v) => v !== m)
                            : [...draft.focus, m],
                        })
                      }
                    />
                  ))}
                </div>
              </details>
            </Field>
          ) : (
            <Field label="Expected effort">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['easy', 'Easy'],
                  ['normal', 'Normal'],
                  ['hard', 'Hard'],
                ].map(([v, label]) => (
                  <Choice
                    key={v}
                    value={v}
                    selected={draft.effort === v}
                    onClick={(effort) =>
                      patch({
                        effort,
                        impact: draft.impact
                          ? {
                              ...draft.impact,
                              ...presetImpact(draft.sport, effort, draft.kind),
                              muscles: draft.impact.muscles,
                              source: draft.impact.source,
                            }
                          : null,
                      })
                    }
                  >
                    {label}
                  </Choice>
                ))}
              </div>
            </Field>
          )}
          {(manual || draft.impact?.source === 'ai') && (
            <Field label="Areas involved" hint="Check this. These areas get lighter work around it.">
              <div className="grid grid-cols-2 gap-2">
                {EVENT_MUSCLES.map((m) => (
                  <Choice
                    key={m}
                    value={m}
                    selected={draft.impact?.muscles.includes(m)}
                    onClick={() =>
                      editImpact({
                        muscles: draft.impact.muscles.includes(m)
                          ? draft.impact.muscles.filter((v) => v !== m)
                          : [...draft.impact.muscles, m],
                      })
                    }
                  />
                ))}
              </div>
            </Field>
          )}
        </>
      )}
      {screen === 'review' && draft && (
        <>
          <div className="mt-5 rounded-tuck bg-surface2 p-5">
            <p className="text-[18px] font-semibold">{draft.title}</p>
            <p className="mt-2 text-[14px] text-muted">
              {labelForKey(draft.date)} · {draft.time}
            </p>
            <p className="mt-5 text-[15px] leading-relaxed">
              {draft.kind === 'occasion' ? 'Open it for a short, optional session.' : draft.impact.summary}
            </p>
            <p className="mt-3 text-[13px] text-muted">
              {draft.kind !== 'occasion' &&
                `${draft.status === 'done' ? 'Already happened · ' : draft.impact.beforeHours + 'h before · '}${draft.impact.afterHours}h after · ${draft.impact.muscles.join(', ') || 'No areas selected'}`}
            </p>
          </div>
          {draft.kind === 'competition' && (
            <p className="mt-5 text-[14px] leading-relaxed">
              Training builds toward it, then eases off close to the day.
            </p>
          )}
          <p className="mt-5 text-[13px] text-muted">
            Future plans update. A session already open stays as it is.
          </p>
        </>
      )}
      {screen === 'list' && (profile.lifeEvents || []).some((e) => e.status === 'cancelled') && (
        <details className="mt-5 border-t border-line">
          <summary className="min-h-12 cursor-pointer py-4 text-[13px] text-muted">
            Cancelled or removed events
          </summary>
          {(profile.lifeEvents || [])
            .filter((e) => e.status === 'cancelled' && validTrainingEvent(e))
            .map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-3 text-[13px]">
                <span className="min-w-0 flex-1">{e.title}</span>
                <button
                  className="btn-secondary"
                  onClick={() => saveEvent({ ...e, status: e.cancelledFrom === 'done' ? 'done' : 'planned' })}
                >
                  Restore
                </button>
              </div>
            ))}
        </details>
      )}
    </Modal>
  )
}
