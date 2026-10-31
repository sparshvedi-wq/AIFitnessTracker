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

const root = ReactDOM.createRoot(document.getElementById('root'))
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
