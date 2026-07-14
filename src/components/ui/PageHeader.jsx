import { ChevronLeft } from 'lucide-react'

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  onBack,
  backLabel = 'Back',
  compact = false,
  className = '',
}) {
  return (
    <header className={`flex items-start justify-between gap-4 ${compact ? 'py-2.5' : 'py-3.5'} ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} aria-label={backLabel}
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.09] text-emerald-200">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/55">{eyebrow}</p>}
          <h1 className={`${compact ? 'text-[19px]' : 'text-[25px] md:text-[28px]'} truncate font-display font-semibold leading-tight tracking-[-0.02em] text-white`}>{title}</h1>
          {subtitle && <p className="mt-1 max-w-xl text-xs leading-relaxed text-readable-secondary md:text-sm">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
