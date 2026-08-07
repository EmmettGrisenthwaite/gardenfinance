import { ArrowRight, ClipboardList, ListChecks, SlidersHorizontal } from 'lucide-react'
import { orderForPresentation } from '@/lib/moneyRoute'

const formatMoney = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`

// Labels are written as destinations ("Pay extra toward Visa Card") so they
// read cleanly in the plan list; strip the verb prefix when a bare name is
// what the sentence needs.
const bareName = label => label.replace(/^Pay extra toward |^Build the |^Grow |^Fund |^Increase investing in /, '')

// An ordered list says what comes first; a date says whether it is worth
// starting. "About" is load-bearing — see scheduleRungs for what these ignore.
const months = n => (n === 1 ? 'about a month' : `about ${n} months`)
const takesLabel = item => (item.etaMonths ? months(item.etaMonths) : null)
const startsLabel = item => (item.startsInMonths ? `starts in ${months(item.startsInMonths)}` : null)

function planItems(route) {
  return orderForPresentation((route?.allocations || []).filter(item => (
    !['hold_for_coverage', 'unassigned'].includes(item.key) && (item.amount > 0 || !item.adjustable)
  )))
}

export function MoneyRouteSummary({ route }) {
  if (!route?.ready) return null
  const visible = planItems(route).slice(0, 3)
  if (!visible.length) return null
  return (
    <section aria-label="Your plan" className="rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.045] px-4 py-3.5">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-emerald-200" />
        <p className="text-[13px] font-semibold text-white">Your plan</p>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-readable-secondary">
        <strong className="font-semibold text-white">{formatMoney(route.availableMonthlyAmount)}/mo</strong>
        {` → ${visible.map(item => bareName(item.label)).join(' → ')}`}
      </p>
    </section>
  )
}

/**
 * The plan the app recommends. Shown only once every required input exists,
 * so it never needs hedging language — if something is missing the caller
 * renders the setup prompt instead.
 */
export default function MoneyRouteCard({
  route,
  variant = 'advisor',
  onPrimary,
  primaryLabel = 'Add this to my Plan',
  onAdjust,
  onResolveBlocker,
  busy = false,
}) {
  if (!route?.ready) return null
  const items = planItems(route)
  const compact = variant === 'home'
  const limit = compact ? 3 : 5
  // Home stays tight; the full card shows the sequence.
  const upcoming = compact
    ? (route.upcoming || []).slice(0, Math.max(0, 3 - items.length))
    : (route.upcoming || []).slice(0, Math.max(0, 5 - items.slice(0, limit).length))
  const refinement = route.refinements?.[0]
  const mentionsMatch = [...items, ...(route.upcoming || [])]
    .some(item => item.key === 'capture_employer_match' || item.key === 'confirm_employer_match')

  return (
    <section className={`overflow-hidden rounded-[24px] border border-emerald-200/16 bg-[linear-gradient(145deg,rgba(18,41,31,.97),rgba(8,20,15,.99))] shadow-[0_18px_45px_rgba(0,0,0,.2)] ${compact ? 'p-4 sm:p-5' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.09] text-emerald-100"><ClipboardList className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/80">Your plan</p>
          <h2 className="mt-1.5 text-[20px] font-semibold leading-7 tracking-[-0.02em] text-white">
            Here is where your {formatMoney(route.availableMonthlyAmount)} a month goes
          </h2>
          {/* Keeps this figure from reading as a second, unexplained number
              next to Home's "Left over monthly" — every subtraction is shown. */}
          {!compact && route.reconciliation?.length > 1 && (
            <p className="mt-1 text-xs leading-5 text-readable-muted">
              {formatMoney(route.reconciliation[0].amount)} left over
              {route.reconciliation.slice(1).map(line => ` − ${formatMoney(Math.abs(line.amount))} ${line.label.toLowerCase()}`).join('')}
            </p>
          )}
        </div>
      </div>

      <ol className="mt-4 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.09] bg-black/[0.08] px-3.5">
        {items.slice(0, limit).map((item, index) => (
          <li key={item.key} className="flex gap-3 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-[11px] font-bold text-emerald-100">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold leading-5 text-white">{item.label}</p>
                {item.amount > 0 && <span className="shrink-0 text-[13px] font-semibold tabular-nums text-emerald-100">{formatMoney(item.amount)}</span>}
              </div>
              {takesLabel(item) && (
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200/70">{takesLabel(item)} at this rate</p>
              )}
              {!compact && <p className="mt-0.5 text-xs leading-5 text-readable-secondary">{item.reason}</p>}
            </div>
          </li>
        ))}

        {/* One priority can absorb the whole monthly surplus, so the funded
            list is often a single line. Showing what the same ladder reaches
            next is what makes this a plan rather than one suggestion. */}
        {upcoming.map((item, index) => (
          <li key={item.key} className="flex gap-3 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.14] text-[11px] font-bold text-readable-muted">{items.slice(0, limit).length + index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold leading-5 text-readable-secondary">{item.label}</p>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-readable-muted">Then</span>
              </div>
              {startsLabel(item) && (
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-readable-muted">{startsLabel(item)}</p>
              )}
              {!compact && <p className="mt-0.5 text-xs leading-5 text-readable-muted">{item.reason}</p>}
            </div>
          </li>
        ))}
      </ol>
      {items.length > limit && <p className="mt-2 text-xs text-readable-secondary">+{items.length - limit} more funded this month</p>}

      {/* Anything the user entered but the plan deliberately leaves alone —
          silence about a debt they typed in reads as lost data. */}
      {!compact && (route.notes || []).map(note => (
        <p key={note} className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs leading-5 text-readable-secondary">{note}</p>
      ))}

      <div className={`mt-4 flex ${compact ? 'items-center' : 'flex-col sm:flex-row'} gap-2`}>
        {onPrimary && <button type="button" onClick={onPrimary} disabled={busy} className="btn-primary min-h-11 flex-1 disabled:opacity-50">
          {busy ? 'Saving…' : primaryLabel} <ArrowRight className="h-4 w-4" />
        </button>}
        {!compact && onAdjust && route.allocations.some(item => item.adjustable) && <button type="button" onClick={onAdjust} disabled={busy} className="btn-ghost min-h-11 flex-1"><SlidersHorizontal className="h-4 w-4" /> Adjust amounts</button>}
      </div>

      {/* Optional detail that would sharpen an already-valid plan. Deliberately
          quiet and below the actions — it is not a warning. */}
      {!compact && refinement && onResolveBlocker && (
        <button type="button" onClick={() => onResolveBlocker(refinement)} disabled={busy}
          className="mt-3 min-h-9 w-full rounded-lg px-1 text-left text-xs leading-5 text-readable-muted hover:text-readable-secondary disabled:opacity-50">
          Optional: {refinement.title.replace(/^Add /, 'add ')} to sharpen this further.
        </button>
      )}

      {/* Explains the ranking, minus any rung that does not apply — a student
          with no employer should not be told about matching contributions. */}
      {!compact && (
        <p className="mt-3 text-center text-[11px] leading-4 text-readable-muted">
          Ordered by what earns you most: a cash cushion,{mentionsMatch ? ' free money from your employer,' : ''} expensive debt, then saving and investing.
        </p>
      )}
    </section>
  )
}
