// Workout tab: this week at a glance, a suggested next session, your routines,
// starter routines, and workout history.

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { TEMPLATES, findExercise } from '../lib/exercises.js'
import {
  buildSession, describeSets, estimateMinutes, fmtDuration, fmtNum, lastDoneDate,
  pickNextRoutine, routineMuscles, startReady, weekStreak, weekSummary,
} from '../lib/workout.js'
import { addDays, inlineLabel, labelForKey } from '../lib/date.js'
import { unlockAudio } from '../lib/coach.js'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RoutineEditor from '../components/workout/RoutineEditor.jsx'
import { MuscleTag } from '../components/workout/Controls.jsx'
import { EFFORT } from '../components/workout/WorkoutSummary.jsx'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Icon and accent for each starter routine card.
const TEMPLATE_STYLE = {
  'tpl-full-body': { icon: 'dumbbell', tint: 'bg-brand-soft text-brand' },
  'tpl-upper': { icon: 'arrowUp', tint: 'bg-protein/15 text-protein' },
  'tpl-lower': { icon: 'arrowDown', tint: 'bg-water/15 text-[#1F7AD6] dark:text-water' },
  'tpl-hiit': { icon: 'zap', tint: 'bg-carbs/15 text-[#B87400] dark:text-carbs' },
  'tpl-core': { icon: 'target', tint: 'bg-fat/15 text-fat' },
  'tpl-mobility': { icon: 'sprout', tint: 'bg-success/15 text-success' },
}

export default function Workouts({ onOpenPlayer }) {
  const { state, dispatch, today } = useApp()
  const { routines, workouts, activeWorkout } = state
  const prefs = state.settings.workout
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit/copy
  const [preview, setPreview] = useState(null)
  const [detail, setDetail] = useState(null)
  const [pendingStart, setPendingStart] = useState(null)

  const week = useMemo(() => weekSummary(workouts, today), [workouts, today])
  const streak = useMemo(() => weekStreak(workouts, prefs.weeklyGoal, today), [workouts, prefs.weeklyGoal, today])
  const next = useMemo(() => pickNextRoutine(routines.length ? routines : TEMPLATES, workouts), [routines, workouts])
  const history = useMemo(() => workouts.slice().reverse(), [workouts])
  const [showAll, setShowAll] = useState(false)

  function start(routine, force = false) {
    if (activeWorkout && !force) {
      setPendingStart(routine)
      return
    }
    unlockAudio()
    const session = buildSession(routine, {
      workouts,
      customExercises: state.customExercises,
      unit: state.settings.weightUnit,
    })
    const ready = session.exercises.length ? startReady(session, prefs.countdown) : { ...session, phase: 'work' }
    dispatch({ type: 'SET_ACTIVE_WORKOUT', session: ready })
    setPreview(null)
    onOpenPlayer()
  }

  const goalPct = prefs.weeklyGoal ? Math.min(100, (week.count / prefs.weeklyGoal) * 100) : 0

  return (
    <div>
      <PageHeader title="Workout" subtitle="Guided training" />

      {/* This week */}
      <section className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink2">This week</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
              {week.count}
              <span className="text-sm font-semibold text-muted"> / {prefs.weeklyGoal} workouts</span>
            </p>
            <p className={`mt-0.5 text-[13px] font-medium ${week.count >= prefs.weeklyGoal ? 'text-brand' : 'text-muted'}`}>
              {week.count >= prefs.weeklyGoal
                ? 'Goal reached. Nice work!'
                : `${prefs.weeklyGoal - week.count} more to hit your goal`}
            </p>
          </div>
          {streak > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-carbs/15 px-2.5 py-1 text-[13px] font-semibold text-[#B87400] dark:text-carbs">
              <Icon name="flame" size={15} />
              {streak} wk streak
            </span>
          )}
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${goalPct}%` }} />
        </div>
        <div className="mt-3 flex justify-between">
          {DAY_LETTERS.map((d, i) => {
            const key = addDays(week.start, i)
            const did = week.days.has(key)
            const isToday = key === today
            const future = key > today
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className={`text-[11px] font-semibold ${isToday ? 'text-brand' : 'text-muted'}`}>{d}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    did ? 'bg-brand text-on-brand shadow-brand'
                      : isToday ? 'ring-2 ring-inset ring-brand/50'
                      : future ? 'border border-dashed border-line'
                      : 'bg-surface2'
                  }`}
                >
                  {did && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
              </div>
            )
          })}
        </div>
        {(week.minutes > 0 || week.volume > 0) && (
          <div className="mt-3 flex gap-4 border-t border-line pt-3 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={15} />
              <span><span className="font-semibold text-ink">{week.minutes}</span> min trained</span>
            </span>
            {week.volume > 0 && (
              <span className="flex items-center gap-1.5">
                <Icon name="dumbbell" size={15} />
                <span><span className="font-semibold text-ink">{fmtNum(week.volume)}</span> {state.settings.weightUnit} lifted</span>
              </span>
            )}
          </div>
        )}
      </section>

      {/* Resume or start */}
      {activeWorkout ? (
        <button onClick={onOpenPlayer} className="card mt-3 flex w-full items-center gap-3 border-brand/50 bg-brand-soft p-4 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand">
            <Icon name="play" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-brand">In progress</span>
            <span className="block truncate text-[17px] font-bold text-ink">{activeWorkout.name}</span>
          </span>
          <Icon name="chevronRight" size={20} className="text-brand" />
        </button>
      ) : next && (
        <section className="card mt-3 overflow-hidden">
          <div className="relative p-4">
            {/* Soft brand wash so the suggestion stands out from the other cards */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-soft via-transparent to-transparent" aria-hidden="true" />
            <div className="relative">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand">
                <Icon name="star" size={14} />
                Up next for you
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-tight text-ink">{next.name}</p>
              <p className="mt-0.5 text-[14px] text-muted">
                {next.items.length} exercises · about {estimateMinutes(next)} min
                {lastDoneDate(workouts, next.id) ? ` · last done ${inlineLabel(lastDoneDate(workouts, next.id))}` : ' · not done yet'}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {routineMuscles(next, state.customExercises).map((m) => <MuscleTag key={m} muscle={m} />)}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <button onClick={() => setPreview(next)} className="btn-secondary flex-1">Preview</button>
            <button onClick={() => start(next)} className="btn-primary flex-[2]">
              <Icon name="play" size={18} />
              Start workout
            </button>
          </div>
        </section>
      )}

      {/* My routines */}
      <div className="mb-2 mt-7 flex items-center justify-between">
        <h2 className="section-title">My routines</h2>
        <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-[14px] font-semibold text-brand">
          <Icon name="plus" size={16} strokeWidth={2.5} />
          New
        </button>
      </div>
      {routines.length === 0 ? (
        <div className="card p-4 text-[15px] text-muted">
          Build your own routine, or start from one below and tap <span className="font-semibold text-ink2">Customize</span> to make it yours.
        </div>
      ) : (
        <div className="space-y-2.5">
          {routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              muscles={routineMuscles(r, state.customExercises)}
              lastDone={lastDoneDate(workouts, r.id)}
              onOpen={() => setPreview(r)}
              onStart={() => start(r)}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => start({ id: 'quick', name: 'Quick workout', items: [] })}
        className="btn-secondary mt-2.5 w-full"
      >
        <Icon name="zap" size={17} />
        Start an empty workout
      </button>

      {/* Starters */}
      <h2 className="section-title mb-2 mt-7">Starter routines</h2>
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-0.5">
        {TEMPLATES.map((t) => {
          const style = TEMPLATE_STYLE[t.id] || TEMPLATE_STYLE['tpl-full-body']
          return (
          <button
            key={t.id}
            onClick={() => setPreview(t)}
            className="card flex w-56 shrink-0 snap-start flex-col p-4 text-left transition-colors hover:border-brand/40"
          >
            <span className="flex items-center justify-between">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.tint}`}>
                <Icon name={style.icon} size={18} strokeWidth={2.2} />
              </span>
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink2">{t.level}</span>
            </span>
            <span className="mt-3 text-[16px] font-bold leading-snug text-ink">{t.name}</span>
            <span className="mt-1 line-clamp-2 text-[13px] text-ink2">{t.blurb}</span>
            <span className="mt-auto flex items-center gap-1.5 pt-3 text-[13px] font-semibold text-brand">
              <Icon name="clock" size={14} />
              {estimateMinutes(t)} min · {t.circuit ? 'Circuit' : `${t.items.length} exercises`}
            </span>
          </button>
          )
        })}
      </div>

      {/* History */}
      <h2 className="section-title mb-2 mt-7">History</h2>
      {history.length === 0 ? (
        <div className="card p-4 text-[15px] text-muted">Finished workouts show up here with your sets, records and notes.</div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {(showAll ? history : history.slice(0, 6)).map((w) => (
            <button key={w.id} onClick={() => setDetail(w)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface2 active:bg-surface2">
              <DateBadge date={w.date} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
                  {w.name}
                  {w.records?.length > 0 && <Icon name="trophy" size={14} className="shrink-0 text-carbs" />}
                </p>
                <p className="text-[13px] text-muted">
                  {fmtDuration(w.durationSec)} · {w.totals.sets} sets
                  {w.totals.volume > 0 ? ` · ${fmtNum(w.totals.volume)} ${w.unit}` : ''}
                </p>
              </div>
              <Icon name="chevronRight" size={18} className="text-muted" />
            </button>
          ))}
          {history.length > 6 && (
            <button onClick={() => setShowAll((s) => !s)} className="w-full px-4 py-3 text-center text-[14px] font-semibold text-brand">
              {showAll ? 'Show less' : `Show all ${history.length}`}
            </button>
          )}
        </div>
      )}

      <RoutinePreview
        routine={preview}
        onClose={() => setPreview(null)}
        onStart={() => start(preview)}
        onEdit={() => { setEditing(preview); setPreview(null) }}
      />
      <RoutineEditor open={editing !== undefined} routine={editing} onClose={() => setEditing(undefined)} />
      <WorkoutDetail
        workout={detail}
        onClose={() => setDetail(null)}
        onRepeat={(r) => { setDetail(null); start(r) }}
      />
      <ConfirmDialog
        open={Boolean(pendingStart)}
        title="Replace current workout?"
        message={`"${activeWorkout?.name}" is still in progress. Starting a new one discards it.`}
        confirmLabel="Start new"
        onConfirm={() => start(pendingStart, true)}
        onClose={() => setPendingStart(null)}
      />
    </div>
  )
}

// Small calendar tile: weekday over day number.
function DateBadge({ date }) {
  const d = new Date(`${date}T12:00:00`)
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface2 leading-none">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {d.toLocaleDateString(undefined, { weekday: 'short' })}
      </span>
      <span className="mt-0.5 text-[16px] font-bold tabular-nums text-ink">{d.getDate()}</span>
    </span>
  )
}

function RoutineCard({ routine, muscles, lastDone, onOpen, onStart }) {
  return (
    <div className="card flex items-center gap-3 p-3 pl-4">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[16px] font-bold text-ink">{routine.name}</p>
        <p className="truncate text-[13px] text-muted">
          {routine.items.length} exercises · ~{estimateMinutes(routine)} min
          {routine.circuit ? ' · circuit' : ''}
          {lastDone ? ` · ${inlineLabel(lastDone)}` : ' · not done yet'}
        </p>
        {muscles.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {muscles.slice(0, 4).map((m) => <MuscleTag key={m} muscle={m} />)}
          </span>
        )}
      </button>
      <button onClick={onStart} className="btn-primary h-10 w-10 shrink-0 rounded-full p-0" aria-label={`Start ${routine.name}`}>
        <Icon name="play" size={16} />
      </button>
    </div>
  )
}

function RoutinePreview({ routine, onClose, onStart, onEdit }) {
  const { state } = useApp()
  if (!routine) return null
  const isMine = state.routines.some((r) => r.id === routine.id)
  const unit = state.settings.weightUnit
  return (
    <Modal
      open
      onClose={onClose}
      title={routine.name}
      footer={
        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-secondary flex-1">
            <Icon name="pencil" size={16} />
            {isMine ? 'Edit' : 'Customize'}
          </button>
          <button onClick={onStart} className="btn-primary flex-[2]">
            <Icon name="play" size={18} />
            Start
          </button>
        </div>
      }
    >
      {routine.blurb && <p className="text-[15px] text-ink2">{routine.blurb}</p>}
      <p className="mt-1 text-[13px] font-medium text-muted">
        About {estimateMinutes(routine)} min · {routine.circuit ? `Circuit, ${Math.max(...routine.items.map((i) => i.sets))} rounds` : 'Straight sets'}
      </p>
      <ol className="mt-4 space-y-2">
        {routine.items.map((item, i) => {
          const def = findExercise(item.exId, state.customExercises)
          if (!def) return null
          return (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface2 text-[12px] font-bold text-ink2">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{def.name}</p>
                <p className="text-[13px] text-muted">
                  {item.sets} × {def.type === 'time' ? `${item.sec}s` : `${item.reps} reps`}
                  {item.weight ? ` @ ${fmtNum(item.weight)} ${unit}` : ''} · rest {item.restSec}s
                </p>
              </div>
              <MuscleTag muscle={def.muscle} />
            </li>
          )
        })}
      </ol>
      <p className="mt-4 flex gap-2 text-[13px] text-muted">
        <Icon name="trendUp" size={16} className="mt-0.5 shrink-0 text-brand" />
        Targets adjust from your last session: when you hit every rep, the weight (or reps, or time) goes up.
      </p>
    </Modal>
  )
}

function WorkoutDetail({ workout, onClose, onRepeat }) {
  const { state, dispatch, toast } = useApp()
  const [confirm, setConfirm] = useState(false)
  if (!workout) return null
  const routine = state.routines.find((r) => r.id === workout.routineId) || TEMPLATES.find((t) => t.id === workout.routineId)
  const effort = EFFORT.find((e) => e.value === workout.effort)
  const started = new Date(workout.startedAt)

  return (
    <>
      <Modal
        open={!confirm}
        onClose={onClose}
        title={workout.name}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setConfirm(true)} className="btn-danger-ghost px-3" aria-label="Delete workout">
              <Icon name="trash" size={18} />
            </button>
            {routine && (
              <button onClick={() => onRepeat(routine)} className="btn-primary flex-1">
                <Icon name="repeat" size={17} />
                Do it again
              </button>
            )}
          </div>
        }
      >
        <p className="text-[14px] text-muted">
          {labelForKey(workout.date)} at {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="Time" value={fmtDuration(workout.durationSec)} />
          <MiniStat label="Sets" value={workout.totals.sets} />
          <MiniStat label={workout.totals.volume > 0 ? 'Volume' : 'Reps'} value={workout.totals.volume > 0 ? fmtNum(workout.totals.volume) : workout.totals.reps} />
        </div>

        {workout.records?.length > 0 && (
          <div className="mt-3 rounded-2xl bg-carbs/10 px-4 py-3">
            {workout.records.map((r) => (
              <p key={r.exId} className="flex items-center gap-2 text-[14px] text-ink">
                <Icon name="trophy" size={15} className="shrink-0 text-carbs" />
                <span className="font-semibold">{r.name}</span>
                <span className="text-ink2">{r.label}</span>
              </p>
            ))}
          </div>
        )}

        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {workout.exercises.map((e) => (
            <li key={e.exId} className="px-4 py-2.5">
              <p className="text-[15px] font-semibold text-ink">{e.name}</p>
              <p className="text-[13px] tabular-nums text-ink2">{describeSets(e, workout.unit)}</p>
            </li>
          ))}
        </ul>

        {(effort || workout.note) && (
          <div className="mt-3 space-y-1 text-[14px] text-ink2">
            {effort && <p><span className="text-muted">Effort:</span> {effort.value}/5, {effort.label.toLowerCase()}</p>}
            {workout.note && <p className="whitespace-pre-wrap">{workout.note}</p>}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Delete this workout?"
        message="It will be removed from your history and weekly stats."
        onConfirm={() => {
          dispatch({ type: 'DELETE_WORKOUT', id: workout.id })
          toast('Workout deleted', 'info', { label: 'Undo', onClick: () => dispatch({ type: 'RESTORE_WORKOUT', workout }) })
          onClose()
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface2 px-3 py-2.5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-[17px] font-bold tabular-nums text-ink">{value}</p>
    </div>
  )
}
