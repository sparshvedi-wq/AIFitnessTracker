// "Ask or adjust…": one understated entry below today's training. Typed
// requests are understood locally; results come from the app's own data and
// changes are previewed, then applied (and undone) only on request.
import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { useApp } from '../store/AppContext.jsx'
import { parseRequest } from '../lib/assistant/parse.js'
import {
  applyPreview,
  explainResult,
  historyResult,
  previewChanges,
  progressResult,
  undoChange,
} from '../lib/assistant/actions.js'
import { interpretRemotely, remoteInterpretationAvailable } from '../lib/assistant/remote.js'
import { profileOf } from '../lib/planner.js'
import { placesOf } from '../lib/places.js'
import { findExercise } from '../lib/exercises.js'
import { shortLabel } from '../lib/date.js'

export default function AskAdjust({ nav, plan }) {
  const { state, dispatch, today, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [undo, setUndo] = useState(null)
  const input = useRef(null)
  const lastSubmit = useRef({ text: '', at: 0 })
  const abort = useRef(null)
  const applying = useRef(false)
  const toggle = useRef(null)

  const context = useMemo(() => {
    return {
      today,
      plan,
      places: placesOf(profileOf(state)).map((p) => ({ id: p.id, name: p.name })),
      planIds: plan.items.map((i) => i.exId),
      workoutIds: state.activeWorkout
        ? state.activeWorkout.exercises
            .filter((e) => e.sets.some((s) => s.status === 'todo'))
            .map((e) => e.exId)
        : [],
      historyIds: [
        ...new Set(state.workouts.filter((w) => !w.sample).flatMap((w) => w.exercises.map((e) => e.exId))),
      ],
      custom: state.customExercises,
      nameOf: (id) => findExercise(id, state.customExercises)?.name || id,
    }
  }, [state, today, plan])
  const examples = [
    'Why these exercises?',
    ...(context.planIds.length ? [`Replace ${context.nameOf(context.planIds[0])}`] : []),
    ...(context.historyIds.length ? ['Show workouts over the past 30 days'] : []),
  ]

  useEffect(() => {
    if (open) input.current?.focus()
    return () => abort.current?.abort()
  }, [open])

  const close = () => {
    abort.current?.abort()
    setOpen(false)
    setOutcome(null)
    setText('')
    requestAnimationFrame(() => toggle.current?.focus())
  }

  function run(parsed) {
    if (parsed.clarify) return setOutcome({ kind: 'clarify', ...parsed.clarify })
    const reads = []
    const changes = parsed.intents.filter((i) =>
      ['plan.minutes', 'plan.place', 'exercise.replace'].includes(i.type),
    )
    for (const intent of parsed.intents) {
      if (intent.type === 'history.show') reads.push(historyResult(state, intent.args, today))
      if (intent.type === 'exercise.progress') reads.push(progressResult(state, intent.args.exId, today))
      if (intent.type === 'plan.explain') reads.push(explainResult(context.plan))
      if (intent.type === 'activity.add') reads.push({ kind: 'activity' })
      if (intent.type === 'filters.clear') reads.push({ kind: 'cleared' })
    }
    const preview = changes.length ? previewChanges(state, changes, { today, now: Date.now() }) : null
    setOutcome({ kind: 'results', reads, preview, scope: parsed.scope, intents: parsed.intents })
  }

  async function submit(event) {
    event.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    // The same request twice in quick succession is one request.
    if (value === lastSubmit.current.text && Date.now() - lastSubmit.current.at < 1500) return
    lastSubmit.current = { text: value, at: Date.now() }
    setUndo(null)
    const parsed = parseRequest(value, context)
    if (!parsed.unknown) return run(parsed)
    if (!remoteInterpretationAvailable()) return setOutcome({ kind: 'unknown' })
    setBusy(true)
    abort.current?.abort()
    abort.current = new AbortController()
    try {
      const remote = await interpretRemotely(value, context, abort.current.signal)
      if (remote.status === 'ok' && !remote.parsed.unknown) run(remote.parsed)
      else setOutcome({ kind: remote.status === 'cancelled' ? 'cancelled' : 'unknown', note: remote.message })
    } finally {
      setBusy(false)
    }
  }

  function apply(preview) {
    if (applying.current) return
    applying.current = true
    try {
      const result = applyPreview(state, preview, { today, now: Date.now() })
      if (result.status === 'stale') {
        // Recompute from the current state rather than overwrite newer work.
        setOutcome((o) => ({
          ...o,
          preview: previewChanges(
            state,
            o.intents.filter((i) => ['plan.minutes', 'plan.place', 'exercise.replace'].includes(i.type)),
            { today, now: Date.now() },
          ),
          stale: true,
        }))
        return
      }
      result.actions.forEach(dispatch)
      setUndo(result.undo)
      setOutcome((o) => ({ ...o, applied: true }))
      toast(
        preview.target === 'workout'
          ? 'Workout adjusted · logged sets kept'
          : 'Today’s plan updated · just for today',
        'info',
      )
    } finally {
      applying.current = false
    }
  }

  if (!open)
    return (
      <button ref={toggle} className="ask-entry" onClick={() => setOpen(true)} aria-expanded="false">
        <Icon name="search" size={16} />
        Ask or adjust…
      </button>
    )
  return (
    <section className="ask-panel" aria-label="Ask or adjust">
      <form className="flex items-center gap-2" onSubmit={submit}>
        <label className="sr-only" htmlFor="ask-input">
          Ask about your training or adjust today
        </label>
        <input
          id="ask-input"
          data-ask-input
          ref={input}
          className="input"
          value={text}
          maxLength={200}
          autoComplete="off"
          placeholder="Ask about your training…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
        />
        <button className="btn-primary shrink-0 !px-4" type="submit" disabled={!text.trim() || busy}>
          {busy ? 'Working…' : 'Go'}
        </button>
        <button type="button" className="icon-btn !h-11 !w-11 shrink-0" aria-label="Close" onClick={close}>
          <Icon name="x" size={17} />
        </button>
      </form>
      <div aria-live="polite" className="mt-3">
        {!outcome && (
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button key={example} className="chip bg-surface2" onClick={() => setText(example)}>
                {example}
              </button>
            ))}
          </div>
        )}
        {outcome?.kind === 'unknown' && (
          <p className="text-[14px] text-muted">
            {outcome.note || 'I didn’t catch that.'} Try “Replace lunges” or “How has my squat improved?”
          </p>
        )}
        {outcome?.kind === 'cancelled' && <p className="text-[14px] text-muted">Cancelled.</p>}
        {outcome?.kind === 'clarify' && (
          <div>
            <p className="text-[14px] font-semibold">{outcome.question}</p>
            {outcome.options.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {outcome.options.map((option) => (
                  <button
                    key={`${option.type}-${JSON.stringify(option.args)}`}
                    className="chip bg-surface2"
                    onClick={() => run({ intents: [option], scope: 'temporary' })}
                  >
                    {option.args.exId
                      ? findExercise(option.args.exId, state.customExercises)?.name
                      : placesOf(profileOf(state)).find((p) => p.id === option.args.location)?.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-muted">Name the exercise, for example “Replace lunges”.</p>
            )}
          </div>
        )}
        {outcome?.kind === 'results' && (
          <div className="space-y-3">
            {outcome.reads.map((read, i) => (
              <ResultCard key={i} read={read} nav={nav} onClose={close} />
            ))}
            {outcome.preview && (
              <PreviewCard
                preview={outcome.preview}
                stale={outcome.stale}
                applied={outcome.applied}
                scope={outcome.scope}
                onApply={() => apply(outcome.preview)}
                onUndo={
                  undo
                    ? () => {
                        const result = undoChange(state, undo)
                        if (result.status === 'stale')
                          toast('Can’t undo: the workout has changed since', 'info')
                        else {
                          result.actions.forEach(dispatch)
                          toast('Undone', 'info')
                        }
                        setUndo(null)
                        setOutcome(null)
                      }
                    : null
                }
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function ResultCard({ read, nav, onClose }) {
  if (read.kind === 'history')
    return (
      <div className="rounded-2xl bg-surface2 p-4">
        <p className="text-[12px] text-muted">
          {read.label} · {shortLabel(read.from)}–{shortLabel(read.to)}
        </p>
        <p className="mt-2 text-[15px]">
          <span className="font-semibold">{read.trainingSessions}</span> training{' '}
          {read.trainingSessions === 1 ? 'session' : 'sessions'} on{' '}
          <span className="font-semibold">{read.trainingDays}</span>{' '}
          {read.trainingDays === 1 ? 'day' : 'days'} ·{' '}
          <span className="font-semibold">{read.workingSets}</span> working{' '}
          {read.workingSets === 1 ? 'set' : 'sets'}
        </p>
        {(read.warmups > 0 || read.activities > 0) && (
          <p className="mt-1 text-[13px] text-muted">
            Plus {read.warmups} warm-up{read.warmups === 1 ? '' : 's'} and {read.activities} activit
            {read.activities === 1 ? 'y' : 'ies'}, counted separately.
          </p>
        )}
        {read.recent.length > 0 && (
          <ul className="mt-2 text-[13px] text-ink2">
            {read.recent.map((r) => (
              <li key={r.id}>
                {shortLabel(r.date)} · {r.name}
              </li>
            ))}
          </ul>
        )}
        <button
          className="text-link mt-2 min-h-11"
          onClick={() => {
            onClose()
            nav.go('history')
          }}
        >
          Open History
        </button>
      </div>
    )
  if (read.kind === 'progress')
    return (
      <div className="rounded-2xl bg-surface2 p-4">
        <p className="text-[15px] font-semibold">{read.name}</p>
        {read.enough ? (
          <p className="mt-1 text-[14px] text-ink2">
            Best set {read.from.text} ({shortLabel(read.from.date)}) → {read.to.text} (
            {shortLabel(read.to.date)}), across {read.sessions} logged sessions
            {read.direction === 'same' ? '. About the same so far.' : '.'}
          </p>
        ) : (
          <p className="mt-1 text-[14px] text-muted">
            {read.sessions ? 'Only one logged session so far' : 'No logged sessions yet'}, so there’s no
            change to show.
          </p>
        )}
      </div>
    )
  if (read.kind === 'explain')
    return (
      <div className="rounded-2xl bg-surface2 p-4">
        <p className="text-[14px] font-semibold">{read.headline}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-ink2">
          {read.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    )
  if (read.kind === 'activity')
    return (
      <div className="rounded-2xl bg-surface2 p-4 text-[14px]">
        <button
          className="text-link min-h-11"
          onClick={() => {
            onClose()
            nav.openEvents('add')
          }}
        >
          Add a one-off activity
        </button>
      </div>
    )
  if (read.kind === 'cleared')
    return <p className="text-[13px] text-muted">Nothing filtered. Ask again any time.</p>
  return null
}

function PreviewCard({ preview, stale, applied, scope, onApply, onUndo }) {
  if (preview.kind !== 'preview') return <p className="text-[13px] text-muted">{preview.reason}</p>
  const d = preview.diff
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-[12px] text-muted">
        {preview.target === 'workout' ? 'Workout in progress · logged sets stay' : 'Today only'}
      </p>
      <ul className="mt-2 space-y-1 text-[14px]">
        {d.minutes && (
          <li>
            Time:{' '}
            {typeof d.minutes === 'object'
              ? `${d.minutes.from} → ${d.minutes.to} min`
              : `${d.minutes} min left`}
          </li>
        )}
        {d.place && <li>Place: {d.place}</li>}
        {d.added.map((a) => (
          <li key={`a-${a}`}>+ {a}</li>
        ))}
        {d.removed.map((r) => (
          <li key={`r-${r}`} className="text-muted">
            − {r}
          </li>
        ))}
        {!preview.changed && <li className="text-muted">Nothing would change.</li>}
      </ul>
      {stale && <p className="mt-2 text-[13px]">Your workout changed, so this preview was updated.</p>}
      {scope === 'persistent-requested' && (
        <p className="mt-2 text-[12px] text-muted">
          This changes today only. Your usual setup stays in Training preferences.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {!applied ? (
          <button className="btn-primary min-h-11 flex-1" disabled={!preview.changed} onClick={onApply}>
            Apply
          </button>
        ) : (
          onUndo && (
            <button className="btn-secondary min-h-11 flex-1" onClick={onUndo}>
              Undo
            </button>
          )
        )}
      </div>
    </div>
  )
}
