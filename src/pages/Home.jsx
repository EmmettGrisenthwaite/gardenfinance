import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowRight, Flower2, Loader2, Sprout, Target } from 'lucide-react'
import Money from '@/pages/Money'
import IllustratedGarden from '@/components/garden/IllustratedGarden'
import BottomSheet from '@/components/ui/BottomSheet'
import { useAuth } from '@/context/AuthContext'
import { useGarden } from '@/context/GardenContext'
import { getPlan } from '@/lib/advisorPlans'
import { milestoneEventsFromState, groupGardenGoals, stageProgress, STAGE_COLORS, STAGE_NAMES } from '@/lib/gardenModel'
import { reconcileGardenMilestones } from '@/lib/gardenProgress'
import { getMoneySetupState } from '@/lib/moneySetup'
import { selectHomeAction } from '@/lib/homeModel'

const formatMoney = value => `$${Math.max(0, Number(value) || 0).toLocaleString()}`

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function HomeHero({ profile, accounts, debts, goals, cashFlowItems, snapshot, openSheet, renderNetWorth }) {
  const { user } = useAuth()
  const { stage, milestones, milestoneTotal, momentum, sceneTone, updateGarden } = useGarden()
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [gardenError, setGardenError] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)

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

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('garden') === 'story') setSheet('story')
  }, [location.search])

  const setupState = useMemo(() => getMoneySetupState({
    profile, accounts, debts, goals, cashFlowItems,
  }), [profile, accounts, debts, goals, cashFlowItems])
  const action = useMemo(() => selectHomeAction({ setupState, plan, planLoading }), [setupState, plan, planLoading])
  const grouped = useMemo(() => groupGardenGoals(goals, milestones, 3), [goals, milestones])
  const progress = stageProgress(milestoneTotal)
  const latest = milestones.slice(0, 3)
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
    const params = new URLSearchParams(location.search)
    if (params.has('garden')) {
      params.delete('garden')
      navigate({ pathname: '/', search: params.toString() ? `?${params}` : '' }, { replace: true })
    }
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
          onOpenStory={() => setSheet('story')}
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

      <BottomSheet open={sheet === 'story'} title="Your Garden Story" subtitle="Growth is permanent. Current goals and recent momentum add life without taking earned beauty away." onClose={closeSheet} size="md">
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.055] p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full ring-2 ring-white/15" style={{ background: STAGE_COLORS[stage] }} />
              <div><p className="text-[17px] font-semibold text-white">{STAGE_NAMES[stage]}</p><p className="text-[13px] font-medium text-readable-secondary">{milestoneTotal} permanent {milestoneTotal === 1 ? 'milestone' : 'milestones'}</p></div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${progress.percent}%` }} /></div>
            <p className="mt-2 text-[13px] font-medium text-emerald-100">{progress.nextThreshold == null ? 'Your sanctuary is fully grown.' : `${progress.remaining} more earned ${progress.remaining === 1 ? 'action' : 'actions'} to ${STAGE_NAMES[stage + 1]}.`}</p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-white">Active goal plants</h3>
            {grouped.visible.length ? <div className="mt-2 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08] px-3">
              {grouped.visible.map(goal => {
                const pct = Math.min(100, Math.round(Number(goal.current_amount || 0) / Math.max(1, Number(goal.target_amount || 0)) * 100))
                return <button key={goal.id} type="button" onClick={() => openGoal(goal)} className="flex min-h-14 w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
                  <Target className="h-4 w-4 shrink-0 text-emerald-200" /><span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{goal.name}</span><span className="text-[13px] font-semibold tabular-nums text-emerald-100">{pct}%</span>
                </button>
              })}
            </div> : <p className="mt-2 text-[13px] leading-5 text-readable-secondary">Goals added in Plan will appear as plants here.</p>}
            {grouped.overflow.length > 0 && <button type="button" onClick={() => setSheet('overflow')} className="btn-ghost mt-3 min-h-11 w-full">View {grouped.overflow.length} more active goals</button>}
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-white">Recent milestones</h3>
            {latest.length ? <ul className="mt-2 divide-y divide-white/[0.07]">{latest.map(item => <li key={item.id || `${item.kind}-${item.source_key}`} className="flex gap-3 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-200">{item.kind === 'goal' ? <Flower2 className="h-4 w-4" /> : <Sprout className="h-4 w-4" />}</span>
              <span className="min-w-0"><span className="block text-[13px] font-semibold leading-5 text-white">{item.label}</span><span className="block text-xs text-readable-secondary">{formatDate(item.earned_at)}</span></span>
            </li>)}</ul> : <p className="mt-2 text-[13px] leading-5 text-readable-secondary">Your prepared seedbed is ready for the first action you complete.</p>}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <h3 className="text-[15px] font-semibold text-white">How permanent growth works</h3>
            <p className="mt-1 text-[13px] leading-5 text-readable-secondary">The first completion of each Plan step and the first time a goal is reached earns one permanent milestone. Unchecking, deleting, or changing a goal never removes that growth.</p>
            <p className="mt-2 text-[13px] leading-5 text-readable-secondary">The garden is {momentum === 'lively' ? 'lively from recent tending' : momentum === 'gentle' ? 'gently active' : 'resting peacefully'}. {sceneTone === 'strained' ? 'A softer sky reflects a tight month, but every earned layer remains.' : 'A clear atmosphere reflects a steady money picture.'}</p>
            <button type="button" onClick={() => setSheet('legacy')} className="btn-ghost mt-3 min-h-11 w-full">View legacy grove{grouped.legacy.length ? ` (${grouped.legacy.length})` : ''}</button>
          </div>
        </div>
      </BottomSheet>

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

      <BottomSheet open={sheet === 'legacy'} title="Legacy grove" subtitle="Every goal first reached remains part of your story." onClose={closeSheet} size="sm">
        {grouped.legacy.length ? <ul className="divide-y divide-white/[0.07]">{grouped.legacy.map(item => <li key={item.id || item.source_key} className="flex gap-3 py-3"><Flower2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200"/><span><span className="block text-[13px] font-semibold text-white">{item.label}</span><span className="text-xs text-readable-secondary">Reached {formatDate(item.earned_at)}</span></span></li>)}</ul> : <p className="text-[13px] leading-5 text-readable-secondary">Reached goals will flower here permanently.</p>}
      </BottomSheet>
    </>
  )
}

export default function Home() {
  return <Money homeMode renderHomeHero={props => <HomeHero {...props} />} />
}
