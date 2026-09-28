import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, X } from 'lucide-react'
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
      }} aria-label="Dismiss" className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-2.5 text-left">
        <span className="min-w-0 flex-1 text-[14px] leading-5 text-emerald-50">Your money picture is complete. The advisor now works from all of it.</span>
        <X className="h-4 w-4 shrink-0 text-readable-muted" />
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
      <button type="button" onClick={open} className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-left transition-colors ${fresh ? 'border-emerald-400/25 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]' : 'border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.07]'}`}>
        <span className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[13px] text-readable-muted">Your money picture</span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${Math.round(state.done / state.total * 100)}%` }} /></span>
          <span className="whitespace-nowrap text-[13px] tabular-nums text-readable-secondary">{state.done} of {state.total}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{state.next.label}</span><span className="inline-flex shrink-0 items-center gap-0.5 text-[14px] font-semibold text-emerald-200">{state.next.cta}<ChevronRight className="h-4 w-4" /></span></span>
      </button>
      <button type="button" onClick={snooze} aria-label="Hide for three days" className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl text-readable-muted hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"><X className="h-4 w-4" /></button>
    </motion.div>
  )
}
