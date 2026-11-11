import { useMemo, useState } from 'react'
import { recoveryTimeline, RECOVERY_HORIZONS } from '../lib/recovery-view.js'
import usePlanningTime, { lastRecordedAt } from './training/usePlanningTime.js'
import Icon from './Icon.jsx'

export default function MuscleRecovery({ state, today }) {
  const now = usePlanningTime(
    Math.min(Date.now(), lastRecordedAt(state.workouts.filter((w) => w.date <= today))),
  )
  const [horizon, setHorizon] = useState(0)
  const [info, setInfo] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => recoveryTimeline(state, today, now), [state, today, now])
  if (!rows.length) return null
  return (
    <section className="mt-3 rounded-tuck bg-surface p-5" aria-label="Estimated muscle readiness">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">Muscle readiness</h2>
        <button
          className="icon-btn -mr-2 h-11 w-11 text-muted"
          aria-label="About muscle readiness"
          aria-expanded={info}
          aria-controls="muscle-recovery-info"
          onClick={() => setInfo(!info)}
        >
          <Icon name="info" size={18} />
        </button>
      </div>
      {info && (
        <p
          id="muscle-recovery-info"
          className="mb-4 rounded-xl bg-surface2 p-3 text-[13px] leading-relaxed text-ink2"
        >
          Estimated from logged sets, effort and recent activities. Forecasts assume no further training. How
          you feel still matters; these aren’t measurements of muscle recovery.
        </p>
      )}
      <div className="recovery-horizons" role="group" aria-label="Recovery forecast">
        {RECOVERY_HORIZONS.map((hours, index) => (
          <button key={hours} aria-pressed={horizon === index} onClick={() => setHorizon(index)}>
            {hours ? `+${hours}h` : 'Now'}
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-5">
        {(expanded ? rows : rows.slice(0, 6)).map((r) => {
          const percent = r.values[horizon]
          const status = r.avoid ? 'Avoid' : r.sore ? 'Sore' : percent >= 90 ? 'Ready' : 'Recovering'
          return (
            <div key={r.muscle}>
              <div className="mb-2 flex items-center justify-between gap-3 text-[14px]">
                <span className="font-semibold">{r.label}</span>
                <span
                  className={`text-[12px] font-semibold ${r.avoid || r.sore ? 'text-ink2' : 'text-muted'}`}
                >
                  {status}
                  {!r.avoid && <span className="ml-2 tabular-nums text-accent-ink">{percent}%</span>}
                </span>
              </div>
              <div
                className={`recovery-track ${r.avoid ? 'recovery-track--avoid' : ''}`}
                role={r.avoid ? 'img' : 'progressbar'}
                aria-label={`${r.label}: ${status}${horizon ? `, forecast in ${RECOVERY_HORIZONS[horizon]} hours` : ''}`}
                aria-valuemin={r.avoid ? undefined : 0}
                aria-valuemax={r.avoid ? undefined : 100}
                aria-valuenow={r.avoid ? undefined : percent}
              >
                {!r.avoid && <span style={{ width: `${percent}%` }} />}
              </div>
            </div>
          )
        })}
      </div>
      {rows.length > 6 && (
        <button
          className="text-link mt-4 min-h-11 w-full justify-center !text-[13px]"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show fewer' : 'All recently trained muscles'}
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={15} />
        </button>
      )}
    </section>
  )
}
