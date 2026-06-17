import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Bot, Wallet, Percent, PiggyBank, Target, Plus, Sprout } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { listPlans, updatePlanSteps, deletePlan, applyStep } from '@/lib/advisorPlans'
import { deriveDefaults, computeRetirement, loadRetirement, fmt$ } from '@/lib/retirement'
import { GoalItem, GoalModal, getProjection } from '@/components/GoalItem'
import PlanCard from '@/components/PlanCard'
import RetirementPlanner from '@/components/RetirementPlanner'

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function SnapshotChip({ icon: Icon, label, value, sub, valueColor }) {
  return (
    <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-3 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-emerald-300/80 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-white/45 uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className={`text-base md:text-lg font-bold tabular-nums leading-tight ${valueColor ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

export default function Plan() {
  const { user, profile } = useAuth()
  const [plans, setPlans]     = useState([])
  const [data, setData]       = useState({ goals: [], budgets: [], debts: [], accounts: [] })
  const [retire, setRetire]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)   // null | 'new' | goal

  async function loadGoals() {
    const { data: g } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
    setData(d => ({ ...d, goals: g ?? [] }))
  }

  useEffect(() => {
    async function load() {
      const [g, b, d, a, ret, pl] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
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

  // ── Goal CRUD (refreshes goals so snapshot + retirement stay in sync) ────────
  async function saveGoal(payload) {
    if (modal && modal !== 'new') await supabase.from('goals').update(payload).eq('id', modal.id)
    else await supabase.from('goals').insert({ ...payload, user_id: user.id })
    setModal(null)
    loadGoals()
  }
  function deleteGoal(id) {
    setData(d => ({ ...d, goals: d.goals.filter(g => g.id !== id) }))
    supabase.from('goals').delete().eq('id', id).then(() => {})
  }
  function updateProgress(id, amount) {
    setData(d => ({ ...d, goals: d.goals.map(g => g.id === id ? { ...g, current_amount: amount } : g) }))
    supabase.from('goals').update({ current_amount: amount }).eq('id', id).then(() => {})
  }

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

  // ── Derived metrics ──────────────────────────────────────────────────────────
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

  const stepsLeft   = plans.reduce((n, p) => n + p.steps.filter(s => !s.done).length, 0)
  const isComplete  = p => p.steps.length > 0 && p.steps.every(s => s.done)
  const sortedPlans = [...plans].sort((a, b) => (isComplete(a) === isComplete(b) ? 0 : isComplete(a) ? 1 : -1))

  // Living headline — the nearest goal you'll reach, in plain language.
  const nearest = goals
    .map(g => ({ g, p: getProjection(g) }))
    .filter(x => x.p && !x.p.done && !x.p.longTerm && x.p.monthsLeft)
    .sort((a, b) => a.p.monthsLeft - b.p.monthsLeft)[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div>
        <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Your Plan</h1>
        <p className="text-white/60 mt-1 text-sm">Your goals, retirement, and next steps — in one place.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white/[0.05] rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Living headline */}
          {nearest && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/[0.1] border border-emerald-400/20">
              <Sprout className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <p className="text-sm text-white/90 leading-snug">
                On pace to reach <span className="font-semibold text-white">{nearest.g.name}</span> by{' '}
                <span className="font-semibold text-emerald-300">{nearest.p.label}</span>.
              </p>
            </div>
          )}

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

          {/* Sticky jump-nav */}
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-[#04100a]/80 backdrop-blur-md border-y border-white/[0.06]">
            <div className="flex gap-2">
              {[['Goals', 'goals'], ['Retirement', 'retirement'], ['Steps', 'steps']].map(([label, id]) => (
                <button key={id} onClick={() => scrollTo(id)}
                  className="px-3 py-1 rounded-full text-xs font-semibold text-white/60 bg-white/[0.06] border border-white/[0.08] hover:text-white hover:bg-white/10 transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Goals ── */}
          <section id="goals" className="scroll-mt-16 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-300" /> Goals
              </h2>
              <button onClick={() => setModal('new')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add goal
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-8 text-center">
                <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-white font-semibold text-sm mb-1">No goals yet</p>
                <p className="text-white/45 text-xs max-w-xs mx-auto mb-4">
                  What are you saving toward — a house, emergency fund, or trip? Add one to plant your first tree.
                </p>
                <button onClick={() => setModal('new')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  <Plus className="w-4 h-4" /> Add your first goal
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {goals.map(g => (
                  <GoalItem key={g.id} goal={g}
                    onEdit={setModal} onDelete={deleteGoal} onUpdateProgress={updateProgress} />
                ))}
              </div>
            )}
          </section>

          {/* ── Retirement ── */}
          <section id="retirement" className="scroll-mt-16">
            <h2 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2.5">
              <PiggyBank className="w-4 h-4 text-emerald-300" /> Retirement
            </h2>
            <RetirementPlanner
              userId={user.id}
              defaults={defaults}
              initial={retire?.settings}
              linkedGoalId={retire?.linked_goal_id}
              onGoalSynced={loadGoals}
            />
          </section>

          {/* ── Action steps ── */}
          <section id="steps" className="scroll-mt-16">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-300" /> Action steps
              </h2>
              {stepsLeft > 0 && <span className="text-xs text-white/45">{stepsLeft} left</span>}
            </div>

            {plans.length === 0 ? (
              <div className="bg-white/[0.055] rounded-2xl border border-white/[0.08] p-8 text-center">
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
          </section>
        </>
      )}

      {modal && (
        <GoalModal goal={modal === 'new' ? null : modal} onSave={saveGoal} onClose={() => setModal(null)} />
      )}
    </motion.div>
  )
}
