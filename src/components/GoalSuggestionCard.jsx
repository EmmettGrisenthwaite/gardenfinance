import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Check, Plus, Loader2, ArrowRight, X, TrendingUp, Sprout } from 'lucide-react'

const fmt$ = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`

// Pick a friendly emoji from the goal name.
function goalEmoji(name = '') {
  const n = name.toLowerCase()
  const has = (...k) => k.some(w => n.includes(w))
  if (has('house', 'home', 'down payment', 'mortgage', 'apartment', 'condo')) return '🏡'
  if (has('car', 'vehicle', 'truck', 'tesla'))                                return '🚗'
  if (has('trip', 'travel', 'vacation', 'japan', 'europe', 'flight', 'holiday')) return '✈️'
  if (has('wedding', 'ring', 'engage'))                                       return '💍'
  if (has('emergency', 'rainy', 'safety'))                                    return '🛟'
  if (has('baby', 'child', 'kid'))                                            return '👶'
  if (has('school', 'college', 'tuition', 'education'))                       return '🎓'
  if (has('retire', 'roth', 'ira', '401'))                                    return '🏦'
  if (has('invest', 'brokerage', 'stock', 'wealth'))                          return '📈'
  if (has('business', 'startup'))                                            return '💼'
  return '🎯'
}

function timeline(months) {
  const m = Math.round(Number(months) || 0)
  if (!m) return null
  if (m < 18)  return `~${m} months`
  return `~${(m / 12).toFixed(m % 12 === 0 ? 0 : 1)} years`
}

export default function GoalSuggestionCard({ suggestion: s, onAdd, onDismiss }) {
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const isInv = s.goal_type === 'investment'
  const tl = timeline(s.timeline_months)

  async function handleAdd() {
    setBusy(true)
    try { await onAdd(s); setAdded(true) } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-emerald-500/10">
        <Sparkles className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-emerald-200 flex-1">Add this to your plan?</span>
        {!added && onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className="p-0.5 -mr-1 text-white/35 hover:text-white/70 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
            {goalEmoji(s.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-white">{s.name}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isInv ? 'bg-amber-400/15 border-amber-400/30 text-amber-200'
                      : 'bg-emerald-400/15 border-emerald-400/30 text-emerald-200'}`}>
                {isInv ? <TrendingUp className="w-3 h-3" /> : <Sprout className="w-3 h-3" />}
                {isInv ? 'Investment' : 'Savings'}
              </span>
            </div>
            <div className="text-xs text-white/60 mt-0.5 tabular-nums">
              {fmt$(s.target_amount)} target
              {s.monthly_contribution ? ` · ${fmt$(s.monthly_contribution)}/mo` : ''}
              {tl ? ` · ${tl}` : ''}
            </div>
          </div>
        </div>
        {s.rationale && <p className="text-xs text-white/55 leading-snug">{s.rationale}</p>}
      </div>

      <div className="px-4 py-3 border-t border-white/10">
        {added ? (
          <Link to="/plan" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
            <Check className="w-3.5 h-3.5" /> Added to your goals &amp; plan · view <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button onClick={handleAdd} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-60">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add to my goals &amp; plan
          </button>
        )}
      </div>
    </div>
  )
}
