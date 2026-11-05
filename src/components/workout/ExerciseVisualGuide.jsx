import { useState } from 'react'
import visuals from '../../lib/exercise-visuals.json'

// The two frames share one source so changing position never triggers a download.
export default function ExerciseVisualGuide({ exercise }) {
  const [frame, setFrame] = useState(0)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const visual = visuals[exercise.exId]
  if (!visual) return null
  const source = `${import.meta.env.BASE_URL}exercise-guides/${exercise.exId}.png`

  return (
    <figure className="mt-4 overflow-hidden rounded-[22px] border border-line">
      <div className="relative aspect-square overflow-hidden bg-[#131416]">
        {!loaded && !failed && (
          <div
            className="absolute inset-0 flex items-center justify-center text-[13px] text-[#ECE9E2]"
            role="status"
          >
            Loading demonstration…
          </div>
        )}
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-[#ECE9E2]">
            <p className="text-[14px]">The illustration couldn’t load. The technique cues are below.</p>
            <button
              className="min-h-11 rounded-full border border-white/30 px-5 text-[14px]"
              onClick={() => {
                setFailed(false)
                setLoaded(false)
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <img
            src={source}
            alt={`${exercise.name}: ${visual.frames[frame]}. Illustrated mannequin demonstration.`}
            width="2048"
            height="1024"
            decoding="async"
            className="absolute inset-y-0 h-full w-[200%] max-w-none object-fill"
            style={{ left: frame === 0 ? '0%' : '-100%', opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        <span
          className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-white"
          aria-hidden="true"
        >
          {String(frame + 1).padStart(2, '0')} / 02
        </span>
      </div>
      <figcaption className="bg-surface2 p-3">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Demonstration position">
          {visual.frames.map((caption, index) => (
            <button
              key={caption}
              onClick={() => setFrame(index)}
              aria-pressed={frame === index}
              className={`min-h-[60px] rounded-xl px-3 py-2 text-left ${frame === index ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
            >
              <span
                className={`mb-0.5 block text-[10px] font-bold uppercase tracking-wider ${frame === index ? 'text-accent' : ''}`}
              >
                Position {index + 1}
              </span>
              <span className="block text-[13px] font-medium leading-snug">{caption}</span>
            </button>
          ))}
        </div>
        <p className="px-1 pb-1 pt-3 text-[11px] leading-relaxed text-muted">
          Illustrated positions. Follow the technique cues below at your own pace.
        </p>
      </figcaption>
    </figure>
  )
}
