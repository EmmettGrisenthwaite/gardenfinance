import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Flower2, Sprout, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGarden } from '@/context/GardenContext'
import { getPlan } from '@/lib/advisorPlans'
import {
  STAGE_COLORS,
  STAGE_NAMES,
  groupGardenGoals,
  milestoneEventsFromState,
  stageProgress,
} from '@/lib/gardenModel'
import { reconcileGardenMilestones } from '@/lib/gardenProgress'
import BottomSheet from '@/components/ui/BottomSheet'
import { isChunkError, reloadOnce } from '@/lib/chunkReload'

const Garden3D = lazy(() => import('@/components/garden/Garden3D').catch(error => {
  if (isChunkError(error) && reloadOnce()) return new Promise(() => {})
  throw error
}))

function GardenLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-emerald-600 shadow-xl">
        <Sprout className="h-6 w-6 text-white" strokeWidth={2.5} />
      </span>
      <span className="text-[13px] font-semibold text-white/75">Tending your garden…</span>
    </div>
  )
}

function formatMoney(value) {
  return `$${Math.max(0, Number(value) || 0).toLocaleString()}`
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StageChip({ total, onClick }) {
  const progress = stageProgress(total)
  return (
    <button type="button" onClick={onClick}
      aria-label={`Open Garden Story. ${STAGE_NAMES[progress.stage]}, ${total} permanent milestones.`}
      className="pointer-events-auto flex min-h-11 max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full border border-white/15 bg-[#08110e]/78 px-3.5 py-2 text-left shadow-[0_10px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors hover:bg-[#0b1812]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/20" style={{ background: STAGE_COLORS[progress.stage] }} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-white">{STAGE_NAMES[progress.stage]}</span>
        <span className="block truncate text-[11px] font-semibold text-emerald-100/85">
          {progress.nextThreshold == null ? `${total} milestones · sanctuary complete` : `${progress.remaining} to ${STAGE_NAMES[progress.stage + 1]}`}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/65" />
    </button>
  )
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { stage, milestones, milestoneTotal, momentum, sceneTone, updateGarden } = useGarden()
  const reducedMotion = useReducedMotion()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const hintKey = `garden-interaction-hint-${user.id}`
  const [showHint, setShowHint] = useState(() => {
    try { return localStorage.getItem(hintKey) !== '1' } catch { return false }
  })

  useEffect(() => {
    async function load() {
      setError(null)
      const [goalResult, plan] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
        getPlan(user.id),
      ])
      if (goalResult.error) throw goalResult.error
      const loadedGoals = goalResult.data ?? []
      let progress
      try {
        progress = await reconcileGardenMilestones(user.id, {
          plans: plan ? [plan] : [],
          goals: loadedGoals,
        })
      } catch {
        const fallback = milestoneEventsFromState({ plans: plan ? [plan] : [], goals: loadedGoals })
        progress = { milestones: fallback, total: fallback.length }
        setError('Your garden is visible, but permanent progress could not sync yet. It will retry next time.')
      }
      setGoals(loadedGoals)
      updateGarden({
        milestones: progress.milestones,
        milestoneTotal: progress.total,
        goals: loadedGoals,
        income: profile?.monthly_income,
        expenses: profile?.monthly_expenses,
      })
      setLoading(false)
    }
    load().catch(loadError => {
      setError(loadError.message ?? 'Could not tend your garden right now.')
      setLoading(false)
    })
  }, [profile?.monthly_expenses, profile?.monthly_income, updateGarden, user.id])

  useEffect(() => {
    if (!showHint) return undefined
    try { localStorage.setItem(hintKey, '1') } catch {}
    const timer = setTimeout(() => setShowHint(false), 6500)
    return () => clearTimeout(timer)
  }, [hintKey, showHint])

  const grouped = useMemo(() => groupGardenGoals(goals, milestones), [goals, milestones])
  const progress = stageProgress(milestoneTotal)
  const latest = milestones.slice(0, 3)

  function openGoal(goal) {
    setSelectedGoal(goal)
    setSheet('goal')
  }

  const selectedPercent = selectedGoal
    ? Math.min(100, Math.round((Number(selectedGoal.current_amount || 0) / Math.max(1, Number(selectedGoal.target_amount || 0))) * 100))
    : 0

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.25 }}
      className="relative h-full min-h-0 overflow-hidden pb-[var(--mobile-dock-clearance)] md:pb-0">
      <div className="absolute inset-0 pb-[var(--mobile-dock-clearance)] md:pb-0">
        <Suspense fallback={<GardenLoading />}>
          <Garden3D
            onSelectGoal={openGoal}
            onSelectOverflow={() => setSheet('overflow')}
            onSelectLegacy={() => setSheet('legacy')}
          />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4 md:top-4">
        {!loading && <StageChip total={milestoneTotal} onClick={() => setSheet('story')} />}
      </div>

      {error && (
        <div role="alert" className="absolute left-4 right-4 top-16 z-20 mx-auto max-w-lg rounded-xl border border-amber-200/20 bg-[#172017]/90 px-3 py-2 text-[13px] font-medium leading-5 text-amber-50 backdrop-blur-xl">
          {error}
        </div>
      )}

      {showHint && !loading && (
        <button type="button" onClick={() => setShowHint(false)}
          className="absolute bottom-[calc(var(--mobile-dock-clearance)+0.65rem)] left-1/2 z-20 min-h-11 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-[#08110e]/82 px-4 text-[13px] font-semibold text-white/90 shadow-xl backdrop-blur-xl md:bottom-5">
          Tap a plant · drag gently to look around
        </button>
      )}

      <BottomSheet open={sheet === 'story'} title="Your Garden Story" onClose={() => setSheet(null)} size="sm">
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.055] p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full ring-2 ring-white/15" style={{ background: STAGE_COLORS[stage] }} />
              <div>
                <p className="text-[17px] font-semibold text-white">{STAGE_NAMES[stage]}</p>
                <p className="text-[13px] font-medium text-readable-secondary">{milestoneTotal} permanent {milestoneTotal === 1 ? 'milestone' : 'milestones'}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-[13px] font-medium text-emerald-100">
              {progress.nextThreshold == null ? 'Your sanctuary is fully grown.' : `${progress.remaining} more earned ${progress.remaining === 1 ? 'action' : 'actions'} to ${STAGE_NAMES[stage + 1]}.`}
            </p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-white">What the garden means</h3>
            <p className="mt-1 text-[13px] leading-5 text-readable-secondary">Each completed Plan step and first-time goal achievement becomes a permanent milestone. Goal plants show live progress. Reached goals flower together in the legacy grove.</p>
            <p className="mt-2 text-[13px] leading-5 text-readable-secondary">The garden is {momentum === 'lively' ? 'lively from recent tending' : momentum === 'gentle' ? 'gently active' : 'resting peacefully'}. {sceneTone === 'strained' ? 'Soft cloud cover reflects a tight month, but nothing you earned can be lost.' : 'Its calm atmosphere reflects a steady money picture.'}</p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-white">Recent milestones</h3>
            {latest.length ? (
              <ul className="mt-2 divide-y divide-white/[0.07]">
                {latest.map(item => (
                  <li key={item.id || `${item.kind}-${item.source_key}`} className="flex gap-3 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-200">
                      {item.kind === 'goal' ? <Flower2 className="h-4 w-4" /> : <Sprout className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-5 text-white">{item.label}</span>
                      <span className="block text-xs text-readable-secondary">{formatDate(item.earned_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[13px] leading-5 text-readable-secondary">Your prepared seedbed is ready for the first action you complete.</p>}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'goal'} title={selectedGoal?.name || 'Goal progress'} onClose={() => { setSheet(null); setSelectedGoal(null) }} size="sm">
        {selectedGoal && (
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-readable-secondary">Saved so far</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{formatMoney(selectedGoal.current_amount)}</p>
              </div>
              <p className="text-[15px] font-semibold tabular-nums text-emerald-200">{selectedPercent}%</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${selectedPercent}%` }} />
            </div>
            <dl className="mt-5 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.09] px-4">
              <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Target</dt><dd className="font-semibold tabular-nums text-white">{formatMoney(selectedGoal.target_amount)}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Monthly contribution</dt><dd className="font-semibold tabular-nums text-white">{formatMoney(selectedGoal.monthly_contribution)}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-[13px]"><dt className="text-readable-secondary">Target date</dt><dd className="font-semibold text-white">{selectedGoal.deadline ? formatDate(`${selectedGoal.deadline}T00:00:00`) : 'Not set'}</dd></div>
            </dl>
            <Link to="/plan#goals" onClick={() => setSheet(null)} className="btn-primary mt-5 w-full justify-center">Update in Plan</Link>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === 'overflow'} title="More growing goals" subtitle="These goals are still part of your garden, gathered together to keep the landscape calm." onClose={() => setSheet(null)} size="sm">
        <div className="divide-y divide-white/[0.07]">
          {grouped.overflow.map(goal => (
            <button key={goal.id} type="button" onClick={() => openGoal(goal)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
              <Target className="h-4 w-4 shrink-0 text-emerald-200" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{goal.name}</span>
              <ChevronRight className="h-4 w-4 text-readable-muted" />
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'legacy'} title="Legacy grove" subtitle="Every goal first reached remains part of your story." onClose={() => setSheet(null)} size="sm">
        {grouped.legacy.length ? (
          <ul className="divide-y divide-white/[0.07]">
            {grouped.legacy.map(item => (
              <li key={item.id || item.source_key} className="flex gap-3 py-3">
                <Flower2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                <span><span className="block text-[13px] font-semibold text-white">{item.label}</span><span className="text-xs text-readable-secondary">Reached {formatDate(item.earned_at)}</span></span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] leading-5 text-readable-secondary">Reached goals will flower here permanently.</p>}
      </BottomSheet>
    </motion.main>
  )
}
