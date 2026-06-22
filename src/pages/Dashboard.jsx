import { useState, useEffect, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, Bot, ArrowRight, UserCircle, Check, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden, milestonesToStage, STAGE_NAMES, STAGE_THRESHOLDS } from '@/context/GardenContext'
import { listPlans, updatePlanSteps } from '@/lib/advisorPlans'
import Onboarding from '@/components/Onboarding'
import GardenGrowthToast from '@/components/GardenGrowthToast'

// Lazy-load the 3D garden so Three.js ships as its own chunk.
const Garden3D = lazy(() => import('@/components/garden/Garden3D'))

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
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-center gap-2.5 bg-black/45 backdrop-blur-md border border-white/10 rounded-full pl-3.5 pr-4 py-1.5 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20"
          style={{ background: ['#8a6a44','#a3b35a','#6cc24a','#3fa53b','#2f9e44','#34d399'][stage] }} />
        <span className="text-xs font-bold text-white whitespace-nowrap">{STAGE_NAMES[stage]}</span>
        <span className="text-[10px] font-semibold text-green-200/90 whitespace-nowrap tabular-nums">
          {stage >= 5 ? `${done} milestones` : `${remaining} more to bloom`}
        </span>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile } = useAuth()
  const { updateGarden } = useGarden()

  const [plans,   setPlans]   = useState([])
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [growth,  setGrowth]  = useState(null)

  const profileIncomplete = isProfileIncompleteFn(profile)

  useEffect(() => {
    async function load() {
      const [g, d, pl, ac] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        listPlans(user.id),
        supabase.from('accounts').select('balance').eq('user_id', user.id),
      ])
      setGoals(g.data ?? [])
      setDebts(d.data ?? [])
      setPlans(pl)
      setAccounts(ac.data ?? [])
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user.id])

  // After onboarding seeds account value, refetch so the stat isn't stale at $0.
  useEffect(() => {
    if (!profile?.onboarding_complete) return
    supabase.from('accounts').select('balance').eq('user_id', user.id)
      .then(({ data }) => setAccounts(data ?? []))
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
  const netWorth       = Number(profile?.net_worth) || 0
  const accountValue   = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const fmt$           = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`

  // Keep the garden in sync with live state.
  useEffect(() => {
    if (loading) return
    updateGarden({ completedSteps, totalSteps, goalsReached, surplusRatio, netWorth, goals, debts })
  }, [completedSteps, totalSteps, goalsReached, surplusRatio, netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Next 1–2 uncompleted steps (across plans) — checkable right from the garden.
  const nextSteps = plans.flatMap(p => p.steps.filter(s => !s.done).map(s => ({ planId: p.id, step: s }))).slice(0, 2)

  function toggleStep(planId, stepId, text) {
    // Celebrate synchronously if this check crosses a stage boundary.
    const newStage = milestonesToStage(completedSteps + goalsReached + 1)
    if (newStage > stage) setGrowth({ stage: newStage, stepText: text })
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const steps = p.steps.map(s => s.id === stepId ? { ...s, done: true } : s)
      updatePlanSteps(planId, steps).catch(() => {})
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

        {/* Account value + net worth — tap to edit in the Plan */}
        {!loading && (
          <Link to="/plan#money" className="grid grid-cols-2 gap-2.5 group">
            <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] px-3 py-2 group-hover:bg-white/[0.08] transition-colors">
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide">Account value</div>
              <div className="text-base font-bold tabular-nums text-emerald-200 leading-tight">{fmt$(accountValue)}</div>
            </div>
            <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] px-3 py-2 group-hover:bg-white/[0.08] transition-colors">
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide">Net worth</div>
              <div className={`text-base font-bold tabular-nums leading-tight ${netWorth >= 0 ? 'text-white' : 'text-rose-300'}`}>{fmt$(netWorth)}</div>
            </div>
          </Link>
        )}

        {/* Finish profile (powers the advisor) */}
        {profileIncomplete && !loading && (
          <button onClick={() => setShowOnboarding(true)}
            className="w-full flex items-center gap-3 px-3 py-2 bg-amber-400/15 rounded-xl border border-amber-400/30 hover:bg-amber-400/25 transition-all text-left">
            <UserCircle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span className="flex-1 min-w-0 text-xs font-semibold text-white truncate">Finish your profile so your advisor knows you</span>
            <span className="text-xs font-semibold text-amber-300 flex-shrink-0">Add →</span>
          </button>
        )}

        {!loading && !profileIncomplete && (
          hasPlan ? (
            nextSteps.length > 0 ? (
              <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-white/55 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-300" /> Next in your plan
                  </span>
                  <Link to="/plan" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">All steps →</Link>
                </div>
                {nextSteps.map(({ planId, step }) => (
                  <button key={step.id} onClick={() => toggleStep(planId, step.id, step.text)}
                    className="w-full flex items-center gap-2.5 px-1 py-1 text-left group">
                    <span className="w-[18px] h-[18px] rounded-md border border-white/30 group-hover:border-emerald-400 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Check className="w-3 h-3 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
                    </span>
                    <span className="text-sm text-white/90 truncate">{step.text}</span>
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
            <Link to="/advisor"
              className="flex items-center gap-2.5 px-3 py-2 bg-emerald-500/15 rounded-xl border border-emerald-400/25 hover:bg-emerald-500/25 transition-all group">
              <Bot className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-semibold text-white truncate">Talk to your advisor to grow your first plan</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )
        )}
      </div>

      {/* ── The garden IS the dashboard ── */}
      <div className="relative flex-1 min-h-[340px]">
        <div className="absolute inset-0"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0, black 26px, black calc(100% - 96px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 26px, black calc(100% - 96px), transparent 100%)',
          }}>
          <Suspense fallback={<GardenLoading />}>
            <Garden3D />
          </Suspense>
        </div>
        {!loading && <GardenHud stage={stage} done={done} />}
      </div>

      <GardenGrowthToast data={growth} onDismiss={() => setGrowth(null)} />
    </motion.div>
  )
}
