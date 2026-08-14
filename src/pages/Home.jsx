import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle, ArrowRight, CalendarClock, Eye, EyeOff, History, Loader2, MoreHorizontal,
  RefreshCw, Settings, SlidersHorizontal, Sprout, Target, WalletCards,
} from 'lucide-react'
import Money from '@/pages/Money'
import BottomSheet from '@/components/ui/BottomSheet'
import PageHeader from '@/components/ui/PageHeader'
import DashboardGrid from '@/components/dashboard/DashboardGrid'
import CustomizeHomeSheet from '@/components/dashboard/CustomizeHomeSheet'
import { useAuth } from '@/context/AuthContext'
import { useGarden } from '@/context/GardenContext'
import { getPlan } from '@/lib/advisorPlans'
import { milestoneEventsFromState, groupGardenGoals, stageProgress, STAGE_NAMES } from '@/lib/gardenModel'
import { netWorthExplanation } from '@/lib/finance'
import { reconcileGardenMilestones } from '@/lib/gardenProgress'
import { getMoneySetupState } from '@/lib/moneySetup'
import { selectHomeAction } from '@/lib/homeModel'
import { buildPlanModel } from '@/lib/focusedPlan'
import { useMoneyRoute } from '@/hooks/useMoneyRoute'
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences'
import { buildDefaultDashboard } from '@/lib/dashboardModel'
import { maskMoneyText } from '@/lib/privacy'
import MoneyRouteCard from '@/components/MoneyRouteCard'
import ProgressActivitySheet from '@/components/ProgressActivitySheet'
import { listFinancialActivities } from '@/lib/financialActivities'
import { isPromptableActivity } from '@/lib/progressOutcome'
import { buildReminderModel } from '@/lib/reminderModel'
import { listReminderEvents, listReminders } from '@/lib/reminders'

const formatMoney = value => {
  const amount = Number(value) || 0
  return `${amount < 0 ? '-' : ''}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function HomeHero({ profile, accounts, debts, goals, cashFlowItems, budgetLimits, snapshot, trend, openSheet, refreshMoney }) {
  const { user, refreshProfile } = useAuth()
  const { stage, milestones, milestoneTotal, momentum, sceneTone, updateGarden } = useGarden()
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [gardenError, setGardenError] = useState(null)
  const [subsystemErrors, setSubsystemErrors] = useState({})
  const [homeRefreshKey, setHomeRefreshKey] = useState(0)
  // Explains a negative net worth when one balance drives it (see finance.js).
  const netWorthNote = useMemo(
    () => netWorthExplanation({ netWorth: snapshot.netWorth, debts }),
    [snapshot.netWorth, debts],
  )
  const [sheet, setSheet] = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [activities, setActivities] = useState([])
  const [reminders, setReminders] = useState([])
  const [reminderEvents, setReminderEvents] = useState([])
  const [activitySheetOpen, setActivitySheetOpen] = useState(false)
  const [promptActivity, setPromptActivity] = useState(null)
  const [customizing, setCustomizing] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('progress') === '1') setActivitySheetOpen(true)
    if (params.get('garden') === '1') setSheet('story')
  }, [location.search])

  useEffect(() => {
    let live = true
    async function loadGarden() {
      setPlanLoading(true)
      setGardenError(null)
      setSubsystemErrors({})
      let loadedPlan = null
      try {
        loadedPlan = await getPlan(user.id)
        if (!live) return
        setPlan(loadedPlan)
      } catch (error) {
        if (!live) return
        setGardenError(error.message ?? 'Your Plan could not load yet. Your money details are still available.')
      }

      const [activityResult, reminderResult, eventResult] = await Promise.allSettled([
        listFinancialActivities(user.id),
        listReminders(user.id),
        listReminderEvents(user.id),
      ])
      if (!live) return
      const activityRows = activityResult.status === 'fulfilled' ? activityResult.value : []
      const reminderRows = reminderResult.status === 'fulfilled' ? reminderResult.value : []
      const eventRows = eventResult.status === 'fulfilled' ? eventResult.value : []
      setActivities(activityRows)
      setReminders(reminderRows)
      setReminderEvents(eventRows)
      setSubsystemErrors({
        ...(activityResult.status === 'rejected' ? { activities: 'Recent progress could not load.' } : {}),
        ...(reminderResult.status === 'rejected' || eventResult.status === 'rejected' ? { reminders: 'Routines could not load.' } : {}),
      })
      const unseen = activityRows.find(activity => isPromptableActivity(activity) && !activity.prompt_seen_at)
      if (unseen) {
        setPromptActivity(unseen)
        setActivitySheetOpen(true)
      }

      let gardenProgress
      try {
        gardenProgress = await reconcileGardenMilestones(user.id, {
          plans: loadedPlan ? [loadedPlan] : [],
          goals,
        })
      } catch {
        const fallback = milestoneEventsFromState({ plans: loadedPlan ? [loadedPlan] : [], goals })
        gardenProgress = { milestones: fallback, total: fallback.length }
        if (live) setGardenError('Permanent garden progress could not sync yet. Your money data is safe and the garden will retry next time.')
      }
      if (!live) return
      updateGarden({
        milestones: gardenProgress.milestones,
        milestoneTotal: gardenProgress.total,
        goals,
        income: snapshot.income,
        expenses: snapshot.expenses,
      })
      setPlanLoading(false)
    }
    loadGarden()
    return () => { live = false }
  }, [goals, homeRefreshKey, snapshot.expenses, snapshot.income, updateGarden, user.id])

  const setupState = useMemo(() => getMoneySetupState({
    profile, accounts, debts, goals, cashFlowItems,
  }), [profile, accounts, debts, goals, cashFlowItems])
  const { route: moneyRoute } = useMoneyRoute({
    snapshot: { ...snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits },
    profile, accounts, debts, goals, activities, setupState,
  }, user.id)
  const planModel = useMemo(() => buildPlanModel({
    snapshot: { ...snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits },
    setupState,
    plan,
    activities,
    reminders,
    moneyRoute,
  }), [snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits, setupState, plan, activities, reminders, moneyRoute])
  const reminderModel = useMemo(() => buildReminderModel({
    snapshot, profile, accounts, debts, goals, activities,
    reminders, events: reminderEvents,
  }), [snapshot, profile, accounts, debts, goals, activities, reminders, reminderEvents])
  const action = useMemo(() => selectHomeAction({
    setupState, planModel, reminderModel, activities, plan, planLoading,
  }), [setupState, planModel, reminderModel, activities, plan, planLoading])
  const grouped = useMemo(() => groupGardenGoals(goals, milestones, 3), [goals, milestones])
  const gardenStageProgress = useMemo(() => stageProgress(milestoneTotal), [milestoneTotal])
  const selectedPercent = selectedGoal
    ? Math.min(100, Math.round((Number(selectedGoal.current_amount || 0) / Math.max(1, Number(selectedGoal.target_amount || 0))) * 100))
    : 0
  // Only show the plan once every required input exists — otherwise Home
  // falls through to the normal next-action card, which already knows how to
  // ask for whatever is missing.
  const hasMoneyRoute = moneyRoute.ready
  const approvedRouteStep = [...planModel.focus, ...planModel.later]
    .find(step => !step.proposed && step.source === 'money-route') || null
  const dashboardContext = useMemo(() => ({
    snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits,
    activities, reminders, reminderEvents, reminderModel, primaryAction: action,
  }), [snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits, activities, reminders, reminderEvents, reminderModel, action])
  const dashboardPreferences = useDashboardPreferences(user.id, dashboardContext)
  const defaultDashboard = useMemo(() => buildDefaultDashboard(dashboardContext), [dashboardContext])

  function runAction() {
    if (action.kind === 'setup') openSheet(action.sheet)
    else if (action.href) navigate(action.href)
  }

  function runMoneyRoute() {
    if (approvedRouteStep?.id) navigate(`/plan/step/${approvedRouteStep.id}`)
    else navigate('/advisor?firstRoute=1')
  }

  function openGoal(goal) {
    if (!goal) {
      navigate('/plan#goals')
      return
    }
    setSelectedGoal(goal)
    setSheet('goal')
  }

  function closeSheet() {
    setSheet(null)
    setSelectedGoal(null)
    const params = new URLSearchParams(location.search)
    if (params.has('garden')) {
      params.delete('garden')
      navigate({ pathname: '/', search: params.toString() ? `?${params}` : '' }, { replace: true })
    }
  }

  function closeActivitySheet() {
    setActivitySheetOpen(false)
    setPromptActivity(null)
    const params = new URLSearchParams(location.search)
    if (params.has('progress')) {
      params.delete('progress')
      navigate({ pathname: '/', search: params.toString() ? `?${params}` : '' }, { replace: true })
    }
  }

  async function refreshActivityData() {
    await refreshMoney?.()
    const activityRows = await listFinancialActivities(user.id)
    setActivities(activityRows)
    await refreshProfile()
  }

  async function handleActivityApplied(result) {
    if (result?.activity) setActivities(current => [result.activity, ...current.filter(activity => activity.id !== result.activity.id)])
    await refreshMoney?.()
    await refreshProfile()
    setPromptActivity(null)
  }

  function handleActivityChanged(changed) {
    if (changed) setActivities(current => [changed, ...current.filter(activity => activity.id !== changed.id)])
    setPromptActivity(null)
  }

  const dashboardData = {
    ...dashboardContext,
    trend, stage, milestones, milestoneTotal, momentum, sceneTone,
    reducedMotion: Boolean(reducedMotion), netWorthNote, errors: subsystemErrors,
  }
  const dashboardActions = {
    openGarden: () => setSheet('story'),
    openGoal,
    openProgress: () => setActivitySheetOpen(true),
    openSheet,
    openMoney: () => navigate('/?section=money'),
    openAccount: accountId => navigate(`/?section=money&sheet=accounts&accountId=${encodeURIComponent(accountId)}`),
    openRoutines: reminderId => navigate(reminderId ? `/plan?reminder=${encodeURIComponent(reminderId)}#goals` : '/plan#goals'),
    retryHomeData: () => setHomeRefreshKey(value => value + 1),
  }
  const customizeContext = { ...dashboardContext, defaultLayout: defaultDashboard }

  return (
    <>
      <PageHeader title="Home" subtitle="What matters now, with your priorities close by."
        actions={<div className="flex items-center gap-2">
          <button type="button" onClick={() => dashboardPreferences.setHideAmounts(!dashboardPreferences.hideAmounts)}
            disabled={dashboardPreferences.loading || dashboardPreferences.privacySaving}
            aria-label={dashboardPreferences.hideAmounts ? 'Show financial amounts' : 'Hide financial amounts'}
            aria-pressed={dashboardPreferences.hideAmounts}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] text-readable-secondary hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 disabled:opacity-50">
            {dashboardPreferences.privacySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : dashboardPreferences.hideAmounts ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          <HomeHeaderMenu navigate={navigate} onCustomize={() => setCustomizing(true)} />
        </div>} />

      <section aria-label="Today" className="mb-3">
        {hasMoneyRoute ? <MoneyRouteCard
          route={moneyRoute}
          variant="home"
          hideAmounts={dashboardPreferences.hideAmounts}
          onPrimary={runMoneyRoute}
          primaryLabel={approvedRouteStep ? 'Do the next move' : 'Review my plan'}
        /> : <motion.section key={action.kind + action.title}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            className="rounded-[24px] border border-emerald-200/15 bg-[linear-gradient(145deg,rgba(18,41,31,.96),rgba(8,20,15,.98))] p-4 shadow-[0_18px_45px_rgba(0,0,0,.2)] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.09] text-emerald-100">
                {action.kind === 'loading'
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : action.kind === 'reminder'
                    ? <CalendarClock className="h-5 w-5" />
                    : action.kind === 'setup'
                      ? <WalletCards className="h-5 w-5" />
                      : <Sprout className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/80">Today · {action.eyebrow}</p>
                <h2 className="mt-1.5 text-[18px] font-semibold leading-6 tracking-[-0.015em] text-white">{maskMoneyText(action.title, dashboardPreferences.hideAmounts)}</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-readable-secondary">{maskMoneyText(action.detail, dashboardPreferences.hideAmounts)}</p>
                {action.doneWhen && <p className="mt-2 text-[12px] leading-5 text-white/[0.78]"><span className="font-semibold text-readable-secondary">Done when:</span> {maskMoneyText(action.doneWhen, dashboardPreferences.hideAmounts)}</p>}
                {action.cta && <button type="button" onClick={runAction} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl text-[13px] font-semibold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
                  {action.cta}<ArrowRight className="h-4 w-4" />
                </button>}
              </div>
            </div>
        </motion.section>}
      </section>

      <DashboardGrid layout={dashboardPreferences.layout} data={dashboardData} actions={dashboardActions} hideAmounts={dashboardPreferences.hideAmounts} />

      {(gardenError || dashboardPreferences.error) && <div role="status" className="mt-3 flex gap-2 rounded-xl border border-amber-200/18 bg-amber-300/[0.05] px-3.5 py-3 text-[13px] leading-5 text-amber-50"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{gardenError || dashboardPreferences.error}</div>}

      <BottomSheet open={sheet === 'goal'} title={selectedGoal?.name || 'Goal progress'} onClose={closeSheet} size="sm">
        {selectedGoal && <div>
          <div className="flex items-end justify-between gap-4"><div><p className="text-[13px] font-medium text-readable-secondary">Saved so far</p><p className="mt-1 text-2xl font-semibold tabular-nums text-white">{dashboardPreferences.hideAmounts ? 'Amount hidden' : formatMoney(selectedGoal.current_amount)}</p></div><p className="text-[15px] font-semibold tabular-nums text-emerald-200">{selectedPercent}%</p></div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${selectedPercent}%` }} /></div>
          <dl className="mt-5 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.09] px-4">
            <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Target</dt><dd className="font-semibold tabular-nums text-white">{dashboardPreferences.hideAmounts ? 'Amount hidden' : formatMoney(selectedGoal.target_amount)}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Monthly contribution</dt><dd className="font-semibold tabular-nums text-white">{dashboardPreferences.hideAmounts ? 'Amount hidden' : formatMoney(selectedGoal.monthly_contribution)}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Target date</dt><dd className="font-semibold text-white">{selectedGoal.deadline ? formatDate(`${selectedGoal.deadline}T00:00:00`) : 'Not set'}</dd></div>
          </dl>
          <button type="button" onClick={() => navigate('/plan#goals')} className="btn-primary mt-5 w-full">Update in Plan</button>
        </div>}
      </BottomSheet>

      <BottomSheet open={sheet === 'overflow'} title="More growing goals" subtitle="These goals remain part of your garden without crowding the portrait." onClose={closeSheet} size="sm">
        <div className="divide-y divide-white/[0.07]">{grouped.overflow.map(goal => <button key={goal.id} type="button" onClick={() => openGoal(goal)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"><Target className="h-4 w-4 shrink-0 text-emerald-200"/><span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{goal.name}</span><ArrowRight className="h-4 w-4 text-readable-muted"/></button>)}</div>
      </BottomSheet>

      <BottomSheet open={sheet === 'story'} title="Garden Story" subtitle="Your garden keeps every milestone you have earned." onClose={closeSheet} size="sm">
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4">
            <p className="text-[13px] font-semibold text-readable-secondary">Current stage</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="text-xl font-semibold text-white">{STAGE_NAMES[stage]}</p>
              <p className="text-[13px] font-semibold text-emerald-100">{milestoneTotal} milestones</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${gardenStageProgress.percent}%` }} /></div>
            <p className="mt-2 text-xs text-readable-secondary">{gardenStageProgress.nextThreshold == null ? 'Sanctuary complete' : `${gardenStageProgress.remaining} more to ${STAGE_NAMES[stage + 1]}`}</p>
          </div>
          <section>
            <h3 className="text-sm font-semibold text-white">Recent milestones</h3>
            <div className="mt-2 divide-y divide-white/[0.07]">
              {milestones.slice(0, 3).map(item => <div key={item.id || item.source_key} className="py-2.5 text-[13px]"><p className="font-semibold text-white">{item.label}</p><p className="mt-0.5 text-readable-secondary">{formatDate(item.earned_at)}</p></div>)}
              {!milestones.length && <p className="py-3 text-[13px] text-readable-secondary">Your first completed Plan step will become a permanent milestone.</p>}
            </div>
          </section>
          {goals.length > 0 && <section><h3 className="text-sm font-semibold text-white">Growing goals</h3><div className="mt-2 space-y-2">{goals.slice(0, 5).map(goal => <button key={goal.id} type="button" onClick={() => openGoal(goal)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/[0.04]"><Target className="h-4 w-4 text-emerald-200"/><span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{goal.name}</span><ArrowRight className="h-4 w-4 text-readable-muted"/></button>)}</div></section>}
        </div>
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
        onRefresh={refreshActivityData}
        onActivityChanged={handleActivityChanged}
        onOpenAccount={activity => navigate(`/?section=money&sheet=accounts&accountSubtype=${encodeURIComponent(activity.metadata?.account_subtype_hint || '')}`)}
        onCorrect={() => openSheet('balances')}
      />

      <CustomizeHomeSheet open={customizing} layout={dashboardPreferences.layout} context={customizeContext}
        onClose={() => setCustomizing(false)} onSave={dashboardPreferences.saveLayout} onReload={dashboardPreferences.refetch} />

    </>
  )
}

export default function Home() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const moneySheets = new Set(['plan', 'accounts', 'cash', 'investment', 'asset', 'debts', 'balances'])
  const workspaceMode = params.get('section') === 'money' || moneySheets.has(params.get('sheet'))
  return <Money
    homeMode
    workspaceMode={workspaceMode}
    renderHomeHero={props => <HomeHero {...props} />}
  />
}

function HomeHeaderMenu({ navigate, onCustomize }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      {open && <button type="button" aria-label="Close Home menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />}
      <button type="button" onClick={() => setOpen(value => !value)} aria-label="Home menu" aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] text-readable-secondary hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-white/[0.12] bg-[#101a14] p-2 shadow-2xl shadow-black/40">
        {[
          { label: 'Customize Home', icon: SlidersHorizontal, action: onCustomize },
          { label: 'Update balances', icon: RefreshCw, to: '/?section=money&sheet=balances' },
          { label: 'Recent progress', icon: History, to: '/?progress=1' },
          { label: 'Garden Story', icon: Sprout, to: '/?garden=1' },
          { label: 'Settings', icon: Settings, to: '/settings' },
        ].map(item => <button key={item.label} type="button" onClick={() => { setOpen(false); if (item.action) item.action(); else navigate(item.to) }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-readable-secondary hover:bg-white/[0.06] hover:text-white"><item.icon className="h-4 w-4 text-emerald-200"/>{item.label}</button>)}
      </div>}
    </div>
  )
}
