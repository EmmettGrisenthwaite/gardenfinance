import { ChevronLeft } from 'lucide-react'

// A page title and its controls — nothing else. No icon badge, no eyebrow
// over the title, no tagline under it: the navigation already says where you
// are, and a heading that needs three lines of support is the wrong heading.
export default function PageHeader({
  title,
  actions,
  onBack,
  backLabel = 'Back',
  compact = false,
  className = '',
}) {
  return (
    <header className={`flex items-center justify-between gap-4 ${compact ? 'py-2.5' : 'py-3.5'} ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          // The label is visible, not just aria — a bare chevron makes users
          // guess where it leads; "‹ Plan" says it.
          <button type="button" onClick={onBack} aria-label={backLabel}
            className="-ml-1.5 flex min-h-11 shrink-0 items-center gap-0.5 rounded-xl py-2 pl-1 pr-2.5 text-sm font-medium text-readable-secondary transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
            <ChevronLeft className="h-5 w-5" />
            <span className="max-w-[9rem] truncate">{backLabel}</span>
          </button>
        )}
        {title && (
          <h1 className={`${compact ? 'text-[20px]' : 'text-[26px] md:text-[28px]'} truncate font-semibold leading-tight tracking-[-0.02em] text-white`}>{title}</h1>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
