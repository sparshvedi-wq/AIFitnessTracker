import Icon from '../Icon.jsx'
import { photoReviewSlides, conciseSummary } from '../../lib/photo-review.js'
import { ONBOARDING_ART } from '../../lib/onboarding-art.js'
import './photo-review.css'
// Only the real request state is shown; no invented stages or percentages.
export function PhotoReviewLoading({ status }) {
  return (
    <section className="review-loading" role="status" aria-live="polite">
      <div className="review-scan">
        <span className="floor-glow review-scan-floor" />
        <img src={ONBOARDING_ART.neutral} alt="" />
        <span className="review-scan-line" />
      </div>
      <h3 className="font-display text-[30px]">A closer look</h3>
      <p className="mt-3 text-[16px] text-ink2">{status}</p>
    </section>
  )
}
// Where each reviewed area sits on M1, in % of the render. Only a qualitative highlight:
// it marks the area a finding refers to, never a size, score or measurement.
const FRONT = '/onboarding/m1-neutral.webp'
const BACK = '/onboarding/m1-photo-back.webp'
const FOCUS = {
  shoulders: {
    src: BACK,
    spots: [
      [33, 22, 10, 6],
      [67, 22, 10, 6],
    ],
  },
  back: { src: BACK, spots: [[50, 30, 17, 9]] },
  glutes: { src: BACK, spots: [[50, 51, 15, 6]] },
  chest: { src: FRONT, spots: [[50, 25, 15, 6]] },
  arms: {
    src: FRONT,
    spots: [
      [27, 37, 7, 10],
      [73, 37, 7, 10],
    ],
  },
  legs: {
    src: FRONT,
    spots: [
      [42, 72, 8, 17],
      [58, 72, 8, 17],
    ],
  },
}

export function FocusModel({ area }) {
  const focus = FOCUS[area]
  const src = focus?.src || FRONT
  const glow = focus
    ? focus.spots
        .map(
          ([x, y, w, h]) =>
            `radial-gradient(${w}% ${h}% at ${x}% ${y}%, rgb(var(--accent) / 0.95), rgb(var(--accent) / 0.4) 55%, rgb(var(--accent) / 0) 100%)`,
        )
        .join(', ')
    : 'linear-gradient(rgb(var(--accent) / 0.38), rgb(var(--accent) / 0.38))'
  return (
    <div className="focus-model" aria-hidden="true">
      <span className="floor-glow focus-model-floor" />
      <div className="focus-model-figure">
        <img src={src} alt="" width="1024" height="1536" decoding="async" />
        <span
          className="focus-model-tint"
          style={{ backgroundImage: glow, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
        />
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
            <div className="review-finding">
              <FocusModel area={slide.area} />
              {slide.evidenceViews?.length > 0 && (
                <div className="review-evidence" aria-label="Seen in your photos">
                  {slide.evidenceViews.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onZoom({ src: previews?.[a], label: `${a} view` })}
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
            {slide.uncertainty && (
              <p className="review-uncertainty">
                <Icon name="info" size={16} />
                <span>{slide.uncertainty}</span>
              </p>
            )}
            {review.suggestedFocus?.some((f) => f.area === slide.area) && (
              <div className="review-training-response">
                <span className="flex items-center gap-2 text-[13px] font-bold text-accent-ink">
                  <Icon name="train" size={16} />
                  In your training
                </span>
                <p className="mt-2 text-[15px] leading-relaxed">
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
                    className="tile review-focus"
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
