import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './store/AppContext.jsx'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/hanken-grotesk'
import './index.css'
import { restoreNativeState } from './lib/native.js'
import { loadState } from './lib/storage.js'
import { openPreviews } from './lib/photo-store.js'
import BootSkeleton from './components/Skeleton.jsx'

// Every image shows a shimmer until it has loaded (or failed), so artwork and
// photos never pop into an empty box. Capture-phase: load events don't bubble.
const markImage = (event) => {
  if (event.target instanceof HTMLImageElement) event.target.dataset.loaded = event.type
}
document.addEventListener('load', markImage, true)
document.addEventListener('error', markImage, true)
// A cached image can finish before it is attached (its load event never reaches
// the document), and a reused <img> can get a new src: check both cases here.
const settle = (img) => {
  if (img.complete && img.naturalWidth) img.dataset.loaded = 'load'
}
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
      delete record.target.dataset.loaded
      settle(record.target)
      continue
    }
    for (const node of record.addedNodes) {
      if (node instanceof HTMLImageElement) settle(node)
      else if (node instanceof Element) node.querySelectorAll('img:not([data-loaded])').forEach(settle)
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<BootSkeleton />)
restoreNativeState()
  .then(loadState)
  .then(openPreviews)
  .then(({ state, previews }) =>
    root.render(
      <React.StrictMode>
        <AppProvider initialState={state} initialPreviews={previews}>
          <App />
        </AppProvider>
      </React.StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="mx-auto max-w-xl px-[22px] py-12 text-ink">
        <h1 className="h-page">Your saved training</h1>
        <p className="mt-4 text-muted">
          We couldn’t open your saved data. Your saved copy has not been replaced.
        </p>
        <button className="btn-primary mt-6" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>,
    ),
  )
