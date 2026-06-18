import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden } from '@/context/GardenContext'
import { computeScores } from '@/lib/gardenUtils'
import { Sprout } from 'lucide-react'
import Onboarding from '@/components/Onboarding'

// Lazy-load the 3D garden so Three.js ships as its own chunk — keeps first
// paint (login, other routes) fast and lets us show a branded loading state.
const Garden3D = lazy(() => import('@/components/garden/Garden3D'))

function GardenLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
      >
        <Sprout className="w-6 h-6 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-xs font-medium text-white/45">Growing your garden…</span>
    </div>
  )
}
import MilestoneToast, { useMilestones, computeAchieved } from '@/components/MilestoneToast'
import { Target, CreditCard, TrendingUp, Wallet, UserCircle, ClipboardList, Bot, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const PROFILE_FIELDS = [
  { key: 'age',              label: 'Age' },
  { key: 'employment_type',  label: 'Employment type' },
  { key: 'employer_401k',    label: '401k status' },
  { key: 'investment_types', label: 'Investment accounts', check: v => Array.isArray(v) && v.length > 0 },
  { key: 'health_insurance', label: 'Health insurance' },
  { key: 'primary_goal',     label: 'Primary goal' },
]

function profileCompleteness(profile) {
  if (!profile) return { filled: 0, total: PROFILE_FIELDS.length, missing: PROFILE_FIELDS.map(f => f.label) }
  const filled  = PROFILE_FIELDS.filter(f => f.check ? f.check(profile[f.key]) : !!profile[f.key])
  const missing = PROFILE_FIELDS.filter(f => !(f.check ? f.check(profile[f.key]) : !!profile[f.key]))
  return { filled: filled.length, total: PROFILE_FIELDS.length, missing: missing.map(f => f.label) }
}

// ─── Garden stage HUD ──────────────────────────────────────────────────────────
const STAGE_NAMES      = ['Barren', 'Sprouting', 'Greening', 'Growing', 'Thriving', 'Flourishing']
const STAGE_THRESHOLDS = [0, 12, 30, 50, 70, 90, 100]

function GardenHud({ stage, score }) {
  const lo  = STAGE_THRESHOLDS[stage]
  const hi  = STAGE_THRESHOLDS[stage + 1] ?? 100
  const pct = stage >= 5 ? 100 : Math.round(((score - lo) / (hi - lo)) * 100)
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-center gap-2.5 bg-black/45 backdrop-blur-md border border-white/10 rounded-full pl-3.5 pr-4 py-1.5 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20"
          style={{ background: ['#8a6a44','#a3b35a','#6cc24a','#3fa53b','#2f9e44','#34d399'][stage] }} />
        <span className="text-xs font-bold text-white whitespace-nowrap">{STAGE_NAMES[stage]}</span>
        <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-green-300 to-emerald-400 transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
        <span className="text-[10px] font-bold text-green-200 whitespace-nowrap">{score}/100</span>
      </div>
    </div>
  )
}

// ─── Top stat cards — dark glass, matches the HUD + nav language ──────────────
function StatCard({ to, icon: Icon, label, value, sub, subColor }) {
  return (
    <Link to={to} className="block group">
      <div className="bg-white/[0.055] rounded-2xl border border-white/[0.08] p-3 h-full
                      group-hover:bg-white/[0.1] group-hover:border-white/[0.12] transition-all">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-emerald-200/80" />
          </div>
          <span className="text-[9px] font-semibold text-white/50 uppercase tracking-wide truncate">{label}</span>
        </div>
        <div className="text-lg font-bold tabular-nums text-white leading-tight truncate drop-shadow">{value}</div>
        <div className={`text-[10px] font-medium mt-0.5 truncate ${subColor ?? 'text-white/40'}`}>{sub}</div>
      </div>
    </Link>
  )
}

function StatSkeleton() {
  return (
    <div className="bg-white/[0.055] rounded-2xl border border-white/[0.08] p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 bg-white/15 rounded-lg" />
        <div className="h-2.5 bg-white/15 rounded w-14" />
      </div>
      <div className="h-5 bg-white/15 rounded w-20 mb-1.5" />
      <div className="h-2.5 bg-white/10 rounded w-16" />
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile } = useAuth()
  const { updateGarden, stage } = useGarden()
  const { getNewMilestones, markSeen } = useMilestones(user.id)

  const [goals,          setGoals]          = useState([])
  const [budgets,        setBudgets]        = useState([])
  const [debts,          setDebts]          = useState([])
  const [accounts,       setAccounts]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  // undefined = not computed yet · null = first snapshot · number = change vs last visit
  const [nwDelta,        setNwDelta]        = useState(undefined)
  const [planStepsLeft,  setPlanStepsLeft]  = useState(0)
  const [hasPlan,        setHasPlan]        = useState(false)

  // Milestone queue: array of milestone keys to show one at a time
  const [milestoneQueue, setMilestoneQueue] = useState([])
  const prevScoreRef = useRef(null)

  const { filled, total } = profileCompleteness(profile)
  const isProfileIncomplete = filled < total

  useEffect(() => {
    async function load() {
      const [g, b, d, a, pl] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('advisor_plans').select('steps').eq('user_id', user.id),
      ])
      const goalsData   = g.data ?? []
      const budgetsData = b.data ?? []
      const debtsData   = d.data ?? []
      const acctData    = a.data ?? []

      setGoals(goalsData)
      setBudgets(budgetsData)
      setDebts(debtsData)
      setAccounts(acctData)
      setPlanStepsLeft((pl.data ?? []).reduce((n, p) => n + (p.steps ?? []).filter(s => !s.done).length, 0))
      setHasPlan((pl.data ?? []).length > 0)
      setLoading(false)

      // Update garden (now accounts-aware)
      updateGarden(budgetsData, goalsData, debtsData, acctData)

      // ── Net worth change — vs the most recent prior daily snapshot
      //    (net_worth_snapshots is the canonical history, shared with Accounts) ─
      const assets = acctData.reduce((s, x) => s + Number(x.balance), 0)
      const liabilities = debtsData.reduce((s, x) => s + Number(x.balance), 0)
      const worth = assets - liabilities
      try {
        const today = new Date().toISOString().slice(0, 10)
        const { data: snaps } = await supabase.from('net_worth_snapshots')
          .select('snapshot_date, net_worth').eq('user_id', user.id)
          .order('snapshot_date', { ascending: false }).limit(3)
        const prev = (snaps ?? []).find(s => s.snapshot_date !== today)
        setNwDelta(prev ? worth - Number(prev.net_worth) : null)
        // Record today so history builds from the home page too
        await supabase.from('net_worth_snapshots').upsert(
          { user_id: user.id, assets, liabilities, net_worth: worth, snapshot_date: today },
          { onConflict: 'user_id,snapshot_date' }
        )
      } catch { setNwDelta(null) }

      // ── Milestone detection ───────────────────────────────────────────────
      const scores  = computeScores(budgetsData, goalsData, debtsData, acctData)
      const achieved = computeAchieved({
        budgets: budgetsData,
        goals:   goalsData,
        debts:   debtsData,
        accounts: acctData,
        scores,
      })
      const newOnes = getNewMilestones(achieved)
      if (newOnes.length > 0) {
        // Only show the "highest value" milestone per session to avoid spam
        // Priority: score milestones > goal/debt specifics > first-time milestones
        const priority = ['score_100','score_75','score_50','goal_complete','debt_cleared','first_surplus','first_account','first_goal','first_debt','first_budget','first_transaction']
        const sorted = newOnes.sort((a, b) => {
          const ai = priority.findIndex(p => a.startsWith(p))
          const bi = priority.findIndex(p => b.startsWith(p))
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })
        setMilestoneQueue(sorted)
        prevScoreRef.current = scores.totalScore
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  function dismissMilestone() {
    const [shown, ...rest] = milestoneQueue
    if (shown) markSeen(shown)
    setMilestoneQueue(rest)
  }

  const totalDebt   = debts.reduce((s, d) => s + Number(d.balance), 0)
  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const netWorth    = totalAssets - totalDebt
  const gardenScore = computeScores(budgets, goals, debts, accounts).totalScore
  const goalsPct    = goals.length
    ? Math.round(goals.reduce((s, g) => s + Math.min(Number(g.current_amount) / (Number(g.target_amount) || 1), 1), 0) / goals.length * 100)
    : 0

  const name    = user.user_metadata?.full_name?.split(' ')[0] || 'there'
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const stats = [
    {
      to: '/accounts', icon: Wallet,
      label: 'Balances', value: `$${totalAssets.toLocaleString()}`,
      sub: accounts.length > 0 ? `${accounts.length} account${accounts.length === 1 ? '' : 's'}` : 'Add your accounts',
    },
    {
      to: '/accounts', icon: TrendingUp,
      label: 'Net Worth', value: `${netWorth < 0 ? '-' : ''}$${Math.abs(netWorth).toLocaleString()}`,
      sub: nwDelta === undefined || nwDelta === null ? 'Tracking starts today'
         : nwDelta === 0 ? 'No change since last visit'
         : `${nwDelta > 0 ? '▲' : '▼'} $${Math.abs(nwDelta).toLocaleString()} since last visit`,
      subColor: nwDelta > 0 ? 'text-emerald-300' : nwDelta < 0 ? 'text-rose-300' : undefined,
    },
    {
      to: '/budget#debt', icon: CreditCard,
      label: 'Debt', value: `$${totalDebt.toLocaleString()}`,
      sub: totalDebt === 0 ? 'Debt-free' : `${debts.length} account${debts.length === 1 ? '' : 's'}`,
      subColor: totalDebt === 0 ? 'text-emerald-300' : undefined,
    },
    {
      to: '/plan#goals', icon: Target,
      label: 'Goals', value: `${goals.length}`,
      sub: goals.length > 0 ? `${goalsPct}% avg progress` : 'Plant your first goal',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
    >
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      {/* Milestone celebration — shows queued milestones one at a time */}
      {milestoneQueue.length > 0 && (
        <MilestoneToast
          milestoneKey={milestoneQueue[0]}
          goals={goals}
          debts={debts}
          onDismiss={dismissMilestone}
        />
      )}

      {/* ── Top: greeting + the four stats ── */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-1 pb-2 space-y-2.5 flex-shrink-0">
        <div>
          <h1 className="font-display text-[22px] font-medium text-white drop-shadow-lg leading-tight">{greeting}, {name}</h1>
        </div>

        {/* Profile completeness banner */}
        {isProfileIncomplete && !loading && (
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full flex items-center gap-3 px-3 py-2 bg-amber-400/15 backdrop-blur-sm rounded-xl border border-amber-400/30 hover:bg-amber-400/25 transition-all group text-left"
          >
            <UserCircle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-xs font-semibold text-white truncate">
              Complete your advisor profile — {filled}/{total} done
            </div>
            <span className="text-xs font-semibold text-amber-300 flex-shrink-0">Add →</span>
          </button>
        )}

        {/* Stats — 2×2 on mobile, one row on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {loading
            ? [1, 2, 3, 4].map(i => <StatSkeleton key={i} />)
            : stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Connective thread to the Plan / Advisor — one focused next step */}
        {!loading && !isProfileIncomplete && (goals.length > 0 || budgets.length > 0 || accounts.length > 0 || debts.length > 0) && (() => {
          const toPlan = planStepsLeft > 0
          const to     = toPlan ? '/plan' : '/advisor'
          const Icon   = toPlan ? ClipboardList : Bot
          const text   = toPlan ? `${planStepsLeft} step${planStepsLeft === 1 ? '' : 's'} left in your plan`
                       : hasPlan ? 'Plan complete — see what’s next with your advisor'
                       : 'Get a personalized action plan from your advisor'
          return (
            <Link to={to}
              className="flex items-center gap-2.5 px-3 py-2 bg-emerald-500/15 backdrop-blur-sm rounded-xl border border-emerald-400/25 hover:bg-emerald-500/25 transition-all group">
              <Icon className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-semibold text-white truncate">{text}</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )
        })()}
      </div>

      {/* ── The garden IS the dashboard — fills everything below the stats,
            edge-faded so it melts into the page; the nav floats over it ── */}
      <div className="relative flex-1 min-h-[340px]">
        <div
          className="absolute inset-0"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0, black 26px, black calc(100% - 96px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 26px, black calc(100% - 96px), transparent 100%)',
          }}
        >
          <Suspense fallback={<GardenLoading />}>
            <Garden3D />
          </Suspense>
        </div>
        {!loading && <GardenHud stage={stage} score={gardenScore} />}
      </div>
    </motion.div>
  )
}
