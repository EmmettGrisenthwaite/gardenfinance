import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, Bot, ArrowRight, UserCircle, Check, ClipboardList, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden, milestonesToStage, STAGE_NAMES, STAGE_THRESHOLDS } from '@/context/GardenContext'
import { listPlans, updatePlanSteps } from '@/lib/advisorPlans'
import { orderSteps } from '@/lib/planOrder'
import { netWorthTrend } from '@/lib/netWorth'
import Onboarding from '@/components/Onboarding'
import GardenGrowthToast from '@/components/GardenGrowthToast'
import { isChunkError, reloadOnce } from '@/lib/chunkReload'

// Lazy-load the 3D garden so Three.js ships as its own chunk. If the chunk fails
// to load after a deploy (stale hash), reload once to fetch the fresh manifest.
const Garden3D = lazy(() =>
  import('@/components/garden/Garden3D').catch(err => {
    if (isChunkError(err) && reloadOnce()) return new Promise(() => {})
    throw err
  })
)

function GardenLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
        <Sprout className="w-6 h-6 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-xs font-medium text-white/45">Growing your garden…</span>
    </div>
  )
}

const PROFILE_FIELDS = ['age', 'employment_type', 'employer_401k', 'investment_types', 'health_insurance', 'primary_goal']
function isProfileIncompleteFn(profile) {
  if (!profile) return true
  return PROFILE_FIELDS.some(k => k === 'investment_types'
    ? !(Array.isArray(profile[k]) && profile[k].length > 0)
    : !profile[k])
}

// ─── Minimal milestone HUD ──────────────────────────────────────────────────────
function GardenHud({ stage, done }) {
  const next = STAGE_THRESHOLDS[stage + 1]
  const remaining = next ? next - done : 0
  const [flash, setFlash] = useState(false)
  const prevDone = useRef(done)
  useEffect(() => {
    if (done > prevDone.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(t)
    }
    prevDone.current = done
  }, [done])
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="relative flex items-center gap-2.5 bg-black/45 backdrop-blur-md border border-white/10 rounded-full pl-3.5 pr-4 py-1.5 shadow-lg overflow-hidden">
        {flash && <div className="absolute inset-0 animate-hud-shimmer pointer-events-none" />} 
        <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20"
          style={{ background: ['#8a6a44','#a3b35a','#6cc24a','#3fa53b','#2f9e44','#34d399'][stage] }} />
        <span className="text-xs font-bold text-white whitespace-nowrap">{STAGE_NAMES[stage]}</span>
        <span className="text-white/25 text-[10px]">·</span>
        <span className="text-[10px] font-semibold text-green-200/90 whitespace-nowrap tabular-nums">
          {stage >= 5
            ? 'fully grown 🌸'
            : `${remaining} more step${remaining === 1 ? '' : 's'} → ${STAGE_NAMES[stage + 1]}`}
        </span>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile, rememberCompletedStep } = useAuth()
  const { updateGarden, triggerBurst } = useGarden()
  const navigate = useNavigate()

  const [plans,   setPlans]   = useState([])
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [growth,  setGrowth]  = useState(null)
  const [trend,   setTrend]   = useState(null)
  const [goalSheet, setGoalSheet] = useState(null)

  const profileIncomplete = isProfileIncompleteFn(profile)

  useEffect(() => {
    async function load() {
      setError(null)
      const [g, d, pl, ac] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        listPlans(user.id),
        supabase.from('accounts').select('balance').eq('user_id', user.id),
      ])
      if (g.error) throw g.error
      if (d.error) throw d.error
      if (ac.error) throw ac.error
      setGoals(g.data ?? [])
      setDebts(d.data ?? [])
      setPlans(pl)
      setAccounts(ac.data ?? [])
      setLoading(false)
    }
    load().catch(err => {
      setError(err.message ?? 'Could not load your dashboard.')
      setLoading(false)
    })
  }, [user.id])

  // After onboarding seeds accounts AND debts, refetch both — refreshing only
  // accounts left net worth wrong (e.g. +$2,300 instead of -$1,100 with a
  // $3,400 card) at the exact moment the user first sees their dashboard.
  useEffect(() => {
    if (!profile?.onboarding_complete) return
    supabase.from('accounts').select('balance').eq('user_id', user.id)
      .then(({ data, error: accountsError }) => {
        if (accountsError) setError(accountsError.message ?? 'Could not refresh your balances.')
        else setAccounts(data ?? [])
      })
    supabase.from('debts').select('*').eq('user_id', user.id)
      .then(({ data, error: debtsError }) => {
        if (!debtsError) setDebts(data ?? [])
      })
  }, [profile?.onboarding_complete, user.id])

  // ── Milestone counts ──────────────────────────────────────────────────────────
  const completedSteps = plans.reduce((n, p) => n + p.steps.filter(s => s.done).length, 0)
  const totalSteps     = plans.reduce((n, p) => n + p.steps.length, 0)
  const goalsReached   = goals.filter(g => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount)).length
  const done           = completedSteps + goalsReached
  const stage          = milestonesToStage(done)
  const income         = Number(profile?.monthly_income)   || 0
  const expenses       = Number(profile?.monthly_expenses) || 0
  const surplusRatio   = income > 0 ? (income - expenses) / income : 0
  const accountValue   = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const debtsTotal     = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  // Net worth derives live from what you own minus what you owe.
  const netWorth       = accountValue - debtsTotal
  const fmt$           = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`

  // Keep the garden in sync with live state.
  useEffect(() => {
    if (loading) return
    updateGarden({ completedSteps, totalSteps, goalsReached, surplusRatio, netWorth, goals, debts })
  }, [completedSteps, totalSteps, goalsReached, surplusRatio, netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Record today's net-worth snapshot + read the change since ~30 days ago.
  useEffect(() => {
    if (loading) return
    netWorthTrend(user.id, netWorth).then(setTrend).catch(() => {})
  }, [loading, netWorth, user.id])

  // Next 1–2 uncompleted steps — the SAME ordering the Plan page's "Up next"
  // card uses (src/lib/planOrder.js), so the peek and the page always agree.
  const nextSteps = orderSteps(
    plans.flatMap(p => p.steps.filter(s => !s.done).map(s => ({ ...s, planId: p.id }))),
  ).slice(0, 2)

  async function toggleStep(planId, stepId, text) {
    try {
      await rememberCompletedStep(text)
    } catch (err) {
      setError(err.message ?? 'Could not update what your profile knows about this step.')
      return
    }
    // Celebrate synchronously if this check crosses a stage boundary.
    const newStage = milestonesToStage(completedSteps + goalsReached + 1)
    if (newStage > stage) {
      setGrowth({ stage: newStage, stepText: text })
      triggerBurst()
    }
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const steps = p.steps.map(s => s.id === stepId
        ? { ...s, done: true, completedAt: new Date().toISOString() } : s)
      updatePlanSteps(planId, steps, user.id).catch(err => {
        setError(err.message ?? 'Could not save that step.')
      })
      return { ...p, steps }
    }))
  }

  const name     = user.user_metadata?.full_name?.split(' ')[0] || 'there'
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const hasPlan  = plans.length > 0

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="h-full flex flex-col">
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      {/* ── Top: greeting + a single focused nudge ── */}
      <div className="max-w-xl mx-auto w-full px-4 pt-1 pb-2 space-y-2.5 flex-shrink-0">
        <h1 className="font-display text-[22px] font-medium text-white drop-shadow-lg leading-tight">{greeting}, {name}</h1>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}

        {/* Assets + net worth — tap to open Your Money */}
        {!loading && (
          <Link to="/money" className="grid grid-cols-2 gap-2.5 group">
            <div className="bg-white/[0.075] rounded-xl border border-white/[0.11] px-3 py-2 group-hover:bg-white/[0.11] transition-colors">
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide">Assets</div>
              <div className="text-base font-bold tabular-nums text-emerald-200 leading-tight">{fmt$(accountValue)}</div>
            </div>
            <div className="bg-white/[0.075] rounded-xl border border-white/[0.11] px-3 py-2 group-hover:bg-white/[0.11] transition-colors">
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide flex items-center justify-between gap-1">
                Net worth
                {trend?.has && trend.delta !== 0 && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums normal-case tracking-normal ${trend.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {trend.delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {fmt$(Math.abs(trend.delta))}
                  </span>
                )}
              </div>
              <div className={`text-base font-bold tabular-nums leading-tight ${netWorth >= 0 ? 'text-white' : 'text-rose-300'}`}>{fmt$(netWorth)}</div>
            </div>
          </Link>
        )}

        {/* Finish profile (powers the advisor) */}
        {profileIncomplete && !loading && (
          <button onClick={() => setShowOnboarding(true)}
            className="w-full flex items-center gap-3 px-3 py-2 bg-amber-400/15 rounded-xl border border-amber-400/30 hover:bg-amber-400/25 transition-all text-left">
            <UserCircle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span className="flex-1 min-w-0 text-xs font-semibold text-white leading-snug">Finish your profile so your advisor knows you</span>
            <span className="text-xs font-semibold text-amber-300 flex-shrink-0">Add →</span>
          </button>
        )}

        {!loading && (
          hasPlan ? (
            nextSteps.length > 0 ? (
              <div className="bg-white/[0.075] rounded-xl border border-white/[0.11] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-white/55 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-300" /> Next in your plan
                  </span>
                  <Link to="/plan" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">All steps →</Link>
                </div>
                {nextSteps.map(step => (
                  <button key={step.id} onClick={() => toggleStep(step.planId, step.id, step.text)}
                    className="w-full flex items-start gap-2.5 px-1 py-1 text-left group">
                    <span className="mt-0.5 w-[18px] h-[18px] rounded-md border border-white/30 group-hover:border-emerald-400 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Check className="w-3 h-3 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
                    </span>
                    <span className="text-sm text-white/90 line-clamp-2 leading-snug">{step.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Link to="/advisor"
                className="flex items-center gap-2.5 px-3 py-2 bg-emerald-500/15 rounded-xl border border-emerald-400/25 hover:bg-emerald-500/25 transition-all group">
                <Bot className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span className="flex-1 min-w-0 text-xs font-semibold text-white truncate">All steps done — ask your advisor what's next</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )
          ) : (
            // First run: a single, unmistakable "start here" action.
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="relative">
              <motion.span
                aria-hidden className="absolute inset-0 rounded-2xl bg-emerald-400/30 -z-10"
                animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.03, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
              <Link to="/advisor"
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-300/40 shadow-lg shadow-emerald-900/40 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/90">Start here</div>
                  <div className="text-sm font-semibold text-white leading-tight">Meet your advisor & build your first plan</div>
                </div>
                <ArrowRight className="w-5 h-5 text-white flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )
        )}
      </div>

      {/* ── The garden IS the dashboard ── */}
      <div className="relative flex-1 min-h-[340px]">
        <div className="absolute inset-0"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0, black 48px, black calc(100% - 80px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 48px, black calc(100% - 80px), transparent 100%)',
          }}>
          <Suspense fallback={<GardenLoading />}>
            <Garden3D onSelectGoal={(g) => setGoalSheet(g)} onAddGoal={() => navigate('/plan#goals')} />
          </Suspense>
        </div>
        {!loading && <GardenHud stage={stage} done={done} />}
      </div>

      {goalSheet && (
        <div className="fixed inset-0 z-50" onClick={() => setGoalSheet(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-black/45 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-base font-bold text-white leading-tight">{goalSheet.name}</h3>
              <button
                onClick={() => setGoalSheet(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-white/70 tabular-nums mb-2">
              ${Number(goalSheet.current_amount || 0).toLocaleString()} of ${Number(goalSheet.target_amount || 0).toLocaleString()}
            </p>
            {(() => {
              const pct = Math.min(100, Math.round((Number(goalSheet.current_amount || 0) / (Number(goalSheet.target_amount) || 1)) * 100))
              return (
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              )
            })()}
            <Link
              to="/plan#goals"
              className="btn-primary w-full justify-center"
              onClick={() => setGoalSheet(null)}
            >
              Update progress
            </Link>
          </div>
        </div>
      )}

      <GardenGrowthToast data={growth} onDismiss={() => setGrowth(null)} />
    </motion.div>
  )
}
