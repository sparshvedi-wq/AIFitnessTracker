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
      if (node === branch || ['SCRIPT', 'STYLE'].includes(node.tagName)) continue
      undoIsolation.push({ node, inert: node.inert, hidden: node.getAttribute('aria-hidden') })
      node.inert = true
      node.setAttribute('aria-hidden', 'true')
    }
    branch = branch.parentElement
  }
}
export default function useDialogAccessibility(dialog, open, onClose) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open || !dialog.current) return
    const node = dialog.current
    const previousFocus = document.activeElement
    registered.add(node)
    if (count++ === 0) previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    isolateTopDialog()
    if (topDialog() === node) node.querySelector('button')?.focus({ preventScroll: true })
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
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]'))
        previousFocus.focus({ preventScroll: true })
    }
  }, [dialog, open])
}
