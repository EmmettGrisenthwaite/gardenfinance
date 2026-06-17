import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, X, CreditCard, Flame, Snowflake, Calculator, ChevronDown, ChevronUp, DollarSign, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import MilestoneToast from '@/components/MilestoneToast'

// ─── Payoff simulator ──────────────────────────────────────────────────────────
function simulatePayoff(debts, extraPayment, strategy) {
  if (!debts.length) return null
  const hasSomeMinimum = debts.some(d => Number(d.minimum_payment) > 0)
  if (!hasSomeMinimum && extraPayment === 0) return null

  const items = debts.map(d => ({
    name: d.name,
    balance: Number(d.balance),
    monthlyRate: Number(d.interest_rate) / 100 / 12,
    minPayment: Number(d.minimum_payment) || 0,
  }))

  const sorted =
    strategy === 'avalanche'
      ? [...items].sort((a, b) => b.monthlyRate - a.monthlyRate)
      : [...items].sort((a, b) => a.balance - b.balance)

  let months = 0
  let totalInterest = 0
  const MAX_MONTHS = 600
  const EPSILON = 0.01

  while (sorted.some(d => d.balance > EPSILON) && months < MAX_MONTHS) {
    months++
    for (const d of sorted) {
      if (d.balance > EPSILON) {
        const interest = d.balance * d.monthlyRate
        d.balance += interest
        totalInterest += interest
      }
    }
    for (const d of sorted) {
      if (d.balance > EPSILON) {
        const payment = Math.min(d.minPayment, d.balance)
        d.balance = Math.max(0, d.balance - payment)
      }
    }
    let extra = extraPayment
    for (const d of sorted) {
      if (d.balance > EPSILON && extra > 0) {
        const payment = Math.min(extra, d.balance)
        d.balance = Math.max(0, d.balance - payment)
        extra -= payment
        break
      }
    }
  }

  if (months >= MAX_MONTHS) return { months: null, totalInterest: null, capped: true }
  return { months, totalInterest: Math.round(totalInterest), capped: false }
}

function formatMonths(months) {
  if (!months) return '—'
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  if (yrs === 0) return `${mos} mo`
  if (mos === 0) return `${yrs} yr`
  return `${yrs} yr ${mos} mo`
}

// ─── Debt modal ────────────────────────────────────────────────────────────────
function DebtModal({ debt, onSave, onClose }) {
  const [name,         setName]         = useState(debt?.name ?? '')
  const [balance,      setBalance]      = useState(debt?.balance ?? '')
  const [interestRate, setInterestRate] = useState(debt?.interest_rate ?? '')
  const [minPayment,   setMinPayment]   = useState(debt?.minimum_payment ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      name,
      balance:         parseFloat(balance),
      interest_rate:   parseFloat(interestRate) || 0,
      minimum_payment: parseFloat(minPayment) || 0,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-[#0e1812] w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-semibold text-white">{debt ? 'Edit Debt' : 'Add Debt'}</h3>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/60 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Debt name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Student loan"
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Balance ($)</label>
                <input type="number" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} required min="0" step="0.01"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Interest rate (%)</label>
                <input type="number" inputMode="decimal" value={interestRate} onChange={e => setInterestRate(e.target.value)} min="0" max="100" step="0.01" placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Minimum monthly payment ($)</label>
              <input type="number" inputMode="decimal" value={minPayment} onChange={e => setMinPayment(e.target.value)} min="0" step="0.01" placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 border border-white/[0.08] rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Quick payment recorder ────────────────────────────────────────────────────
function PaymentRecorder({ debt, onRecord, onCancel }) {
  const [amount, setAmount] = useState('')
  const balance = Number(debt.balance)

  function handleSubmit(e) {
    e.preventDefault()
    const payment = parseFloat(amount)
    if (isNaN(payment) || payment <= 0) return
    onRecord(debt.id, Math.min(payment, balance))
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs font-medium text-white/50 mb-2">Record a payment toward this debt</div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
            <input
              autoFocus
              type="number" inputMode="decimal" min="0.01" max={balance} step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Max $${balance.toLocaleString()}`}
              className="pl-7 pr-3 py-2 w-44 border border-white/[0.08] rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
            />
          </div>
          {/* Shortcut: minimum payment */}
          {Number(debt.minimum_payment) > 0 && (
            <button type="button"
              onClick={() => setAmount(String(debt.minimum_payment))}
              className="text-xs text-sky-400 hover:text-sky-300 border border-sky-400/30 hover:border-blue-400 px-2.5 py-1.5 rounded-lg transition-colors">
              Min: ${Number(debt.minimum_payment).toLocaleString()}
            </button>
          )}
          <button type="submit"
            className="flex items-center gap-1.5 px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Check className="w-3.5 h-3.5" /> Record
          </button>
          <button type="button" onClick={onCancel}
            className="p-2 text-white/40 hover:text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-white/40 mt-2">
          This will reduce the remaining balance from ${balance.toLocaleString()}.
        </p>
      </form>
    </motion.div>
  )
}

// ─── Payoff calculator ─────────────────────────────────────────────────────────
function PayoffCalculator({ debts }) {
  const [strategy,    setStrategy]    = useState('avalanche')
  const [extraPay,    setExtraPay]    = useState(0)
  const [inputVal,    setInputVal]    = useState('0')
  const [showDetails, setShowDetails] = useState(false)

  // Dynamic slider max: at least $1000, or 3× the largest min payment, whichever is bigger
  const maxExtra = Math.max(1000, debts.reduce((m, d) => Math.max(m, Number(d.minimum_payment) * 3), 0))

  function handleSlider(e) {
    const v = Number(e.target.value)
    setExtraPay(v)
    setInputVal(String(v))
  }
  function handleInput(e) {
    setInputVal(e.target.value)
    const n = parseFloat(e.target.value)
    if (!isNaN(n) && n >= 0) setExtraPay(Math.min(n, maxExtra * 3)) // allow typing beyond slider
  }

  const avResult   = useMemo(() => simulatePayoff(debts, extraPay, 'avalanche'), [debts, extraPay])
  const snowResult = useMemo(() => simulatePayoff(debts, extraPay, 'snowball'),  [debts, extraPay])

  const activeResult = strategy === 'avalanche' ? avResult : snowResult

  const avalancheOrder = [...debts].sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate))
  const snowballOrder  = [...debts].sort((a, b) => Number(a.balance) - Number(b.balance))
  const strategyOrder  = strategy === 'avalanche' ? avalancheOrder : snowballOrder

  let interestSavings = null
  let monthSavings    = null
  if (avResult && snowResult && !avResult.capped && !snowResult.capped) {
    interestSavings = snowResult.totalInterest - avResult.totalInterest
    monthSavings    = snowResult.months - avResult.months
  }

  const noMinimums = debts.every(d => Number(d.minimum_payment) === 0)

  return (
    <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white/5/80 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-white/60" />
          <span className="text-sm font-semibold text-white">Payoff Calculator</span>
        </div>
        <button onClick={() => setShowDetails(v => !v)}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors">
          {showDetails ? <><ChevronUp className="w-3 h-3" /> Hide order</> : <><ChevronDown className="w-3 h-3" /> Show order</>}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Strategy toggle */}
        <div className="flex gap-2">
          <button onClick={() => setStrategy('avalanche')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              strategy === 'avalanche' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white/10 text-white/50 hover:bg-white/15'
            }`}>
            <Flame className="w-4 h-4" /> Avalanche
          </button>
          <button onClick={() => setStrategy('snowball')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              strategy === 'snowball' ? 'bg-blue-500 text-white shadow-sm' : 'bg-white/10 text-white/50 hover:bg-white/15'
            }`}>
            <Snowflake className="w-4 h-4" /> Snowball
          </button>
        </div>

        <p className="text-xs text-white/50">
          {strategy === 'avalanche'
            ? 'Pay minimums on all debts, then attack the highest-interest debt first. Saves the most money.'
            : 'Pay minimums on all debts, then attack the smallest balance first. Best for motivation.'}
        </p>

        {/* Extra payment — slider + free-form input combo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-white/60">Extra monthly payment</label>
            <div className="flex items-center gap-1">
              <span className="text-white/40 text-sm">$</span>
              <input
                type="number" inputMode="decimal" min="0" step="25"
                value={inputVal}
                onChange={handleInput}
                onBlur={() => setInputVal(String(extraPay))}
                className="w-20 text-right text-sm font-bold text-emerald-300 border border-white/[0.08] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <span className="text-sm font-bold text-emerald-300">/mo</span>
            </div>
          </div>
          <input
            type="range" min="0" max={maxExtra} step="25"
            value={Math.min(extraPay, maxExtra)}
            onChange={handleSlider}
            className="w-full h-2 bg-white/15 rounded-full appearance-none cursor-pointer accent-green-500"
          />
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>$0</span>
            <span>${Math.round(maxExtra / 2).toLocaleString()}</span>
            <span>${maxExtra.toLocaleString()}</span>
          </div>
        </div>

        {noMinimums && extraPay === 0 && (
          <div className="text-xs text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-lg px-3 py-2">
            Add minimum payments to your debts (or set an extra payment above) to see your payoff timeline.
          </div>
        )}

        {activeResult && !activeResult.capped && (
          <AnimatePresence mode="wait">
            <motion.div key={strategy}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-4 text-center ${strategy === 'avalanche' ? 'bg-amber-500/15' : 'bg-sky-500/15'}`}>
                <div className={`text-2xl font-black ${strategy === 'avalanche' ? 'text-amber-300' : 'text-sky-300'}`}>
                  {formatMonths(activeResult.months)}
                </div>
                <div className="text-xs text-white/50 mt-0.5">until debt-free</div>
              </div>
              <div className={`rounded-xl p-4 text-center ${strategy === 'avalanche' ? 'bg-amber-500/15' : 'bg-sky-500/15'}`}>
                <div className={`text-2xl font-black ${strategy === 'avalanche' ? 'text-amber-300' : 'text-sky-300'}`}>
                  ${activeResult.totalInterest.toLocaleString()}
                </div>
                <div className="text-xs text-white/50 mt-0.5">total interest paid</div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {activeResult?.capped && (
          <div className="text-xs text-rose-400 bg-rose-500/15 border border-rose-400/20 rounded-lg px-3 py-2 text-center">
            Payments are too low to pay off this debt. Increase your monthly payment.
          </div>
        )}

        {interestSavings !== null && (
          <div className="text-xs text-center">
            {interestSavings > 0 ? (
              <span className="text-emerald-300 font-medium">
                Avalanche saves ${interestSavings.toLocaleString()} in interest
                {monthSavings > 0 && ` and ${formatMonths(monthSavings)} faster`} vs Snowball
              </span>
            ) : interestSavings < 0 ? (
              <span className="text-sky-300 font-medium">
                Snowball saves ${Math.abs(interestSavings).toLocaleString()} in interest vs Avalanche
              </span>
            ) : (
              <span className="text-white/50">Both strategies yield the same result for your debts</span>
            )}
          </div>
        )}

        <AnimatePresence>
          {showDetails && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-white/10 pt-3 space-y-1.5">
                <p className="text-xs font-medium text-white/50 mb-2">
                  {strategy === 'avalanche' ? 'Attack order (highest APR first):' : 'Attack order (smallest balance first):'}
                </p>
                {strategyOrder.map((debt, i) => (
                  <div key={debt.id} className="flex items-center gap-2.5 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                      strategy === 'avalanche' ? 'bg-amber-400' : 'bg-blue-400'
                    }`}>{i + 1}</span>
                    <span className="font-medium text-white flex-1 min-w-0 truncate">{debt.name}</span>
                    <span className="text-white/40 text-xs flex-shrink-0">
                      ${Number(debt.balance).toLocaleString()}
                      {Number(debt.interest_rate) > 0 && ` · ${Number(debt.interest_rate).toFixed(1)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Debt() {
  const { user } = useAuth()
  const [debts,          setDebts]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [modal,          setModal]          = useState(null)
  const [recordingFor,   setRecordingFor]   = useState(null) // debt id showing payment recorder
  const [clearedMilestone, setClearedMilestone] = useState(null) // { key, debtName }

  useEffect(() => { load() }, [user.id])

  async function load() {
    const { data } = await supabase.from('debts').select('*').eq('user_id', user.id).order('created_at')
    setDebts(data ?? [])
    setLoading(false)
  }

  async function handleSave(data) {
    if (modal && modal !== 'new') {
      await supabase.from('debts').update(data).eq('id', modal.id)
    } else {
      await supabase.from('debts').insert({ ...data, user_id: user.id })
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('debts').delete().eq('id', id)
    setDebts(prev => prev.filter(d => d.id !== id))
  }

  async function handleRecordPayment(debtId, amount) {
    const debt = debts.find(d => d.id === debtId)
    if (!debt) return
    const newBalance = Math.max(0, Number(debt.balance) - amount)
    await supabase.from('debts').update({ balance: newBalance }).eq('id', debtId)
    setDebts(prev => prev.map(d => d.id === debtId ? { ...d, balance: newBalance } : d))
    setRecordingFor(null)

    // Celebrate if debt is fully paid off
    if (newBalance === 0) {
      setClearedMilestone({ key: `debt_cleared_${debtId}`, debtName: debt.name })
      // Mark in localStorage so Dashboard doesn't re-show it
      try {
        const storageKey = `milestones-seen-${user.id}`
        const seen = new Set(JSON.parse(localStorage.getItem(storageKey)) ?? [])
        seen.add(`debt_cleared_${debtId}`)
        localStorage.setItem(storageKey, JSON.stringify([...seen]))
      } catch {}
    }
  }

  const totalDebt       = debts.reduce((s, d) => s + Number(d.balance), 0)
  const totalMinPayment = debts.reduce((s, d) => s + Number(d.minimum_payment), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      {/* Debt-cleared celebration */}
      {clearedMilestone && (
        <MilestoneToast
          milestoneKey={clearedMilestone.key}
          debts={[{ id: clearedMilestone.key.replace('debt_cleared_', ''), name: clearedMilestone.debtName }]}
          onDismiss={() => setClearedMilestone(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Debt</h1>
          <p className="text-white/60 mt-1 text-sm">Track and strategize your payoff plan</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Debt
        </button>
      </div>

      {/* Summary */}
      {!loading && debts.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] shadow-sm p-4">
            <div className="text-xs text-rose-400 font-semibold mb-1">Total Debt</div>
            <div className="text-2xl font-bold text-rose-300">${totalDebt.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] shadow-sm p-4">
            <div className="text-xs text-amber-300 font-semibold mb-1">Min. Monthly Payments</div>
            <div className="text-2xl font-bold text-amber-300">
              {totalMinPayment > 0 ? `$${totalMinPayment.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Payoff calculator */}
      {!loading && debts.length > 0 && (
        <PayoffCalculator debts={debts} />
      )}

      {/* Debt list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/[0.05] rounded-xl animate-pulse" />)}
        </div>
      ) : debts.length === 0 ? (
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-10 text-center">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-white font-semibold text-sm mb-1">No debts tracked</p>
          <p className="text-white/40 text-xs max-w-xs mx-auto">
            Debt-free or just getting started — add any loans or cards to plan your payoff strategy.
          </p>
          <button onClick={() => setModal('new')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add a debt
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map(debt => {
            const isHighInterest = Number(debt.interest_rate) >= 15
            const isPaidOff      = Number(debt.balance) === 0
            const isRecording    = recordingFor === debt.id

            return (
              <div key={debt.id}
                className={`bg-white/[0.055] rounded-xl border shadow-lg p-5 transition-all ${
                  isPaidOff ? 'border-emerald-400/30 bg-emerald-500/15/80' : 'border-white/[0.08]'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isPaidOff ? 'bg-emerald-500/20' : isHighInterest ? 'bg-rose-500/20' : 'bg-rose-500/15'
                    }`}>
                      {isPaidOff
                        ? <span className="text-lg">✅</span>
                        : <CreditCard className={`w-4 h-4 ${isHighInterest ? 'text-rose-400' : 'text-red-400'}`} />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className={`font-semibold truncate ${isPaidOff ? 'text-emerald-300 line-through' : 'text-white'}`}>
                          {debt.name}
                        </h3>
                        {isHighInterest && !isPaidOff && (
                          <span className="text-xs font-bold text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            High APR
                          </span>
                        )}
                        {isPaidOff && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full">
                            Paid off!
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        {Number(debt.interest_rate) > 0 ? `${Number(debt.interest_rate).toFixed(1)}% APR` : 'No interest'}
                        {Number(debt.minimum_payment) > 0 && ` · $${Number(debt.minimum_payment).toLocaleString()} min/mo`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-lg font-bold ${isPaidOff ? 'text-emerald-300' : 'text-white'}`}>
                      ${Number(debt.balance).toLocaleString()}
                    </span>
                    <button onClick={() => setModal(debt)}
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(debt.id)}
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/15 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Record payment button / inline recorder */}
                {!isPaidOff && (
                  <div className="mt-3">
                    <AnimatePresence mode="wait">
                      {isRecording ? (
                        <PaymentRecorder
                          key="recorder"
                          debt={debt}
                          onRecord={handleRecordPayment}
                          onCancel={() => setRecordingFor(null)}
                        />
                      ) : (
                        <motion.button
                          key="btn"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setRecordingFor(debt.id)}
                          className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          <DollarSign className="w-3 h-3" /> Record payment
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <DebtModal debt={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </motion.div>
  )
}
