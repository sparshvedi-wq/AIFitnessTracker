import Modal from '../Modal.jsx'
import { TallyLogo } from '../Ink.jsx'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import Icon from '../Icon.jsx'
import './first-workout.css'

export default function FirstWorkoutCelebration({ achievement, onContinue, onClose }) {
  return (
    <Modal
      open
      fullScreen
      hideHandle
      onClose={onClose}
      title="Your first mark"
      header={
        <div className="flex min-h-16 items-center justify-between px-5 pt-2">
          <span className="first-workout-brand">
            <TallyLogo width={26} /> tally
          </span>
          <button className="icon-btn" aria-label="Close celebration" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
      }
      className="first-workout-dialog"
      bodyClassName="first-workout-body"
      footer={
        <button className="btn-primary min-h-12 w-full" onClick={onContinue}>
          See my session
        </button>
      }
    >
      <section className="first-workout" aria-label="First workout milestone">
        <div className="first-workout-stage" aria-hidden="true">
          <span className="floor-glow first-workout-floor" />
          <img src={ONBOARDING_ART.neutral} alt="" width="1024" height="1536" decoding="async" />
          <svg viewBox="0 0 100 220" className="first-workout-mark">
            <path d="M51 30C46 81 57 141 49 190" pathLength="1" />
          </svg>
        </div>
        <h3 className="first-workout-title">Your first mark.</h3>
        <p className="first-workout-copy">Nice work. Your first session is saved.</p>
        <div className="first-workout-stats" aria-label="Work saved">
          <span>
            <strong>{achievement.sets}</strong>
            {achievement.sets === 1 ? 'set' : 'sets'}
          </span>
          <span>
            <strong>{achievement.exercises}</strong>
            {achievement.exercises === 1 ? 'exercise' : 'exercises'}
          </span>
        </div>
      </section>
    </Modal>
  )
}
