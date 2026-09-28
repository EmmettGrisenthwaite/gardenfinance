import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Trash2, X, Check, TrendingUp, Sprout, Plus, Loader2, ShoppingBag } from 'lucide-react'
import HowToInline from '@/components/HowToInline'
import BottomSheet from '@/components/ui/BottomSheet'
import { THRESHOLDS } from '@/lib/finance'

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
    const i = THRESHOLDS.investReturn / 12
    let bal = current, n = 0
    while (bal < target && n < 1200) { bal = bal * (1 + i) + monthly; n++ }
    monthsLeft = n
  } else {
    monthsLeft = Math.ceil((target - current) / monthly)
  }

  const longTerm = monthsLeft >= 1200
  const date = new Date()
  date.setMonth(date.getMonth() + Math.min(monthsLeft, 1200))
  const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const deadline = goal.deadline ? new Date(`${goal.deadline}T00:00:00`) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineValid = deadline && !Number.isNaN(deadline.getTime())
  const deadlineLabel = deadlineValid
    ? deadline.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null
  const deadlinePassed = Boolean(deadlineValid && deadline < today)
  const onTime = deadlineValid ? !deadlinePassed && date <= deadline : null
  return { monthsLeft, label, deadlineLabel, deadlinePassed, onTime, longTerm }
}

// ─── Goal create/edit modal ─────────────────────────────────────────────────────
export function GoalModal({ goal, onSave, onClose }) {
  const [name,         setName]         = useState(goal?.name ?? '')
  const [target,       setTarget]       = useState(goal?.target_amount ?? '')
  const [current,      setCurrent]      = useState(goal?.current_amount ?? 0)
  const [deadline,     setDeadline]     = useState(goal?.deadline ?? '')
  const [contribution, setContribution] = useState(goal?.monthly_contribution ?? '')
  const [goalType,     setGoalType]     = useState(goal?.goal_type ?? 'savings')
  const [dirty,        setDirty]        = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)
  const nameRef = useRef(null)

  const change = (setter) => (eventOrValue) => {
    setDirty(true)
    setter(eventOrValue?.target ? eventOrValue.target.value : eventOrValue)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await onSave({
        name,
        goal_type:            goalType,
        target_amount:        parseFloat(target),
        current_amount:       parseFloat(current),
        deadline:             deadline || null,
        monthly_contribution: contribution !== '' ? parseFloat(contribution) : 0,
      })
      setDirty(false)
    } catch (err) {
      setSaveError(err.message ?? 'Could not save that goal.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-white/[0.11] bg-white/[0.055] px-3.5 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/45'
  return (
    <BottomSheet
      open
      title={goal ? 'Edit goal' : 'New goal'}
      subtitle="Set the target and pace. Your garden updates as progress grows."
      onClose={onClose}
      dirty={dirty && !saving}
      initialFocusRef={nameRef}
      footer={(
        // One close affordance (the header X, dirty-guarded) — so Save stands
        // alone at full width, the same footer language as every other sheet.
        <button type="submit" form="goal-editor-form" disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save goal
        </button>
      )}
    >
          <form id="goal-editor-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Goal type</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => change(setGoalType)('savings')}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-2 text-sm font-medium transition-colors ${
                    goalType === 'savings'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/[0.11] bg-[#0e1812] text-white/60 hover:border-white/10'
                  }`}>
                  <Sprout className="w-4 h-4" /><span>Savings</span>
                </button>
                <button type="button" onClick={() => change(setGoalType)('purchase')}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-2 text-sm font-medium transition-colors ${
                    goalType === 'purchase'
                      ? 'border-sky-400 bg-sky-400/15 text-sky-200'
                      : 'border-white/[0.11] bg-[#0e1812] text-white/60 hover:border-white/10'
                  }`}>
                  <ShoppingBag className="w-4 h-4" /><span>Purchase</span>
                </button>
                <button type="button" onClick={() => change(setGoalType)('investment')}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-2 text-sm font-medium transition-colors ${
                    goalType === 'investment'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                      : 'border-white/[0.11] bg-[#0e1812] text-white/60 hover:border-white/10'
                  }`}>
                  <TrendingUp className="w-4 h-4" /><span>Investment</span>
                </button>
              </div>
              <p className="mt-1.5 text-xs text-readable-secondary">
                {goalType === 'investment'
                  ? 'Uses an estimated return for the projection; actual performance may differ.'
                  : goalType === 'purchase'
                    ? 'Tracks cash saved for a specific future purchase.'
                    : 'Tracks cash saved for a reserve or flexible objective.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Goal name</label>
              <input ref={nameRef} value={name} onChange={change(setName)} required placeholder="e.g. Emergency fund" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Target ($)</label>
                <input type="number" inputMode="decimal" value={target} onChange={change(setTarget)} required min="1" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Saved so far ($)</label>
                <input type="number" inputMode="decimal" value={current} onChange={change(setCurrent)} min="0" step="0.01" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">
                Monthly contribution ($)
                <span className="ml-1 font-normal text-white/40">(shows when you'll get there)</span>
              </label>
              <input type="number" inputMode="decimal" value={contribution} onChange={change(setContribution)}
                min="0" step="0.01" placeholder="0" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Target date (optional)</label>
              <input type="date" value={deadline} onChange={change(setDeadline)} className={inputCls} />
            </div>

            {saveError && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{saveError}</p>}
          </form>
    </BottomSheet>
  )
}

// ─── Inline progress updater (log progress or adjust manually) ────────────────
function ProgressInput({ goal, onContribute, onUpdate }) {
  const [mode,   setMode]   = useState(null)   // null | 'add' | 'adjust'
  const [amount, setAmount] = useState('')
  const [absVal, setAbsVal] = useState(goal.current_amount)
  const isInv = goal.goal_type === 'investment'

  const pct  = Math.min(Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100), 100)

  function addMoney() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return
    onContribute(goal.id, amt)
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
        <div className={`h-2 rounded-full transition-all duration-500 ${isInv ? 'bg-amber-300' : 'bg-emerald-400'}`}
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
            <button onClick={addMoney} aria-label="Save contribution" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setMode(null)} aria-label="Cancel contribution" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-readable-muted hover:bg-white/[0.06] hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[13px] leading-5 text-readable-muted">This logs progress toward the goal. Account balances stay as they are.</p>
        </div>
      ) : mode === 'adjust' ? (
        <div className="flex gap-2 items-center">
          <input autoFocus type="number" inputMode="decimal" value={absVal} onChange={e => setAbsVal(e.target.value)}
            min="0" step="0.01"
            className="flex-1 px-2.5 py-2 rounded-lg border border-white/[0.11] bg-white/[0.085] text-white text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
          <button onClick={saveAbs} aria-label="Save progress" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setMode(null)} aria-label="Cancel progress edit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-readable-muted hover:bg-white/[0.06] hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* A reached goal doesn't need more money — just the option to adjust. */}
          {pct < 100 && (
            <button onClick={() => setMode('add')}
              className="btn-primary min-h-11 px-3.5">
              <Plus className="h-4 w-4" /> Log progress
            </button>
          )}
          <button onClick={() => { setAbsVal(goal.current_amount); setMode('adjust') }}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-readable-secondary hover:bg-white/[0.05] hover:text-white">
            Adjust
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Timeline line ─────────────────────────────────────────────────────────────
// One sentence under the bar. Colour only where it means something: amber when
// the goal is behind its date, emerald when it is on pace or done.
function TimelineBadge({ goal }) {
  const proj = getProjection(goal)
  let text = 'Set a monthly contribution to see when you will get there.'
  let tone = 'text-readable-muted'
  if (proj?.done) {
    text = 'Goal reached.'
    tone = 'text-emerald-200'
  } else if (proj?.deadlinePassed || proj?.onTime === false) {
    text = proj.deadlinePassed ? `Past its target date (${proj.deadlineLabel}).` : `Behind its target date (${proj.deadlineLabel}).`
    tone = 'text-amber-200'
  } else if (proj?.onTime === true) {
    text = `On pace for ${proj.deadlineLabel}.`
    tone = 'text-emerald-200'
  } else if (proj?.longTerm) {
    text = 'Long term. It grows with your contributions.'
    tone = 'text-readable-secondary'
  } else if (proj) {
    text = `On pace for ${proj.label}, about ${proj.monthsLeft} month${proj.monthsLeft === 1 ? '' : 's'} away.`
    tone = 'text-readable-secondary'
  }
  return <p className={`mt-3 text-[13px] leading-5 ${tone}`}>{text}</p>
}

// ─── Editable goal card ─────────────────────────────────────────────────────────
// `embedded`: inside a sheet whose title already names the goal, so no card
// surface and no second heading.
export function GoalItem({ goal, onEdit, onDelete, onUpdateProgress, onContribute, howToContext, embedded = false }) {
  const isInv = goal.goal_type === 'investment'
  const isPurchase = goal.goal_type === 'purchase'
  // Deleting a goal is destructive — require a second tap to confirm (the armed
  // state disarms itself after a moment).
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 2500)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={embedded ? '' : 'rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4 md:p-5'}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {!embedded && <h3 className="mb-0.5 break-words text-[17px] font-semibold text-white">{goal.name}</h3>}
          {/* Type in words, not a coloured pill: it is a label, not a state. */}
          <p className="mt-0.5 text-[13px] text-readable-muted">
            {isInv ? 'Investment' : isPurchase ? 'Purchase' : 'Savings'}
            {goal.deadline ? ` · by ${new Date(`${String(goal.deadline).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(goal)} aria-label="Edit goal"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/40 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (armed) onDelete(goal.id); else setArmed(true) }}
            aria-label={armed ? 'Tap again to delete' : 'Delete goal'}
            className={`p-2 min-h-[44px] flex items-center justify-center gap-1 rounded-lg transition-colors ${
              armed ? 'min-w-0 px-2.5 text-rose-200 bg-rose-500/20 border border-rose-400/40'
                    : 'min-w-[44px] text-white/40 hover:text-rose-400 hover:bg-rose-500/15'}`}>
            <Trash2 className="w-3.5 h-3.5" />
            {armed && <span className="whitespace-nowrap text-[13px] font-semibold">Delete?</span>}
          </button>
        </div>
      </div>
      <ProgressInput goal={goal} onContribute={onContribute} onUpdate={onUpdateProgress} />
      <TimelineBadge goal={goal} />
      {/* AI path to the goal, generated in place — how much, where, and how */}
      {howToContext !== undefined && Number(goal.current_amount) < Number(goal.target_amount) && (
        <HowToInline
          subject={`reach my "${goal.name}" ${isInv ? 'investment' : isPurchase ? 'purchase' : 'savings'} goal — $${Number(goal.current_amount || 0).toLocaleString()} saved of $${Number(goal.target_amount || 0).toLocaleString()}${Number(goal.monthly_contribution) > 0 ? `, currently putting in $${Number(goal.monthly_contribution).toLocaleString()}/mo` : ''}`}
          context={howToContext} />
      )}
    </motion.div>
  )
}
