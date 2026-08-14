import { ArrowRight } from 'lucide-react'

export default function DashboardCard({ title, eyebrow, icon: Icon, children, actionLabel, onAction, tone = 'neutral' }) {
  const toneClass = tone === 'emerald'
    ? 'border-emerald-200/15 bg-[linear-gradient(145deg,rgba(18,41,31,.94),rgba(8,20,15,.98))]'
    : tone === 'amber'
      ? 'border-amber-200/15 bg-amber-300/[0.045]'
      : 'border-white/[0.09] bg-white/[0.04]'
  return (
    <article className={`flex h-full min-w-0 flex-col rounded-[22px] border p-4 shadow-[0_14px_38px_rgba(0,0,0,.14)] sm:p-5 ${toneClass}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-100/80">{eyebrow}</p>}
          <h2 className={`${eyebrow ? 'mt-1' : ''} text-[15px] font-semibold leading-5 text-readable-primary`}>{title}</h2>
        </div>
        {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/[0.08] text-emerald-100"><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-3 min-w-0 flex-1">{children}</div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl text-[13px] font-semibold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
          {actionLabel}<ArrowRight className="h-4 w-4" />
        </button>
      )}
    </article>
  )
}
