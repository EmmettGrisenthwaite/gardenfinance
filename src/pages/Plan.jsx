import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Target, MoreHorizontal, Trash2, History, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden, milestonesToStage } from '@/context/GardenContext'
import { milestoneEventForGoal, milestoneEventForStep, milestoneEventsFromState } from '@/lib/gardenModel'
import { reconcileGardenMilestones, recordGardenMilestone } from '@/lib/gardenProgress'
import { getPlan, updatePlanSteps, deletePlan, applyStep, appendSteps, normalizeSteps } from '@/lib/advisorPlans'
import { requestFocusPlan, chatConfigured } from '@/lib/claude'
import { computeSnapshot } from '@/lib/finance'
import { buildHowToContext } from '@/lib/howToContext'
import { GoalItem, GoalModal } from '@/components/GoalItem'
import ReminderWorkspace from '@/components/ReminderWorkspace'
import {
  UpNextCard,
  DoneAccordion,
  AddStepRow,
  CalmNextChapterCard,
  PlanPrerequisite,
  FocusQueue,
  LaterAccordion,
  CalmOutdatedStepReview,
} from '@/components/PlanSteps'
import GardenMeter from '@/components/GardenMeter'
import GardenGrowthToast from '@/components/GardenGrowthToast'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import ProgressActivitySheet from '@/components/ProgressActivitySheet'
import { listFinancialActivities, recordStepActivity } from '@/lib/financialActivities'
import { isPromptableActivity } from '@/lib/progressOutcome'
import {
  buildPlanModel,
  mergeFocusWording,
  replacementCandidate,
  validateFocusPlanResult,
} from '@/lib/focusedPlan'
import { getMoneySetupState } from '@/lib/moneySetup'
import { filterFreshPlanSteps } from '@/lib/planReplenishment'
import { buildReminderModel } from '@/lib/reminderModel'
import {
  actOnReminder,
  approveReminderCandidate,
  dismissReminderCandidate,
  listReminderEvents,
  listReminders,
  saveReminder,
  setReminderStatus,
} from '@/lib/reminders'

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
  const { user, profile, setProfile, refreshProfile, rememberCompletedStep } = useAuth()
  const { updateGarden, triggerBurst } = useGarden()
  const navigate = useNavigate()
  const location = useLocation()
  const [plan,    setPlan]    = useState(null)   // THE plan (one per user) | null
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [money,   setMoney]   = useState({ income: 0, expenses: 0, netWorth: 0 })
  const [accounts, setAccounts] = useState([])
  const [cashFlowItems, setCashFlowItems] = useState([])
  const [budgetLimits, setBudgetLimits] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // null | 'new' | goal
  const [growth,  setGrowth]  = useState(null)   // garden-grew celebration
  const [error,   setError]   = useState(null)
  const [notice, setNotice] = useState(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [savingStep, setSavingStep] = useState(false)
  const [gardenTotal, setGardenTotal] = useState(0)
  const [gardenMilestones, setGardenMilestones] = useState([])
  const [nextChapter, setNextChapter] = useState(null)
  const [nextStatus, setNextStatus] = useState('idle')
  const [nextError, setNextError] = useState(null)
  const [attemptedFingerprint, setAttemptedFingerprint] = useState(null)
  const [activities, setActivities] = useState([])
  const [reminders, setReminders] = useState([])
  const [reminderEvents, setReminderEvents] = useState([])
  const [pendingLinkedReminder, setPendingLinkedReminder] = useState(null)
  const [completionOffer, setCompletionOffer] = useState(null)
  const [goalDetail, setGoalDetail] = useState(null)
  const [activitySheetOpen, setActivitySheetOpen] = useState(false)
  const [promptActivity, setPromptActivity] = useState(null)
  const [queuedActivity, setQueuedActivity] = useState(null)
  const dismissGrowth = useCallback(() => setGrowth(null), [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!queuedActivity || growth || loading) return
    setPromptActivity(queuedActivity)
    setActivitySheetOpen(true)
    setQueuedActivity(null)
  }, [growth, loading, queuedActivity])

  // A step completed on its detail page may have crossed a garden stage — the
  // detail page passes the crossing back so the celebration fires right here.
  useEffect(() => {
    const grew = location.state?.grew
    const syncError = location.state?.gardenSyncError
    if (!grew && !syncError) return
    window.history.replaceState({}, '')
    if (grew) {
      setGrowth(grew)
      triggerBurst()
    }
    if (syncError) setError(syncError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadGoals() {
    const { data: g, error: goalError } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
    if (goalError) throw goalError
    setGoals(g ?? [])
  }

  useEffect(() => {
    async function load() {
      const [g, d, pl, ac, flow, limits, activityRows, reminderRows, reminderEventRows] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('*').eq('user_id', user.id),
        getPlan(user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('cash_flow_items').select('*').eq('user_id', user.id).order('sort_order'),
        supabase.from('budget_limits').select('*').eq('user_id', user.id),
        listFinancialActivities(user.id),
        listReminders(user.id),
        listReminderEvents(user.id),
      ])
      if (g.error) throw g.error
      if (d.error) throw d.error
      if (ac.error) throw ac.error
      if (flow.error) throw flow.error
      if (limits.error) throw limits.error
      const loadedAccounts = ac.data ?? []
      const loadedDebts = d.data ?? []
      const loadedFlow = flow.data ?? []
      const loadedLimits = limits.data ?? []
      const loadedSnapshot = computeSnapshot({
        profile, accounts: loadedAccounts, debts: loadedDebts, goals: g.data ?? [],
        cashFlowItems: loadedFlow, budgetLimits: loadedLimits,
      })
      setGoals(g.data ?? [])
      setDebts(loadedDebts)
      setPlan(pl)
      setAccounts(loadedAccounts)
      setCashFlowItems(loadedFlow)
      setBudgetLimits(loadedLimits)
      setActivities(activityRows)
      setReminders(reminderRows)
      setReminderEvents(reminderEventRows)
      const unseen = activityRows.find(activity => isPromptableActivity(activity) && !activity.prompt_seen_at)
      if (unseen) setQueuedActivity(unseen)
      try {
        const garden = await reconcileGardenMilestones(user.id, {
          plans: pl ? [pl] : [],
          goals: g.data ?? [],
        })
        setGardenTotal(garden.total)
        setGardenMilestones(garden.milestones)
      } catch {
        const fallback = milestoneEventsFromState({ plans: pl ? [pl] : [], goals: g.data ?? [] })
        setGardenTotal(fallback.length)
        setGardenMilestones(fallback)
        setError('Your plan loaded, but permanent garden progress could not sync yet.')
      }
      setMoney({
        income: loadedSnapshot.income,
        expenses: loadedSnapshot.expenses,
        netWorth: loadedSnapshot.netWorth,
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
  const totalSteps     = steps.filter(step => !step.supersededAt).length

  // The one shared ordering — the Up-next card, this list, and the Dashboard
  // peek all agree on what's next.
  const snapshot = useMemo(() => computeSnapshot({
    profile, accounts, debts, goals, cashFlowItems, budgetLimits,
  }), [profile, accounts, debts, goals, cashFlowItems, budgetLimits])
  const setupState = useMemo(() => getMoneySetupState({
    profile, accounts, debts, goals, cashFlowItems,
  }), [profile, accounts, debts, goals, cashFlowItems])
  const reminderModel = useMemo(() => buildReminderModel({
    snapshot, profile, accounts, debts, goals, activities,
    reminders, events: reminderEvents,
  }), [snapshot, profile, accounts, debts, goals, activities, reminders, reminderEvents])
  const basePlanModel = useMemo(() => buildPlanModel({
    snapshot, setupState, plan, activities, reminders,
  }), [snapshot, setupState, plan, activities, reminders])
  const currentFingerprint = basePlanModel.fingerprint
  const currentDraft = nextChapter?.fingerprint === currentFingerprint ? nextChapter.draft : null
  const planModel = useMemo(() => buildPlanModel({
    snapshot, setupState, plan, activities, reminders, proposals: currentDraft?.steps || [],
  }), [snapshot, setupState, plan, activities, reminders, currentDraft])
  const activeSteps = useMemo(() => steps.filter(step => !step.done && !step.supersededAt), [steps])
  const upNext = planModel.focus[0] ?? null
  const afterThis = planModel.focus.slice(1, 3)
  const doneSteps = steps.filter(step => step.done)
  const replacement = replacementCandidate(planModel)
  const fingerprintRef = useRef(currentFingerprint)
  useEffect(() => { fingerprintRef.current = currentFingerprint }, [currentFingerprint])
  const dismissedKey = `focus-plan-dismissed-${user.id}`
  const cacheKey = `focus-plan-draft-${user.id}-${currentFingerprint}`

  // Net worth auto-derives from what you own (accounts) minus what you owe
  // (debts) — one source of truth, always in sync as those change.
  const accountsTotal = accounts.filter(a => a.include_in_net_worth !== false).reduce((s, a) => s + Number(a.balance || 0), 0)
  const debtsTotal    = debts.filter(d => d.include_in_net_worth !== false).reduce((s, d) => s + Number(d.balance || 0), 0)
  const netWorth      = accountsTotal - debtsTotal

  // Keep the garden in sync with live state.
  useEffect(() => {
    if (loading) return
    updateGarden({
      milestones: gardenMilestones,
      milestoneTotal: gardenTotal,
      goals,
      income: money.income,
      expenses: money.expenses,
    })
  }, [gardenMilestones, gardenTotal, goals, money.income, money.expenses, loading, updateGarden])

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

  function acceptGardenResult(result, label) {
    setGardenTotal(result.total)
    if (result.inserted) {
      const newStage = milestonesToStage(result.total)
      if (newStage > milestonesToStage(result.previousTotal)) {
        setGrowth({ stage: newStage, stepText: label })
        triggerBurst()
      }
    }
  }

  async function recordEarnedMilestone(event, label) {
    try {
      const result = await recordGardenMilestone(event)
      acceptGardenResult(result, label)
      return result
    } catch {
      setError('Your change was saved. Permanent garden progress will catch up automatically when you return.')
      return null
    }
  }

  // ── Step handlers (functional updaters → burst-safe) ────────────────────────
  async function editSteps(mutate) {
    if (!plan || savingStep) return null
    const next = mutate(plan.steps)
    setSavingStep(true)
    try {
      await updatePlanSteps(plan.id, next, user.id)
      setPlan(previous => previous ? { ...previous, steps: next, updated_at: new Date().toISOString() } : previous)
      return next
    } catch (err) {
      try { setPlan(await getPlan(user.id)) } catch { /* keep the visible error below */ }
      setError(err.message ?? 'Could not save that plan change.')
      throw err
    } finally {
      setSavingStep(false)
    }
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
      await updatePlanSteps(plan.id, next, user.id)
      setPlan(previous => previous ? { ...previous, steps: next, updated_at: new Date().toISOString() } : previous)
      if (completing) {
        try {
          await rememberCompletedStep(step.text)
        } catch {
          setError('Step completed. Advisor memory will reconcile automatically the next time your profile loads.')
        }
        const stepIndex = steps.findIndex(item => item.id === step.id)
        await recordEarnedMilestone(milestoneEventForStep(
          plan,
          { ...step, done: true, completedAt: next.find(item => item.id === step.id)?.completedAt },
          stepIndex >= 0 ? stepIndex : 0,
        ), step.text)
        try {
          const completedStep = next.find(item => item.id === step.id)
          const activity = await recordStepActivity({ plan, step: completedStep, accounts, debts, goals })
          if (activity) {
            setActivities(current => [activity, ...current.filter(item => item.id !== activity.id)])
            if (isPromptableActivity(activity) && !activity.prompt_seen_at) setQueuedActivity(activity)
          }
        } catch {
          setError('Step completed. You can update any resulting balance from Home; progress memory will retry later.')
        }
      }
    } catch (err) {
      try { setPlan(await getPlan(user.id)) } catch { /* preserve the original error */ }
      setError(err.message ?? 'Could not save that completed step.')
    } finally {
      setSavingStep(false)
    }
  }
  // Tapping a step opens its own page: the why + the full how-to, with a back
  // button. The step rides along in nav state for an instant paint.
  const openStep = (step) => navigate(`/plan/step/${step.id}`, { state: { step } })

  // Manual steps stay user-owned, while the shared admission check prevents an
  // accidental duplicate from occupying a second focus position.
  async function addOwnStep(text) {
    try {
      const step = normalizeSteps([{
        text,
        source: 'user',
        addedAt: new Date().toISOString(),
        chapterId: planModel.approvedCount >= 3 ? 'manual.later' : null,
      }])[0]
      if (plan) {
        const admission = filterFreshPlanSteps(steps, [step])
        if (!admission.fresh.length) {
          setNotice('That action is already in your Plan.')
          return
        }
        await editSteps(list => [...list, admission.fresh[0]])
        if (planModel.approvedCount >= 3) setNotice('Step added to Later. Use “Make next” whenever you want to promote it.')
      } else {
        const { plan: created } = await appendSteps(user.id, [step], { source: 'user' })
        setPlan(created)
      }
    } catch (err) {
      setError(err.message ?? 'Could not add that step.')
    }
  }

  async function makeNext(step) {
    if (!step || savingStep) return
    const pinnedAt = new Date().toISOString()
    try {
      await editSteps(list => list.map(item => item.id === step.id
        ? { ...item, pinnedAt }
        : { ...item, pinnedAt: null }))
    } catch { /* editSteps already restored canonical state and surfaced the error */ }
  }

  async function keepOutdated(step) {
    if (!step || savingStep) return
    try {
      await editSteps(list => list.map(item => item.id === step.id
        ? { ...item, reviewOverrideFingerprint: currentFingerprint }
        : item))
    } catch { /* handled by editSteps */ }
  }

  async function replaceOutdated(step, proposed) {
    if (!step || !proposed || savingStep) return
    const now = new Date().toISOString()
    const normalizedReplacement = normalizeSteps([{
      ...proposed,
      id: undefined,
      proposed: undefined,
      source: 'focus',
      addedAt: now,
      generatedForFingerprint: currentFingerprint,
    }])[0]
    const admission = filterFreshPlanSteps(
      steps.filter(item => item.id !== step.id),
      [normalizedReplacement],
      { dedupeCompleted: true },
    )
    if (!admission.fresh.length) {
      setNotice('That replacement is already represented in your Plan.')
      return
    }
    const replacementStep = admission.fresh[0]
    try {
      await editSteps(list => [
        ...list.map(item => item.id === step.id
          ? { ...item, supersededAt: now, pinnedAt: null }
          : item),
        replacementStep,
      ])
    } catch { /* handled by editSteps */ }
  }

  function openPrerequisite(item) {
    if (item?.sheet) navigate(`/?section=money&sheet=${encodeURIComponent(item.sheet)}`)
    else navigate('/plan#goals')
  }

  // Clearing everything is destructive — two-tap arm, tucked at the bottom.
  const [clearArmed, setClearArmed] = useState(false)
  useEffect(() => {
    if (!clearArmed) return
    const t = setTimeout(() => setClearArmed(false), 2500)
    return () => clearTimeout(t)
  }, [clearArmed])
  async function clearPlan() {
    if (!plan || savingStep) return
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
      await editSteps(list => list.map(s => s.id === step.id ? { ...s, applied: true } : s))
      if (step.apply?.type === 'budget') {
        // The apply changed profile income/expenses — refresh so the page and the
        // advisor read the new truth immediately.
        const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (profileError) throw profileError
        if (data) {
          setProfile(data)
          setMoney(m => ({ ...m, income: Number(data.monthly_income) || 0, expenses: Number(data.monthly_expenses) || 0 }))
        }
        const [flowResult, limitResult] = await Promise.all([
          supabase.from('cash_flow_items').select('*').eq('user_id', user.id).order('sort_order'),
          supabase.from('budget_limits').select('*').eq('user_id', user.id),
        ])
        if (flowResult.error) throw flowResult.error
        if (limitResult.error) throw limitResult.error
        setCashFlowItems(flowResult.data ?? [])
        setBudgetLimits(limitResult.data ?? [])
      }
      if (step.apply?.type === 'goal') await loadGoals()
    } catch (err) {
      setError(err.message ?? 'Could not apply that step.')
    }
  }

  async function refreshActivityFinancials() {
    const [accountResult, debtResult, goalResult, activityRows] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('debts').select('*').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
      listFinancialActivities(user.id),
    ])
    if (accountResult.error) throw accountResult.error
    if (debtResult.error) throw debtResult.error
    if (goalResult.error) throw goalResult.error
    setAccounts(accountResult.data ?? [])
    setDebts(debtResult.data ?? [])
    setGoals(goalResult.data ?? [])
    setActivities(activityRows)
    await refreshProfile()
    return { accounts: accountResult.data ?? [], debts: debtResult.data ?? [], goals: goalResult.data ?? [] }
  }

  async function handleActivityApplied(result) {
    const nextAccounts = result?.accounts ?? accounts
    const nextDebts = result?.debts ?? debts
    const nextGoals = result?.goals ?? goals
    setAccounts(nextAccounts)
    setDebts(nextDebts)
    setGoals(nextGoals)
    if (result?.activity) setActivities(current => [result.activity, ...current.filter(item => item.id !== result.activity.id)])
    for (const nextGoal of nextGoals) {
      const previous = goals.find(goal => goal.id === nextGoal.id)
      const wasReached = previous && Number(previous.target_amount) > 0 && Number(previous.current_amount) >= Number(previous.target_amount)
      const isReached = Number(nextGoal.target_amount) > 0 && Number(nextGoal.current_amount) >= Number(nextGoal.target_amount)
      if (!wasReached && isReached) await recordEarnedMilestone(milestoneEventForGoal(nextGoal), `Reached ${nextGoal.name}`)
    }
    await refreshProfile()
    setPromptActivity(null)
  }

  function handleActivityChanged(changed) {
    if (!changed) return
    setActivities(current => [changed, ...current.filter(item => item.id !== changed.id)])
    setPromptActivity(null)
  }

  function closeActivitySheet() {
    setActivitySheetOpen(false)
    setPromptActivity(null)
  }

  async function refreshReminderRecords() {
    const [nextReminders, nextEvents] = await Promise.all([
      listReminders(user.id),
      listReminderEvents(user.id),
    ])
    setReminders(nextReminders)
    setReminderEvents(nextEvents)
    return { reminders: nextReminders, events: nextEvents }
  }

  // Approval is based on a fresh canonical read, not the values that happened
  // to be on screen when the suggestion was first rendered.
  async function refreshReminderContext() {
    const [profileResult, accountResult, debtResult, goalResult, flowResult, limitResult, activityRows, reminderRows, eventRows] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('debts').select('*').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('cash_flow_items').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('budget_limits').select('*').eq('user_id', user.id),
      listFinancialActivities(user.id),
      listReminders(user.id),
      listReminderEvents(user.id),
    ])
    for (const result of [profileResult, accountResult, debtResult, goalResult, flowResult, limitResult]) {
      if (result.error) throw result.error
    }
    const canonicalProfile = profileResult.data || profile
    const canonicalAccounts = accountResult.data || []
    const canonicalDebts = debtResult.data || []
    const canonicalGoals = goalResult.data || []
    const canonicalFlow = flowResult.data || []
    const canonicalLimits = limitResult.data || []
    const canonicalSnapshot = computeSnapshot({
      profile: canonicalProfile,
      accounts: canonicalAccounts,
      debts: canonicalDebts,
      goals: canonicalGoals,
      cashFlowItems: canonicalFlow,
      budgetLimits: canonicalLimits,
    })
    setProfile(canonicalProfile)
    setAccounts(canonicalAccounts)
    setDebts(canonicalDebts)
    setGoals(canonicalGoals)
    setCashFlowItems(canonicalFlow)
    setBudgetLimits(canonicalLimits)
    setActivities(activityRows)
    setReminders(reminderRows)
    setReminderEvents(eventRows)
    return buildReminderModel({
      snapshot: canonicalSnapshot,
      profile: canonicalProfile,
      accounts: canonicalAccounts,
      debts: canonicalDebts,
      goals: canonicalGoals,
      activities: activityRows,
      reminders: reminderRows,
      events: eventRows,
    })
  }

  async function approveReminderSuggestion(candidate) {
    const canonicalModel = await refreshReminderContext()
    const canonical = canonicalModel.suggestions.find(item => item.candidateKey === candidate.candidateKey)
    if (!canonical || canonical.sourceFingerprint !== candidate.sourceFingerprint) {
      const stale = new Error('The financial information behind this suggestion changed. The current suggestion is now shown instead.')
      stale.code = 'STALE_REMINDER_CANDIDATE'
      throw stale
    }
    const approved = candidate.userEdited ? {
      ...canonical,
      title: candidate.title,
      detail: candidate.detail,
      cadence: candidate.cadence,
      anchorDate: candidate.anchorDate,
      linkedRecordType: candidate.linkedRecordType,
      linkedRecordId: candidate.linkedRecordId,
      userEdited: true,
    } : canonical
    await approveReminderCandidate(approved)
    await refreshReminderRecords()
    setNotice('Reminder added. It will never change a balance on its own.')
  }

  async function dismissReminderSuggestion(candidate) {
    await dismissReminderCandidate(candidate)
    await refreshReminderRecords()
  }

  async function persistReminder(payload) {
    await saveReminder(payload)
    await refreshReminderRecords()
    setNotice(payload.id ? 'Reminder updated.' : 'Reminder added.')
  }

  async function performReminderAction(reminder, action, snoozedUntil = null) {
    await actOnReminder(reminder, action, snoozedUntil)
    await refreshReminderRecords()
    if (completionOffer?.id === reminder.id) setCompletionOffer(null)
    setNotice(action === 'done' ? 'Check-in completed. No balances were changed.' : action === 'skipped' ? 'This occurrence was skipped.' : `Snoozed until ${new Date(`${snoozedUntil}T12:00:00`).toLocaleDateString()}.`)
  }

  async function changeReminderStatus(reminder, status, metadataPatch = {}) {
    await setReminderStatus(reminder.id, status, metadataPatch)
    await refreshReminderRecords()
    setNotice(status === 'archived' ? 'Reminder archived. Its history is preserved.' : status === 'paused' ? 'Reminder paused.' : 'Reminder active.')
  }

  function openReminderContext(reminder) {
    if (reminder.linked_record_type === 'goal' && reminder.linked_record_id) {
      const linkedGoal = goals.find(goal => goal.id === reminder.linked_record_id)
      if (linkedGoal) {
        setPendingLinkedReminder(reminder)
        setModal(linkedGoal)
        return
      }
    }
    const fallback = {
      monthly_plan: '/?sheet=plan', money_records: '/?sheet=balances',
      debt: '/?sheet=debts', account: '/?section=money&sheet=accounts',
      profile: '/settings',
    }[reminder.linked_record_type]
    const target = reminder.metadata?.action_target || fallback
    if (!target) return
    const [withoutHash, hash] = target.split('#')
    const separator = withoutHash.includes('?') ? '&' : '?'
    const linkedParam = reminder.linked_record_type === 'account' && reminder.linked_record_id
      ? `&accountId=${encodeURIComponent(reminder.linked_record_id)}`
      : reminder.linked_record_type === 'debt' && reminder.linked_record_id
        ? `&debtId=${encodeURIComponent(reminder.linked_record_id)}` : ''
    navigate(`${withoutHash}${separator}reminder=${encodeURIComponent(reminder.id)}&reminderDue=${encodeURIComponent(reminder.next_due_on)}${linkedParam}${hash ? `#${hash}` : ''}`)
  }

  const generateNextChapter = useCallback(async ({ force = false } = {}) => {
    const requestFingerprint = currentFingerprint
    if (!force && (nextStatus === 'loading' || nextStatus === 'saving')) return
    const candidates = basePlanModel.candidates
    if (!candidates.length) {
      setNextChapter(null)
      setNextStatus('idle')
      return
    }

    if (force) {
      removeStorage(window.localStorage, dismissedKey)
      removeStorage(window.sessionStorage, cacheKey)
    }

    setAttemptedFingerprint(requestFingerprint)
    const fallbackDraft = { title: 'Your focused next moves', steps: candidates }
    setNextChapter({ fingerprint: requestFingerprint, draft: fallbackDraft })
    setNextError(null)
    setNextStatus('loading')

    try {
      if (!chatConfigured) {
        setNextStatus('fallback')
        return
      }

      const first = await requestFocusPlan(candidates, { fingerprint: requestFingerprint }, { desiredSteps: candidates.length })
      const firstValidation = validateFocusPlanResult(first, candidates)
      let second = null
      if (firstValidation.rejected.length) {
        const rejectedCandidates = firstValidation.rejected.map(item => item.candidate)
        second = await requestFocusPlan(rejectedCandidates, { fingerprint: requestFingerprint, retry: true }, { desiredSteps: rejectedCandidates.length })
      }
      if (requestFingerprint !== fingerprintRef.current) return

      const draft = {
        title: 'Your focused next moves',
        steps: mergeFocusWording(candidates, first, second),
      }
      writeStorage(window.sessionStorage, cacheKey, JSON.stringify({
        fingerprint: requestFingerprint,
        draft,
      }))
      setNextChapter({ fingerprint: requestFingerprint, draft })
      setNextStatus('ready')
    } catch {
      if (requestFingerprint !== fingerprintRef.current) return
      setNextChapter({ fingerprint: requestFingerprint, draft: fallbackDraft })
      setNextError('The focused steps are ready with verified wording. Personalized phrasing could not load just now.')
      setNextStatus('error')
    }
  }, [basePlanModel.candidates, cacheKey, currentFingerprint, dismissedKey, nextStatus])

  useEffect(() => {
    if (loading || growth || tab !== 'steps') return

    if (!basePlanModel.candidates.length) {
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

    if (nextChapter || ['loading', 'saving', 'error', 'fallback', 'ready'].includes(nextStatus)) return

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

    if (attemptedFingerprint === currentFingerprint || dismissedFingerprint === currentFingerprint || savingStep) return

    void generateNextChapter()
  }, [attemptedFingerprint, basePlanModel.candidates.length, cacheKey, currentFingerprint, dismissedKey, generateNextChapter, growth, loading, nextChapter, nextError, nextStatus, savingStep, tab])

  async function approveNextChapter() {
    const approvalDraft = currentDraft || (basePlanModel.candidates.length
      ? { title: 'Your focused next moves', steps: basePlanModel.candidates }
      : null)
    if (!approvalDraft?.steps?.length || nextStatus === 'saving') return
    if (nextChapter && nextChapter.fingerprint !== currentFingerprint) {
      void generateNextChapter({ force: true })
      return
    }

    setNextError(null)
    setNextStatus('saving')
    setSavingStep(true)
    try {
      const { plan: updated, added } = await appendSteps(user.id, approvalDraft.steps, {
        source: 'focus',
        group: 'Focused plan',
        dedupeCompleted: true,
      })
      if (!added) throw new Error('Those steps are already part of your financial history.')
      setPlan(updated)
      removeStorage(window.sessionStorage, cacheKey)
      setNextChapter(null)
      setAttemptedFingerprint(null)
      setNextStatus('idle')
    } catch (err) {
      try { setPlan(await getPlan(user.id)) } catch { /* preserve the approval error */ }
      setNextError(err.message ?? 'Could not add these steps. Your current plan was not changed.')
      setNextStatus('error')
    } finally {
      setSavingStep(false)
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
      const previousGoal = modal && modal !== 'new' ? goals.find(goal => goal.id === modal.id) : null
      const savedPayload = { ...payload, updated_at: new Date().toISOString() }
      const result = modal && modal !== 'new'
        ? await supabase.from('goals').update(savedPayload).eq('id', modal.id).eq('user_id', user.id).select().single()
        : await supabase.from('goals').insert({ ...savedPayload, user_id: user.id }).select().single()
      if (result.error) throw result.error
      if (result.data) {
        setGoals(prev => modal && modal !== 'new'
          ? prev.map(g => g.id === result.data.id ? result.data : g)
          : [...prev, result.data])
        const wasReached = previousGoal && Number(previousGoal.target_amount) > 0 && Number(previousGoal.current_amount) >= Number(previousGoal.target_amount)
        const isReached = Number(result.data.target_amount) > 0 && Number(result.data.current_amount) >= Number(result.data.target_amount)
        if (!wasReached && isReached) {
          await recordEarnedMilestone(milestoneEventForGoal(result.data), `Reached ${result.data.name}`)
        }
      }
      setModal(null)
      if (pendingLinkedReminder) {
        setCompletionOffer(pendingLinkedReminder)
        setPendingLinkedReminder(null)
      }
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
    if (!goal) return
    const { data, error } = await supabase.from('goals').update({ current_amount: amount, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id).select().single()
    if (error) {
      setError(error.message ?? 'Could not update that goal.')
      return
    }
    setGoals(gs => gs.map(g => g.id === id ? data : g))
    const wasReached = Number(goal.target_amount) > 0 && Number(goal.current_amount) >= Number(goal.target_amount)
    const isReached = Number(data.target_amount) > 0 && Number(data.current_amount) >= Number(data.target_amount)
    if (!wasReached && isReached) {
      await recordEarnedMilestone(milestoneEventForGoal(data), `Reached ${data.name}`)
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
  const howToCtx = buildHowToContext({ profile, debts, accounts, goals, income: money.income, expenses: money.expenses, netWorth })

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
        actions={(
          <>
          <GardenMeter total={gardenTotal} compact />
          <div className="relative">
            <button onClick={() => setManageOpen(open => !open)} aria-label="Manage plan" aria-expanded={manageOpen}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {manageOpen && (
              <>
                <button aria-label="Close plan menu" onClick={() => setManageOpen(false)} className="fixed inset-0 z-20 cursor-default" />
                <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-white/[0.12] bg-[#101a14] p-2 shadow-2xl shadow-black/40">
                 <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-readable-muted">Plan management</p>
                  <button type="button" onClick={() => { setManageOpen(false); setPromptActivity(null); setActivitySheetOpen(true) }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-readable-secondary hover:bg-white/[0.06] hover:text-white">
                    <History className="h-4 w-4" /> Recent progress
                  </button>
                  {plan && <button onClick={() => { if (clearArmed) clearPlan(); else setClearArmed(true) }}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm transition-colors ${clearArmed ? 'bg-rose-500/15 text-rose-200' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}>
                    <Trash2 className="h-4 w-4" />
                    {clearArmed ? 'Confirm clear plan' : 'Clear plan'}
                  </button>}
                </div>
              </>
            )}
          </div>
          </>
        )}
      />

      {/* ── Steps | Goals switcher — a checklist you DO vs targets you GROW ── */}
      <div className="sticky top-0 z-20 -mx-1 border-y border-white/[0.06] bg-[#0b1410]/90 px-1 py-2 backdrop-blur-xl md:top-3 md:rounded-2xl md:border">
      <div className="flex p-1 rounded-xl bg-white/[0.06] border border-white/[0.10]">
        {[
          { id: 'steps', icon: ClipboardList, label: 'Steps',
            badge: totalSteps === 0 ? null : (activeSteps.length === 0 ? 'all done' : `${activeSteps.length} left`) },
          { id: 'goals', icon: Target, label: 'Goals',
            badge: reminderModel.counts.due > 0 ? `${reminderModel.counts.due} due` : (goals.length ? `${goals.length} goals` : null) },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-semibold transition-all ${
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
          {planModel.prerequisite ? (
            <PlanPrerequisite
              item={planModel.prerequisite}
              onOpen={openPrerequisite}
            />
          ) : <>
            {upNext && !upNext.proposed && (
              <UpNextCard
                step={upNext}
                onToggle={toggleStep}
                onApply={applyAndMark}
                onOpen={openStep}
                busy={savingStep}
              />
            )}

            {upNext && !upNext.proposed && <FocusQueue steps={afterThis} onOpen={openStep} />}

            {!growth && basePlanModel.candidates.length > 0 && (
              <CalmNextChapterCard
                status={nextStatus}
                draft={currentDraft || { title: 'Your focused next moves', steps: basePlanModel.candidates }}
                error={nextError}
                onAdd={approveNextChapter}
                onDismiss={dismissNextChapter}
                onRegenerate={regenerateNextChapter}
                onRetry={regenerateNextChapter}
                isEmpty={!activeSteps.length}
              />
            )}

            {!upNext && !basePlanModel.candidates.length && (
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.045] p-5 text-center">
                <GardenMeter total={gardenTotal} />
                <p className="mt-4 text-sm font-semibold text-white">Your focused plan is clear.</p>
                <p className="mt-1 text-xs leading-5 text-readable-secondary">Add a goal or a manual step when there is a concrete next move.</p>
              </div>
            )}
          </>}

          <CalmOutdatedStepReview
            review={planModel.review}
            replacement={replacement}
            onKeep={keepOutdated}
            onReplace={replaceOutdated}
            busy={savingStep}
          />

          <LaterAccordion steps={planModel.later} onOpen={openStep} onMakeNext={makeNext} busy={savingStep} />
          <DoneAccordion steps={doneSteps} onToggle={toggleStep} />
          <AddStepRow onAdd={addOwnStep} disabled={savingStep} />

          {error && (
            <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg text-center">{error}</p>
          )}
          {notice && (
            <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2 text-center text-xs text-emerald-50" role="status">{notice}</p>
          )}
        </motion.div>
      ) : (
        <motion.div key="goals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }} className="space-y-3">

          {/* Living headline — this is goal news, so it lives on the Goals tab */}
          <ReminderWorkspace
            model={reminderModel}
            reminders={reminders}
            events={reminderEvents}
            goals={goals}
            accounts={accounts}
            debts={debts}
            initialReminderId={new URLSearchParams(location.search).get('reminder')}
            onApproveSuggestion={approveReminderSuggestion}
            onDismissSuggestion={dismissReminderSuggestion}
            onSaveReminder={persistReminder}
            onReminderAction={performReminderAction}
            onReminderStatus={changeReminderStatus}
            onOpenContext={openReminderContext}
            onAddGoal={() => setModal('new')}
            completionOffer={completionOffer}
            onDismissCompletionOffer={() => setCompletionOffer(null)}
            goalContent={goals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.1] px-5 py-6 text-center">
                <p className="mx-auto max-w-xs text-[13px] leading-5 text-readable-secondary">Add a savings, purchase, or investment goal to track a clear amount and timeline.</p>
                <button type="button" onClick={() => setModal('new')} className="mt-3 min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500">Add money goal</button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.07]">
                {goals.map(goal => {
                  const target = Math.max(1, Number(goal.target_amount) || 0)
                  const current = Math.max(0, Number(goal.current_amount) || 0)
                  const percent = Math.min(100, Math.round((current / target) * 100))
                  const type = goal.goal_type === 'investment' ? 'Investment' : goal.goal_type === 'purchase' ? 'Purchase' : 'Savings'
                  return <button key={goal.id} type="button" onClick={() => setGoalDetail(goal)}
                    className="flex min-h-[76px] w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold text-white">{goal.name}</span><span className="text-xs font-semibold tabular-nums text-emerald-100">{percent}%</span></span>
                      <span className="mt-1 flex items-center justify-between gap-3 text-xs text-readable-secondary"><span>{type}</span><span className="tabular-nums">${current.toLocaleString()} of ${target.toLocaleString()}</span></span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }}/></span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-readable-muted"/>
                  </button>
                })}
              </div>
            )}
          />
          {error && <p className="rounded-lg border border-rose-400/25 bg-rose-500/15 px-3 py-2 text-center text-xs text-rose-100">{error}</p>}
          {notice && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2 text-center text-xs text-emerald-50" role="status">{notice}</p>}
        </motion.div>
      )}

      {modal && <GoalModal goal={modal === 'new' ? null : modal} onSave={saveGoal} onClose={() => { setModal(null); setPendingLinkedReminder(null) }} />}
      <BottomSheet open={Boolean(goalDetail)} title={goalDetail?.name || 'Goal details'} subtitle="Progress, pace, and management in one place." onClose={() => setGoalDetail(null)} size="sm">
        {goalDetail && <GoalItem goal={goalDetail}
          onEdit={goal => { setGoalDetail(null); setModal(goal) }}
          onDelete={async id => { await deleteGoal(id); setGoalDetail(null) }}
          onUpdateProgress={async (id, value) => { await updateProgress(id, value); setGoalDetail(current => current ? { ...current, current_amount: value } : current) }}
          onContribute={async (id, amount) => { await contribute(id, amount); setGoalDetail(current => current ? { ...current, current_amount: Number(current.current_amount || 0) + Number(amount || 0) } : current) }}
          howToContext={howToCtx} />}
      </BottomSheet>
      <ProgressActivitySheet
        open={activitySheetOpen}
        initialActivity={promptActivity}
        activities={activities}
        accounts={accounts}
        debts={debts}
        goals={goals}
        onClose={closeActivitySheet}
        onApplied={handleActivityApplied}
        onRefresh={refreshActivityFinancials}
        onActivityChanged={handleActivityChanged}
        onOpenAccount={activity => navigate(`/?section=money&sheet=accounts&accountSubtype=${encodeURIComponent(activity.metadata?.account_subtype_hint || '')}`)}
        onCorrect={() => navigate('/?section=money&sheet=balances')}
      />
      <GardenGrowthToast data={growth} onDismiss={dismissGrowth} />
    </motion.div>
  )
}
