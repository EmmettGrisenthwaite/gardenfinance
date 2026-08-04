import { useState } from 'react'
import { ArrowRight, Check, CircleHelp, Route, SlidersHorizontal } from 'lucide-react'

const formatMoney = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`

function routeItems(route) {
  return (route?.allocations || []).filter(item => item.amount > 0 || !item.adjustable)
}

export function MoneyRouteSummary({ route }) {
  if (!route) return null
  const visible = routeItems(route).filter(item => !['hold_for_coverage', 'unassigned'].includes(item.key)).slice(0, 3)
  return (
    <section aria-label="Money route" className="rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.045] px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Route className="h-4 w-4 text-emerald-200" />
        <p className="text-[13px] font-semibold text-white">Money Route</p>
        {route.provisional && <span className="ml-auto rounded-full border border-amber-200/20 bg-amber-300/[0.08] px-2 py-0.5 text-[11px] font-semibold text-amber-50">Provisional</span>}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-readable-secondary">
        <strong className="font-semibold text-white">{formatMoney(route.availableMonthlyAmount)}/mo</strong>
        {visible.length ? ` → ${visible.map(item => item.label.replace(/^Pay extra toward |^Build the |^Grow |^Fund |^Increase investing in /, '')).join(' → ')}` : ' available after recorded commitments'}
      </p>
      {route.blockers[0] && <p className="mt-1.5 text-xs leading-5 text-amber-50/90">Could change after: {route.blockers[0].title}</p>}
    </section>
  )
}

export default function MoneyRouteCard({
  route,
  variant = 'advisor',
  onPrimary,
  primaryLabel = 'Use this plan',
  onAdjust,
  onAnswer,
  onResolveBlocker,
  busy = false,
}) {
  const [questionOpen, setQuestionOpen] = useState(false)
  if (!route) return null
  const items = routeItems(route)
  const compact = variant === 'home'
  const question = route.primaryQuestion
  const blocker = route.blockers?.[0]

  return (
    <section className={`overflow-hidden rounded-[24px] border border-emerald-200/16 bg-[linear-gradient(145deg,rgba(18,41,31,.97),rgba(8,20,15,.99))] shadow-[0_18px_45px_rgba(0,0,0,.2)] ${compact ? 'p-4 sm:p-5' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.09] text-emerald-100"><Route className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/80">{compact ? 'Your monthly route' : 'Your first money route'}</p>
            {route.provisional && <span className="rounded-full border border-amber-200/20 bg-amber-300/[0.08] px-2 py-0.5 text-[11px] font-semibold text-amber-50">Provisional</span>}
          </div>
          <h2 className="mt-1.5 text-[20px] font-semibold leading-7 tracking-[-0.02em] text-white">
            {route.availableMonthlyAmount > 0
              ? `${formatMoney(route.availableMonthlyAmount)} left to assign each month`
              : `${route.chapter} comes first`}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{route.chapter} is the current chapter. Required payments and recorded allocations are kept separate so this money is not counted twice.</p>
        </div>
      </div>

      <ol className="mt-4 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.09] bg-black/[0.08] px-3.5">
        {items.slice(0, compact ? 3 : 5).map((item, index) => (
          <li key={item.key} className="flex gap-3 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-[11px] font-bold text-emerald-100">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold leading-5 text-white">{item.label}</p>
                {item.amount > 0 && <span className="shrink-0 text-[13px] font-semibold tabular-nums text-emerald-100">{formatMoney(item.amount)}</span>}
              </div>
              {!compact && <p className="mt-0.5 text-xs leading-5 text-readable-secondary">{item.reason}</p>}
            </div>
          </li>
        ))}
      </ol>
      {items.length > (compact ? 3 : 5) && <p className="mt-2 text-xs text-readable-secondary">+{items.length - (compact ? 3 : 5)} later destination{items.length - (compact ? 3 : 5) === 1 ? '' : 's'}</p>}

      {route.nextDestination && !compact && <p className="mt-3 text-[13px] leading-5 text-readable-secondary"><span className="font-semibold text-white">After this:</span> {route.nextDestination}</p>}

      {blocker && (
        <div className="mt-3 rounded-xl border border-amber-200/18 bg-amber-300/[0.055] px-3.5 py-3">
          <div className="flex gap-2.5">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
            <div><p className="text-[13px] font-semibold text-amber-50">One fact could refine this route</p><p className="mt-0.5 text-xs leading-5 text-readable-secondary">{blocker.title}. {blocker.detail}</p></div>
          </div>
        </div>
      )}

      {questionOpen && question && (
        <div className="mt-3 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3.5">
          <p className="text-[13px] font-semibold leading-5 text-white">{question.prompt}</p>
          <div className="mt-2 grid gap-2">
            {question.options.map(option => <button key={option.value} type="button" onClick={() => onAnswer?.(question.key, option.value)} disabled={busy}
              className="min-h-11 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.055] px-3 text-left text-[13px] font-semibold text-emerald-50 hover:bg-emerald-300/[0.1] disabled:opacity-50">
              {option.label}
            </button>)}
          </div>
        </div>
      )}

      <div className={`mt-4 flex ${compact ? 'items-center' : 'flex-col sm:flex-row'} gap-2`}>
        {onPrimary && <button type="button" onClick={onPrimary} disabled={busy} className="btn-primary min-h-11 flex-1 disabled:opacity-50">
          {busy ? 'Saving…' : primaryLabel} <ArrowRight className="h-4 w-4" />
        </button>}
        {!compact && onAdjust && route.allocations.some(item => item.adjustable) && <button type="button" onClick={onAdjust} disabled={busy} className="btn-ghost min-h-11 flex-1"><SlidersHorizontal className="h-4 w-4" /> Adjust amounts</button>}
        {!compact && question && <button type="button" onClick={() => setQuestionOpen(open => !open)} disabled={busy} className="btn-ghost min-h-11 flex-1"><CircleHelp className="h-4 w-4" /> Answer one question</button>}
        {!compact && !question && blocker && onResolveBlocker && <button type="button" onClick={() => onResolveBlocker(blocker)} disabled={busy} className="btn-ghost min-h-11 flex-1"><Check className="h-4 w-4" /> Add missing detail</button>}
      </div>
    </section>
  )
}
