import { useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { currentSet, setCounts } from '../../lib/workout.js'
import { SKIP_REASONS } from '../../lib/workout-quick-actions.js'

export default function QuickWorkoutActions({
  session,
  onClose,
  onSkip,
  onSwap,
  onShorten,
  onFinish,
  onEnd,
  onMore,
}) {
  const [reasons, setReasons] = useState(false)
  const cur = currentSet(session)
  const { done } = setCounts(session)
  const canSkip = cur?.ex.sets.some((s) => s.status === 'todo') && session.phase !== 'prepared'
  return (
    <Modal
      open
      onClose={onClose}
      title={reasons ? 'Skip exercise' : 'Adjust workout'}
      subtitle={cur?.ex.name}
      footer={
        <button
          className="btn-ghost min-h-11 w-full text-[14px]"
          onClick={reasons ? () => setReasons(false) : onMore}
        >
          {reasons ? 'Back' : 'All workout options'}
        </button>
      }
    >
      {reasons ? (
        <div className="mt-2 divide-y divide-line">
          {SKIP_REASONS.map(([reason, label]) => (
            <Action key={reason} label={label} onClick={() => onSkip(reason)} />
          ))}
        </div>
      ) : (
        <div className="mt-2 divide-y divide-line">
          {canSkip && (
            <div className="flex items-center gap-1">
              <Action icon="skip" label="Skip exercise" onClick={() => onSkip('other')} />
              <button
                className="icon-btn !h-11 !w-11 shrink-0"
                aria-label="Choose a reason for skipping"
                title="Skip options"
                onClick={() => setReasons(true)}
              >
                <Icon name="chevronDown" size={17} />
              </button>
            </div>
          )}
          {canSkip && <Action icon="repeat" label="Swap exercise" onClick={onSwap} />}
          {!['sport', 'manual'].includes(session.kind) && (
            <Action icon="clock" label="Less time left" onClick={onShorten} />
          )}
          <Action
            icon="check"
            label={done ? 'Finish & review' : 'End workout'}
            onClick={done ? onFinish : onEnd}
          />
        </div>
      )}
    </Modal>
  )
}

function Action({ icon, label, onClick }) {
  return (
    <button className="flex min-h-16 w-full min-w-0 items-center gap-3 py-3 text-left" onClick={onClick}>
      {icon && <Icon name={icon} size={19} className="shrink-0 text-ink2" />}
      <span className="min-w-0 flex-1 text-[16px] font-semibold">{label}</span>
    </button>
  )
}
