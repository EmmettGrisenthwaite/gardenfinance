import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Bot, Target, Plus, Sprout, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden, milestonesToStage } from '@/context/GardenContext'
import { getPlan, updatePlanSteps, deletePlan, applyStep, appendSteps, normalizeSteps } from '@/lib/advisorPlans'
import { orderSteps } from '@/lib/planOrder'
import { requestPlan } from '@/lib/claude'
import { buildContext, buildSystemPrompt } from '@/lib/advisorContext'
import { buildSuggestions } from '@/components/SmartSuggestions'
import { GoalItem, GoalModal, getProjection } from '@/components/GoalItem'
import { UpNextCard, StepList, DoneAccordion, AddStepRow, SuggestionRow } from '@/components/PlanSteps'
import GardenMeter from '@/components/GardenMeter'
import GardenGrowthToast from '@/components/GardenGrowthToast'

export default function Plan() {
  const { user, profile, setProfile } = useAuth()
  const { updateGarden, triggerBurst } = useGarden()
  const navigate = useNavigate()
  const [plan,    setPlan]    = useState(null)   // THE plan (one per user) | null
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [money,   setMoney]   = useState({ income: 0, expenses: 0, netWorth: 0 })
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // null | 'new' | goal
  const [growth,  setGrowth]  = useState(null)   // garden-grew celebration
  const [expandedId, setExpandedId] = useState(null)  // the one expanded row
  const [building, setBuilding] = useState(false)     // starter-plan generation
  const [error,   setError]   = useState(null)

  async function loadGoals() {
    const { data: g, error: goalError } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
    if (goalError) throw goalError
    setGoals(g ?? [])
  }

  useEffect(() => {
    async function load() {
      const [g, d, pl, ac] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('*').eq('user_id', user.id),
        getPlan(user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
      ])
      if (g.error) throw g.error
      if (d.error) throw d.error
      if (ac.error) throw ac.error
      setGoals(g.data ?? [])
      setDebts(d.data ?? [])
      setPlan(pl)
      setAccounts(ac.data ?? [])
      setMoney({
        income:   Number(profile?.monthly_income)   || 0,
        expenses: Number(profile?.monthly_expenses) || 0,
        netWorth: Number(profile?.net_worth)         || 0,
      })
      setLoading(false)
    }
    load().catch(err => {
      setError(err.message ?? 'Could not load your plan.')
      setLoading(false)
    })
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
  const steps          = plan?.steps ?? []
  const completedSteps = steps.filter(s => s.done).length
  const totalSteps     = steps.length
  const goalsReached   = goals.filter(g => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount)).length
  const surplusRatio   = money.income > 0 ? (money.income - money.expenses) / money.income : 0
  const stage          = milestonesToStage(completedSteps + goalsReached)

  // The one shared ordering — the Up-next card, this list, and the Dashboard
  // peek all agree on what's next.
  const activeSteps = orderSteps(steps.filter(s => !s.done))
  const upNext      = activeSteps[0] ?? null
  const restSteps   = activeSteps.slice(1)
  const doneSteps   = steps.filter(s => s.done)

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
    supabase.from('profiles').update({ net_worth: netWorth }).eq('id', user.id)
      .then(({ error: profileError }) => {
        if (profileError) setError(profileError.message ?? 'Could not sync net worth.')
      })
  }, [netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fire the celebration synchronously when an action crosses a stage boundary.
  function celebrate(deltaMilestones, stepText) {
    const newStage = milestonesToStage(completedSteps + goalsReached + deltaMilestones)
    if (newStage > stage) {
      setGrowth({ stage: newStage, stepText })
      triggerBurst()
    }
  }

  // ── Step handlers (functional updaters → burst-safe) ────────────────────────
  function editSteps(mutate) {
    setPlan(prev => {
      if (!prev) return prev
      const next = mutate(prev.steps)
      updatePlanSteps(prev.id, next, user.id).catch(err => {
        setError(err.message ?? 'Could not save that plan change.')
      })
      return { ...prev, steps: next }
    })
  }
  function toggleStep(stepId) {
    const step = steps.find(s => s.id === stepId)
    if (step && !step.done) celebrate(1, step.text)   // crossing into a new stage?
    editSteps(list => list.map(s => s.id === stepId
      ? { ...s, done: !s.done, completedAt: s.done ? null : new Date().toISOString() }
      : s))
    setExpandedId(null)
  }
  function deleteStep(stepId) {
    editSteps(list => list.filter(s => s.id !== stepId))
    setExpandedId(null)
  }
  const setDue = (stepId, due) =>
    editSteps(list => list.map(s => s.id === stepId ? { ...s, due } : s))

  // The user's own step — their intent wins, no dedupe second-guessing.
  async function addOwnStep(text) {
    try {
      const step = normalizeSteps([{ text, source: 'user', addedAt: new Date().toISOString() }])[0]
      if (plan) {
        editSteps(list => [...list, step])
      } else {
        const { plan: created } = await appendSteps(user.id, [step], { source: 'user' })
        setPlan(created)
      }
    } catch (err) {
      setError(err.message ?? 'Could not add that step.')
    }
  }

  // Clearing everything is destructive — two-tap arm, tucked at the bottom.
  const [clearArmed, setClearArmed] = useState(false)
  useEffect(() => {
    if (!clearArmed) return
    const t = setTimeout(() => setClearArmed(false), 2500)
    return () => clearTimeout(t)
  }, [clearArmed])
  async function clearPlan() {
    if (!plan) return
    try {
      await deletePlan(plan.id, user.id)
      setPlan(null)
      setClearArmed(false)
    } catch (err) {
      setError(err.message ?? 'Could not clear your plan.')
    }
  }

  async function applyAndMark(step) {
    try {
      await applyStep(user.id, step.apply)
      editSteps(list => list.map(s => s.id === step.id ? { ...s, applied: true } : s))
      if (step.apply?.type === 'budget') {
        // The apply changed profile income/expenses — refresh so the page and the
        // advisor read the new truth immediately.
        const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (profileError) throw profileError
        if (data) {
          setProfile(data)
          setMoney(m => ({ ...m, income: Number(data.monthly_income) || 0, expenses: Number(data.monthly_expenses) || 0 }))
        }
      }
      if (step.apply?.type === 'goal') await loadGoals()
    } catch (err) {
      setError(err.message ?? 'Could not apply that step.')
    }
  }

  // ── One-tap starter plan (the advisor's brain, right here) ───────────────────
  async function buildStarterPlan() {
    if (building) return
    setBuilding(true)
    setError(null)
    try {
      const ctx = buildContext(money, goals, debts, profile, { plans: [], accounts })
      const system = buildSystemPrompt(ctx)
      const p = await requestPlan([{
        role: 'user',
        content: 'Based on my actual numbers, build me a short, concrete starter financial action plan — 3 to 5 ordered steps. Where a step means starting a savings/investment goal or adjusting my monthly income/expense numbers, include its apply action so I can act in one tap.',
      }], system)
      // These are the plan's founding steps, not an import from elsewhere — no
      // "from:" origin tag.
      const { plan: created } = await appendSteps(user.id, p.steps, { source: 'advisor' })
      setPlan(created)
    } catch (err) {
      setError(err.message ?? 'Could not build your plan. Try again.')
    } finally {
      setBuilding(false)
    }
  }

  // ── Goal handlers ────────────────────────────────────────────────────────────
  async function saveGoal(payload) {
    try {
      const result = modal && modal !== 'new'
        ? await supabase.from('goals').update(payload).eq('id', modal.id).eq('user_id', user.id).select().single()
        : await supabase.from('goals').insert({ ...payload, user_id: user.id }).select().single()
      if (result.error) throw result.error
      if (result.data) {
        setGoals(prev => modal && modal !== 'new'
          ? prev.map(g => g.id === result.data.id ? result.data : g)
          : [...prev, result.data])
      }
      setModal(null)
    } catch (err) {
      setError(err.message ?? 'Could not save that goal.')
    }
  }
  async function deleteGoal(id) {
    const previous = goals
    setGoals(gs => gs.filter(g => g.id !== id))
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id)
    if (error) {
      setGoals(previous)
      setError(error.message ?? 'Could not delete that goal.')
    }
  }
  async function updateProgress(id, amount) {
    const goal = goals.find(g => g.id === id)
    if (goal && Number(goal.target_amount) > 0) {
      const wasReached = Number(goal.current_amount) >= Number(goal.target_amount)
      if (!wasReached && amount >= Number(goal.target_amount)) celebrate(1, `Reached ${goal.name}`)
    }
    const previous = goals
    setGoals(gs => gs.map(g => g.id === id ? { ...g, current_amount: amount } : g))
    const { error } = await supabase.from('goals').update({ current_amount: amount })
      .eq('id', id).eq('user_id', user.id)
    if (error) {
      setGoals(previous)
      setError(error.message ?? 'Could not update that goal.')
    }
  }
  function contribute(goalId, amount) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const next = Number(goal.current_amount) + amount
    updateProgress(goalId, next)
  }

  // ── The one suggestion (whispered, dismissable, only when the plan runs low) ──
  const DISMISS_KEY = `plan-sugg-dismissed-${user.id}`
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY)) ?? [] } catch { return [] }
  })
  function dismissSuggestion(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch {}
  }
  const suggestion = (!loading && activeSteps.length < 3)
    ? buildSuggestions({ profile, goals, debts, accounts, plans: plan ? [plan] : [] })
        .filter(s => !dismissed.includes(s.id))[0] ?? null
    : null

  async function runSuggestion(action) {
    if (action.kind === 'task') {
      const { plan: next } = await appendSteps(user.id, [{ text: action.text }], { source: 'suggestion' })
      setPlan(next)
    } else if (action.kind === 'goal') {
      addSuggestedGoal(action.preset)
    } else if (action.kind === 'ask') {
      navigate('/advisor', { state: { ask: action.q } })
    }
  }
  // One-tap goal from a preset, else open the modal to fill in details.
  async function addSuggestedGoal(preset) {
    if (!preset) { setModal('new'); return }
    // An emergency-fund goal starts at the user's existing liquid cushion (the
    // engine passes it as a hint) instead of pretending they're at $0.
    const target = Math.round(preset.target_amount) || 0
    const startAt = Math.min(Math.max(0, Math.round(preset.current_amount_hint || 0)), target)
    const { data, error } = await supabase.from('goals').insert({
      user_id: user.id, name: preset.name, goal_type: preset.goal_type || 'savings',
      target_amount: target, current_amount: startAt,
      monthly_contribution: Math.round(preset.monthly_contribution) || 0, deadline: null,
    }).select().single()
    if (error) {
      setError(error.message ?? 'Could not add that goal.')
      return
    }
    if (data) setGoals(gs => [...gs, data])
  }

  // Compact situation snapshot for the inline "Show me how" mini-guides — the
  // AI writes amounts against the user's real numbers without leaving the card.
  const howToCtx = [
    `Monthly income $${money.income.toLocaleString()}, expenses $${money.expenses.toLocaleString()} (surplus $${(money.income - money.expenses).toLocaleString()}/mo).`,
    `Net worth $${netWorth.toLocaleString()}.`,
    profile?.age ? `Age ${profile.age}.` : '',
    profile?.employment_type ? `Employment: ${profile.employment_type}.` : '',
    debts.length ? `Debts: ${debts.map(d => `${d.name} $${Number(d.balance).toLocaleString()}${d.interest_rate ? ` @ ${d.interest_rate}%` : ''}`).join(', ')}.` : 'No debts.',
  ].filter(Boolean).join(' ')

  // Living headline — the nearest goal you'll reach.
  const nearest = goals
    .map(g => ({ g, p: getProjection(g) }))
    .filter(x => x.p && !x.p.done && !x.p.longTerm && x.p.monthsLeft)
    .sort((a, b) => a.p.monthsLeft - b.p.monthsLeft)[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-4 pb-24 md:pb-8"
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
            badge: totalSteps === 0 ? null : (activeSteps.length === 0 ? 'all done' : `${activeSteps.length} left`) },
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
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/[0.075] rounded-2xl animate-pulse" />)}</div>
      ) : tab === 'steps' ? (
        <motion.div key="steps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }} className="space-y-3">

          {/* One thin line of garden progress — the reward, always visible */}
          <GardenMeter done={completedSteps + goalsReached} />

          {building ? (
            /* Starter plan generating — skeleton steps, not a spinner */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-200/80 px-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Building your plan from your real numbers…
              </div>
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-white/[0.06] rounded-xl animate-pulse" />)}
            </div>
          ) : upNext ? (
            <>
              {/* THE emphasized element — the one thing to do next */}
              <UpNextCard step={upNext} onToggle={toggleStep} onApply={applyAndMark} howToContext={howToCtx} />

              {/* Everything else stays quiet */}
              <StepList steps={restSteps}
                expandedId={expandedId} onExpand={setExpandedId}
                onToggle={toggleStep} onApply={applyAndMark}
                onSetDue={setDue} onDelete={deleteStep}
                howToContext={howToCtx} />

              {suggestion && <SuggestionRow suggestion={suggestion} onRun={runSuggestion} onDismiss={dismissSuggestion} />}

              <DoneAccordion steps={doneSteps} onToggle={toggleStep} />

              <div className="flex items-center justify-between">
                <AddStepRow onAdd={addOwnStep} />
                <button onClick={() => { if (clearArmed) clearPlan(); else setClearArmed(true) }}
                  className={`text-[11px] font-medium transition-colors ${
                    clearArmed ? 'text-rose-300 font-semibold' : 'text-white/25 hover:text-white/50'}`}>
                  {clearArmed ? 'Tap again to clear everything' : 'Clear my plan'}
                </button>
              </div>
            </>
          ) : totalSteps > 0 ? (
            /* Every step done — celebrate + point forward */
            <>
              <div className="bg-emerald-500/[0.08] rounded-2xl border border-emerald-400/25 p-6 text-center">
                <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Sprout className="w-5 h-5 text-emerald-300" />
                </div>
                <p className="text-white font-semibold text-sm mb-1">Every step done — your garden thanks you.</p>
                <p className="text-white/50 text-xs mb-4">Ask your advisor what's next, or add your own.</p>
                <Link to="/advisor"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  <Bot className="w-4 h-4" /> What's next?
                </Link>
              </div>
              {suggestion && <SuggestionRow suggestion={suggestion} onRun={runSuggestion} onDismiss={dismissSuggestion} />}
              <DoneAccordion steps={doneSteps} onToggle={toggleStep} />
              <AddStepRow onAdd={addOwnStep} />
            </>
          ) : (
            /* First run — one tap from empty to a real, personalized plan */
            <div className="bg-white/[0.075] rounded-2xl border border-white/[0.11] p-8 text-center">
              <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Sprout className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">Your garden is waiting</p>
              <p className="text-white/45 text-xs max-w-xs mx-auto mb-4">
                I'll turn your numbers into a short checklist. Each step you check off grows your garden.
              </p>
              <button onClick={buildStarterPlan}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-colors">
                <ClipboardList className="w-4 h-4" /> Build my starter plan
              </button>
              <div className="mt-3">
                <Link to="/advisor" className="text-xs text-white/40 hover:text-emerald-300 transition-colors">
                  or ask your advisor →
                </Link>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg text-center">{error}</p>
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
                  onUpdateProgress={updateProgress} onContribute={contribute}
                  howToContext={howToCtx} />
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
