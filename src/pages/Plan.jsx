import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Target, Plus, Sprout, MoreHorizontal, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden, milestonesToStage } from '@/context/GardenContext'
import { getPlan, updatePlanSteps, deletePlan, applyStep, appendSteps, normalizeSteps } from '@/lib/advisorPlans'
import { orderSteps } from '@/lib/planOrder'
import { requestPlan, chatConfigured } from '@/lib/claude'
import { buildContext, buildSystemPrompt } from '@/lib/advisorContext'
import { buildHowToContext } from '@/lib/howToContext'
import { GoalItem, GoalModal, getProjection } from '@/components/GoalItem'
import { UpNextCard, StepList, DoneAccordion, AddStepRow, NextChapterCard } from '@/components/PlanSteps'
import GardenMeter from '@/components/GardenMeter'
import GardenGrowthToast from '@/components/GardenGrowthToast'
import PageHeader from '@/components/ui/PageHeader'
import {
  filterFreshPlanSteps,
  isCurrentNextChapter,
  nextChapterFingerprint,
  shouldRequestNextChapter,
} from '@/lib/planReplenishment'

function readStorage(storage, key) {
  try { return storage.getItem(key) } catch { return null }
}

function writeStorage(storage, key, value) {
  try { storage.setItem(key, value) } catch {}
}

function removeStorage(storage, key) {
  try { storage.removeItem(key) } catch {}
}

export default function Plan() {
  const { user, profile, setProfile, rememberCompletedStep } = useAuth()
  const { updateGarden, triggerBurst } = useGarden()
  const navigate = useNavigate()
  const location = useLocation()
  const [plan,    setPlan]    = useState(null)   // THE plan (one per user) | null
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [money,   setMoney]   = useState({ income: 0, expenses: 0, netWorth: 0 })
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // null | 'new' | goal
  const [growth,  setGrowth]  = useState(null)   // garden-grew celebration
  const [error,   setError]   = useState(null)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [savingStep, setSavingStep] = useState(false)
  const [nextChapter, setNextChapter] = useState(null)
  const [nextStatus, setNextStatus] = useState('idle')
  const [nextError, setNextError] = useState(null)
  const [attemptedFingerprint, setAttemptedFingerprint] = useState(null)
  const dismissGrowth = useCallback(() => setGrowth(null), [])

  // A step completed on its detail page may have crossed a garden stage — the
  // detail page passes the crossing back so the celebration fires right here.
  useEffect(() => {
    const grew = location.state?.grew
    if (!grew) return
    window.history.replaceState({}, '')
    setGrowth(grew)
    triggerBurst()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const steps          = useMemo(() => plan?.steps ?? [], [plan])
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
  const visibleRestSteps = showAllSteps ? restSteps : restSteps.slice(0, 3)
  const doneSteps   = steps.filter(s => s.done)
  const currentFingerprint = useMemo(() => nextChapterFingerprint({
    userId: user.id, profile, steps, goals, debts, accounts,
  }), [user.id, profile, steps, goals, debts, accounts])
  const fingerprintRef = useRef(currentFingerprint)
  useEffect(() => { fingerprintRef.current = currentFingerprint }, [currentFingerprint])
  const dismissedKey = `next-chapter-dismissed-${user.id}`
  const cacheKey = `next-chapter-draft-${user.id}-${currentFingerprint}`

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
  async function toggleStep(stepId) {
    if (savingStep || !plan) return
    const step = steps.find(s => s.id === stepId)
    if (!step) return
    const completing = !step.done
    const next = steps.map(s => s.id === stepId
      ? { ...s, done: completing, completedAt: completing ? new Date().toISOString() : null }
      : s)
    setSavingStep(true)
    try {
      if (completing) {
        await rememberCompletedStep(step.text)
      }
      await updatePlanSteps(plan.id, next, user.id)
      setPlan(previous => previous ? { ...previous, steps: next, updated_at: new Date().toISOString() } : previous)
      if (completing) celebrate(1, step.text)
    } catch (err) {
      setError(err.message ?? 'Could not save that completed step.')
    } finally {
      setSavingStep(false)
    }
  }
  // Tapping a step opens its own page: the why + the full how-to, with a back
  // button. The step rides along in nav state for an instant paint.
  const openStep = (step) => navigate(`/plan/step/${step.id}`, { state: { step } })

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
      setManageOpen(false)
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

  const generateNextChapter = useCallback(async ({ force = false } = {}) => {
    const requestFingerprint = currentFingerprint
    if (!force && (nextStatus === 'loading' || nextStatus === 'saving')) return

    if (force) {
      removeStorage(window.localStorage, dismissedKey)
      removeStorage(window.sessionStorage, cacheKey)
    }

    setAttemptedFingerprint(requestFingerprint)
    setNextChapter(null)
    setNextError(null)
    setNextStatus('loading')

    try {
      if (!chatConfigured) {
        throw new Error('The advisor service is not available right now.')
      }

      const ctx = buildContext(money, goals, debts, profile, {
        plans: plan ? [plan] : [],
        accounts,
      })
      const system = buildSystemPrompt(ctx)
      const generated = await requestPlan([{
        role: 'user',
        content: `Build the next chapter of my financial action plan. Return exactly 5 concise, ordered, practical steps based on my current finances, goals, debts, accounts, ${activeSteps.length} unfinished plan steps, and completed history. Do not repeat anything already active or completed. Avoid recommending insurance, investing, emergency-fund, or debt work when the profile and completed history show it is already handled. Include apply actions only when they are safe and immediately useful.`,
      }], system)

      const { fresh } = filterFreshPlanSteps(steps, generated.steps, { dedupeCompleted: true })
      const proposed = fresh.slice(0, 5)
      if (proposed.length < 3) {
        throw new Error('The advisor could not find enough new steps yet. You can try again when your finances change.')
      }

      if (!isCurrentNextChapter(requestFingerprint, fingerprintRef.current)) return

      const draft = {
        title: generated.title || 'Keep your momentum growing',
        steps: proposed,
      }
      writeStorage(window.sessionStorage, cacheKey, JSON.stringify({
        fingerprint: requestFingerprint,
        draft,
      }))
      setNextChapter({ fingerprint: requestFingerprint, draft })
      setNextStatus('ready')
    } catch (err) {
      if (!isCurrentNextChapter(requestFingerprint, fingerprintRef.current)) return
      setNextError(err.message ?? 'Could not prepare your next chapter.')
      setNextStatus('error')
    }
  }, [accounts, activeSteps.length, cacheKey, currentFingerprint, debts, dismissedKey, goals, money, nextStatus, plan, profile, steps])

  useEffect(() => {
    if (loading || growth || tab !== 'steps') return

    if (activeSteps.length > 2) {
      if (nextStatus !== 'idle' || nextChapter || nextError) {
        setNextChapter(null)
        setNextError(null)
        setNextStatus('idle')
        setAttemptedFingerprint(null)
      }
      return
    }

    if (attemptedFingerprint && attemptedFingerprint !== currentFingerprint && nextStatus !== 'saving') {
      setNextChapter(null)
      setNextError(null)
      setNextStatus('idle')
      setAttemptedFingerprint(null)
      return
    }

    if (nextChapter && nextChapter.fingerprint !== currentFingerprint) {
      setNextChapter(null)
      setNextStatus('idle')
      setNextError(null)
      return
    }

    if (nextChapter || nextStatus === 'loading' || nextStatus === 'saving' || nextStatus === 'error') return

    const cached = readStorage(window.sessionStorage, cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (parsed.fingerprint === currentFingerprint && parsed.draft?.steps?.length) {
          setNextChapter(parsed)
          setNextStatus('ready')
          return
        }
      } catch {
        removeStorage(window.sessionStorage, cacheKey)
      }
    }

    const dismissedFingerprint = readStorage(window.localStorage, dismissedKey)
    if (dismissedFingerprint === currentFingerprint) {
      if (nextStatus !== 'dismissed') setNextStatus('dismissed')
      return
    }

    if (!shouldRequestNextChapter({
      activeCount: activeSteps.length,
      fingerprint: currentFingerprint,
      attemptedFingerprint,
      dismissedFingerprint,
      hasDraft: Boolean(nextChapter),
      loading,
      busy: savingStep,
    })) return

    void generateNextChapter()
  }, [activeSteps.length, attemptedFingerprint, cacheKey, currentFingerprint, dismissedKey, generateNextChapter, growth, loading, nextChapter, nextError, nextStatus, savingStep, tab])

  async function approveNextChapter() {
    if (!nextChapter?.draft?.steps?.length || nextStatus === 'saving') return
    if (!isCurrentNextChapter(nextChapter.fingerprint, currentFingerprint)) {
      void generateNextChapter({ force: true })
      return
    }

    setNextError(null)
    setNextStatus('saving')
    try {
      const { plan: updated, added } = await appendSteps(user.id, nextChapter.draft.steps, {
        source: 'advisor',
        group: 'Next chapter',
        dedupeCompleted: true,
      })
      if (!added) throw new Error('Those steps are already part of your financial history.')
      setPlan(updated)
      removeStorage(window.sessionStorage, cacheKey)
      setNextChapter(null)
      setAttemptedFingerprint(null)
      setNextStatus('idle')
    } catch (err) {
      setNextError(err.message ?? 'Could not add these steps. Your current plan was not changed.')
      setNextStatus('error')
    }
  }

  function dismissNextChapter() {
    writeStorage(window.localStorage, dismissedKey, currentFingerprint)
    removeStorage(window.sessionStorage, cacheKey)
    setNextChapter(null)
    setNextError(null)
    setNextStatus('dismissed')
  }

  function regenerateNextChapter() {
    setNextChapter(null)
    setNextError(null)
    setNextStatus('idle')
    setAttemptedFingerprint(null)
    void generateNextChapter({ force: true })
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
      throw err
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

  // Situation snapshot for the goal cards' inline "Show me how" guides (steps
  // build theirs on the step detail page from the same shared builder).
  const howToCtx = buildHowToContext({ profile, debts, income: money.income, expenses: money.expenses, netWorth })

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
      <PageHeader
        icon={ClipboardList}
        eyebrow="Your path"
        title="Plan"
        subtitle={tab === 'steps' ? 'One clear move at a time.' : 'Grow the goals that matter most.'}
        actions={plan && (
          <div className="relative">
            <button onClick={() => setManageOpen(open => !open)} aria-label="Manage plan" aria-expanded={manageOpen}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {manageOpen && (
              <>
                <button aria-label="Close plan menu" onClick={() => setManageOpen(false)} className="fixed inset-0 z-20 cursor-default" />
                <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-white/[0.12] bg-[#101a14] p-2 shadow-2xl shadow-black/40">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Plan management</p>
                  <button onClick={() => { if (clearArmed) clearPlan(); else setClearArmed(true) }}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm transition-colors ${clearArmed ? 'bg-rose-500/15 text-rose-200' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}>
                    <Trash2 className="h-4 w-4" />
                    {clearArmed ? 'Confirm clear plan' : 'Clear plan'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      />

      {/* ── Steps | Goals switcher — a checklist you DO vs targets you GROW ── */}
      <div className="sticky top-0 z-20 -mx-1 border-y border-white/[0.06] bg-[#0b1410]/90 px-1 py-2 backdrop-blur-xl md:top-3 md:rounded-2xl md:border">
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
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/[0.075] rounded-2xl animate-pulse" />)}</div>
      ) : tab === 'steps' ? (
        <motion.div key="steps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }} className="space-y-3">

          {/* One thin line of garden progress — the reward, always visible */}
          {upNext ? (
            <>
              {/* THE emphasized element — the one thing to do next */}
              <UpNextCard step={upNext} onToggle={toggleStep} onApply={applyAndMark} onOpen={openStep}
                progress={<GardenMeter done={completedSteps + goalsReached} embedded />} />

              {/* Everything else stays quiet — tap a row for its own page */}
              <StepList steps={visibleRestSteps} onToggle={toggleStep} onOpen={openStep} />
              {restSteps.length > 3 && (
                <button onClick={() => setShowAllSteps(show => !show)}
                  className="min-h-11 w-full rounded-xl text-sm font-semibold text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
                  {showAllSteps ? 'Show less' : `Show all ${restSteps.length} queued steps`}
                </button>
              )}

              <DoneAccordion steps={doneSteps} onToggle={toggleStep} />

              {activeSteps.length <= 2 && !growth && (
                <NextChapterCard
                  status={nextStatus}
                  draft={nextChapter?.draft}
                  error={nextError}
                  onAdd={approveNextChapter}
                  onDismiss={dismissNextChapter}
                  onRegenerate={regenerateNextChapter}
                  onRetry={regenerateNextChapter}
                />
              )}

              <AddStepRow onAdd={addOwnStep} />
            </>
          ) : totalSteps > 0 ? (
            /* Every step done — celebrate + point forward */
            <>
              <GardenMeter done={completedSteps + goalsReached} />
              <div className="bg-emerald-500/[0.08] rounded-2xl border border-emerald-400/25 p-6 text-center">
                <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Sprout className="w-5 h-5 text-emerald-300" />
                </div>
                <p className="text-white font-semibold text-sm mb-1">Every step done — your garden thanks you.</p>
                <p className="text-readable-secondary text-xs">Your next suggestions appear below after this completion is safely remembered.</p>
              </div>
              <DoneAccordion steps={doneSteps} onToggle={toggleStep} />
              {!growth && (
                <NextChapterCard
                  status={nextStatus}
                  draft={nextChapter?.draft}
                  error={nextError}
                  onAdd={approveNextChapter}
                  onDismiss={dismissNextChapter}
                  onRegenerate={regenerateNextChapter}
                  onRetry={regenerateNextChapter}
                />
              )}
              <AddStepRow onAdd={addOwnStep} />
            </>
          ) : (
            <>
              <NextChapterCard
                status={nextStatus}
                draft={nextChapter?.draft}
                error={nextError}
                onAdd={approveNextChapter}
                onDismiss={dismissNextChapter}
                onRegenerate={regenerateNextChapter}
                onRetry={regenerateNextChapter}
                isEmpty
              />
              <AddStepRow onAdd={addOwnStep} />
            </>
          )}

          {error && (
            <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg text-center">{error}</p>
          )}
        </motion.div>
      ) : (
        <motion.div key="goals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }} className="space-y-3">

          {/* Living headline — this is goal news, so it lives on the Goals tab */}
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.12] to-white/[0.035] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/65">Across all goals</p>
                <p className="mt-2 font-display text-2xl font-medium text-white tabular-nums">
                  ${goals.reduce((s, g) => s + Number(g.current_amount || 0), 0).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  of ${goals.reduce((s, g) => s + Number(g.target_amount || 0), 0).toLocaleString()} saved · {goalsReached} reached
                </p>
              </div>
              <button onClick={() => setModal('new')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
                <Plus className="w-3.5 h-3.5" /> Add goal
              </button>
            </div>
            {nearest && (
              <p className="mt-4 border-t border-white/[0.08] pt-3 text-sm text-white/65">
                <Sprout className="mr-1.5 inline h-4 w-4 text-emerald-300" />
                <span className="font-semibold text-white">{nearest.g.name}</span> is on pace for <span className="text-emerald-200">{nearest.p.label}</span>.
              </p>
            )}
          </div>

          {goals.length === 0 ? (
            <div className="bg-white/[0.075] rounded-xl border border-white/[0.11] p-6 text-center">
              <p className="text-white/55 text-xs max-w-xs mx-auto">
                Saving toward something — a house, emergency fund, a trip? Add a goal to plant a tree. Reaching it grows your garden.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {goals.map(g => (
                <GoalItem key={g.id} goal={g}
                  onEdit={setModal} onDelete={deleteGoal}
                  onUpdateProgress={updateProgress} onContribute={contribute}
                  howToContext={howToCtx} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {modal && <GoalModal goal={modal === 'new' ? null : modal} onSave={saveGoal} onClose={() => setModal(null)} />}
      <GardenGrowthToast data={growth} onDismiss={dismissGrowth} />
    </motion.div>
  )
}
