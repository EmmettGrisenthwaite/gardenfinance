import { Component } from 'react'
import { Sprout, RefreshCw } from 'lucide-react'

// Top-level boundary: catches render/runtime errors anywhere in the tree and
// shows a friendly recovery screen instead of a white page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('App error boundary caught:', error, info)
    // TODO (Track 5.5): forward to error monitoring once configured.
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Sprout className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              The app hit an unexpected error. Reloading usually clears it — your data is safe.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
