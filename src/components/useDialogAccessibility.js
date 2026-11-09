import { useEffect, useRef } from 'react'

const registered = new Set()
let undoIsolation = []
let count = 0
let previousOverflow = ''
const topDialog = () =>
  [...document.querySelectorAll('[aria-modal="true"]')].filter((node) => registered.has(node)).at(-1)
function isolateTopDialog() {
  for (const { node, inert, hidden } of undoIsolation) {
    node.inert = inert
    if (hidden === null) node.removeAttribute('aria-hidden')
    else node.setAttribute('aria-hidden', hidden)
  }
  undoIsolation = []
  let branch = topDialog()
  while (branch && branch !== document.body) {
    for (const node of branch.parentElement?.children || []) {
      // Toasts (save errors, Undo) must stay usable above any sheet.
      if (node === branch || ['SCRIPT', 'STYLE'].includes(node.tagName) || node.hasAttribute('data-dialog-exempt'))
        continue
      undoIsolation.push({ node, inert: node.inert, hidden: node.getAttribute('aria-hidden') })
      node.inert = true
      node.setAttribute('aria-hidden', 'true')
    }
    branch = branch.parentElement
  }
}
export default function useDialogAccessibility(dialog, open, onClose) {
  const close = useRef(onClose)
  // The control that opened the dialog, read while rendering: a field inside
  // the dialog may take focus (autoFocus or an effect) before effects here run.
  const opener = useRef(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement
  wasOpen.current = open
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open || !dialog.current) return
    const node = dialog.current
    const previousFocus = opener.current && !node.contains(opener.current) ? opener.current : null
    registered.add(node)
    if (count++ === 0) previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    isolateTopDialog()
    // Respect deliberate input autofocus; otherwise announce the dialog's title.
    if (topDialog() === node && !node.contains(document.activeElement)) node.focus({ preventScroll: true })
    const onKey = (event) => {
      if (topDialog() !== node) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const controls = [
        ...node.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length && !el.closest('[inert]'))
      const first = controls[0],
        last = controls.at(-1)
      if (!first) {
        event.preventDefault()
        node.focus()
        return
      }
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !node.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      registered.delete(node)
      isolateTopDialog()
      if (--count === 0) document.body.style.overflow = previousOverflow
      // After this update settles: not when the same dialog is set up again
      // (development re-runs effects), nor when another dialog has taken focus.
      queueMicrotask(() => {
        if (registered.has(node) || !previousFocus?.isConnected || previousFocus.closest('[inert]')) return
        const top = topDialog()
        if (top && !top.contains(previousFocus)) return
        previousFocus.focus({ preventScroll: true })
      })
    }
  }, [dialog, open])
}
