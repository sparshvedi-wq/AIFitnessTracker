import { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import MannequinRegions from './MannequinRegions.jsx'
import { photoReviewSlides, focusAction } from '../../lib/photo-review.js'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import './photo-review.css'
const viewName = (angle) => `${angle.charAt(0).toUpperCase()}${angle.slice(1)} view`
// Only the real request state is shown; no invented stages or percentages.
export function PhotoReviewLoading({ status, previews }) {
  const [angle, setAngle] = useState(0)
  const photos = ['front', 'side', 'back'].map((a) => previews?.[a]?.preview || previews?.[a]).filter(Boolean)
  useEffect(() => {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('tally-reduce-motion')
    )
      return
    const timer = setInterval(() => setAngle((v) => (v + 1) % 3), 2600)
    return () => clearInterval(timer)
  }, [])
  return (
    <section className="review-loading" role="status" aria-live="polite">
      <div className="review-scan">
        <span className="floor-glow review-scan-floor" />
        <img
          key={angle}
          src={photos[angle % Math.max(1, photos.length)] || ONBOARDING_ART.neutral}
          alt=""
          className="review-loading-photo"
        />
        <span className="review-scan-line" />
      </div>
      <h3 className="font-display text-[30px]">A closer look</h3>
      <p className="mt-3 text-[16px] text-ink2">{status}</p>
    </section>
  )
}
// The tint follows M1's traced regions; it is an area marker, never a measurement.
export function FocusModel({ area }) {
  const view = ['back', 'shoulders', 'glutes'].includes(area) ? 'back' : 'front'
  const groups = {
    shoulders: ['Shoulders'],
    chest: ['Chest'],
    back: ['Back'],
    arms: ['Biceps', 'Triceps'],
    legs: ['Legs'],
    glutes: ['Glutes'],
    overall: [],
  }
  return (
    <div className="focus-model" aria-hidden="true">
      <span className="floor-glow focus-model-floor" />
      <div className="focus-model-figure">
        <MannequinRegions view={view} selected={groups[area] || []} />
      </div>
    </div>
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
  appliesOnContinue = false,
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
                  onClick={() => onZoom({ src: previews?.[a], label: viewName(a) })}
                  disabled={!previews?.[a]}
                >
                  {previews?.[a] && <img src={previews[a]} alt={`${a} view`} />}
                  <span>{a}</span>
                </button>
              ))}
            </div>
            <h3 className="review-title">{slide.title}</h3>
          </>
        )}
        {slide.kind === 'finding' && (
          <>
            <div className="review-finding">
              <FocusModel area={slide.area} />
              {slide.evidenceViews?.length > 0 && (
                <div className="review-evidence" aria-label="Seen in your photos">
                  {slide.evidenceViews.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onZoom({ src: previews?.[a], label: viewName(a) })}
                      disabled={!previews?.[a]}
                      aria-label={`Enlarge ${a} photo`}
                    >
                      {previews?.[a] ? <img src={previews[a]} alt={`${a} view`} /> : <i aria-hidden="true" />}
                      <span>{a}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="review-area">
              <span aria-hidden="true" />
              {slide.title}
            </p>
            <h3 className="review-observation">{slide.observation}</h3>
            <details className="review-reading-note">
              <summary>About this reading</summary>
              <p className="font-medium text-ink2">
                {canApply
                  ? slide.trainingResponse
                  : 'Your goals and workout feedback guide how Tally adjusts your training.'}
              </p>
              <p>{slide.uncertainty}</p>
              <p>
                {review.demo
                  ? 'Illustrative sample, not an assessment of you.'
                  : 'Photos show appearance, not measured strength or muscle size.'}
              </p>
            </details>
          </>
        )}
        {slide.kind === 'plan' && (
          <>
            <img className="review-plan-art" src={ONBOARDING_ART.review} alt="" />
            {/* Only claim "built in" when continuing really applies the choices. */}
            <h3 className="review-title">
              {canApply && appliesOnContinue ? slide.title : 'Suggested priorities'}
            </h3>
            {slide.focus.length && !canApply ? (
              <ul className="review-focus-list">
                {slide.focus.map((f) => (
                  <li key={f.area} className="tile review-focus is-static">
                    <span className="review-focus-heading">
                      <span>{focusAction(f.area)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : slide.focus.length ? (
              <div className="review-focus-list">
                {slide.focus.map((f) => (
                  <button
                    key={f.area}
                    type="button"
                    aria-pressed={selectedFocus.includes(f.area)}
                    onClick={() =>
                      onFocusChange(
                        selectedFocus.includes(f.area)
                          ? selectedFocus.filter((a) => a !== f.area)
                          : [...selectedFocus, f.area],
                      )
                    }
                    className="tile review-focus"
                  >
                    <span className="review-focus-heading">
                      <span>{focusAction(f.area)}</span>
                      <Icon name={selectedFocus.includes(f.area) ? 'check' : 'plus'} size={18} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="review-copy">
                Keep a balanced starting plan. Your logged sets and feedback guide the next changes.
              </p>
            )}
            {canApply && <p className="review-copy">These priorities fit into your whole-body plan.</p>}
          </>
        )}
        {slide.kind === 'checkins' && (
          <>
            <div className="checkin-story-art">
              <FocusModel area="overall" />
              <div className="checkin-story-photos">
                {['front', 'back'].map(
                  (a) => previews?.[a] && <img key={a} src={previews[a]} alt={`${a} check-in`} />,
                )}
              </div>
            </div>
            <h3 className="review-title">{slide.title}</h3>
            <p className="review-copy">
              Photo check-ins help us review your balance and update your training.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
