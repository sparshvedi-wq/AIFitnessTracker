import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { nextVisitInvitation } from '../../lib/flexible-training.js'
import { nextTimeNotes } from '../../lib/next-time.js'
import { profileOf } from '../../lib/planner.js'
import { count } from '../../lib/presentation.js'
import { useApp } from '../../store/AppContext.jsx'

export default function SessionSaved({ workout, onClose, onPreview }) {
  const { state } = useApp()
  const invitation = nextVisitInvitation(workout)
  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  // Pain or soreness means no push for more next time.
  const next = ['pain', 'soreness'].includes(workout.finishReason)
    ? []
    : nextTimeNotes(workout, profileOf(state), workout.unit, state.customExercises)
  return (
    <Modal
      open
      onClose={onClose}
      title="Saved"
      footer={
        <button className="btn-primary min-h-12 w-full" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="pb-3 pt-1">
        <p className="flex items-center gap-2 text-[15px] text-ink2">
          <Icon name="check" size={18} className="text-accent" />
          {count(sets, 'set')} in History
          {workout.newBests > 0 && (
            <span className="font-semibold text-accent">· {count(workout.newBests, 'new best')}</span>
          )}
        </p>
        {next.length > 0 && (
          <section className="mt-6 rounded-tuck bg-surface2 p-4">
            <h4 className="text-[14px] font-semibold">Next time</h4>
            <ul className="mt-2 divide-y divide-line">
              {next.map((n) => (
                <li key={n.exId} className="py-2.5">
                  <span className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="min-w-0 truncate">{n.name}</span>
                    <span className="num shrink-0 text-[17px]">{n.change}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">{n.why}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">Lighter on low-energy days.</p>
          </section>
        )}
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-[15px] leading-relaxed text-ink2">{invitation.text}</p>
          <button className="btn-secondary mt-4 min-h-12 w-full" onClick={onPreview}>
            <Icon name="clock" size={17} />
            {invitation.action}
          </button>
        </div>
      </div>
    </Modal>
  )
}
