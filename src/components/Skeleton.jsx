// Placeholder shapes while saved training or artwork loads. Purely visual.
export function SkeletonBlock({ className = '', style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

// The Home layout in outline, shown while saved data opens (Expo Go reads it
// from device storage first, which can take a moment).
export default function BootSkeleton() {
  return (
    <main className="mx-auto max-w-xl px-[22px] pt-[max(env(safe-area-inset-top),20px)]" aria-busy="true">
      <p className="sr-only" role="status">
        Opening your training
      </p>
      <div className="flex h-11 items-center justify-between">
        <SkeletonBlock className="h-7 w-24 rounded-full" />
        <SkeletonBlock className="h-11 w-11 rounded-full" />
      </div>
      <div className="mt-5 flex justify-between">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[38px] w-[38px] rounded-full" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-[124px] rounded-[22px]" />
        <SkeletonBlock className="h-[124px] rounded-[22px]" />
      </div>
      <SkeletonBlock className="mt-5 h-[320px] rounded-[26px]" />
      <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
        <SkeletonBlock className="h-12 rounded-[16px]" />
        <SkeletonBlock className="h-12 rounded-[16px]" />
      </div>
    </main>
  )
}
