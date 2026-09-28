import { Loader2, RefreshCw } from 'lucide-react'

export default function DataLoadState({ title, loading = false, onRetry }) {
  return (
    <section className="mx-auto flex min-h-[45vh] w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center" aria-busy={loading}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/[0.08] text-emerald-200">
        {loading ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-5 w-5" />}
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-readable-primary">{title}</h1>
      <p role="status" className="mt-2 text-[15px] leading-6 text-readable-secondary">
        {loading ? 'Loading your saved information…' : 'We couldn’t load your saved information. Your records haven’t changed.'}
      </p>
      {!loading && <button type="button" onClick={onRetry} className="btn-primary mt-5 min-h-11 gap-2">
        <RefreshCw aria-hidden="true" className="h-4 w-4" /> Try again
      </button>}
    </section>
  )
}
