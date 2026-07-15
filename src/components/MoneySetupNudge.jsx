import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Wallet, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getMoneySetupState } from '@/lib/moneySetup'

const SNOOZE_DAYS = 3

function storedNumber(key) {
  try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 }
}

function storedFlag(key) {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

export default function MoneySetupNudge({ profile, accounts, debts, goals = [], cashFlowItems = null, onOpenGap }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const snoozeKey = `money-nudge-snooze-${user.id}`
  const celebrateKey = `money-nudge-celebrated-${user.id}`
  const seenKey = `money-nudge-seen-${user.id}`
  const [fetchedFlowItems, setFetchedFlowItems] = useState(null)
  const [snoozedAt, setSnoozedAt] = useState(() => storedNumber(snoozeKey))
  const [celebrated, setCelebrated] = useState(() => storedFlag(celebrateKey))
  const [fresh] = useState(() => {
    try {
      const key = `money-nudge-fresh-${user.id}`
      const isFresh = sessionStorage.getItem(key) === '1'
      if (isFresh) sessionStorage.removeItem(key)
      return isFresh
    } catch { return false }
  })

  useEffect(() => {
    if (cashFlowItems !== null) return undefined
    supabase.from('cash_flow_items').select('kind, amount, monthly_amount, frequency').eq('user_id', user.id)
      .then(({ data, error }) => setFetchedFlowItems(error ? [] : (data ?? [])))
    return undefined
  }, [cashFlowItems, user.id])

  const flowItems = cashFlowItems ?? fetchedFlowItems
  const state = useMemo(() => flowItems === null ? null : getMoneySetupState({
    profile, accounts, debts, goals, cashFlowItems: flowItems,
  }), [flowItems, profile, accounts, debts, goals])

  if (!state) return null
  if (!state.next) {
    let wasEverShown = false
    try { wasEverShown = localStorage.getItem(seenKey) === '1' } catch { /* private mode */ }
    if (!wasEverShown || celebrated) return null
    return (
      <button type="button" onClick={() => {
        try { localStorage.setItem(celebrateKey, '1') } catch { /* private mode */ }
        setCelebrated(true)
      }} className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.12] px-3 py-2 text-left">
        <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" />
        <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-white">Money picture complete - your advisor now sees the full you.</span>
        <X className="h-3.5 w-3.5 shrink-0 text-readable-muted" />
      </button>
    )
  }

  if (snoozedAt && Date.now() - snoozedAt < SNOOZE_DAYS * 86400000) return null
  try { localStorage.setItem(seenKey, '1') } catch { /* private mode */ }

  function open() {
    if (onOpenGap) onOpenGap(state.next.sheet)
    else navigate(`/?sheet=${encodeURIComponent(state.next.sheet)}`)
  }

  function snooze() {
    try { localStorage.setItem(snoozeKey, String(Date.now())) } catch { /* private mode */ }
    setSnoozedAt(Date.now())
  }

  return (
    <motion.div className="relative flex gap-1.5" initial={fresh ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: fresh ? 0.25 : 0 }}>
      <button type="button" onClick={open} className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${fresh ? 'border-emerald-400/30 bg-emerald-500/[0.12] hover:bg-emerald-500/[0.18]' : 'border-white/[0.11] bg-white/[0.075] hover:bg-white/[0.11]'}`}>
        <span className="flex items-center gap-2.5">
          <Wallet className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="whitespace-nowrap text-[11px] font-semibold text-readable-secondary">{fresh ? 'Nice work - your money picture' : 'Your money picture'}</span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-400/80" style={{ width: `${Math.round(state.done / state.total * 100)}%` }} /></span>
          <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-emerald-100">{state.done} of {state.total}</span>
        </span>
        <span className="mt-1 flex items-center gap-2 pl-[26px]"><span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{state.next.label}</span><span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-300">{state.next.cta}<ArrowRight className="h-3 w-3" /></span></span>
      </button>
      <button type="button" onClick={snooze} aria-label="Hide for three days" className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl text-readable-muted hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"><X className="h-4 w-4" /></button>
    </motion.div>
  )
}
