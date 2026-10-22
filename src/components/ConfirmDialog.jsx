import Modal from './Modal.jsx'

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Delete', onConfirm, onClose,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-[15px] leading-relaxed text-ink2">{message}</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => { onConfirm(); onClose() }} className="btn-danger">{confirmLabel}</button>
      </div>
    </Modal>
  )
}
