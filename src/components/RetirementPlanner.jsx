import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PiggyBank, TrendingUp, Check, Loader2, ArrowRight, Info } from 'lucide-react'
import { computeRetirement, saveRetirement, syncRetirementGoal, fmt$ } from '@/lib/retirement'

function Field({ label, value, onChange, prefix, suffix, step = 1, min = 0, max }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-1">{label}</span>
      <div className="flex items-center bg-white/10 border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus-within:border-emerald-400/50 transition-colors">
        {prefix && <span className="text-white/40 text-sm mr-1">{prefix}</span>}
        <input
          type="number" inputMode="decimal" value={value} step={step} min={min} max={max}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full bg-transparent text-sm font-semibold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        {suffix && <span className="text-white/40 text-xs ml-1">{suffix}</span>}
      </div>
    </label>
  )
}

export default function RetirementPlanner({ userId, defaults, initial, linkedGoalId: initialLinked, onGoalSynced }) {
  const [inp, setInp] = useState(() => ({ ...defaults, ...(initial ?? {}) }))
  const [linkedGoalId, setLinkedGoalId] = useState(initialLinked ?? null)
  const [syncing, setSyncing] = useState(false)
  const [justLinked, setJustLinked] = useState(false)
  const firstRun = useRef(true)

  const set = (field, value) => setInp(p => ({ ...p, [field]: value }))
  const out = useMemo(() => computeRetirement(inp), [inp])

  // Persist settings (debounced) whenever inputs change.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => { saveRetirement(userId, inp, linkedGoalId).catch(() => {}) }, 700)
    return () => clearTimeout(t)
  }, [inp, userId, linkedGoalId])

  const pct = Math.max(0, Math.min(1, out.onTrack))
  const tier = out.onTrack >= 1 ? 'good' : out.onTrack >= 0.6 ? 'warn' : 'low'
  const barColor = { good: 'from-emerald-400 to-emerald-300', warn: 'from-amber-400 to-amber-300', low: 'from-rose-400 to-rose-300' }[tier]
  const statusText = { good: 'On track', warn: 'Close — small tweak needed', low: 'Behind — needs attention' }[tier]
  const statusColor = { good: 'text-emerald-300', warn: 'text-amber-300', low: 'text-rose-300' }[tier]

  async function handleSync() {
    setSyncing(true)
    try {
      const goalId = await syncRetirementGoal(userId, {
        target: out.target, monthly: inp.monthly, current: inp.currentSaved, linkedGoalId,
      })
      setLinkedGoalId(goalId)
      await saveRetirement(userId, inp, goalId).catch(() => {})
      setJustLinked(true)
      onGoalSynced?.()
    } finally { setSyncing(false) }
  }

  const advice = out.years <= 0
    ? 'Set a retirement age beyond your current age to project your nest egg.'
    : out.onTrack >= 1
      ? `You're projected to reach ${fmt$(out.projected)} by age ${inp.retireAge} — enough to draw about ${fmt$(out.safeIncome)}/year.`
      : `Contributing ${fmt$(out.monthlyGap)} more per month (${fmt$(out.requiredMonthly)} total) puts you on track for your ${fmt$(out.target)} goal.`

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.055] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-emerald-500/10">
        <PiggyBank className="w-4 h-4 text-emerald-300" />
        <span className="text-sm font-semibold text-white flex-1">Retirement Planner</span>
        <span className={`text-[11px] font-bold ${statusColor}`}>{statusText}</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 p-4">
        <Field label="Current age"     value={inp.currentAge}    onChange={v => set('currentAge', v)} suffix="yrs" />
        <Field label="Retire at"       value={inp.retireAge}     onChange={v => set('retireAge', v)} suffix="yrs" />
        <Field label="Return"          value={inp.annualReturn}  onChange={v => set('annualReturn', v)} suffix="%/yr" step={0.5} max={15} />
        <Field label="Saved now"       value={inp.currentSaved}  onChange={v => set('currentSaved', v)} prefix="$" step={500} />
        <Field label="Contributing"    value={inp.monthly}       onChange={v => set('monthly', v)} prefix="$" suffix="/mo" step={25} />
        <Field label="Income in ret."  value={inp.desiredIncome} onChange={v => set('desiredIncome', v)} prefix="$" suffix="/yr" step={1000} />
      </div>

      {/* Projection */}
      <div className="px-4 pb-3">
        <div className="rounded-xl bg-black/20 border border-white/10 p-3.5">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide">Projected at retirement</div>
              <div className="text-2xl font-bold text-white tabular-nums leading-tight">{fmt$(out.projected)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide">Target (4% rule)</div>
              <div className="text-base font-bold text-white/70 tabular-nums">{fmt$(out.target)}</div>
            </div>
          </div>
          {/* On-track gauge */}
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`} style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px]">
            <span className={`font-bold ${statusColor}`}>{Math.round(out.onTrack * 100)}% of goal</span>
            <span className="text-white/40">{out.years} yrs to go</span>
          </div>
        </div>

        {/* Advice */}
        <div className="flex items-start gap-2 mt-2.5 text-xs text-white/70 leading-snug">
          <Info className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 mt-0.5" />
          <span>{advice}</span>
        </div>
      </div>

      {/* Goal integration */}
      <div className="px-4 py-3 border-t border-white/10">
        {linkedGoalId ? (
          <Link to="/plan#goals" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
            <Check className="w-3.5 h-3.5" /> {justLinked ? 'Synced' : 'Linked'} to your Retirement goal · view in goals <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button onClick={handleSync} disabled={syncing || out.years <= 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-colors">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
            Track this in my goals
          </button>
        )}
      </div>
    </div>
  )
}
