import { useCallback, useLayoutEffect, useRef } from 'react'

// The second tap of a double tap must not press the button that has just
// replaced the one tapped first (Log set → Start next set, Save → Done).
// Taps within `ms` of the button appearing, or of `key` changing, are ignored.
export const FRESH_TAP_MS = 400

export default function useFreshTapGuard(key = null, ms = FRESH_TAP_MS) {
  const shownAt = useRef(0)
  useLayoutEffect(() => {
    shownAt.current = performance.now()
  }, [key])
  return useCallback(
    (handler) =>
      (...args) => {
        if (performance.now() - shownAt.current >= ms) handler?.(...args)
      },
    [ms],
  )
}
