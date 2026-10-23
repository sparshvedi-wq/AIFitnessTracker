// "Share my week": renders the story card, previews it in a sheet and hands
// it to the share sheet (or downloads it where sharing files isn't supported).

import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { computeStreak, weeklyStats } from '../lib/calc.js'
import { fmtNum, weekSummary } from '../lib/workout.js'
import { fromKey } from '../lib/date.js'
import { weekLine } from '../lib/voice.js'
import { drawWeekCard, shareCanvas } from '../lib/shareCard.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'

// variant 'button' is the full-width primary action; 'chip' is a small pill.
export default function ShareWeek({ variant = 'button' }) {
  const { state, today, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [canvas, setCanvas] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const goal = state.settings.workout.weeklyGoal
    const week = weekSummary(state.workouts, today)
    const sets = state.workouts.filter((w) => w.date >= week.start).reduce((s, w) => s + (w.totals?.sets || 0), 0)
    const nutrition = weeklyStats(state, today)
    const start = fromKey(week.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    drawWeekCard({
      weekLabel: `Week of ${start}`,
      count: week.count,
      goal,
      line: weekLine(week.count, goal),
      stats: [
        { label: 'Time trained', value: week.minutes, unit: 'min' },
        week.volume > 0
          ? { label: 'Lifted', value: fmtNum(week.volume), unit: state.settings.weightUnit }
          : { label: 'Sets', value: sets },
        { label: 'Day streak', value: computeStreak(state, today) },
        { label: 'Avg calories', value: nutrition.avgCalories ? fmtNum(nutrition.avgCalories) : '—' },
      ],
    }).then((c) => !cancelled && setCanvas(c))
    return () => { cancelled = true }
  }, [open, state, today])

  async function share() {
    if (!canvas) return
    const result = await shareCanvas(canvas)
    if (result === 'downloaded') toast('Saved. Go post it.')
    if (result !== 'cancelled') setOpen(false)
  }

  return (
    <>
      {variant === 'chip' ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink2 hover:text-ink">
          <Icon name="upload" size={13} strokeWidth={2.6} />
          Share
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary h-12 w-full">
          <Icon name="upload" size={18} strokeWidth={2.4} />
          Share my week
        </button>
      )}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setCanvas(null) }}
        title="Your week, ready to post"
        footer={
          <button onClick={share} disabled={!canvas} className="btn-primary h-12 w-full">
            <Icon name="upload" size={18} strokeWidth={2.4} />
            Share
          </button>
        }
      >
        <div className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[22px] bg-[#08080A]">
          {canvas && <img src={canvas.toDataURL('image/png')} alt="Your week as a story card" className="h-full w-full" />}
        </div>
        <p className="mt-3 text-center text-[13px] text-muted">Sized for stories. Nothing leaves your phone unless you share it.</p>
      </Modal>
    </>
  )
}
