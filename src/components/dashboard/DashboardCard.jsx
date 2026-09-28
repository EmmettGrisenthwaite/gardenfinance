import { ChevronRight } from 'lucide-react'

// One quiet surface per widget: a small title, the number, a line of context.
// A compact tile is a single tap target — its "Open …" link was a second,
// smaller target that wrapped onto two centred lines at phone width.
export default function DashboardCard({ title, children, actionLabel, onAction, tone = 'neutral', compact = false }) {
  const surface = tone === 'amber'
    ? 'border-amber-200/[0.14] bg-amber-300/[0.035]'
    : 'border-white/[0.08] bg-white/[0.04]'
  const heading = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="min-w-0 truncate text-[13px] font-medium text-readable-secondary">{title}</h2>
      {compact && onAction && <ChevronRight className="h-4 w-4 shrink-0 text-readable-muted" aria-hidden="true" />}
    </div>
  )

  if (compact && onAction) {
    return (
      <button type="button" onClick={onAction} title={actionLabel || title}
        className={`flex h-full w-full min-w-0 flex-col rounded-2xl border p-4 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${surface}`}>
        {heading}
        <div className="mt-2 min-w-0 flex-1">{children}</div>
      </button>
    )
  }

  return (
    <article className={`flex h-full min-w-0 flex-col rounded-2xl border p-4 sm:p-5 ${surface}`}>
      {heading}
      <div className="mt-2 min-w-0 flex-1">{children}</div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}
          className="-ml-1 mt-2 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-[13px] font-medium text-emerald-200 transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
          {actionLabel}<ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </article>
  )
}
