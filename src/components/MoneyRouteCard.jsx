import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import { HORIZON_MONTHS, formatDuration, orderForPresentation } from '@/lib/moneyRoute'
import { maskMoneyText } from '@/lib/privacy'

const formatMoney = (value, hidden = false) => hidden ? 'Amount hidden' : `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`

// Labels are written as destinations ("Pay extra toward Visa Card") so they
// read cleanly in the plan list; strip the verb prefix when a bare name is
// what the sentence needs.
const bareName = label => label.replace(/^Pay extra toward |^Build the |^Grow |^Fund |^Increase investing in /, '')

// An ordered list says what comes first; a date says whether it is worth
// starting. "About" is load-bearing — see scheduleRungs for what these ignore.
// A duration on the funded rung is worth showing even when it is grim — it is
// how the user learns their surplus is too small. A start date that far out is
// not: it only says the plan begins somewhere past the horizon.
const takesLabel = item => formatDuration(item.etaMonths)
const startsLabel = item => {
  if (!item.startsInMonths || item.startsInMonths > HORIZON_MONTHS) return null
  return `Starts in ${formatDuration(item.startsInMonths)}`
}

const capitalize = text => text ? text.charAt(0).toUpperCase() + text.slice(1) : text

function planItems(route) {
  return orderForPresentation((route?.allocations || []).filter(item => (
    !['hold_for_coverage', 'unassigned'].includes(item.key) && (item.amount > 0 || !item.adjustable)
  )))
}

export function MoneyRouteSummary({ route }) {
  if (!route?.ready) return null
  // Where the money goes: funded destinations, named as nouns. A $0 setup
  // chore ("Put every minimum payment on autopay") is not a destination.
  const items = planItems(route)
  const funded = items.filter(item => item.amount > 0)
  const visible = (funded.length ? funded : items).slice(0, 3)
  if (!visible.length) return null
  return (
    <p aria-label="Where your money goes this month" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] leading-5 text-readable-secondary">
      <span className="font-semibold tabular-nums text-white">{formatMoney(route.availableMonthlyAmount)}/mo</span>
      {` → ${visible.map(item => item.destinationAccountName || item.destinationName || bareName(item.label)).join(' → ')}`}
    </p>
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
  onSecondary,
  secondaryLabel,
  onResolveBlocker,
  followUps = [],
  onAskFollowUp,
  busy = false,
  hideAmounts = false,
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
    <section className={`rounded-2xl border border-white/[0.09] bg-white/[0.045] ${compact ? 'p-4 sm:p-5' : 'p-5'}`}>
      <h2 className="text-[18px] font-semibold leading-6 tracking-[-0.015em] text-white">
        {/* "Here is where your $0 a month goes" answers a question nobody
            asked. When there is nothing to route, say so and point at the
            rung that changes it. */}
        {route.availableMonthlyAmount > 0
          ? `Where your ${formatMoney(route.availableMonthlyAmount, hideAmounts)} a month goes`
          : 'Nothing is left over yet. Start here.'}
      </h2>
      {/* Keeps this figure from reading as a second, unexplained number
          next to Home's "Left over monthly" — every subtraction is shown. */}
      {!compact && route.reconciliation?.length > 1 && (
        <p className="mt-1 text-xs leading-5 text-readable-muted">
          {formatMoney(route.reconciliation[0].amount)} left over
          {route.reconciliation.slice(1).map(line => ` − ${formatMoney(Math.abs(line.amount))} ${line.label.toLowerCase()}`).join('')}
        </p>
      )}

      <ol className="mt-3 divide-y divide-white/[0.07]">
        {items.slice(0, limit).map((item, index) => (
          <li key={item.key} className="flex gap-3 py-3">
            <span className="w-4 shrink-0 pt-px text-[13px] font-medium tabular-nums text-readable-muted">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-medium leading-5 text-white">{maskMoneyText(item.label, hideAmounts)}</p>
                {item.amount > 0 && <span className="shrink-0 text-[14px] font-semibold tabular-nums text-white">{formatMoney(item.amount, hideAmounts)}</span>}
              </div>
              {takesLabel(item) && <p className="mt-0.5 text-xs text-readable-muted">{capitalize(takesLabel(item))} at this rate</p>}
              {!compact && <p className="mt-1 text-xs leading-5 text-readable-secondary">{item.reason}</p>}
            </div>
          </li>
        ))}

        {/* One priority can absorb the whole monthly surplus, so the funded
            list is often a single line. Showing what the same ladder reaches
            next is what makes this a plan rather than one suggestion. */}
        {upcoming.map((item, index) => (
          <li key={item.key} className="flex gap-3 py-3">
            <span className="w-4 shrink-0 pt-px text-[13px] font-medium tabular-nums text-readable-muted">{items.slice(0, limit).length + index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] leading-5 text-readable-secondary">{maskMoneyText(item.label, hideAmounts)}</p>
                <span className="shrink-0 text-xs text-readable-muted">Then</span>
              </div>
              {startsLabel(item) && <p className="mt-0.5 text-xs text-readable-muted">{startsLabel(item)}</p>}
              {!compact && <p className="mt-1 text-xs leading-5 text-readable-muted">{item.reason}</p>}
            </div>
          </li>
        ))}
      </ol>
      {items.length > limit && <p className="mt-1 text-xs text-readable-secondary">+{items.length - limit} more funded this month</p>}

      {/* Anything the user entered but the plan deliberately leaves alone —
          silence about a debt they typed in reads as lost data. */}
      {!compact && (route.notes || []).map(note => (
        <p key={note} className="mt-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-readable-secondary">{note}</p>
      ))}

      {/* The plan is settled; these are the things it cannot know. A planner
          would not hand over a ladder and go quiet, so the questions worth
          asking about THIS plan sit right under it rather than waiting for the
          user to guess that the advisor has more to say. */}
      {!compact && followUps.length > 0 && onAskFollowUp && (
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <p className="section-label">Worth answering before you start</p>
          <ul className="mt-1 -mx-2">
            {followUps.map(item => (
              <li key={item.id}>
                {/* A question whose answer is one field does not deserve a trip
                    through the chat. Answering here writes the record and the
                    plan above recomputes; only the ones no column can hold open
                    the advisor. */}
                <button
                  type="button" disabled={busy} onClick={() => onAskFollowUp(item)}
                  className="w-full rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <span className="block text-[14px] font-medium leading-5 text-white">{item.question}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-readable-muted">{item.why}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`mt-4 flex ${compact ? 'items-center' : 'flex-col sm:flex-row'} gap-2`}>
        {onPrimary && <button type="button" onClick={onPrimary} disabled={busy} className="btn-primary min-h-11 flex-1 disabled:opacity-50">
          {busy ? 'Saving…' : primaryLabel} <ArrowRight className="h-4 w-4" />
        </button>}
        {!compact && onAdjust && route.allocations.some(item => item.adjustable) && <button type="button" onClick={onAdjust} disabled={busy} className="btn-ghost min-h-11 flex-1"><SlidersHorizontal className="h-4 w-4" /> Adjust amounts</button>}
        {/* Refining is worth offering, not worth requiring — the plan is valid
            before a single question is answered. */}
        {onSecondary && secondaryLabel && (
          <button type="button" onClick={onSecondary} disabled={busy} className="btn-ghost min-h-11 shrink-0 px-4">
            {secondaryLabel}
          </button>
        )}
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
        <p className="mt-3 text-xs leading-5 text-readable-muted">
          Ordered by what earns you most: a cash cushion,{mentionsMatch ? ' free money from your employer,' : ''} expensive debt, then saving and investing.
        </p>
      )}
    </section>
  )
}
