import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ChevronRight, X } from 'lucide-react'

const fmt$ = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`

function timeline(months) {
  const m = Math.round(Number(months) || 0)
  if (!m) return null
  if (m < 18) return `about ${m} month${m === 1 ? '' : 's'}`
  return `about ${(m / 12).toFixed(m % 12 === 0 ? 0 : 1)} years`
}

export default function GoalSuggestionCard({ suggestion: s, onAdd, onDismiss }) {
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const type = s.goal_type === 'investment' ? 'Investment' : s.goal_type === 'purchase' ? 'Purchase' : 'Savings'
  const tl = timeline(s.timeline_months)

  async function handleAdd() {
    setBusy(true)
    try {
      const succeeded = await onAdd(s)
      if (succeeded !== false) setAdded(true)
    } catch {
      // The parent displays the actionable error; keep the card available to retry.
    } finally { setBusy(false) }
  }

  return (
    <section aria-label={`Suggested goal: ${s.name}`} className="rounded-2xl border border-emerald-400/20 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-emerald-200">Suggested goal</p>
          <h4 className="mt-1 text-[16px] font-semibold leading-6 text-white">{s.name}</h4>
        </div>
        {!added && onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss suggestion"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-readable-muted transition-colors hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[14px] tabular-nums text-readable-secondary">
        {type} · {fmt$(s.target_amount)}
        {s.monthly_contribution ? ` · ${fmt$(s.monthly_contribution)}/mo` : ''}
        {tl ? ` · ${tl}` : ''}
      </p>
      {s.rationale && <p className="mt-2 text-[14px] leading-5 text-readable-muted">{s.rationale}</p>}

      <div className="mt-3">
        {added ? (
          <Link to="/plan#goals" className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-emerald-200 transition-colors hover:text-emerald-100">
            Added to your goals and Plan <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={handleAdd} disabled={busy}
            className="btn-primary min-h-11 px-4 text-[14px] disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add to my goals and Plan
          </button>
        )}
      </div>
    </section>
  )
}
