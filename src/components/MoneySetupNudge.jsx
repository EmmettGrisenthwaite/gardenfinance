import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, X, ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getDataGaps } from '@/lib/dataGaps'

// A single quiet "money picture" row on the garden — the app-entry prompt to
// fill out the Money tab, tuned to never overwhelm:
//   · ONE missing piece at a time (the most valuable), never a checklist wall
//   · a small progress meter so filling it feels like completing, not chores
//   · tap → lands inside the exact Money bottom sheet that resolves it
//   · ✕ snoozes it for 3 days; it retires forever once the picture is complete
//   · pieces are derived live from data, so it advances the moment a field is
//     saved — no bookkeeping, no re-asking for what's already there
const SNOOZE_DAYS = 3

// Which of the money gaps count toward "the picture" (advisor-polish gaps like
// a missing APY stay out of the entry prompt — that's detail, not setup).
const PIECES = [
  { id: 'income',   label: 'Income' },
  { id: 'expenses', label: 'Spending' },
  { id: 'balances', label: 'Balances' },      // synthesized below — no accounts at all
  { id: 'debts',    label: 'Debt details' },  // covers debt_rate + debt_minimum
  { id: 'invest',   label: 'Investments' },   // only if they said they invest
]

export default function MoneySetupNudge({ profile, accounts, debts, goals }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const SNOOZE_KEY    = `money-nudge-snooze-${user.id}`
  const CELEBRATE_KEY = `money-nudge-celebrated-${user.id}`
  const SEEN_KEY      = `money-nudge-seen-${user.id}`

  // Income/expenses may live in detailed cash-flow items rather than the
  // profile lump sums — the dashboard doesn't load those, so fetch them here.
  const [flowItems, setFlowItems] = useState(null)   // null = still loading
  useEffect(() => {
    supabase.from('cash_flow_items').select('kind, amount, monthly_amount, frequency').eq('user_id', user.id)
      .then(({ data, error }) => setFlowItems(error ? [] : (data ?? [])))
  }, [user.id])

  const [snoozedAt, setSnoozedAt] = useState(() => Number(localStorage.getItem(SNOOZE_KEY)) || 0)
  const [celebrated, setCelebrated] = useState(() => localStorage.getItem(CELEBRATE_KEY) === '1')

  const state = useMemo(() => {
    if (flowItems === null) return null   // don't flash before we know
    const gaps = getDataGaps({ profile, accounts, debts, goals, cashFlowItems: flowItems })
    const byId = Object.fromEntries(gaps.map(g => [g.id, g]))

    const investTypes = Array.isArray(profile?.investment_types) ? profile.investment_types : []
    const claimsInvesting = investTypes.length > 0 && !investTypes.includes('none')

    // Which pieces apply to THIS user, and which are still missing.
    const applicable = PIECES.filter(p =>
      p.id === 'debts'  ? debts.length > 0 :
      p.id === 'invest' ? claimsInvesting :
      true)
    const missing = applicable.map(p => {
      if (p.id === 'income')   return byId.income   ? { ...byId.income } : null
      if (p.id === 'expenses') return byId.expenses ? { ...byId.expenses } : null
      if (p.id === 'balances') return accounts.length === 0
        ? { id: 'balances', label: "Add what's in checking & savings", cta: 'Add balances', sheet: 'cash' }
        : null
      if (p.id === 'debts')    return byId.debt_rate ?? byId.debt_minimum ?? null
      if (p.id === 'invest')   return byId.invest_amount ? { ...byId.invest_amount } : null
      return null
    }).filter(Boolean)

    return { total: applicable.length, done: applicable.length - missing.length, next: missing[0] ?? null }
  }, [flowItems, profile, accounts, debts, goals])

  if (!state) return null

  // ── Complete: one quiet celebration, then this component retires forever ──
  if (!state.next) {
    const wasEverShown = localStorage.getItem(SEEN_KEY) === '1'
    if (!wasEverShown || celebrated) return null
    return (
      <button
        onClick={() => { localStorage.setItem(CELEBRATE_KEY, '1'); setCelebrated(true) }}
        className="w-full flex items-center gap-2.5 px-3 py-2 bg-emerald-500/[0.12] rounded-xl border border-emerald-400/25 text-left">
        <Sparkles className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-xs font-semibold text-white leading-snug">
          Money picture complete — your advisor now sees the full you.
        </span>
        <X className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
      </button>
    )
  }

  // ── Incomplete: prompted, never forced ──
  const snoozed = snoozedAt && (Date.now() - snoozedAt) < SNOOZE_DAYS * 86400000
  if (snoozed) return null
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }

  function open() {
    navigate('/money', { state: { sheet: state.next.sheet } })
  }
  function snooze(e) {
    e.stopPropagation()
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())) } catch { /* private mode */ }
    setSnoozedAt(Date.now())
  }

  return (
    <button onClick={open}
      className="w-full px-3 py-2 bg-white/[0.075] rounded-xl border border-white/[0.11] hover:bg-white/[0.11] transition-colors text-left">
      <div className="flex items-center gap-2.5">
        <Wallet className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-white/55 whitespace-nowrap">Your money picture</span>
        <span className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <span className="block h-full rounded-full bg-emerald-400/80 transition-all duration-500"
            style={{ width: `${Math.round((state.done / state.total) * 100)}%` }} />
        </span>
        <span className="text-[10px] font-bold tabular-nums text-emerald-200/85 whitespace-nowrap">
          {state.done} of {state.total}
        </span>
        <span onClick={snooze} role="button" aria-label="Hide for a few days"
          className="p-1.5 -m-1 text-white/30 hover:text-white/60 flex-shrink-0"><X className="w-3.5 h-3.5" /></span>
      </div>
      <div className="flex items-center gap-2 mt-1 pl-[26px]">
        <span className="flex-1 min-w-0 text-xs font-semibold text-white leading-snug truncate">{state.next.label}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 whitespace-nowrap flex-shrink-0">
          {state.next.cta} <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  )
}
