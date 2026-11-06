// Train: today's recommendation, every routine (yours first, then starters),
// and ways to build a new one or just start logging.

import { count } from '../lib/presentation.js'
import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { ROUTINE_TAGS, TEMPLATES, allExercises, findExercise } from '../lib/exercises.js'
import { LOGGED_WORKOUT, estimateMinutes, fmtNum, lastDoneDate } from '../lib/workout.js'
import { relativeDay } from '../lib/derive.js'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { PageTitle, SectionHead } from '../components/Ink.jsx'
import RoutineEditor from '../components/workout/RoutineEditor.jsx'
import useStartWorkout from '../components/workout/useStartWorkout.js'
import { buildDailyPlan, profileOf, todayChoice } from '../lib/planner.js'
import { resolvePlace } from '../lib/places.js'
import { sportById } from '../lib/sports.js'
import usePlanningTime from '../components/training/usePlanningTime.js'
import { sportScheduleContext } from '../lib/sport-schedule.js'
import TrainingCard from '../components/TrainingCard.jsx'
import EventShortcut from '../components/training/EventShortcut.jsx'
import ExercisePicker from '../components/workout/ExercisePicker.jsx'
import FormSheet from '../components/workout/FormSheet.jsx'
import { matchesExercise } from '../lib/exercise-search.js'
import { shortSessionRequest } from '../lib/flexible-training.js'

// Routines saved before tags existed get one from their exercises.
function tagOf(routine, custom) {
  if (routine.tag) return routine.tag
  const muscles = routine.items.map((i) => findExercise(i.exId, custom)?.muscle)
  const has = (...m) => muscles.some((x) => m.includes(x))
  if (has('Cardio', 'Mobility') && !has('Chest', 'Back', 'Legs')) return 'Conditioning'
  if (has('Legs', 'Glutes') && !has('Chest', 'Back', 'Shoulders')) return 'Legs'
  if (has('Chest', 'Triceps') && !has('Back', 'Biceps', 'Legs')) return 'Push'
  if (has('Back', 'Biceps') && !has('Chest', 'Legs')) return 'Pull'
  if (!has('Legs', 'Glutes')) return 'Upper'
  return 'Full body'
}

const ICON_FOR = {
  Push: 'push',
  Pull: 'pull',
  Legs: 'legs',
  Upper: 'upper',
  'Full body': 'full',
  Conditioning: 'zap',
}

export default function Train({ nav }) {
  const { state, today } = useApp()
  const now = usePlanningTime()
  const schedule = sportScheduleContext(state.settings.training, { today, now })
  const { routines, workouts, customExercises } = state
  const start = useStartWorkout(nav)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(undefined) // undefined closed, null new, object edit

  const next = useMemo(
    () => buildDailyPlan(state, { today, now, ...todayChoice(state, today) }),
    [state, today, now],
  )

  const all = useMemo(() => {
    const mine = routines.map((r) => ({ ...r, mine: true }))
    const starters = TEMPLATES.filter((t) => !routines.some((r) => r.id === t.id || r.name === t.name))
    return [...mine, ...starters].map((r) => ({ ...r, tag: tagOf(r, customExercises) }))
  }, [routines, customExercises])

  const q = query.trim().toLowerCase()
  const shown = all.filter((r) => {
    if (filter !== 'All' && r.tag !== filter) return false
    if (!q) return true
    return (
      r.name.toLowerCase().includes(q) ||
      r.items.some((i) => findExercise(i.exId, customExercises)?.name.toLowerCase().includes(q))
    )
  })
  const mine = shown.filter((r) => r.mine)
  const starters = shown.filter((r) => !r.mine)
  const tags = ['All', ...ROUTINE_TAGS.filter((t) => all.some((r) => r.tag === t))]

  const [catalog, setCatalog] = useState(false)
  const [guide, setGuide] = useState(null)
  const matches = q ? allExercises(customExercises).filter((e) => matchesExercise(e, q)) : []
  const warmSport =
    schedule.next?.sport || state.settings.training.lastSport || state.settings.training.sports[0]
  const showGuide = (e) => setGuide({ ...e, exId: e.id })
  const guideWorkout = guide
    ? {
        id: `exercise-${guide.exId}`,
        name: guide.name,
        items: [
          { exId: guide.exId, sets: 3, ...(guide.type === 'time' ? { sec: 30 } : { reps: 10 }), restSec: 60 },
        ],
      }
    : null
  return (
    <div className="animate-fade-in">
      <PageTitle
        title="Train"
        right={
          <div className="flex gap-1">
            <button
              className="icon-btn"
              aria-label={searching ? 'Close search' : 'Search routines and exercises'}
              aria-expanded={searching}
              onClick={() => {
                setSearching((v) => !v)
                setQuery('')
              }}
            >
              <Icon name={searching ? 'x' : 'search'} size={20} />
            </button>
          </div>
        }
      />
      {searching ? (
        <input
          autoFocus
          aria-label="Search routines or exercises"
          className="input mt-4"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Exercise, muscle or routine"
        />
      ) : (
        <>
          {/* While a workout runs, the mini bar above the tabs is its one live entry. */}
          {!state.activeWorkout && (
            <div className="mt-4">
              <TrainingCard
                compact
                plan={next}
                place={resolvePlace(profileOf(state), next.location)}
                onStart={() => start(next)}
              />
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <QuickAction
              icon="sport"
              title="Sport warmup"
              detail={warmSport ? sportById(warmSport).name : '5–20 min'}
              onClick={() => start({ kind: 'sport', sport: warmSport, items: [] })}
            />
            <QuickAction
              icon="clock"
              title="Keep it short"
              detail="5–15 min"
              onClick={() => start(shortSessionRequest())}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="btn-secondary !px-2 text-[14px] whitespace-nowrap"
              onClick={() => start({ id: 'quick', name: LOGGED_WORKOUT, items: [] })}
            >
              <Icon name="plus" size={17} />
              Log workout
            </button>
            <button
              className="btn-secondary !px-2 text-[14px] whitespace-nowrap"
              onClick={() => setCatalog(true)}
            >
              <Icon name="search" size={17} />
              Exercises
            </button>
          </div>
          <EventShortcut state={state} today={today} now={now} nav={nav} />
        </>
      )}
      {q && (
        <section className="mt-5">
          <SectionHead title="Exercises" right={matches.length} />
          <div className="mt-2 rounded-tuck bg-surface px-4">
            {matches.slice(0, 20).map((e) => (
              <button
                key={e.id}
                className="list-row border-b border-line last:border-0"
                onClick={() => showGuide(e)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{e.name}</span>
                  <span className="mt-1 block text-[13px] text-muted">
                    {e.muscle} · {e.type === 'time' ? 'Timed' : e.weighted ? 'Weighted' : 'Bodyweight'}
                  </span>
                </span>
                <Icon name="chevronRight" size={17} />
              </button>
            ))}
          </div>
          {!matches.length && <p className="mt-3 text-[14px] text-muted">No matches. Try a muscle name.</p>}
        </section>
      )}
      <section className="page-section">
        <SectionHead
          title="Your routines"
          right={mine.length ? 'Create' : null}
          onRight={() => setEditing(null)}
        />
        {mine.length ? (
          <RoutineList list={mine} workouts={workouts} today={today} onOpen={setPreview} />
        ) : (
          <div className="mt-3 flex items-center gap-4 rounded-tuck bg-surface p-4">
            <p className="min-w-0 flex-1 text-[14px] text-muted">Save the workouts you like.</p>
            <button className="btn-secondary shrink-0 !px-4" onClick={() => setEditing(null)}>
              <Icon name="plus" size={16} />
              Create
            </button>
          </div>
        )}
      </section>
      <details className="page-section border-t border-line" open={searching || undefined}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-[16px] font-semibold">
          Starter routines <Icon name="chevronDown" size={18} />
        </summary>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          {tags.map((t) => (
            <button
              key={t}
              aria-pressed={filter === t}
              onClick={() => setFilter(t)}
              className={`chip ${filter === t ? 'chip-active' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
        {starters.length ? (
          <RoutineList list={starters} workouts={workouts} today={today} onOpen={setPreview} />
        ) : (
          <p className="py-4 text-[14px] text-muted">No routines match this filter.</p>
        )}
      </details>
      <RoutinePreview
        routine={preview}
        onClose={() => setPreview(null)}
        onStart={() => {
          const r = preview
          setPreview(null)
          start(r)
        }}
        onEdit={() => {
          setEditing(preview)
          setPreview(null)
        }}
      />
      <RoutineEditor open={editing !== undefined} routine={editing} onClose={() => setEditing(undefined)} />
      <ExercisePicker open={catalog} browse onClose={() => setCatalog(false)} onPick={showGuide} />
      <FormSheet
        open={Boolean(guide)}
        exercise={guide}
        onClose={() => setGuide(null)}
        closeLabel="Back to Train"
        onStart={() => {
          setGuide(null)
          start(guideWorkout)
        }}
      />
    </div>
  )
}
function QuickAction({ icon, title, detail, onClick }) {
  return (
    <button className="tile min-h-24 p-3.5 text-left" onClick={onClick}>
      <span className="flex items-center justify-between gap-2">
        <span className="quick-action-art" aria-hidden="true">
          <Icon name={icon} size={22} strokeWidth={2} />
        </span>
        <Icon name="chevronRight" size={16} className="text-faint" />
      </span>
      <span className="mt-3 block text-[15px] font-semibold">{title}</span>
      <span className="mt-0.5 block truncate text-[13px] text-muted">{detail}</span>
    </button>
  )
}

function RoutineList({ list, workouts, today, onOpen }) {
  return (
    <div className="mt-3 rounded-tuck bg-surface px-4">
      {list.map((r, i) => {
        const last = lastDoneDate(workouts, r.id)
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r)}
            className={`list-row ${i ? 'border-t border-line' : ''}`}
          >
            <span className="dot h-[46px] w-[46px] rounded-[15px] bg-surface2 text-ink">
              <Icon name={r.icon || ICON_FOR[r.tag] || 'train'} size={22} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-snug">{r.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {count(r.items.length, 'exercise')} · {estimateMinutes(r)} min{r.circuit ? ' · circuit' : ''}
              </span>
            </span>
            {last ? (
              <span className="shrink-0 text-right text-[12px] text-muted">{relativeDay(last, today)}</span>
            ) : (
              <Icon name="chevronRight" size={16} className="shrink-0 text-faint" />
            )}
          </button>
        )
      })}
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
      subtitle={`About ${estimateMinutes(routine)} min · ${routine.circuit ? `circuit, ${Math.max(...routine.items.map((i) => i.sets))} rounds` : `${routine.items.reduce((s, i) => s + i.sets, 0)} sets`}`}
      footer={
        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-secondary h-[50px] flex-1">
            <Icon name="edit" size={16} />
            {isMine ? 'Edit' : 'Customize'}
          </button>
          <button onClick={onStart} className="btn-primary h-[50px] flex-[2]">
            Review session
          </button>
        </div>
      }
    >
      {routine.blurb && <p className="text-[15px] text-ink2">{routine.blurb}</p>}
      <ol className="mt-2">
        {routine.items.map((item, i) => {
          const def = findExercise(item.exId, state.customExercises)
          if (!def) return null
          return (
            <li key={i} className={`flex items-center gap-3.5 py-3 ${i ? 'border-t border-line' : ''}`}>
              <span className="dot num h-[30px] w-[30px] bg-surface2 text-[15px]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{def.name}</span>
                <span className="block text-[13px] text-muted">
                  {item.sets} × {def.type === 'time' ? `${item.sec}s` : `${item.reps} reps`}
                  {item.weight ? ` · ${fmtNum(item.weight)} ${unit}` : ''} · rest {item.restSec}s
                </span>
              </span>
              <span className="tag">{def.muscle}</span>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
        Weights adjust to your last sessions.
      </p>
    </Modal>
  )
}
