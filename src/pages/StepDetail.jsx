import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Trash2, Loader2, MoreHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { milestonesToStage } from '@/context/GardenContext'
import { getPlan, updatePlanSteps, applyStep } from '@/lib/advisorPlans'
import { milestoneEventForStep } from '@/lib/gardenModel'
import { recordGardenMilestone } from '@/lib/gardenProgress'
import { buildHowToContext } from '@/lib/howToContext'
import { stepFactsForGuide, stepLinks, stepProgress } from '@/lib/stepFacts'
import { StepGuide, DueChip, ApplyAction, StepProgressBar, dueMeta } from '@/components/PlanSteps'
import ResourceLinks from '@/components/ResourceLinks'
import PageHeader from '@/components/ui/PageHeader'
import { recordStepActivity } from '@/lib/financialActivities'
import { doneWhenForStep } from '@/lib/stepQuality'
import BottomSheet from '@/components/ui/BottomSheet'

function withCompletionCondition(step) {
  return step ? { ...step, doneWhen: doneWhenForStep(step) } : null
}

// One step, one page: the title, why it matters, and the full "how to do this"
// guide — reached by tapping the step in the Plan, exited by the back button.
export default function StepDetail() {
  const { stepId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, setProfile, rememberCompletedStep } = useAuth()

  // The Plan passes the step in nav state for instant paint; the plan itself
  // (needed to save changes) hydrates in the background.
  const [step, setStep]   = useState(withCompletionCondition(location.state?.step))
  const [plan, setPlan]   = useState(null)
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [goals, setGoals] = useState([])
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [savingChange, setSavingChange] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [pl, d, a, g] = await Promise.all([
        getPlan(user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ])
      if (d.error) throw d.error
      if (a.error) throw a.error
      if (g.error) throw g.error
      setPlan(pl)
      setDebts(d.data ?? [])
      setAccounts(a.data ?? [])
      setGoals(g.data ?? [])
      const found = pl?.steps.find(s => s.id === stepId)
      if (found) setStep(withCompletionCondition(found))
      else if (!location.state?.step) setMissing(true)
    }
    load().catch(err => setError(err.message ?? 'Could not load this step.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, stepId])

  // Deleted / unknown step (e.g. stale link) → back to the plan.
  useEffect(() => { if (missing) navigate('/plan', { replace: true }) }, [missing, navigate])

  const howToCtx = buildHowToContext({ profile, debts, accounts, goals })
  const records = { accounts, debts, goals }
  // Resolved against the records as they are now, not as they were when the
  // step was saved: the bank to open, how far along, how long is left.
  const links = step ? stepLinks(step, records) : []
  const progress = step && plan ? stepProgress(step, records) : null
  const facts = step ? stepFactsForGuide(step, records) : ''

  async function saveSteps(mutate) {
    if (!plan || savingChange || completing) return null
    const next = mutate(plan.steps)
    setSavingChange(true)
    try {
      await updatePlanSteps(plan.id, next, user.id)
      setPlan(current => ({ ...current, steps: next }))
      return next
    } catch (err) {
      try {
        const canonical = await getPlan(user.id)
        setPlan(canonical)
        const found = canonical?.steps.find(item => item.id === stepId)
        if (found) setStep(withCompletionCondition(found))
      } catch { /* preserve the original save error */ }
      setError(err.message ?? 'Could not save that change.')
      throw err
    } finally {
      setSavingChange(false)
    }
  }

  const saveGuide = async (id, guide, guideFingerprint) => {
    try {
      const next = await saveSteps(list => list.map(s => s.id === id ? { ...s, guide, guideFingerprint } : s))
      if (next) setStep(s => (s && s.id === id ? { ...s, guide, guideFingerprint } : s))
    } catch { /* saveSteps surfaced and recovered the failure */ }
  }
  const setDue = async (due) => {
    try {
      const next = await saveSteps(list => list.map(s => s.id === step.id ? { ...s, due } : s))
      if (next) setStep(s => ({ ...s, due }))
    } catch { /* saveSteps surfaced and recovered the failure */ }
  }

  async function markDone() {
    if (!plan || !step || completing || savingChange) return
    setCompleting(true)
    try {
      const completedAt = new Date().toISOString()
      const next = plan.steps.map(s => s.id === step.id
        ? { ...s, done: true, completedAt } : s)
      await updatePlanSteps(plan.id, next, user.id)
      setPlan(p => ({ ...p, steps: next }))
      try {
        await rememberCompletedStep(step.text)
      } catch {
        setError('Step completed. Advisor memory will reconcile automatically when your profile reloads.')
      }
      let navigationState
      try {
        const stepIndex = plan.steps.findIndex(item => item.id === step.id)
        const garden = await recordGardenMilestone(milestoneEventForStep(
          plan,
          { ...step, done: true, completedAt },
          stepIndex >= 0 ? stepIndex : 0,
        ))
        const oldStage = milestonesToStage(garden.previousTotal)
        const newStage = milestonesToStage(garden.total)
        navigationState = garden.inserted && newStage > oldStage
          ? { grew: { stage: newStage, stepText: step.text } }
          : undefined
      } catch {
        navigationState = { gardenSyncError: 'Step saved. Permanent garden progress will catch up automatically.' }
      }
      try {
        await recordStepActivity({
          plan,
          step: { ...step, done: true, completedAt },
          accounts,
          debts,
          goals,
        })
      } catch {
        navigationState = {
          ...navigationState,
          gardenSyncError: navigationState?.gardenSyncError || 'Step saved. You can update any resulting balance from Home.',
        }
      }
      navigate('/plan', { state: navigationState })
    } catch (err) {
      setError(err.message ?? 'Could not complete that step.')
      setCompleting(false)
    }
  }

  // Removing is destructive — two-tap arm, auto-disarms.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 2500)
    return () => clearTimeout(t)
  }, [armed])
  async function removeStep() {
    try {
      const next = await saveSteps(list => list.filter(s => s.id !== step.id))
      if (next) navigate('/plan')
    } catch { /* saveSteps surfaced and recovered the failure */ }
  }

  async function applyAndMark(s) {
    try {
      await applyStep(user.id, s.apply)
      setStep(prev => ({ ...prev, applied: true }))
      await saveSteps(list => list.map(x => x.id === s.id ? { ...x, applied: true } : x))
      if (s.apply?.type === 'budget') {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) setProfile(data)
      }
    } catch (err) {
      setError(err.message ?? 'Could not apply that step.')
      throw err
    }
  }

  if (!step) {
    return (
      <div className="max-w-xl mx-auto w-full px-4 pt-4 space-y-3">
        <div className="h-8 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="h-24 bg-white/[0.075] rounded-2xl animate-pulse" />
        <div className="h-48 bg-white/[0.06] rounded-2xl animate-pulse" />
      </div>
    )
  }

  const meta = dueMeta(step.due)

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
      className="max-w-2xl mx-auto w-full px-4 pb-32 md:px-6 md:pb-10"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>

      {/* Back to the plan — the visible "‹ Plan" label names the destination,
          so the eyebrow no longer needs to repeat it. */}
      <PageHeader
        onBack={() => navigate('/plan')}
        backLabel="Plan"
        actions={!step.done && (
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            aria-label="Step options"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-readable-secondary transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      />

      {/* The step */}
      <h1 className="mt-2 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-white sm:text-[28px] sm:leading-9">{step.text}</h1>
      {step.detail && <p className="mt-2 text-[15px] leading-6 text-readable-secondary">{step.detail}</p>}
      {/* The saved estimate ("paid off in about 4 months") gives way to the
          live one below once there are balances to read it from. */}
      {step.impact && !progress && (
        <p className="mt-2 text-[14px] font-medium text-emerald-200">{step.impact}</p>
      )}
      {progress && (
        <div className="mt-4">
          <StepProgressBar progress={progress} />
        </div>
      )}
      {step.doneWhen && (
        <p className="mt-4 border-t border-white/[0.07] pt-3 text-[13px] leading-5 text-readable-muted">
          Done when {step.doneWhen.charAt(0).toLowerCase() + step.doneWhen.slice(1)}
        </p>
      )}
      {meta && <p className={`mt-1.5 text-xs font-semibold ${meta.color}`}>{meta.label}</p>}

      {/* The how-to — the reason this page exists */}
      <div className="mt-4">
        {step.done ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 py-3 text-sm font-medium text-emerald-100">
            <Check className="w-4 h-4 text-emerald-300" strokeWidth={3} /> You've done this one.
          </div>
        ) : plan ? (
          <StepGuide step={step} context={howToCtx} facts={facts} onSave={saveGuide} />
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] px-4 py-3 text-[13px] text-readable-secondary" role="status">
            <Loader2 className="status-spinner h-4 w-4" aria-hidden="true" /> Loading your current numbers…
          </div>
        )}
      </div>

      {/* Where the work happens: the user's own bank or lender when the step
          moves money into something they already have, provider pages only
          when something needs opening. Tap → a new tab. */}
      {!step.done && links.length > 0 && (
        <div className="mt-4">
          <h2 className="section-label">Where to do it</h2>
          <ResourceLinks resources={links} variant="list" />
        </div>
      )}

      {/* Actions */}
      {!step.done && (
        <div className="mt-5 space-y-4">
          <button onClick={markDone} disabled={!plan || completing || savingChange}
            className="fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex min-h-12 max-w-2xl items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-colors hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 md:static md:w-full md:shadow-none">
            {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
            {completing ? 'Saving…' : 'Mark as done'}
          </button>
          {step.apply && <ApplyAction step={step} onApply={applyAndMark} />}
        </div>
      )}

      {step.group && <p className="mt-5 text-[13px] text-readable-muted">From {step.group}</p>}

      {error && (
        <p className="mt-4 text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg text-center">{error}</p>
      )}

      <BottomSheet
        open={optionsOpen}
        title="Step options"
        onClose={() => {
          setOptionsOpen(false)
          setArmed(false)
        }}
        size="sm"
      >
        <div className="space-y-5">
          <div>
            <p className="section-label mb-2">Due date</p>
            <DueChip due={step.due} onSet={setDue} />
          </div>
          <div className="border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={() => {
                if (armed) removeStep()
                else setArmed(true)
              }}
              disabled={!plan || savingChange || completing}
              className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
                armed
                  ? 'border-rose-400/40 bg-rose-500/20 text-rose-100'
                  : 'border-white/[0.10] bg-white/[0.04] text-readable-secondary hover:border-rose-400/30 hover:text-rose-200'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {armed ? 'Tap again to remove step' : 'Remove from Plan'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </motion.div>
  )
}
