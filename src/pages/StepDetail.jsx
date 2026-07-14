import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Trash2, ClipboardList, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { milestonesToStage } from '@/context/GardenContext'
import { getPlan, updatePlanSteps, applyStep } from '@/lib/advisorPlans'
import { buildHowToContext } from '@/lib/howToContext'
import { StepGuide, DueChip, ApplyAction, dueMeta } from '@/components/PlanSteps'
import PageHeader from '@/components/ui/PageHeader'

// One step, one page: the title, why it matters, and the full "how to do this"
// guide — reached by tapping the step in the Plan, exited by the back button.
export default function StepDetail() {
  const { stepId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, setProfile, rememberCompletedStep } = useAuth()

  // The Plan passes the step in nav state for instant paint; the plan itself
  // (needed to save changes) hydrates in the background.
  const [step, setStep]   = useState(location.state?.step ?? null)
  const [plan, setPlan]   = useState(null)
  const [goals, setGoals] = useState([])
  const [debts, setDebts] = useState([])
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    async function load() {
      const [pl, g, d] = await Promise.all([
        getPlan(user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
      ])
      setPlan(pl)
      setGoals(g.data ?? [])
      setDebts(d.data ?? [])
      const found = pl?.steps.find(s => s.id === stepId)
      if (found) setStep(found)
      else if (!location.state?.step) setMissing(true)
    }
    load().catch(err => setError(err.message ?? 'Could not load this step.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, stepId])

  // Deleted / unknown step (e.g. stale link) → back to the plan.
  useEffect(() => { if (missing) navigate('/plan', { replace: true }) }, [missing, navigate])

  const howToCtx = buildHowToContext({ profile, debts })

  function saveSteps(mutate) {
    if (!plan) return
    const next = mutate(plan.steps)
    setPlan(p => ({ ...p, steps: next }))
    updatePlanSteps(plan.id, next, user.id).catch(err => setError(err.message ?? 'Could not save that change.'))
  }

  const saveGuide = (id, guide) => {
    setStep(s => (s && s.id === id ? { ...s, guide } : s))
    saveSteps(list => list.map(s => s.id === id ? { ...s, guide } : s))
  }
  const setDue = (due) => {
    setStep(s => ({ ...s, due }))
    saveSteps(list => list.map(s => s.id === step.id ? { ...s, due } : s))
  }

  async function markDone() {
    if (!plan || !step || completing) return
    setCompleting(true)
    try {
      // Save the durable fact before leaving so the Plan lands with every
      // suggestion and finance surface already reading the updated profile.
      await rememberCompletedStep(step.text)

      // Does this check-off cross a garden stage? Compute here so the Plan page
      // can fire the celebration the moment we land back on it.
      const completedSteps = plan.steps.filter(s => s.done).length
      const goalsReached = goals.filter(g => Number(g.target_amount) > 0 && Number(g.current_amount) >= Number(g.target_amount)).length
      const oldStage = milestonesToStage(completedSteps + goalsReached)
      const newStage = milestonesToStage(completedSteps + goalsReached + 1)
      const next = plan.steps.map(s => s.id === step.id
        ? { ...s, done: true, completedAt: new Date().toISOString() } : s)
      await updatePlanSteps(plan.id, next, user.id)
      setPlan(p => ({ ...p, steps: next }))
      navigate('/plan', { state: newStage > oldStage ? { grew: { stage: newStage, stepText: step.text } } : undefined })
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
  function removeStep() {
    saveSteps(list => list.filter(s => s.id !== step.id))
    navigate('/plan')
  }

  async function applyAndMark(s) {
    try {
      await applyStep(user.id, s.apply)
      setStep(prev => ({ ...prev, applied: true }))
      saveSteps(list => list.map(x => x.id === s.id ? { ...x, applied: true } : x))
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

      {/* Back to the plan */}
      <PageHeader
        icon={ClipboardList}
        eyebrow="Plan"
        title="Step guide"
        subtitle="Everything you need to finish this move."
        onBack={() => navigate('/plan')}
        backLabel="Back to Plan"
      />

      {/* The step */}
      <h1 className="mt-6 font-display text-[24px] font-medium text-white leading-snug sm:text-[28px]">{step.text}</h1>
      {(step.detail || step.impact) && (
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          {step.detail}
          {step.impact && (
            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-emerald-500/[0.14] text-emerald-200 text-[11px] font-semibold align-middle">{step.impact}</span>
          )}
        </p>
      )}
      {meta && <p className={`mt-1.5 text-xs font-semibold ${meta.color}`}>{meta.label}</p>}

      {/* The how-to — the reason this page exists */}
      <div className="mt-4">
        {step.done ? (
          <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-emerald-500/[0.1] border border-emerald-400/25 text-sm text-emerald-100 font-medium">
            <Check className="w-4 h-4 text-emerald-300" strokeWidth={3} /> You've done this one.
          </div>
        ) : (
          <StepGuide step={step} context={howToCtx} onSave={saveGuide} />
        )}
      </div>

      {/* Actions */}
      {!step.done && (
        <div className="mt-5 space-y-4">
          <button onClick={markDone} disabled={!plan || completing}
            className="fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex min-h-12 max-w-2xl items-center justify-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-600 px-4 text-sm font-semibold text-white shadow-2xl shadow-black/40 transition-colors hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 md:static md:w-full md:shadow-lg md:shadow-emerald-950/25">
            {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
            {completing ? 'Saving…' : 'Mark done — grow my garden'}
          </button>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {step.apply && <ApplyAction step={step} onApply={applyAndMark} />}
              <DueChip due={step.due} onSet={setDue} />
            </div>
            <button
              onClick={() => { if (armed) removeStep(); else setArmed(true) }}
              disabled={!plan}
              className={`inline-flex items-center gap-1 rounded-md transition-colors text-[11px] font-semibold disabled:opacity-40 ${
                armed ? 'px-2 py-1 text-rose-200 bg-rose-500/20 border border-rose-400/40'
                      : 'p-1 text-white/30 hover:text-rose-300'}`}>
              <Trash2 className="w-3.5 h-3.5" />
              {armed ? 'Remove this step?' : 'Remove'}
            </button>
          </div>
        </div>
      )}

      {step.group && <p className="mt-5 text-[10px] text-white/30">from: {step.group}</p>}

      {error && (
        <p className="mt-4 text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg text-center">{error}</p>
      )}
    </motion.div>
  )
}
