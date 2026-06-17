import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Bot, Wallet, Percent, PiggyBank, Target, TrendingUp, Sprout } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { listPlans, updatePlanSteps, deletePlan, applyStep } from '@/lib/advisorPlans'
import { deriveDefaults, computeRetirement, loadRetirement, fmt$ } from '@/lib/retirement'
import PlanCard from '@/components/PlanCard'
import RetirementPlanner from '@/components/RetirementPlanner'

function GoalRow({ goal }) {
  const pct   = Math.min(100, Math.round((Number(goal.current_amount) / (Number(goal.target_amount) || 1)) * 100))
  const isInv = goal.goal_type === 'investment'
  const done  = pct >= 100
  return (
    <Link to="/goals" className="block bg-white/10 rounded-xl border border-white/15 p-3 hover:bg-white/[0.14] transition-colors">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-sm font-semibold text-white truncate flex items-center gap-1.5 min-w-0">
          {isInv ? <TrendingUp className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                 : <Sprout className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />}
          <span className="truncate">{goal.name}</span>
        </span>
        <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${done ? 'text-emerald-300' : 'text-white/60'}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${isInv ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-white/40 mt-1 tabular-nums">{fmt$(goal.current_amount)} of {fmt$(goal.target_amount)}</div>
    </Link>
  )
}

function SnapshotChip({ icon: Icon, label, value, sub, valueColor }) {
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-emerald-300/80" />
        <span className="text-[10px] font-semibold text-white/45 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-bold tabular-nums leading-tight ${valueColor ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Plan() {
  const { user, profile } = useAuth()
  const [plans, setPlans]     = useState([])
  const [data, setData]       = useState({ goals: [], budgets: [], debts: [], accounts: [] })
  const [retire, setRetire]   = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadGoals() {
    const { data: g } = await supabase.from('goals').select('*').eq('user_id', user.id)
    setData(d => ({ ...d, goals: g ?? [] }))
  }

  useEffect(() => {
    async function load() {
      const [g, b, d, a, ret, pl] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        loadRetirement(user.id),
        listPlans(user.id),
      ])
      setData({ goals: g.data ?? [], budgets: b.data ?? [], debts: d.data ?? [], accounts: a.data ?? [] })
      setRetire(ret)
      setPlans(pl)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user.id])

  // ── Action-plan handlers (functional updaters → burst-safe) ─────────────────
  function editPlan(planId, mutate) {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const steps = mutate(p.steps)
      updatePlanSteps(planId, steps).catch(() => {})
      return { ...p, steps }
    }))
  }
  const toggleStep = (planId, stepId) => editPlan(planId, steps => steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s))
  async function applyAndMark(planId, step) {
    await applyStep(user.id, step.apply)
    editPlan(planId, steps => steps.map(s => s.id === step.id ? { ...s, applied: true } : s))
  }
  const addStep = (planId, text) => editPlan(planId, steps => [...steps, {
    id: `u_${Math.random().toString(36).slice(2, 8)}`, text, detail: null, apply: null, done: false, applied: false,
  }])
  function removePlan(planId) {
    setPlans(prev => prev.filter(p => p.id !== planId))
    deletePlan(planId).catch(() => {})
  }

  // ── Snapshot metrics ────────────────────────────────────────────────────────
  const { goals, budgets, debts, accounts } = data
  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const totalDebt   = debts.reduce((s, d) => s + Number(d.balance), 0)
  const netWorth    = totalAssets - totalDebt
  const income      = budgets.filter(b => b.type === 'income'  && b.recurring !== false).reduce((s, b) => s + Number(b.amount), 0)
  const expenses    = budgets.filter(b => b.type === 'expense' && b.recurring !== false).reduce((s, b) => s + Number(b.amount), 0)
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : null

  const defaults    = deriveDefaults({ accounts, goals, budgets, profile })
  const retireInput = { ...defaults, ...(retire?.settings ?? {}) }
  const retireOut   = computeRetirement(retireInput)

  const isComplete  = p => p.steps.length > 0 && p.steps.every(s => s.done)
  const stepsLeft   = plans.reduce((n, p) => n + p.steps.filter(s => !s.done).length, 0)
  const sortedPlans = [...plans].sort((a, b) => (isComplete(a) === isComplete(b) ? 0 : isComplete(a) ? 1 : -1))

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div>
        <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Your Financial Plan</h1>
        <p className="text-white/60 mt-1 text-sm">A living plan that grows with you</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white/10 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Snapshot */}
          <div className="grid grid-cols-3 gap-2.5">
            <SnapshotChip icon={Wallet} label="Net worth" value={`${netWorth < 0 ? '-' : ''}${fmt$(Math.abs(netWorth))}`}
              valueColor={netWorth >= 0 ? 'text-white' : 'text-rose-300'}
              sub={accounts.length ? `${fmt$(totalAssets)} − ${fmt$(totalDebt)}` : 'add accounts'} />
            <SnapshotChip icon={Percent} label="Savings rate"
              value={savingsRate === null ? '—' : `${savingsRate}%`}
              valueColor={savingsRate >= 20 ? 'text-emerald-300' : savingsRate < 0 ? 'text-rose-300' : 'text-white'}
              sub={savingsRate === null ? 'add budget' : 'of income kept'} />
            <SnapshotChip icon={PiggyBank} label="Retirement"
              value={`${Math.round(retireOut.onTrack * 100)}%`}
              valueColor={retireOut.onTrack >= 1 ? 'text-emerald-300' : retireOut.onTrack >= 0.6 ? 'text-amber-300' : 'text-rose-300'}
              sub="on track" />
          </div>

          {/* Retirement planner */}
          <RetirementPlanner
            userId={user.id}
            defaults={defaults}
            initial={retire?.settings}
            linkedGoalId={retire?.linked_goal_id}
            onGoalSynced={loadGoals}
          />

          {/* Goals & milestones — the same goals you see on the Goals page */}
          {goals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-300" /> Goals &amp; milestones
                </h2>
                <Link to="/goals" className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors">Manage →</Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {goals.map(g => <GoalRow key={g.id} goal={g} />)}
              </div>
            </div>
          )}

          {/* Action steps */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-300" /> Action steps
              </h2>
              {stepsLeft > 0 && <span className="text-xs text-white/45">{stepsLeft} left</span>}
            </div>

            {plans.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-8 text-center">
                <p className="text-white font-semibold text-sm mb-1">No action steps yet</p>
                <p className="text-white/45 text-xs max-w-xs mx-auto mb-4">
                  Ask your advisor to build an action plan — save it here to track your steps.
                </p>
                <Link to="/advisor"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  <Bot className="w-4 h-4" /> Talk to your advisor
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedPlans.map(plan => (
                  <PlanCard key={plan.id} plan={plan} variant="page"
                    onToggle={(stepId) => toggleStep(plan.id, stepId)}
                    onApply={(step) => applyAndMark(plan.id, step)}
                    onAddStep={(text) => addStep(plan.id, text)}
                    onDelete={() => removePlan(plan.id)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
