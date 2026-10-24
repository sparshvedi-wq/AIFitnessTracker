// Form guide for the current exercise: a video slot, then how it should
// feel, the muscles it works and common mistakes.

import { useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import { formGuide } from '../../lib/form.js'

const TABS = ['How it should feel', 'Muscles', 'Mistakes']

export default function FormSheet({ open, onClose, exercise }) {
  const [tab, setTab] = useState(0)
  if (!exercise) return null
  const guide = formGuide(exercise.exId, exercise.muscle)
  const items =
    tab === 0
      ? exercise.cues.map((c) => ({ t: c }))
      : tab === 1
        ? [{ t: guide.muscles.primary, s: 'Main muscles' }, guide.muscles.secondary && { t: guide.muscles.secondary, s: 'Also working' }].filter(Boolean)
        : guide.mistakes.map((m) => ({ t: m }))

  return (
    <Modal open={open} onClose={onClose} title="Form guide" subtitle={exercise.name}>
      {/* Video placeholder: swap for a <video> once clips are added */}
      <div className="relative mt-2 flex aspect-[16/10] flex-col items-center justify-center rounded-hero border-[1.5px] border-dashed border-outline bg-[#18191C]">
        <span className="dot h-[60px] w-[60px] bg-ink text-on-paper"><Icon name="play" size={20} filled strokeWidth={0} /></span>
        <span className="mt-3 text-[13px] text-muted">Form video coming soon</span>
      </div>

      <div className="no-scrollbar -mx-[22px] mt-4 flex gap-1.5 overflow-x-auto px-[22px]">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`chip ${tab === i ? "chip-active" : "bg-surface2"}`}>{t}</button>
        ))}
      </div>

      <ol className="mt-2">
        {items.map((it, i) => (
          <li key={i} className={`flex items-center gap-3.5 py-3.5 ${i ? 'border-t border-line' : ''}`}>
            <span className={`dot h-[30px] w-[30px] bg-surface2 ${tab === 2 ? 'text-danger' : 'num text-[15px]'}`}>
              {tab === 2 ? <Icon name="x" size={13} strokeWidth={2.6} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{it.t}</span>
              {it.s && <span className="mt-0.5 block text-[13px] text-muted">{it.s}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Modal>
  )
}
