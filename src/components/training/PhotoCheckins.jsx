import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'
import Select from '../Select.jsx'
import { Segmented } from '../Ink.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { useApp } from '../../store/AppContext.jsx'
import { checkinSchedule, profileOf } from '../../lib/planner.js'
import { PHOTO_ANGLES, photoRequest, pickDevicePhoto, preparePhoto } from '../../lib/photos.js'
import { isNativeApp } from '../../lib/native.js'
import { photoDraft } from '../../lib/photo-draft.js'
import { uid } from '../../lib/id.js'
import { Choice, Field } from './Fields.jsx'

const DEV = import.meta.env.DEV
const photoLabel = (checkin, all) =>
  `${checkin.date}${all.filter((c) => c.date === checkin.date).length > 1 && checkin.createdAt ? ` · ${new Date(checkin.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : ''}`
export default function PhotoCheckins({
  onClose,
  onboarding = false,
  profile,
  onBack,
  onManual,
  onComplete,
  initialId,
}) {
  const { state, dispatch, today, toast, photoPreviews, saveCheckin } = useApp()
  // Images live in the photo store; attach them to the check-ins shown here.
  const withPreviews = (c) => (c && photoPreviews[c.id] ? { ...c, previews: photoPreviews[c.id] } : c)
  const checkins = state.checkins.map(withPreviews)
  const p = profile || profileOf(state)
  const schedule = checkinSchedule(state, today)
  const existing =
    checkins.find((c) => c.id === initialId) ||
    (onboarding || p.baselineMode === 'test' ? checkins.find((c) => c.id === p.baselinePhotoId) : null) ||
    schedule.latest ||
    (DEV ? [...checkins].filter((c) => c.synthetic).sort((a, b) => b.createdAt - a.createdAt)[0] : null)
  const [adding, setAdding] = useState(!existing)
  const [checks, setChecks] = useState({})
  const [draftReady, setDraftReady] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [comparing, setComparing] = useState(false)
  const [compareAngle, setCompareAngle] = useState('front')
  const [zoom, setZoom] = useState(null)
  const draftTouched = useRef(false)
  const [photos, setPhotos] = useState({})
  const [angle, setAngle] = useState('front')
  const [consent, setConsent] = useState(false)
  const [guardian, setGuardian] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [selected, setDetail] = useState(existing)
  const detail = selected && withPreviews(checkins.find((c) => c.id === selected.id) || selected)
  const [deleting, setDeleting] = useState(null)
  const [selectedFocus, setSelectedFocus] = useState(
    existing?.id === p.focusCheckinId ? p.confirmedFocus : [],
  )
  const [weakSide, setWeakSide] = useState(p.weakerSide || '')
  const [tested, setTested] = useState(Boolean(p.sideTestConfirmed))
  const [sideExercise, setSideExercise] = useState(p.sideExercise || 'db-row')
  const [synthetic, setSynthetic] = useState(false)
  const [liveTest, setLiveTest] = useState(false)
  const [fixtureLoaded, setFixtureLoaded] = useState(false)
  const file = useRef(null),
    camera = useRef(null),
    controller = useRef(null),
    qualityCache = useRef(new Map())
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    let mounted = true
    photoDraft('read')
      .then((draft) => {
        if (
          mounted &&
          !draftTouched.current &&
          !initialId &&
          draft?.photos &&
          Date.now() - draft.at < 7 * 86400000
        ) {
          setPhotos(draft.photos)
          setAdding(true)
          setAngle(draft.angle || 'front')
          setSynthetic(Boolean(draft.synthetic))
          setFixtureLoaded(Boolean(draft.fixtureLoaded))
          const age = draft.synthetic ? '18+' : p.ageGroup
          if (draft.qualityAge === age) {
            setChecks(draft.checks || {})
            for (const a of PHOTO_ANGLES)
              if (draft.checks?.[a] && draft.photos[a])
                qualityCache.current.set(
                  `${Boolean(draft.synthetic)}:${age}:${a}:${draft.photos[a].base64}`,
                  draft.checks[a],
                )
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setDraftReady(true)
      })
    return () => {
      mounted = false
    }
  }, [existing, initialId, p.ageGroup])
  useEffect(() => {
    if (!draftReady || !adding) return
    if (Object.keys(photos).length)
      photoDraft('write', {
        photos,
        angle,
        checks,
        qualityAge: synthetic ? '18+' : p.ageGroup,
        synthetic,
        fixtureLoaded,
        at: Date.now(),
      })
        .then(() => setDraftError(''))
        .catch(() => setDraftError('Couldn’t save this draft. Keep this screen open.'))
  }, [photos, angle, checks, synthetic, fixtureLoaded, draftReady, adding, p.ageGroup])
  const close = () => {
    controller.current?.abort()
    onClose()
  }
  const all = PHOTO_ANGLES.every((a) => photos[a])
  const simulate = DEV && synthetic && !liveTest
  const allowed = all && (simulate || (consent && (synthetic || p.ageGroup !== '13-17' || guardian)))
  const accept = async (photo) => {
    if (!photo) return
    draftTouched.current = true
    const acceptedAngle = angle
    setPhotos((prev) => ({ ...prev, [acceptedAngle]: photo }))
    setChecks((prev) => ({ ...prev, [acceptedAngle]: null }))
    setError('')
    setSynthetic(false)
    setFixtureLoaded(false)
    if (synthetic) {
      setConsent(false)
      setGuardian(false)
      setLiveTest(false)
    }
    let usable = true
    if (!synthetic && consent && (p.ageGroup !== '13-17' || guardian)) {
      controller.current = new AbortController()
      setBusy(`Checking ${acceptedAngle} view…`)
      try {
        const quality = await photoRequest(
          '/api/photo-quality',
          {
            consent: true,
            ownPhotosConfirmed: true,
            ageGroup: p.ageGroup,
            guardianPermission: guardian,
            photo: { angle: acceptedAngle, base64: photo.base64 },
          },
          controller.current.signal,
        )
        qualityCache.current.set(`false:${p.ageGroup}:${acceptedAngle}:${photo.base64}`, quality)
        setChecks((prev) => ({ ...prev, [acceptedAngle]: quality }))
        usable = quality.usable
        if (!usable) setError(quality.feedback || 'Please retake this view with your full body visible.')
      } catch (e) {
        usable = false
        if (e.name !== 'AbortError') setError(e.message)
      } finally {
        setBusy('')
      }
    }
    const next = PHOTO_ANGLES.find((a) => a !== acceptedAngle && !photos[a])
    if (usable && next) setAngle(next)
  }
  const pick = async (useCamera) => {
    setError('')
    if (!isNativeApp()) {
      ;(useCamera ? camera : file).current?.click()
      return
    }
    setBusy('Opening photos…')
    try {
      await accept(await pickDevicePhoto(useCamera))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }
  const loadFile = async (e) => {
    const item = e.target.files?.[0]
    e.target.value = ''
    if (!item) return
    setBusy('Preparing photo…')
    try {
      await accept(await preparePhoto(item))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }
  const loadDemo = async () => {
    // Test fixtures exist only in development builds.
    if (!import.meta.env.DEV) return
    draftTouched.current = true
    setChecks({})
    setBusy('Loading test photos…')
    setError('')
    try {
      const { demoPhotos } = await import('../../lib/photo-demo.js')
      const entries = await Promise.all(PHOTO_ANGLES.map(async (a) => [a, await preparePhoto(demoPhotos[a])]))
      setPhotos(Object.fromEntries(entries))
      setFixtureLoaded(true)
      setSynthetic(true)
      setLiveTest(false)
      setConsent(false)
      setAngle('front')
      qualityCache.current.clear()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }
  const save = (review = null) => {
    if (!all) return
    const checkin = {
      id: uid(),
      date: today,
      createdAt: Date.now(),
      photoCount: 3,
      previews: Object.fromEntries(PHOTO_ANGLES.map((a) => [a, photos[a].preview])),
      review,
      ...(synthetic ? { synthetic: true, sample: true } : {}),
    }
    saveCheckin(checkin)
      .then(() => {
        void photoDraft('clear').catch(() => {})
        setDetail(checkin)
        setAdding(false)
        setSelectedFocus(review?.suggestedFocus?.map((f) => f.area) || [])
        toast(synthetic ? 'Test review saved' : 'Photo check-in saved')
      })
      .catch(() => setError('Couldn’t save these photos. Free some space and try again.'))
  }
  const analyze = async () => {
    if (!allowed) return
    setError('')
    if (new Set(PHOTO_ANGLES.map((a) => photos[a]?.base64)).size !== 3) {
      setError('Use three different photos: front, side and back.')
      return
    }
    if (import.meta.env.DEV && simulate) {
      setBusy('Preparing demo…')
      try {
        const { demoReview } = await import('../../lib/photo-demo.js')
        save(demoReview())
      } finally {
        setBusy('')
      }
      return
    }
    controller.current = new AbortController()
    const signal = controller.current.signal
    const common = {
      consent: true,
      ownPhotosConfirmed: !synthetic,
      ageGroup: synthetic ? '18+' : p.ageGroup,
      guardianPermission: guardian,
      ...(synthetic ? { synthetic: true } : {}),
    }
    try {
      for (const a of PHOTO_ANGLES) {
        setBusy(`Checking ${a} view…`)
        const cacheKey = `${synthetic}:${common.ageGroup}:${a}:${photos[a].base64}`
        let quality = qualityCache.current.get(cacheKey)
        if (!quality) {
          quality = await photoRequest(
            '/api/photo-quality',
            { ...common, photo: { angle: a, base64: photos[a].base64 } },
            signal,
          )
          qualityCache.current.set(cacheKey, quality)
        }
        setChecks((prev) => ({ ...prev, [a]: quality }))
        if (!quality.usable) {
          setAngle(a)
          throw new Error(`${a}: ${quality.feedback}`)
        }
      }
      setBusy('Reviewing your photos…')
      const review = await photoRequest(
        '/api/photo-assessments',
        {
          ...common,
          goal: p.goal,
          photos: PHOTO_ANGLES.map((a) => ({ angle: a, base64: photos[a].base64 })),
        },
        signal,
      )
      if (review.status !== 'ready') {
        const bad = PHOTO_ANGLES.find((a) => !review.views?.[a]?.usable)
        if (bad) setAngle(bad)
        throw new Error(bad ? `${bad}: ${review.views[bad].feedback}` : 'Replace the flagged photos.')
      }
      save(review)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setBusy('')
    }
  }
  const applyFocus = () => {
    if (!detail || detail.synthetic) return
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: {
        training: {
          ...p,
          baselineMode: 'photos',
          baselinePhotoId: p.baselinePhotoId || detail.id,
          confirmedFocus: selectedFocus,
          focusCheckinId: detail.id,
          weakerSide: tested ? weakSide : '',
          sideTestConfirmed: tested && Boolean(weakSide),
          sideExercise,
          sideTestDate: tested ? today : null,
        },
      },
    })
    toast('Training focus updated')
  }
  return (
    <>
      <Modal
        open
        fullScreen={onboarding}
        dismissible={!onboarding}
        onClose={close}
        headerAction={
          onboarding && DEV ? (
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center text-faint"
              aria-label="Exit setup for testing"
              title="Exit setup for testing"
              onClick={close}
            >
              <Icon name="x" size={13} />
            </button>
          ) : null
        }
        title={onboarding ? 'Your starting photos' : 'Photo check-ins'}
        subtitle={
          adding
            ? `${Object.keys(photos).length} of 3 views added`
            : detail?.synthetic
              ? 'Test result'
              : detail?.date
        }
        footer={
          adding ? (
            <div>
              {error && (
                <p role="alert" className="mb-3 rounded-xl bg-danger/10 p-3 text-[14px] text-danger">
                  {error}
                </p>
              )}
              {busy ? (
                <>
                  <p role="status" className="mb-2 flex items-center justify-center gap-2 text-[14px]">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    {busy}
                  </p>
                  {/Checking|Reviewing/.test(busy) && (
                    <button
                      className="btn-secondary min-h-12 w-full"
                      onClick={() => {
                        controller.current?.abort()
                        setBusy('')
                      }}
                    >
                      Cancel review
                    </button>
                  )}
                </>
              ) : all ? (
                <button className="btn-primary min-h-12 w-full" disabled={!allowed} onClick={analyze}>
                  {simulate ? 'Preview demo results' : 'See my results'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button className="btn-primary min-h-12 flex-1 capitalize" onClick={() => pick(true)}>
                    <Icon name="camera" size={18} />
                    Take {angle} photo
                  </button>
                  <button
                    className="icon-btn !h-12 !w-12"
                    aria-label="Add from camera roll"
                    onClick={() => pick(false)}
                  >
                    <Icon name="image" size={21} />
                  </button>
                </div>
              )}
              {onboarding && (
                <button
                  disabled={Boolean(busy)}
                  className="mx-auto mt-1 block min-h-11 px-3 text-[14px] text-muted underline underline-offset-4"
                  onClick={onManual}
                >
                  Opt out of photos
                </button>
              )}
            </div>
          ) : onboarding ? (
            <div>
              <button
                className="btn-primary min-h-12 w-full"
                onClick={() =>
                  onComplete(
                    detail,
                    detail.synthetic
                      ? {}
                      : {
                          confirmedFocus: selectedFocus,
                          focusCheckinId: detail.id,
                          weakerSide: tested ? weakSide : '',
                          sideTestConfirmed: tested && Boolean(weakSide),
                          sideExercise,
                          sideTestDate: tested ? today : null,
                        },
                  )
                }
              >
                Use this starting point
              </button>
              <button
                className="mx-auto mt-1 block min-h-11 px-3 text-[14px] text-muted underline underline-offset-4"
                onClick={onManual}
              >
                Opt out of photos
              </button>
            </div>
          ) : (
            <button
              className="btn-primary min-h-12 w-full"
              onClick={() => {
                setAdding(true)
                setPhotos({})
                setChecks({})
                setAngle('front')
                setConsent(false)
                setGuardian(false)
                setSynthetic(false)
                setLiveTest(false)
                setFixtureLoaded(false)
                setError('')
                setComparing(false)
              }}
            >
              Add a check-in
            </button>
          )
        }
      >
        {adding ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {PHOTO_ANGLES.map((a, i) => (
                <button
                  key={a}
                  disabled={Boolean(busy)}
                  aria-label={`${a} view`}
                  aria-pressed={angle === a}
                  onClick={() => setAngle(a)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-[14px] capitalize ${angle === a ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'}`}
                >
                  <span>{a}</span>
                  {photos[a] ? (
                    <Icon name={checks[a]?.usable === false ? 'info' : 'check'} size={14} />
                  ) : (
                    <span className="text-[11px] opacity-50">{i + 1}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex h-[260px] items-center justify-center overflow-hidden rounded-tuck bg-bg/80 sm:h-[300px]">
              {photos[angle] ? (
                <img
                  src={photos[angle].preview}
                  alt={`${angle} preview`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted">
                  <svg viewBox="0 0 100 160" className="h-36 w-24 text-faint" aria-hidden="true">
                    <circle cx="50" cy="22" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path
                      d={
                        angle === 'side'
                          ? 'M48 40Q66 44 61 83L57 139M48 40L42 85 46 139M51 47L65 91'
                          : 'M35 41Q50 35 65 41L70 83 61 91 64 141M35 41L30 83 39 91 36 141M40 86L50 96 60 86M50 96V139M35 45L23 89M65 45L77 89'
                      }
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-[14px] capitalize">{angle} view</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-[14px] text-muted">Stand relaxed. Keep your whole body in frame.</p>
            {checks[angle] && (
              <p
                role="status"
                className={`mt-2 text-[14px] ${checks[angle].usable ? 'text-accent' : 'text-danger'}`}
              >
                {checks[angle].usable ? 'This view is usable.' : checks[angle].feedback}
              </p>
            )}
            {Object.keys(photos).length > 0 && (
              <p className="mt-2 text-[13px] text-muted">
                {draftError || 'Draft kept on this device for up to 7 days.'}
              </p>
            )}
            {all && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  disabled={Boolean(busy)}
                  className="btn-secondary min-h-12"
                  onClick={() => pick(true)}
                >
                  <Icon name="camera" size={18} />
                  Take photo
                </button>
                <button
                  disabled={Boolean(busy)}
                  className="btn-secondary min-h-12"
                  onClick={() => pick(false)}
                >
                  <Icon name="image" size={18} />
                  Camera roll
                </button>
              </div>
            )}
            <input ref={file} type="file" accept="image/*" onChange={loadFile} className="hidden" />
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={loadFile}
              className="hidden"
            />
            {!simulate && (
              <div className="mt-5 space-y-3">
                <label className="flex items-start gap-3 text-[13px] leading-relaxed">
                  <input
                    className="mt-1 h-5 w-5 shrink-0"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    {synthetic
                      ? 'Allow an OpenAI review of these fictional adult test photos.'
                      : 'These are my photos. Send them to OpenAI for a review.'}
                  </span>
                </label>
                {!synthetic && p.ageGroup === '13-17' && (
                  <label className="flex items-start gap-3 text-[13px]">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={guardian}
                      onChange={(e) => setGuardian(e.target.checked)}
                    />
                    I have parent or guardian permission.
                  </label>
                )}
              </div>
            )}
            <details className="mt-4 border-t border-line">
              <summary className="min-h-11 cursor-pointer py-3 text-[13px] text-muted">
                Privacy & other options
              </summary>
              <p className="text-[13px] leading-relaxed text-muted">
                Never shared. Reviews pass through our server, which keeps nothing, to OpenAI under its API
                policies. Your last 20 check-ins stay on this device.
              </p>
              <button
                disabled={Boolean(busy)}
                className="btn-ghost mt-3 min-h-11 w-full"
                onClick={() => {
                  draftTouched.current = true
                  setPhotos({})
                  setChecks({})
                  setAngle('front')
                  setSynthetic(false)
                  setFixtureLoaded(false)
                  setLiveTest(false)
                  void photoDraft('clear').catch(() => {})
                }}
              >
                Clear photo draft
              </button>
              <button
                disabled={!all || Boolean(busy) || synthetic}
                className="btn-ghost mt-3 min-h-11 w-full"
                onClick={() => save()}
              >
                Use photos without AI
              </button>
              {onboarding && (
                <button disabled={Boolean(busy)} className="btn-ghost min-h-11 w-full" onClick={onBack}>
                  Back to setup
                </button>
              )}
              {!onboarding && schedule.latest && (
                <button
                  disabled={Boolean(busy)}
                  className="btn-ghost min-h-11 w-full"
                  onClick={() => {
                    setAdding(false)
                  }}
                >
                  Back to check-ins
                </button>
              )}
            </details>
            {DEV && (
              <details className="mt-3 border-t border-line">
                <summary className="min-h-11 cursor-pointer py-3 text-[12px] text-muted">
                  Testing tools
                </summary>
                <button
                  disabled={Boolean(busy)}
                  className="btn-secondary mt-1 min-h-11 w-full"
                  onClick={loadDemo}
                >
                  Load fake photos
                </button>
                <label className="mt-4 flex min-h-11 items-center gap-3 text-[13px]">
                  <input
                    type="checkbox"
                    disabled={Boolean(busy) || fixtureLoaded}
                    checked={synthetic}
                    onChange={(e) => {
                      setSynthetic(e.target.checked)
                      setLiveTest(false)
                      setConsent(false)
                      qualityCache.current.clear()
                    }}
                  />
                  My uploads are fictional adult test photos
                </label>
                {fixtureLoaded && (
                  <button
                    disabled={Boolean(busy)}
                    className="btn-ghost mt-2 min-h-11 w-full"
                    onClick={() => {
                      setPhotos({})
                      setSynthetic(false)
                      setLiveTest(false)
                      setFixtureLoaded(false)
                      setConsent(false)
                    }}
                  >
                    Use my own photos instead
                  </button>
                )}
                {synthetic && (
                  <>
                    <p className="mt-2 text-[12px] text-muted">Demo preview uses no API credits.</p>
                    <label className="mt-3 flex min-h-11 items-center gap-3 text-[13px]">
                      <input
                        type="checkbox"
                        disabled={Boolean(busy)}
                        checked={liveTest}
                        onChange={(e) => {
                          setLiveTest(e.target.checked)
                          setConsent(false)
                        }}
                      />
                      Use real AI analysis · spends API credits
                    </label>
                  </>
                )}
              </details>
            )}
          </>
        ) : (
          <>
            {!onboarding && (
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {[...checkins]
                  .filter((c) => DEV || !c.synthetic)
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((c) => (
                    <Choice
                      key={c.id}
                      value={c.id}
                      selected={detail?.id === c.id}
                      onClick={() => {
                        setDetail(c)
                        setSelectedFocus(c.id === p.focusCheckinId ? p.confirmedFocus : [])
                        setTested(c.id === p.focusCheckinId && Boolean(p.sideTestConfirmed))
                      }}
                    >
                      {c.synthetic ? 'Test · ' : ''}
                      {photoLabel(c, checkins)}
                    </Choice>
                  ))}
              </div>
            )}
            {detail && (
              <section className="mt-5">
                {detail.synthetic && (
                  <p className="mb-4 rounded-2xl border border-accent/30 px-3 py-2 text-[13px] text-accent">
                    {detail.review?.demo
                      ? 'Demo result · no AI request'
                      : 'AI review of fictional test photos'}
                  </p>
                )}
                {detail.previews && (
                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_ANGLES.map((a) => (
                      <figure key={a}>
                        <button
                          type="button"
                          className="block w-full"
                          aria-label={`Enlarge ${a} view`}
                          onClick={() => setZoom({ src: detail.previews[a], label: `${a} · ${detail.date}` })}
                        >
                          <img
                            alt={`${a} check-in ${detail.date}`}
                            src={detail.previews[a]}
                            className="h-36 w-full rounded-2xl bg-bg object-contain"
                          />
                        </button>
                        <figcaption className="mt-2 text-center text-[12px] capitalize text-muted">
                          {a}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {!onboarding &&
                  checkins.some(
                    (c) =>
                      c.id !== detail.id && c.previews && Boolean(c.synthetic) === Boolean(detail.synthetic),
                  ) && (
                    <>
                      <button
                        className="btn-secondary mt-4 min-h-12 w-full"
                        aria-expanded={comparing}
                        onClick={() => setComparing((v) => !v)}
                      >
                        {comparing ? 'Hide comparison' : 'Compare matching views'}
                      </button>
                      {comparing && (
                        <PhotoComparison
                          current={detail}
                          checkins={checkins}
                          angle={compareAngle}
                          setAngle={setCompareAngle}
                          onZoom={setZoom}
                        />
                      )}
                    </>
                  )}
                <h3 className="mt-6 font-display text-[26px]">
                  {onboarding ? 'Your starting point' : 'Your photo review'}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink2">
                  {detail.review?.summary || 'Photos saved. AI review was not requested.'}
                </p>
                {detail.review?.observations?.map((o, i) => (
                  <div key={i} className="mt-4 rounded-tuck bg-surface2 p-4">
                    <p className="text-[14px] leading-relaxed">{o.observation}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{o.uncertainty}</p>
                    <p className="mt-2 text-[12px] text-muted">Based on {o.evidenceViews.join(', ')} views</p>
                  </div>
                ))}
                {!detail.synthetic && p.ageGroup === '18+' && detail.review?.suggestedFocus?.length > 0 && (
                  <Field label="Training focus">
                    <div className="space-y-3">
                      {detail.review.suggestedFocus.map((f) => (
                        <label key={f.area} className="flex gap-3 text-[14px]">
                          <input
                            className="mt-1 h-5 w-5"
                            type="checkbox"
                            checked={selectedFocus.includes(f.area)}
                            onChange={(e) =>
                              setSelectedFocus(
                                e.target.checked
                                  ? [...selectedFocus, f.area]
                                  : selectedFocus.filter((v) => v !== f.area),
                              )
                            }
                          />
                          <span>
                            <span className="capitalize">{f.area}</span>
                            <span className="mt-1 block text-[13px] text-muted">{f.reason}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <details className="mt-4">
                      <summary className="min-h-11 cursor-pointer py-2 text-[13px] text-muted">
                        Side-to-side preference
                      </summary>
                      <p className="text-[12px] text-muted">Base this on a real exercise, not a photo.</p>
                      <Segmented
                        className="mt-3"
                        label="Less capable side"
                        value={weakSide}
                        onChange={setWeakSide}
                        options={[
                          ['', 'No preference'],
                          ['left', 'Left'],
                          ['right', 'Right'],
                        ]}
                      />
                      <Segmented
                        className="mt-3"
                        label="Compared movement"
                        value={sideExercise}
                        onChange={setSideExercise}
                        options={[
                          ['db-row', 'One-arm row'],
                          ['biceps-curl', 'Curl'],
                          ['split-squat', 'Split squat'],
                        ]}
                      />
                      <label className="mt-3 flex gap-3 text-[12px]">
                        <input
                          type="checkbox"
                          checked={tested}
                          onChange={(e) => setTested(e.target.checked)}
                        />
                        I compared sides without pain.
                      </label>
                    </details>
                    <button onClick={applyFocus} className="btn-secondary mt-4 min-h-12 w-full">
                      Use selected focus in my training
                    </button>
                    <p className="mt-2 text-[13px] text-muted">
                      These areas get a little extra work. Reviewed after six weeks.
                    </p>
                  </Field>
                )}
                {detail.review?.limitations?.length > 0 && (
                  <details className="mt-5 text-[13px] text-muted">
                    <summary className="min-h-11 cursor-pointer py-3">Reading limitations</summary>
                    <ul className="list-disc space-y-2 pl-4">
                      {detail.review.limitations.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {!onboarding && (
                  <button className="btn-danger-ghost mt-4 min-h-11" onClick={() => setDeleting(detail)}>
                    Delete check-in
                  </button>
                )}
              </section>
            )}
          </>
        )}
        {!onboarding && (
          <details className="mt-5 border-t border-line">
            <summary className="min-h-11 cursor-pointer py-3 text-[13px] text-muted">Check-in rhythm</summary>
            <div className="flex gap-2">
              {[14, 28].map((days) => (
                <Choice
                  key={days}
                  value={days}
                  selected={p.checkinDays === days}
                  onClick={(checkinDays) =>
                    dispatch({
                      type: 'UPDATE_SETTINGS',
                      patch: { training: { ...state.settings.training, checkinDays } },
                    })
                  }
                >
                  Every {days} days
                </Choice>
              ))}
            </div>
          </details>
        )}
      </Modal>
      <Modal open={Boolean(zoom)} onClose={() => setZoom(null)} title={zoom?.label || 'Photo'}>
        {zoom && (
          <img src={zoom.src} alt={zoom.label} className="mx-auto max-h-[70dvh] w-full object-contain" />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this check-in?"
        message="Its photos, review and focus are removed."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          dispatch({ type: 'DELETE_CHECKIN', id: deleting.id })
          const next = [...checkins]
            .filter((c) => c.id !== deleting.id)
            .sort((a, b) => b.createdAt - a.createdAt)[0]
          setDetail(next || null)
          setSelectedFocus(next?.id === p.focusCheckinId ? p.confirmedFocus : [])
          setDeleting(null)
          setAdding(!next)
          setComparing(false)
        }}
      />
    </>
  )
}

function PhotoComparison({ current, checkins, angle, setAngle, onZoom }) {
  const choices = checkins
    .filter((c) => c.id !== current.id && c.previews && Boolean(c.synthetic) === Boolean(current.synthetic))
    .sort((a, b) => b.createdAt - a.createdAt)
  const [otherId, setOtherId] = useState(choices[0]?.id)
  const other = choices.find((c) => c.id === otherId) || choices[0]
  if (!other) return null
  return (
    <div className="mt-4 rounded-tuck bg-bg p-3">
      <div className="text-[13px] text-muted">
        Compare with
        <Select
          label="Compare with"
          value={other.id}
          onChange={setOtherId}
          options={choices.map((c) => [c.id, `${photoLabel(c, checkins)}${c.synthetic ? ' · Test' : ''}`])}
          className="mt-2"
        />
      </div>
      <div className="segmented mt-3">
        {PHOTO_ANGLES.map((a) => (
          <button
            key={a}
            className={`segment capitalize ${angle === a ? 'segment-active' : ''}`}
            aria-pressed={angle === a}
            onClick={() => setAngle(a)}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[other, current].map((c) => (
          <button
            key={c.id}
            className="rounded-2xl bg-surface p-2"
            aria-label={`Enlarge ${angle} view from ${photoLabel(c, checkins)}`}
            onClick={() => onZoom({ src: c.previews[angle], label: `${angle} · ${c.date}` })}
          >
            <img className="h-56 w-full object-contain" src={c.previews[angle]} alt={`${angle} view`} />
            <span className="mt-2 block text-[12px] text-muted">{photoLabel(c, checkins)}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Lighting and pose change how photos look. Tap to enlarge.
      </p>
    </div>
  )
}
