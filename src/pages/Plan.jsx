import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Bot, Target, Plus, Sprout } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden, milestonesToStage } from '@/context/GardenContext'
import { listPlans, updatePlanSteps, deletePlan, applyStep, savePlan } from '@/lib/advisorPlans'
import { GoalItem, GoalModal, getProjection } from '@/components/GoalItem'
import PlanCard from '@/components/PlanCard'
import MoneyCard from '@/components/MoneyCard'
import SmartSuggestions from '@/components/SmartSuggestions'
import GardenGrowthToast from '@/components/GardenGrowthToast'

export default function Plan() {
  const { user, profile, setProfile } = useAuth()
  const { updateGarden } = useGarden()
  const navigate = useNavigate()
  const [plans,   setPlans]   = useState([])
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [money,   setMoney]   = useState({ income: 0, expenses: 0, netWorth: 0 })
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // null | 'new' | goal
  const [growth,  setGrowth]  = useState(null)   // garden-grew celebration

  async function loadGoals() {
    const { data: g } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
    setGoals(g ?? [])
  }

  useEffect(() => {
    async function load() {
      const [g, d, pl, ac] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('*').eq('user_id', user.id),
        listPlans(user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
      ])
      setGoals(g.data ?? [])
      setDebts(d.data ?? [])
      setPlans(pl)
      setAccounts(ac.data ?? [])
      setMoney({
        income:   Number(profile?.monthly_income)   || 0,
        expenses: Number(profile?.monthly_expenses) || 0,
        netWorth: Number(profile?.net_worth)         || 0,
      })
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link support: /plan#goals etc.
  useEffect(() => {
    if (loading) return
    const id = window.location.hash.slice(1)
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [loading])

  // ── Derived milestone counts ─────────────────────────────────────────────────
  const completedSteps = plans.reduce((n, p) => n + p.steps.filter(s => s.done).length, 0)
  const totalSteps     = plans.reduce((n, p) => n + p.steps.length, 0)
  const goalsReached   = goals.filter(g => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount)).length
  const surplusRatio   = money.income > 0 ? (money.income - money.expenses) / money.income : 0
  const stage          = milestonesToStage(completedSteps + goalsReached)

  // Keep the garden in sync with live state.
  useEffect(() => {
    if (loading) return
    updateGarden({ completedSteps, totalSteps, goalsReached, surplusRatio, netWorth: money.netWorth, goals, debts })
  }, [completedSteps, totalSteps, goalsReached, surplusRatio, money.netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fire the celebration synchronously when an action crosses a stage boundary.
  function celebrate(deltaMilestones, stepText) {
    const newStage = milestonesToStage(completedSteps + goalsReached + deltaMilestones)
    if (newStage > stage) setGrowth({ stage: newStage, stepText })
  }

  // ── Plan-step handlers (functional updaters → burst-safe) ────────────────────
  function editPlan(planId, mutate) {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const steps = mutate(p.steps)
      updatePlanSteps(planId, steps).catch(() => {})
      return { ...p, steps }
    }))
  }
  function toggleStep(planId, stepId) {
    const plan = plans.find(p => p.id === planId)
    const step = plan?.steps.find(s => s.id === stepId)
    if (step && !step.done) celebrate(1, step.text)   // crossing into a new stage?
    editPlan(planId, steps => steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s))
  }
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

  // ── Goal handlers ────────────────────────────────────────────────────────────
  async function saveGoal(payload) {
    if (modal && modal !== 'new') await supabase.from('goals').update(payload).eq('id', modal.id)
    else await supabase.from('goals').insert({ ...payload, user_id: user.id })
    setModal(null)
    loadGoals()
  }
  function deleteGoal(id) {
    setGoals(gs => gs.filter(g => g.id !== id))
    supabase.from('goals').delete().eq('id', id).then(() => {})
  }
  function updateProgress(id, amount) {
    const goal = goals.find(g => g.id === id)
    if (goal && Number(goal.target_amount) > 0) {
      const wasReached = Number(goal.current_amount) >= Number(goal.target_amount)
      if (!wasReached && amount >= Number(goal.target_amount)) celebrate(1, `Reached ${goal.name}`)
    }
    setGoals(gs => gs.map(g => g.id === id ? { ...g, current_amount: amount } : g))
    supabase.from('goals').update({ current_amount: amount }).eq('id', id).then(() => {})
  }
  // No accounts anymore — "add money" just credits the goal.
  function contribute(goalId, amount) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const next = Number(goal.current_amount) + amount
    updateProgress(goalId, next)
  }

  // ── Money handlers ───────────────────────────────────────────────────────────
  async function saveMoney(fields) {
    const next = { ...money }
    if ('monthly_income'   in fields) next.income   = fields.monthly_income
    if ('monthly_expenses' in fields) next.expenses = fields.monthly_expenses
    if ('net_worth'        in fields) next.netWorth = fields.net_worth
    setMoney(next)
    const { data } = await supabase.from('profiles')
      .update(fields).eq('id', user.id).select().single()
    if (data) setProfile(data)   // keep advisor context fresh
  }

  // Account value = total cash/balances (stored in the accounts table, which the
  // advisor also reads). Edited as one simple number; backed by a single row.
  const accountValue = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  async function saveBalance(v) {
    const val = Math.max(0, Number(v) || 0)
    if (accounts.length > 0) {
      const id = accounts[0].id
      setAccounts(prev => prev.map((a, i) => i === 0 ? { ...a, balance: val } : a))
      await supabase.from('accounts').update({ balance: val }).eq('id', id)
    } else {
      const { data } = await supabase.from('accounts')
        .insert({ user_id: user.id, name: 'Savings & cash', type: 'savings', balance: val })
        .select().single()
      if (data) setAccounts([data])
    }
  }
  async function addDebt(d) {
    const { data } = await supabase.from('debts').insert({ user_id: user.id, ...d }).select().single()
    if (data) setDebts(prev => [...prev, data])
  }
  function deleteDebt(id) {
    setDebts(prev => prev.filter(d => d.id !== id))
    supabase.from('debts').delete().eq('id', id).then(() => {})
  }

  // ── Smart-suggestion handlers ────────────────────────────────────────────────
  // Add a suggested task to the user's plan (the first one, or create one).
  async function addSuggestedTask(text) {
    const step = { id: `u_${Math.random().toString(36).slice(2, 8)}`, text, detail: null, apply: null, done: false, applied: false }
    if (plans.length) {
      const target = plans[0]
      const steps = [...target.steps, step]
      setPlans(prev => prev.map(p => p.id === target.id ? { ...p, steps } : p))
      updatePlanSteps(target.id, steps).catch(() => {})
    } else {
      const saved = await savePlan(user.id, { title: 'Your plan', steps: [step] })
      setPlans([saved])
    }
  }
  // One-tap goal from a preset, else open the modal to fill in details.
  async function addSuggestedGoal(preset) {
    if (!preset) { setModal('new'); return }
    const { data } = await supabase.from('goals').insert({
      user_id: user.id, name: preset.name, goal_type: preset.goal_type || 'savings',
      target_amount: Math.round(preset.target_amount) || 0, current_amount: 0,
      monthly_contribution: Math.round(preset.monthly_contribution) || 0, deadline: null,
    }).select().single()
    if (data) setGoals(gs => [...gs, data])
  }
  const askAdvisor = (q) => navigate('/advisor', { state: { ask: q } })

  const stepsLeft   = totalSteps - completedSteps
  const isComplete  = p => p.steps.length > 0 && p.steps.every(s => s.done)
  const sortedPlans = [...plans].sort((a, b) => (isComplete(a) === isComplete(b) ? 0 : isComplete(a) ? 1 : -1))

  // Living headline — the nearest goal you'll reach.
  const nearest = goals
    .map(g => ({ g, p: getProjection(g) }))
    .filter(x => x.p && !x.p.done && !x.p.longTerm && x.p.monthsLeft)
    .sort((a, b) => a.p.monthsLeft - b.p.monthsLeft)[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div>
        <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Your Plan</h1>
        <p className="text-white/60 mt-1 text-sm">Check off steps to grow your garden.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-white/[0.05] rounded-2xl animate-pulse" />)}</div>
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

          {/* ── Smart, situation-aware prompts ── */}
          <SmartSuggestions money={money} profile={profile} goals={goals} debts={debts} plans={plans}
            onAddTask={addSuggestedTask} onAddGoal={addSuggestedGoal} onAsk={askAdvisor} />

          {/* ── Action steps (the hero — checking grows the garden) ── */}
          <section id="steps" className="scroll-mt-16">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-300" /> Action steps
              </h2>
              {totalSteps > 0 && (
                <span className="text-xs text-white/45 tabular-nums">{completedSteps}/{totalSteps} done</span>
              )}
            </div>

            {plans.length === 0 ? (
              <div className="bg-white/[0.055] rounded-2xl border border-white/[0.08] p-8 text-center">
                <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Sprout className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-white font-semibold text-sm mb-1">Your garden is waiting</p>
                <p className="text-white/45 text-xs max-w-xs mx-auto mb-4">
                  Ask your advisor what to do next, then add the steps here. Each one you check off grows your garden.
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

          {/* ── Your money (ingrained budget) ── */}
          <section id="money" className="scroll-mt-16">
            <MoneyCard
              income={money.income} expenses={money.expenses} netWorth={money.netWorth}
              balance={accountValue} debts={debts}
              onSaveMoney={saveMoney} onSaveBalance={saveBalance} onAddDebt={addDebt} onDeleteDebt={deleteDebt} />
          </section>

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
              <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-6 text-center">
                <p className="text-white/55 text-xs max-w-xs mx-auto">
                  Saving toward something — a house, emergency fund, a trip? Add a goal to plant a tree. Reaching it grows your garden.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {goals.map(g => (
                  <GoalItem key={g.id} goal={g} accounts={[]}
                    onEdit={setModal} onDelete={deleteGoal}
                    onUpdateProgress={updateProgress} onContribute={contribute} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {modal && <GoalModal goal={modal === 'new' ? null : modal} onSave={saveGoal} onClose={() => setModal(null)} />}
      <GardenGrowthToast data={growth} onDismiss={() => setGrowth(null)} />
    </motion.div>
  )
}
