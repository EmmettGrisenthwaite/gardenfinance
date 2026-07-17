import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowRight, History, Loader2, Sprout, Target } from 'lucide-react'
import Money from '@/pages/Money'
import IllustratedGarden from '@/components/garden/IllustratedGarden'
import BottomSheet from '@/components/ui/BottomSheet'
import { useAuth } from '@/context/AuthContext'
import { useGarden } from '@/context/GardenContext'
import { getPlan } from '@/lib/advisorPlans'
import { milestoneEventsFromState, groupGardenGoals } from '@/lib/gardenModel'
import { reconcileGardenMilestones } from '@/lib/gardenProgress'
import { getMoneySetupState } from '@/lib/moneySetup'
import { selectHomeAction } from '@/lib/homeModel'
import { buildPlanModel } from '@/lib/focusedPlan'
import ProgressActivitySheet from '@/components/ProgressActivitySheet'
import { listFinancialActivities } from '@/lib/financialActivities'
import { isPromptableActivity } from '@/lib/progressOutcome'

const formatMoney = value => `$${Math.max(0, Number(value) || 0).toLocaleString()}`

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function HomeHero({ profile, accounts, debts, goals, cashFlowItems, budgetLimits, snapshot, openSheet, renderNetWorth, refreshMoney }) {
  const { user, refreshProfile } = useAuth()
  const { stage, milestones, milestoneTotal, momentum, sceneTone, updateGarden } = useGarden()
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [gardenError, setGardenError] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [activities, setActivities] = useState([])
  const [activitySheetOpen, setActivitySheetOpen] = useState(false)
  const [promptActivity, setPromptActivity] = useState(null)

  useEffect(() => {
    let live = true
    async function loadGarden() {
      setPlanLoading(true)
      setGardenError(null)
      let loadedPlan = null
      try {
        loadedPlan = await getPlan(user.id)
        if (!live) return
        setPlan(loadedPlan)
      } catch (error) {
        if (!live) return
        setGardenError(error.message ?? 'Your Plan could not load yet. Your money details are still available.')
      }

      try {
        const activityRows = await listFinancialActivities(user.id)
        if (!live) return
        setActivities(activityRows)
        const unseen = activityRows.find(activity => isPromptableActivity(activity) && !activity.prompt_seen_at)
        if (unseen) {
          setPromptActivity(unseen)
          setActivitySheetOpen(true)
        }
      } catch {
        if (live) setGardenError('Recent progress could not load yet. Your financial records are still available.')
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
  }, [goals, snapshot.expenses, snapshot.income, updateGarden, user.id])

  const setupState = useMemo(() => getMoneySetupState({
    profile, accounts, debts, goals, cashFlowItems,
  }), [profile, accounts, debts, goals, cashFlowItems])
  const planModel = useMemo(() => buildPlanModel({
    snapshot: { ...snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits },
    setupState,
    plan,
    activities,
  }), [snapshot, profile, accounts, debts, goals, cashFlowItems, budgetLimits, setupState, plan, activities])
  const action = useMemo(() => selectHomeAction({ setupState, planModel, plan, planLoading }), [setupState, planModel, plan, planLoading])
  const grouped = useMemo(() => groupGardenGoals(goals, milestones, 3), [goals, milestones])
  const selectedPercent = selectedGoal
    ? Math.min(100, Math.round((Number(selectedGoal.current_amount || 0) / Math.max(1, Number(selectedGoal.target_amount || 0))) * 100))
    : 0

  function runAction() {
    if (action.kind === 'setup') openSheet(action.sheet)
    else if (action.href) navigate(action.href)
  }

  function openGoal(goal) {
    setSelectedGoal(goal)
    setSheet('goal')
  }

  function closeSheet() {
    setSheet(null)
    setSelectedGoal(null)
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

  return (
    <>
      <section className="grid items-start gap-4 md:grid-cols-[minmax(0,1.12fr)_minmax(290px,.88fr)]">
        <IllustratedGarden
          stage={stage}
          milestones={milestones}
          milestoneTotal={milestoneTotal}
          goals={goals}
          momentum={momentum}
          sceneTone={sceneTone}
          reducedMotion={Boolean(reducedMotion)}
          onSelectGoal={openGoal}
          onSelectOverflow={() => setSheet('overflow')}
        />

        <div className="grid gap-4">
          <motion.section key={action.kind + action.title}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
            className="rounded-[24px] border border-emerald-200/15 bg-[linear-gradient(145deg,rgba(18,41,31,.96),rgba(8,20,15,.98))] p-4 shadow-[0_18px_45px_rgba(0,0,0,.2)] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.09] text-emerald-100">
                {action.kind === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sprout className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/80">{action.eyebrow}</p>
                <h2 className="mt-1.5 text-[18px] font-semibold leading-6 tracking-[-0.015em] text-white">{action.title}</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-readable-secondary">{action.detail}</p>
                {action.doneWhen && <p className="mt-2 text-[12px] leading-5 text-white/[0.78]"><span className="font-semibold text-readable-secondary">Done when:</span> {action.doneWhen}</p>}
                {action.cta && <button type="button" onClick={runAction} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl text-[13px] font-semibold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
                  {action.cta}<ArrowRight className="h-4 w-4" />
                </button>}
              </div>
            </div>
          </motion.section>
          {renderNetWorth()}
        </div>
      </section>

      {gardenError && <div role="status" className="mt-3 flex gap-2 rounded-xl border border-amber-200/18 bg-amber-300/[0.05] px-3.5 py-3 text-[13px] leading-5 text-amber-50"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{gardenError}</div>}

      <button type="button" onClick={() => { setPromptActivity(null); setActivitySheetOpen(true) }} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] font-semibold text-readable-secondary transition-colors hover:bg-white/[0.035] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
        <History className="h-4 w-4 text-emerald-200" /> Recent progress
        {activities[0] && <span className="min-w-0 flex-1 truncate text-right text-xs font-normal text-readable-muted">{activities[0].label}</span>}
      </button>


      <BottomSheet open={sheet === 'goal'} title={selectedGoal?.name || 'Goal progress'} onClose={closeSheet} size="sm">
        {selectedGoal && <div>
          <div className="flex items-end justify-between gap-4"><div><p className="text-[13px] font-medium text-readable-secondary">Saved so far</p><p className="mt-1 text-2xl font-semibold tabular-nums text-white">{formatMoney(selectedGoal.current_amount)}</p></div><p className="text-[15px] font-semibold tabular-nums text-emerald-200">{selectedPercent}%</p></div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${selectedPercent}%` }} /></div>
          <dl className="mt-5 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.09] px-4">
            <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Target</dt><dd className="font-semibold tabular-nums text-white">{formatMoney(selectedGoal.target_amount)}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Monthly contribution</dt><dd className="font-semibold tabular-nums text-white">{formatMoney(selectedGoal.monthly_contribution)}</dd></div>
            <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Target date</dt><dd className="font-semibold text-white">{selectedGoal.deadline ? formatDate(`${selectedGoal.deadline}T00:00:00`) : 'Not set'}</dd></div>
          </dl>
          <button type="button" onClick={() => navigate('/plan#goals')} className="btn-primary mt-5 w-full">Update in Plan</button>
        </div>}
      </BottomSheet>

      <BottomSheet open={sheet === 'overflow'} title="More growing goals" subtitle="These goals remain part of your garden without crowding the portrait." onClose={closeSheet} size="sm">
        <div className="divide-y divide-white/[0.07]">{grouped.overflow.map(goal => <button key={goal.id} type="button" onClick={() => openGoal(goal)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"><Target className="h-4 w-4 shrink-0 text-emerald-200"/><span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{goal.name}</span><ArrowRight className="h-4 w-4 text-readable-muted"/></button>)}</div>
      </BottomSheet>

      <ProgressActivitySheet
        open={activitySheetOpen}
        initialActivity={promptActivity}
        activities={activities}
        accounts={accounts}
        debts={debts}
        goals={goals}
        onClose={() => { setActivitySheetOpen(false); setPromptActivity(null) }}
        onApplied={handleActivityApplied}
        onRefresh={refreshActivityData}
        onActivityChanged={handleActivityChanged}
        onOpenAccount={activity => navigate(`/?section=money&sheet=accounts&accountSubtype=${encodeURIComponent(activity.metadata?.account_subtype_hint || '')}`)}
        onCorrect={() => openSheet('balances')}
      />

    </>
  )
}

export default function Home() {
  return <Money homeMode renderHomeHero={props => <HomeHero {...props} />} />
}
