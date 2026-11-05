import Modal from '../Modal.jsx'
import { setCounts } from '../../lib/workout.js'

export default function WorkoutSwitchDialog({ session, onEnd, onKeep }) {
  if (!session) return null
  const { done } = setCounts(session)
  return (
    <Modal open onClose={onKeep} title="Change your workout?" subtitle={session.name} maxWidth="max-w-sm">
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {done
          ? `${done} completed ${done === 1 ? 'set will' : 'sets will'} be saved to History.`
          : 'No sets logged yet. You can start something else.'}
      </p>
      <div className="mt-5 grid gap-2">
        <button className="btn-primary min-h-12" onClick={onKeep}>
          Keep this workout
        </button>
        <button className="btn-secondary min-h-12" onClick={onEnd}>
          End this workout
        </button>
      </div>
    </Modal>
  )
}
