import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import { photoReviewSlides, conciseSummary } from '../../lib/photo-review.js'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import './photo-review.css'
export function PhotoReviewLoading({ status }) {
  const [hint, setHint] = useState(0)
  const lines = ['Checking the views', 'Looking at visible balance', 'Preparing your training focus']
  useEffect(() => {
    const t = setInterval(() => setHint((v) => (v + 1) % lines.length), 3500)
    return () => clearInterval(t)
  }, [lines.length])
  return (
    <section className="review-loading" role="status" aria-live="polite">
      <div className="review-scan">
        <img src={ONBOARDING_ART.neutral} alt="" />
        <span className="review-scan-line" />
      </div>
      <h3 className="font-display text-[30px]">A closer look.</h3>
      <p className="mt-3 text-[15px] text-muted">{status}</p>
      <p key={hint} aria-hidden="true" className="review-loading-hint">
        {lines[hint]}
      </p>
    </section>
  )
}
export default function PhotoReviewStory({
  review,
  step,
  onStep,
  previews,
  onZoom,
  selectedFocus,
  onFocusChange,
  canApply,
}) {
  const slides = photoReviewSlides(review),
    slide = slides[Math.min(step, slides.length - 1)]
  if (!slide) return null
  return (
    <section className="review-story">
      <div className="review-story-top">
        <div
          className="review-story-track"
          role="progressbar"
          aria-label="Photo review progress"
          aria-valuemin={0}
          aria-valuemax={slides.length}
          aria-valuenow={step + 1}
        >
          {slides.map((_, i) => (
            <span key={i} className={i <= step ? 'is-filled' : ''} />
          ))}
        </div>
        {step > 0 && (
          <button
            type="button"
            className="icon-btn !h-11 !w-11"
            aria-label="Previous review slide"
            onClick={() => onStep(step - 1)}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
        )}
      </div>
      {review.demo && <span className="review-demo">Sample preview</span>}
      <div key={step} className="review-slide">
        {slide.kind === 'overview' && (
          <>
            <div className="review-views">
              {['front', 'side', 'back'].map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-label={`Enlarge ${a} view`}
                  onClick={() => onZoom({ src: previews?.[a], label: `${a} view` })}
                  disabled={!previews?.[a]}
                >
                  {previews?.[a] && <img src={previews[a]} alt={`${a} view`} />}
                  <span>{a}</span>
                </button>
              ))}
            </div>
            <h3 className="review-title">{slide.title}</h3>
            <p className="review-copy">{conciseSummary(slide.text)}</p>
            {slide.text?.length > 200 && (
              <details className="mt-3 text-[13px] text-muted">
                <summary className="min-h-11 py-3 cursor-pointer">Full summary</summary>
                {slide.text}
              </details>
            )}
          </>
        )}
        {slide.kind === 'finding' && (
          <>
            <div className="review-evidence">
              {slide.evidenceViews?.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onZoom({ src: previews?.[a], label: `${a} view` })}
                  disabled={!previews?.[a]}
                  aria-label={`Enlarge ${a} evidence`}
                >
                  {previews?.[a] && <img src={previews[a]} alt={`${a} view`} />}
                  <span>{a}</span>
                </button>
              ))}
            </div>
            <h3 className="review-title">{slide.title}</h3>
            <p className="review-copy">{slide.observation}</p>
            <p className="review-uncertainty">
              <Icon name="info" size={16} />
              <span>{slide.uncertainty}</span>
            </p>
            {review.suggestedFocus?.some((f) => f.area === slide.area) && (
              <div className="review-training-response">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-accent">
                  <Icon name="train" size={16} />
                  In your training
                </span>
                <p className="mt-2 text-[14px] leading-relaxed">
                  {review.suggestedFocus.find((f) => f.area === slide.area).reason}
                </p>
              </div>
            )}
          </>
        )}
        {slide.kind === 'plan' && (
          <>
            <img className="review-plan-art" src={ONBOARDING_ART.review} alt="" />
            <h3 className="review-title">{slide.title}</h3>
            {slide.focus.length ? (
              <div className="review-focus-list">
                {slide.focus.map((f) => (
                  <button
                    key={f.area}
                    type="button"
                    disabled={!canApply}
                    aria-pressed={selectedFocus.includes(f.area)}
                    onClick={() =>
                      onFocusChange(
                        selectedFocus.includes(f.area)
                          ? selectedFocus.filter((a) => a !== f.area)
                          : [...selectedFocus, f.area],
                      )
                    }
                    className={`review-focus ${selectedFocus.includes(f.area) ? 'is-selected' : ''}`}
                  >
                    <span className="review-focus-heading">
                      <span className="capitalize">
                        {f.area === 'overall' ? 'Whole-body balance' : f.area}
                      </span>
                      <Icon name={selectedFocus.includes(f.area) ? 'check' : 'plus'} size={18} />
                    </span>
                    <span>{f.reason}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="review-copy">
                Keep a balanced starting plan. Your logged sets and feedback guide the next changes.
              </p>
            )}
            <p className="mt-4 text-[13px] text-muted">
              A photo is a starting reference. Performance and comfort decide how training progresses.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
