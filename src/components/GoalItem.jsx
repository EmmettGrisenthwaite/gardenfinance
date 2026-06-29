import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Trash2, X, Check, CalendarClock, TrendingUp, Sprout, Plus, Wallet } from 'lucide-react'

const LIQUID_TYPES = ['checking', 'savings', 'emergency', 'money_market']

// ─── Timeline projection ───────────────────────────────────────────────────────
// Investment goals compound (~6%/yr) so long horizons stay realistic.
export function getProjection(goal) {
  const target  = Number(goal.target_amount)
  const current = Number(goal.current_amount)
  const monthly = Number(goal.monthly_contribution)
  if (target - current <= 0) return { done: true }
  if (!monthly || monthly <= 0) return null

  let monthsLeft
  if (goal.goal_type === 'investment') {
    const i = 0.06 / 12
    let bal = current, n = 0
    while (bal < target && n < 1200) { bal = bal * (1 + i) + monthly; n++ }
    monthsLeft = n
  } else {
    monthsLeft = Math.ceil((target - current) / monthly)
  }

  if (monthsLeft >= 1200) return { longTerm: true }
  const date = new Date()
  date.setMonth(date.getMonth() + monthsLeft)
  const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { monthsLeft, label }
}

// ─── Goal create/edit modal ─────────────────────────────────────────────────────
export function GoalModal({ goal, onSave, onClose }) {
  const [name,         setName]         = useState(goal?.name ?? '')
  const [target,       setTarget]       = useState(goal?.target_amount ?? '')
  const [current,      setCurrent]      = useState(goal?.current_amount ?? 0)
  const [deadline,     setDeadline]     = useState(goal?.deadline ?? '')
  const [contribution, setContribution] = useState(goal?.monthly_contribution ?? '')
  const [goalType,     setGoalType]     = useState(goal?.goal_type ?? 'savings')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      name,
      goal_type:            goalType,
      target_amount:        parseFloat(target) || 0,
      current_amount:       parseFloat(current) || 0,
      deadline:             deadline || null,
      monthly_contribution: contribution !== '' ? (parseFloat(contribution) || 0) : 0,
    })
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border border-white/[0.11] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30'
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-[#0e1812] w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-semibold text-white">{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/60 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[75vh] sm:max-h-none">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Goal type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setGoalType('savings')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    goalType === 'savings'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/[0.11] bg-[#0e1812] text-white/60 hover:border-white/10'
                  }`}>
                  <Sprout className="w-4 h-4" /><span>Savings / Purchase</span>
                </button>
                <button type="button" onClick={() => setGoalType('investment')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    goalType === 'investment'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                      : 'border-white/[0.11] bg-[#0e1812] text-white/60 hover:border-white/10'
                  }`}>
                  <TrendingUp className="w-4 h-4" /><span>Investment / Wealth</span>
                </button>
              </div>
              <p className="mt-1.5 text-xs text-white/40">
                {goalType === 'investment'
                  ? 'Grows a golden tree in the investment zone as your wealth builds'
                  : 'Grows a green tree in your garden as you save toward it'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Goal name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Emergency fund" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Target ($)</label>
                <input type="number" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} required min="1" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Saved so far ($)</label>
                <input type="number" inputMode="decimal" value={current} onChange={e => setCurrent(e.target.value)} min="0" step="0.01" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">
                Monthly contribution ($)
                <span className="ml-1 font-normal text-white/40">— enables timeline projection</span>
              </label>
              <input type="number" inputMode="decimal" value={contribution} onChange={e => setContribution(e.target.value)}
                min="0" step="0.01" placeholder="0" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Target date (optional)</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 border border-white/[0.11] rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
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

// ─── Inline progress updater (contribute from an account, or adjust manually) ───
function ProgressInput({ goal, accounts = [], onContribute, onUpdate }) {
  const [mode,   setMode]   = useState(null)   // null | 'add' | 'adjust'
  const [amount, setAmount] = useState('')
  const [absVal, setAbsVal] = useState(goal.current_amount)
  const isInv = goal.goal_type === 'investment'

  // Default the source to the largest liquid account, else the largest of any.
  const defaultAcct = useMemo(() => {
    if (!accounts.length) return ''
    const liquid = accounts.filter(a => LIQUID_TYPES.includes(a.type))
    const pool = liquid.length ? liquid : accounts
    return [...pool].sort((a, b) => Number(b.balance) - Number(a.balance))[0].id
  }, [accounts])
  const [account, setAccount] = useState(defaultAcct)

  const pct  = Math.min(Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100), 100)
  const srcAcct = accounts.find(a => a.id === account)

  function addMoney() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return
    onContribute(goal.id, amt, account || null)
    setAmount(''); setMode(null)
  }
  function saveAbs() { onUpdate(goal.id, parseFloat(absVal) || 0); setMode(null) }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/50 tabular-nums">
          ${Number(goal.current_amount).toLocaleString()} of ${Number(goal.target_amount).toLocaleString()}
        </span>
        <span className={`text-xs font-semibold ${isInv ? 'text-amber-300' : 'text-emerald-300'}`}>{pct}%</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-500 ${isInv ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 'bg-gradient-to-r from-emerald-400 to-emerald-300'}`}
          style={{ width: `${pct}%` }} />
      </div>

      {mode === 'add' ? (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
              <input autoFocus type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
                min="0" step="0.01" placeholder="Amount to add"
                onKeyDown={e => e.key === 'Enter' && addMoney()}
                className="w-full pl-6 pr-2.5 py-2 rounded-lg border border-white/[0.11] bg-white/[0.085] text-white text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>
            <button onClick={addMoney} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setMode(null)} className="p-2 text-white/40 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
          {accounts.length > 0 && (
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              <select value={account} onChange={e => setAccount(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-white/[0.11] bg-[#0e1812] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30">
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} — ${Number(a.balance).toLocaleString()}</option>
                ))}
              </select>
            </div>
          )}
          <p className="text-[11px] text-white/40">
            {srcAcct ? `Moves money out of ${srcAcct.name} into this goal.` : 'No account selected — tracked here only.'}
          </p>
        </div>
      ) : mode === 'adjust' ? (
        <div className="flex gap-2 items-center">
          <input autoFocus type="number" inputMode="decimal" value={absVal} onChange={e => setAbsVal(e.target.value)}
            min="0" step="0.01"
            className="flex-1 px-2.5 py-2 rounded-lg border border-white/[0.11] bg-white/[0.085] text-white text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
          <button onClick={saveAbs} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setMode(null)} className="p-2 text-white/40 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button onClick={() => { setAccount(defaultAcct); setMode('add') }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus className="w-3 h-3" /> Add money
          </button>
          <button onClick={() => { setAbsVal(goal.current_amount); setMode('adjust') }}
            className="text-xs text-white/45 hover:text-white/70 font-medium py-1">
            Adjust
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Timeline badge ────────────────────────────────────────────────────────────
function TimelineBadge({ goal }) {
  const proj = getProjection(goal)
  if (!proj) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg border border-dashed border-white/[0.11]">
        <CalendarClock className="w-3 h-3 text-white/30" />
        <span className="text-xs text-white/40">Set a monthly contribution to see your timeline</span>
      </div>
    )
  }
  if (proj.done) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 rounded-lg border border-emerald-400/30">
        <Check className="w-3 h-3 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-300">Goal reached</span>
      </div>
    )
  }
  if (proj.longTerm) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/15 rounded-lg border border-sky-400/30">
        <CalendarClock className="w-3 h-3 text-sky-400" />
        <span className="text-xs font-medium text-sky-300">Long-term — grows with your contributions</span>
      </div>
    )
  }
  const urgency = proj.monthsLeft <= 3  ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                : proj.monthsLeft <= 12 ? 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                :                         'bg-white/5 border-white/[0.11] text-white/60'
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${urgency}`}>
      <CalendarClock className="w-3 h-3" />
      <span className="text-xs font-medium">
        On pace for {proj.label}
        <span className="font-normal opacity-70 ml-1">({proj.monthsLeft} mo)</span>
      </span>
    </div>
  )
}

// ─── Editable goal card ─────────────────────────────────────────────────────────
export function GoalItem({ goal, accounts, onEdit, onDelete, onUpdateProgress, onContribute }) {
  const isInv = goal.goal_type === 'investment'
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.075] rounded-xl border border-white/[0.11] p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="font-semibold text-white break-words">{goal.name}</h3>
            {isInv ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded-full text-xs font-medium border border-amber-400/30">
                <TrendingUp className="w-3 h-3" /> Investment
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-300 rounded-full text-xs font-medium border border-emerald-400/30">
                <Sprout className="w-3 h-3" /> Savings
              </span>
            )}
          </div>
          {goal.deadline && (
            <p className="text-xs text-white/40 mt-0.5">
              Target date: {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(goal)} aria-label="Edit goal"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(goal.id)} aria-label="Delete goal"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/15 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <ProgressInput goal={goal} accounts={accounts} onContribute={onContribute} onUpdate={onUpdateProgress} />
      <TimelineBadge goal={goal} />
    </motion.div>
  )
}
