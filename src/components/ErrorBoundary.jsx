import { Component } from 'react'

// Last line of defence: an unexpected error shows a way back instead of a
// blank screen. It sits outside the store, so the render that failed is never
// saved; reloading opens the last saved copy.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Tally could not show this screen:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto max-w-xl px-[22px] py-12 text-ink" role="alert">
        <h1 className="h-page">Something went wrong</h1>
        <p className="mt-4 text-muted">Reload to continue. Your saved training stays on this device.</p>
        <button className="btn-primary mt-6" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    )
  }
}
