import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { EXERCISES, findExercise } from '../lib/exercises.js'
import { recordBook, validPersonalRecord, dailyArtwork } from '../lib/personal-records.js'
import { fmtNum, isAssisted } from '../lib/workout.js'
import { shortLabel } from '../lib/date.js'
import { uid } from '../lib/id.js'
import { SectionHead } from './Ink.jsx'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { metaOf } from '../lib/catalog/index.js'
import { matchesExercise } from '../lib/exercise-search.js'

const matches = matchesExercise
const valueOf = (r, ex, unit) =>
  `${ex?.weighted ? `${fmtNum(r.weight)} ${unit}${isAssisted(ex.id) ? ' assist' : ''} × ` : ''}${ex?.type === 'time' ? `${fmtNum(r.sec)} sec` : `${r.reps} ${r.reps === 1 ? 'rep' : 'reps'}`}`

export default function PersonalRecords() {
  const { state, dispatch, today } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const unit = state.settings.weightUnit
  const records = useMemo(
    () =>
      recordBook(state.workouts, state.personalRecords || [], unit, today).sort((a, b) =>
        (findExercise(a.exId, state.customExercises)?.name || '').localeCompare(
          findExercise(b.exId, state.customExercises)?.name || '',
        ),
      ),
    [state.workouts, state.personalRecords, state.customExercises, unit, today],
  )
  const filtered = records.filter((r) =>
    matches(findExercise(r.exId, state.customExercises) || { name: r.exId }, query),
  )
  return (
    <section className="page-section">
      <SectionHead title="Personal records" right="Add PR" onRight={() => setOpen(true)} />
      <button className="records-hero mt-3" onClick={() => setOpen(true)}>
        <span>
          <span className="records-heading">Your best lifts.</span>
          <span className="records-action">
            Record a PR <Icon name="plus" size={16} />
          </span>
        </span>
        <img src={dailyArtwork(today, 'records')} alt="" loading="lazy" decoding="async" />
      </button>
      {records.length > 0 && (
        <>
          <label className="record-search mt-3">
            <Icon name="search" size={18} />
            <input
              aria-label="Search personal records"
              placeholder="Find a record"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
            />
          </label>
          <div className="mt-2 rounded-tuck bg-surface px-4">
            {filtered.slice(0, query || showAll ? filtered.length : 5).map((r) => {
              const ex = findExercise(r.exId, state.customExercises)
              return (
                <details key={r.exId} className="record-detail">
                  {/* list-none: this row draws its own chevron, so the shared one is left off. */}
                  <summary className="list-none">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{ex?.name || r.exId}</span>
                      <span className="mt-1 block text-[13px] text-accent">{valueOf(r.best, ex, unit)}</span>
                    </span>
                    <Icon name="chevronDown" size={16} className="shrink-0 text-muted" />
                  </summary>
                  <div className="pb-3">
                    {r.history.map((entry) => (
                      <div key={entry.id} className="record-history">
                        <span>
                          <span className="block text-[14px]">{valueOf(entry, ex, unit)}</span>
                          <span className="text-[12px] text-muted">
                            {shortLabel(entry.date)} · {entry.manual ? 'Added by you' : 'Workout'}
                          </span>
                        </span>
                        {entry.manual && (
                          <button
                            className="icon-btn h-11 w-11"
                            aria-label={`Delete ${ex?.name || 'exercise'} record from ${shortLabel(entry.date)}`}
                            onClick={() => dispatch({ type: 'DELETE_PERSONAL_RECORD', id: entry.id })}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
            {!filtered.length && <p className="py-5 text-[14px] text-muted">No matching records.</p>}
          </div>
          {!query && records.length > 5 && (
            <button className="text-link mt-2 min-h-11" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : 'View all records'}{' '}
              <Icon name={showAll ? 'chevronUp' : 'chevronDown'} size={16} />
            </button>
          )}
        </>
      )}
      {open && <RecordEntry onClose={() => setOpen(false)} />}
    </section>
  )
}

function RecordEntry({ onClose }) {
  const { state, dispatch, toast, today } = useApp()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [date, setDate] = useState(today)
  const unit = state.settings.weightUnit
  const exercises = useMemo(
    () =>
      [...EXERCISES, ...state.customExercises].filter(
        (e, i, all) => all.findIndex((a) => a.id === e.id) === i,
      ),
    [state.customExercises],
  )
  const common = ['bench-press', 'back-squat', 'deadlift', 'ohp', 'pull-up', 'db-bench', 'goblet-squat']
  const rank = (ex) => (common.includes(ex.id) ? common.indexOf(ex.id) : ex.weighted ? 10 : 20)
  const results = exercises
    .filter((ex) => matches(ex, query))
    .sort((a, b) => (query.trim() ? 0 : rank(a) - rank(b)) || a.name.localeCompare(b.name))
  const update = (id, patch) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const add = (exId) => {
    const ex = findExercise(exId, state.customExercises)
    setRows((current) => [
      ...current,
      { id: uid(), exId, weight: '', reps: ex?.weighted && ex.type !== 'time' ? '1' : '', sec: '' },
    ])
    setQuery('')
  }
  const payload = rows.map((r) => ({
    id: r.id,
    exId: r.exId,
    date,
    unit,
    weight: Number(r.weight),
    reps: Number(r.reps),
    sec: Number(r.sec),
  }))
  const ready =
    rows.length > 0 &&
    date <= today &&
    payload.every((r) => {
      const ex = findExercise(r.exId, state.customExercises)
      return (
        validPersonalRecord(r) &&
        (ex?.type === 'time' ? r.sec > 0 : r.reps > 0) &&
        (!ex?.weighted ||
          r.weight > 0 ||
          (isAssisted(r.exId) && rows.find((row) => row.id === r.id)?.weight !== ''))
      )
    })
  return (
    <Modal
      open
      title="Record a PR"
      onClose={onClose}
      footer={
        <button
          className="btn-primary w-full"
          disabled={!ready}
          onClick={() => {
            dispatch({ type: 'SAVE_PERSONAL_RECORDS', records: payload })
            toast(payload.length === 1 ? 'Personal record saved' : `${payload.length} records saved`)
            onClose()
          }}
        >
          Save {rows.length > 1 ? `${rows.length} records` : 'record'}
        </button>
      }
    >
      {rows.length > 0 && (
        <>
          <label className="field-label mt-3" htmlFor="pr-date">
            Date
          </label>
          <input
            id="pr-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
          <div className="my-4 space-y-3">
            {rows.map((row) => {
              const ex = findExercise(row.exId, state.customExercises)
              const timed = ex?.type === 'time'
              return (
                <div key={row.id} className="record-entry">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold">{ex?.name}</h3>
                    <button
                      className="icon-btn h-11 w-11 shrink-0"
                      aria-label={`Remove ${ex?.name} entry`}
                      onClick={() => setRows((all) => all.filter((r) => r.id !== row.id))}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {ex?.weighted && (
                      <label className="record-field">
                        <span>
                          {isAssisted(row.exId) ? 'Assistance' : 'Weight'} ({unit}
                          {metaOf(row.exId)?.load === 'hand' ? '/hand' : ''})
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="10000"
                          step="any"
                          placeholder="—"
                          value={row.weight}
                          onChange={(e) => update(row.id, { weight: e.target.value })}
                        />
                      </label>
                    )}
                    <label className={`record-field ${!ex?.weighted ? 'col-span-2' : ''}`}>
                      <span>{timed ? 'Seconds' : 'Reps'}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={timed ? '86400' : '1000'}
                        step="1"
                        placeholder="—"
                        value={timed ? row.sec : row.reps}
                        onChange={(e) => update(row.id, { [timed ? 'sec' : 'reps']: e.target.value })}
                      />
                    </label>
                  </div>
                  <button className="text-link mt-2 min-h-11 !text-[13px]" onClick={() => add(row.exId)}>
                    <Icon name="plus" size={14} /> Add another result
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
      <label className="record-search mt-3">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder={rows.length ? 'Add another exercise' : 'Search all exercises'}
          aria-label="Search all exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="mt-2 max-h-[32vh] overflow-y-auto" aria-label="Exercise search results">
        {results.map((ex) => (
          <button key={ex.id} className="record-result" onClick={() => add(ex.id)}>
            <span>
              <span className="block text-[15px] font-semibold">{ex.name}</span>
              <span className="text-[12px] text-muted">{ex.muscle}</span>
            </span>
            <Icon name="plus" size={18} className="text-accent" />
          </button>
        ))}
        {!results.length && (
          <p className="py-5 text-[14px] text-muted">No matching exercises. Try another name.</p>
        )}
      </div>
    </Modal>
  )
}
