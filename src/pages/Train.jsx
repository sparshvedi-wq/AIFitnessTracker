// Train: today's recommendation, every routine (yours first, then starters),
// and ways to build a new one or just start logging.

import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { ROUTINE_TAGS, TEMPLATES, findExercise } from '../lib/exercises.js'
import { estimateMinutes, fmtNum, lastDoneDate, pickNextRoutine } from '../lib/workout.js'
import { daysSince, relativeDay } from '../lib/derive.js'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { PageTitle, SectionHead, corner } from '../components/Ink.jsx'
import RoutineEditor from '../components/workout/RoutineEditor.jsx'
import useStartWorkout from '../components/workout/useStartWorkout.js'

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

const ICON_FOR = { Push: 'push', Pull: 'pull', Legs: 'legs', Upper: 'upper', 'Full body': 'full', Conditioning: 'zap' }

export default function Train({ nav }) {
  const { state, today } = useApp()
  const { routines, workouts, customExercises } = state
  const start = useStartWorkout(nav)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(undefined) // undefined closed, null new, object edit

  const next = useMemo(() => pickNextRoutine(routines.length ? routines : TEMPLATES, workouts), [routines, workouts])
  const rested = next ? daysSince(workouts, next.id, today) : null

  const all = useMemo(() => {
    const mine = routines.map((r) => ({ ...r, mine: true }))
    const starters = TEMPLATES.filter((t) => !routines.some((r) => r.id === t.id || r.name === t.name))
    return [...mine, ...starters].map((r) => ({ ...r, tag: tagOf(r, customExercises) }))
  }, [routines, customExercises])

  const q = query.trim().toLowerCase()
  const shown = all.filter((r) => {
    if (filter !== 'All' && r.tag !== filter) return false
    if (!q) return true
    return r.name.toLowerCase().includes(q) || r.items.some((i) => findExercise(i.exId, customExercises)?.name.toLowerCase().includes(q))
  })
  const mine = shown.filter((r) => r.mine)
  const starters = shown.filter((r) => !r.mine)
  const tags = ['All', ...ROUTINE_TAGS.filter((t) => all.some((r) => r.tag === t))]

  return (
    <div className="animate-fade-in">
      <PageTitle
        title="Train"
        right={
          <button onClick={() => { setSearching((s) => !s); setQuery('') }} className="icon-btn" aria-label="Search routines and exercises">
            <Icon name={searching ? 'x' : 'search'} size={18} strokeWidth={2} />
          </button>
        }
      />
      {searching && (
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search routines or exercises" className="input mt-3" />
      )}

      {/* Recommended */}
      {!searching && next && !state.activeWorkout && (
        <section className="mt-5 rounded-hero bg-paper p-5 text-on-paper">
          <p className="flex items-center gap-1.5 text-[13px] text-paper-muted">
            <Icon name="sparkle" size={14} filled strokeWidth={0} className="text-[#2F55D4]" />
            Recommended today
          </p>
          <h2 className="mt-1.5 font-display text-[34px] leading-[1.1]">{next.name}</h2>
          <p className="mt-1.5 text-[14px] text-paper-muted">
            {rested == null ? 'You haven’t done this one yet.' : rested === 0 ? 'You did this earlier today.' : `It’s been ${rested} day${rested === 1 ? '' : 's'} since you last did it.`}
          </p>
          <div className="mt-3.5 flex gap-1.5">
            <span className="pill-paper">{next.items.length} exercises</span>
            <span className="pill-paper">{estimateMinutes(next)} min</span>
          </div>
          <div className="mt-4 flex gap-2.5">
            <button onClick={() => start(next)} className="btn h-12 flex-1 bg-on-paper text-paper">Begin</button>
            <button onClick={() => setPreview(next)} className="btn h-12 rounded-full border-[1.5px] border-[#C9C5BA] px-5 font-semibold">Preview</button>
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="no-scrollbar -mx-[22px] mt-6 flex gap-2 overflow-x-auto px-[22px]">
        {tags.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`chip ${filter === t ? 'chip-active' : ''}`}>{t}</button>
        ))}
      </div>

      {mine.length > 0 && (
        <section className="mt-6">
          <SectionHead title="Your routines" right={mine.length} />
          <RoutineList list={mine} workouts={workouts} today={today} highlight={next?.id} onOpen={setPreview} />
        </section>
      )}

      {starters.length > 0 && (
        <section className="mt-6">
          <SectionHead title={routines.length ? 'Starter routines' : 'Routines'} right={starters.length} />
          <RoutineList list={starters} workouts={workouts} today={today} highlight={next?.id} onOpen={setPreview} />
        </section>
      )}

      {shown.length === 0 && <p className="mt-6 rounded-tuck bg-surface p-4 text-[14px] text-muted">Nothing matches that. Try another search or filter.</p>}

      <section className="mt-6 grid grid-cols-2 gap-2.5">
        <button onClick={() => setEditing(null)} className="rounded-tuck border-[1.5px] border-dashed border-outline p-4 text-left">
          <span className="dot h-[34px] w-[34px] bg-surface2 text-accent"><Icon name="plus" size={15} strokeWidth={2.4} /></span>
          <span className="mt-3 block font-display text-[17px]">New routine</span>
          <span className="mt-0.5 block text-[12px] text-muted">Build your own</span>
        </button>
        <button onClick={() => start({ id: 'quick', name: 'Workout', items: [] })} className="rounded-tuck-r bg-surface p-4 text-left">
          <span className="dot h-[34px] w-[34px] bg-surface2 text-accent"><Icon name="play" size={13} filled strokeWidth={0} /></span>
          <span className="mt-3 block font-display text-[17px]">Empty workout</span>
          <span className="mt-0.5 block text-[12px] text-muted">Log as you go</span>
        </button>
      </section>

      <RoutinePreview
        routine={preview}
        onClose={() => setPreview(null)}
        onStart={() => { const r = preview; setPreview(null); start(r) }}
        onEdit={() => { setEditing(preview); setPreview(null) }}
      />
      <RoutineEditor open={editing !== undefined} routine={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}

function RoutineList({ list, workouts, today, highlight, onOpen }) {
  return (
    <div className="mt-2.5 space-y-2.5">
      {list.map((r, i) => {
        const last = lastDoneDate(workouts, r.id)
        const hot = r.id === highlight
        return (
          <button key={r.id} onClick={() => onOpen(r)} className={`flex w-full items-center gap-3.5 bg-surface px-4 py-3.5 text-left ${corner(i)}`}>
            <span className={`dot h-[46px] w-[46px] rounded-[15px] ${hot ? 'bg-accent/15 text-accent' : 'bg-surface2 text-ink'}`}>
              <Icon name={r.icon || ICON_FOR[r.tag] || 'train'} size={22} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[17px] leading-snug">{r.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{r.items.length} exercises · {estimateMinutes(r)} min{r.circuit ? ' · circuit' : ''}</span>
            </span>
            <span className={`shrink-0 text-right text-[12px] ${hot ? 'text-accent' : 'text-muted'}`}>{last ? relativeDay(last, today) : 'New'}</span>
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
          <button onClick={onStart} className="btn-primary h-[50px] flex-[2]">Begin</button>
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
      <p className="mt-3 flex gap-2 text-[13px] text-muted">
        <Icon name="trend" size={16} className="mt-0.5 shrink-0 text-accent" />
        Targets adjust from last time: hit every rep and the weight, reps or time goes up.
      </p>
    </Modal>
  )
}
