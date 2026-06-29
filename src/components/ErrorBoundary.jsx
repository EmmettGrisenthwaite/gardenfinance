import { Component } from 'react'
import { Sprout, RefreshCw } from 'lucide-react'
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
        <div className="min-h-screen flex flex-col items-center justify-center gap-3"
          style={{ background: 'linear-gradient(155deg, #021109 0%, #04261a 30%, #02140f 62%, #020c0a 100%)' }}>
          <div className="w-12 h-12 bg-green-500/90 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <span className="text-sm font-medium text-white/55">Updating to the latest version…</span>
        </div>
      )
    }
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center"
          style={{ background: 'linear-gradient(155deg, #020c05 0%, #031508 30%, #04101a 60%, #030b14 100%)' }}>
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-2xl">
            <Sprout className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium text-white tracking-tight">Something went wrong</h1>
            <p className="text-sm text-white/45 mt-1 max-w-sm">
              The app hit an unexpected error. Reloading usually clears it — your data is safe.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
