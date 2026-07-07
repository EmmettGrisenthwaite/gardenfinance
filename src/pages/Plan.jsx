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

  // Steps and Goals are different animals (a checklist you do vs money targets
  // you grow), so they live on separate tabs. /plan#goals deep-links (garden
  // "Add a goal", advisor goal cards) open the Goals tab.
  const [tab, setTab] = useState(() => (window.location.hash === '#goals' ? 'goals' : 'steps'))
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#goals') setTab('goals')
      else if (window.location.hash === '#steps') setTab('steps')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // ── Derived milestone counts ─────────────────────────────────────────────────
  const completedSteps = plans.reduce((n, p) => n + p.steps.filter(s => s.done).length, 0)
  const totalSteps     = plans.reduce((n, p) => n + p.steps.length, 0)
  const goalsReached   = goals.filter(g => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount)).length
  const surplusRatio   = money.income > 0 ? (money.income - money.expenses) / money.income : 0
  const stage          = milestonesToStage(completedSteps + goalsReached)

  // Net worth auto-derives from what you own (accounts) minus what you owe
  // (debts) — one source of truth, always in sync as those change.
  const accountsTotal = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const debtsTotal    = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const netWorth      = accountsTotal - debtsTotal

  // Keep the garden in sync with live state.
  useEffect(() => {
    if (loading) return
    updateGarden({ completedSteps, totalSteps, goalsReached, surplusRatio, netWorth, goals, debts })
  }, [completedSteps, totalSteps, goalsReached, surplusRatio, netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the derived net worth so the dashboard, advisor, and trend snapshots
  // all read one consistent number (no manual drift).
  useEffect(() => {
    if (loading) return
    if (Number(profile?.net_worth) === netWorth) return
    setProfile(p => (p ? { ...p, net_worth: netWorth } : p))
    supabase.from('profiles').update({ net_worth: netWorth }).eq('id', user.id).then(() => {}, () => {})
  }, [netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

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
    id: `u_${Math.random().toString(36).slice(2, 8)}`, text, detail: null, apply: null, due: null, done: false, applied: false,
  }])
  const setDue = (planId, stepId, due) =>
    editPlan(planId, steps => steps.map(s => s.id === stepId ? { ...s, due } : s))
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
    // An emergency-fund goal starts at the user's existing liquid cushion (the
    // engine passes it as a hint) instead of pretending they're at $0.
    const target = Math.round(preset.target_amount) || 0
    const startAt = Math.min(Math.max(0, Math.round(preset.current_amount_hint || 0)), target)
    const { data } = await supabase.from('goals').insert({
      user_id: user.id, name: preset.name, goal_type: preset.goal_type || 'savings',
      target_amount: target, current_amount: startAt,
      monthly_contribution: Math.round(preset.monthly_contribution) || 0, deadline: null,
    }).select().single()
    if (data) setGoals(gs => [...gs, data])
  }
  const askAdvisor = (q) => navigate('/advisor', { state: { ask: q } })
  // "Show me how" on a step → advisor builds a tailored, step-by-step guide
  // (it already knows the user's numbers, so it can recommend amounts).
  const howTo = (step) => askAdvisor(
    `Walk me through exactly how to do this, step by step: "${step.text}". Give me the specific actions to take, and based on my situation tell me roughly how much I should aim to put in or contribute.`)

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
        <p className="text-white/60 mt-1 text-sm">
          {tab === 'steps'
            ? 'Check off steps to grow your garden.'
            : 'Each goal plants a tree that grows as you save.'}
        </p>
      </div>

      {/* ── Steps | Goals switcher — a checklist you DO vs targets you GROW ── */}
      <div className="flex p-1 rounded-xl bg-white/[0.06] border border-white/[0.10]">
        {[
          { id: 'steps', icon: ClipboardList, label: 'Steps',
            badge: totalSteps === 0 ? null : (totalSteps - completedSteps === 0 ? 'all done' : `${totalSteps - completedSteps} left`) },
          { id: 'goals', icon: Target, label: 'Goals',
            badge: goals.length === 0 ? null : `${goalsReached}/${goals.length} reached` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-emerald-500/20 ring-1 ring-emerald-400/30 text-white' : 'text-white/50 hover:text-white/80'}`}>
            <t.icon className={`w-4 h-4 flex-shrink-0 ${tab === t.id ? 'text-emerald-300' : ''}`} />
            {t.label}
            {t.badge && (
              <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                tab === t.id ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/45'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-white/[0.075] rounded-2xl animate-pulse" />)}</div>
      ) : tab === 'steps' ? (
        <motion.div key="steps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }} className="space-y-5">

          {/* ── Smart, situation-aware prompts ── */}
          <SmartSuggestions profile={profile} goals={goals} debts={debts} accounts={accounts} plans={plans}
            onAddTask={addSuggestedTask} onAddGoal={addSuggestedGoal} onAsk={askAdvisor} />

          {/* ── Action steps (the hero — checking grows the garden) ── */}
          {plans.length === 0 ? (
            <div className="bg-white/[0.075] rounded-2xl border border-white/[0.11] p-8 text-center">
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
                  onSetDue={(stepId, due) => setDue(plan.id, stepId, due)}
                  onHowTo={howTo}
                  onDelete={() => removePlan(plan.id)} />
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div key="goals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }} className="space-y-3">

          {/* Living headline — this is goal news, so it lives on the Goals tab */}
          {nearest && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/[0.1] border border-emerald-400/20">
              <Sprout className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <p className="text-sm text-white/90 leading-snug">
                On pace to reach <span className="font-semibold text-white">{nearest.g.name}</span> by{' '}
                <span className="font-semibold text-emerald-300">{nearest.p.label}</span>.
              </p>
            </div>
          )}

          {/* Saved-so-far summary + add */}
          <div className="flex items-center justify-between">
            {goals.length > 0 ? (
              <span className="text-xs text-white/45 tabular-nums">
                ${goals.reduce((s, g) => s + Number(g.current_amount || 0), 0).toLocaleString()} saved
                {' '}of ${goals.reduce((s, g) => s + Number(g.target_amount || 0), 0).toLocaleString()}
              </span>
            ) : <span />}
            <button onClick={() => setModal('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white/[0.075] rounded-xl border border-white/[0.11] p-6 text-center">
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
        </motion.div>
      )}

      {modal && <GoalModal goal={modal === 'new' ? null : modal} onSave={saveGoal} onClose={() => setModal(null)} />}
      <GardenGrowthToast data={growth} onDismiss={() => setGrowth(null)} />
    </motion.div>
  )
}
