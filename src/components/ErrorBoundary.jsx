import { Component } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { isChunkError, reloadOnce } from '@/lib/chunkReload'

// Top-level boundary: catches render/runtime errors anywhere in the tree and
// shows a friendly recovery screen instead of a white page. A stale-chunk error
// after a deploy self-heals by reloading once.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, recovering: false }
  }

  static getDerivedStateFromError(error) {
    return { error, recovering: isChunkError(error) }
  }

  componentDidCatch(error, info) {
    // A new version was deployed while this tab was open — reload to fetch it.
    if (isChunkError(error)) { reloadOnce(); return }
    if (import.meta.env.DEV) console.error('App error boundary caught:', error, info)
    // TODO (Track 5.5): forward to error monitoring once configured.
  }

  render() {
    // Stale-chunk recovery: a reload is already firing — show a calm loader, not
    // the scary error screen.
    if (this.state.recovering) {
      return (
        <div className="flex min-h-dvh items-center justify-center gap-2.5" style={{ background: '#08110e' }} role="status">
          <Loader2 className="status-spinner h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span className="text-sm text-readable-secondary">Updating to the latest version…</span>
        </div>
      )
    }
    if (this.state.error) {
      return (
        // Same dark shell as the app: a white page flashing in mid-session
        // reads as a different product having crashed.
        <div className="flex min-h-dvh items-center px-6" style={{ background: '#08110e' }}>
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Something went wrong</h1>
            <p className="mt-1.5 text-[15px] leading-6 text-readable-secondary">
              The app hit an unexpected error. Reloading usually clears it, and your data is safe.
            </p>
            <button onClick={() => window.location.reload()} className="btn-primary mt-5 min-h-11">
              <RefreshCw className="w-4 h-4" /> Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
