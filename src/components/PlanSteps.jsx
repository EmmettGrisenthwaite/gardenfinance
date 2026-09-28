import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, Loader2, Calendar, X, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, ArrowUp } from 'lucide-react'
import { applyLabel } from '@/lib/advisorPlans'
import { fetchHowTo } from '@/lib/claude'
import { guideEvidenceFingerprint, HOW_TO_SLOW_MS } from '@/lib/howToGuide'
import BottomSheet from '@/components/ui/BottomSheet'

// Distance to a step's finish line, read from live balances (see stepProgress).
// The bar moves as the user's accounts do; nothing here is stored on the step.
export function StepProgressBar({ progress, compact = false }) {
  if (!progress) return null
  return (
    <div className={compact ? 'mt-1' : 'mt-2.5'}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className={`font-semibold tabular-nums ${progress.complete ? 'text-emerald-200' : 'text-white/[0.86]'}`}>{progress.label}</span>
        {progress.eta && <span className="shrink-0 text-readable-muted">{progress.eta}</span>}
      </div>
      {!compact && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar"
          aria-label={progress.label} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
        </div>
      )}
    </div>
  )
}

// ── Due-date helpers ────────────────────────────────────────────────────────────
export function dueMeta(due) {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  const days = Math.round((d - today) / 86400000)
  const label = days < 0 ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow'
    : days <= 7 ? `Due in ${days}d`
    : `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  const color = days < 0 ? 'text-rose-300' : days <= 2 ? 'text-amber-300' : 'text-white/40'
  const chip = days < 0 ? 'text-rose-200 bg-rose-500/15 border-rose-400/30'
    : days <= 2 ? 'text-amber-200 bg-amber-400/15 border-amber-400/30'
    : 'text-white/60 bg-white/[0.085] border-white/10'
  return { label, color, chip }
}

// Tap to pick a date (native picker), × to clear. Step detail page only.
export function DueChip({ due, onSet }) {
  const meta = dueMeta(due)
  return (
    <span className="inline-flex items-center">
      <label className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[14px] font-medium transition-colors ${
        meta ? meta.chip : 'border-white/10 bg-white/[0.05] text-readable-secondary hover:border-white/20 hover:text-white'}`}>
        <Calendar className="h-4 w-4" />
        {meta ? meta.label : 'Add due date'}
        <input type="date" value={due || ''} onChange={e => onSet(e.target.value || null)}
          className="sr-only" aria-label="Set due date" />
      </label>
      {due && (
        <button type="button" onClick={() => onSet(null)} aria-label="Clear due date"
          className="flex h-11 w-11 items-center justify-center text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
      )}
    </span>
  )
}

// 18px checkbox with a 44px hit area (padding + negative margin keeps rows slim).
function CheckBox({ done, onToggle, label }) {
  return (
    <button onClick={e => { e.stopPropagation(); onToggle() }} aria-label={label}
      className="p-[13px] -m-[13px] flex-shrink-0 group/cb">
      <span className={`block w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${
        done ? 'bg-emerald-500 border-emerald-500' : 'border-white/30 group-hover/cb:border-emerald-400'}`}>
        {done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  )
}

// ── The step's how-to guide ─────────────────────────────────────────────────────
// Decisive marching orders for THIS step (see fetchHowTo — one provider, one
// sequence, their numbers). Fetches automatically on first open, then lives on
// the step itself (`step.guide`, persisted by the parent via onSave) so
// reopening — this session or next — is instant and free.
const guideCache = new Map()   // stepId → text, survives navigation within a session

export function StepGuide({ step, context, facts = '', onSave }) {
  const sessionCached = guideCache.get(step.id)
  const cached = step.guide ?? (typeof sessionCached === 'string' ? sessionCached : sessionCached?.text) ?? null
  const evidenceFingerprint = guideEvidenceFingerprint(step.text, context)
  const cachedFingerprint = step.guide
    ? step.guideFingerprint
    : (typeof sessionCached === 'object' ? sessionCached?.fingerprint : null)
  const [text, setText]       = useState(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError]     = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [slow, setSlow]       = useState(false)

  useEffect(() => {
    if (text) return
    let alive = true
    const controller = new AbortController()
    const slowTimer = setTimeout(() => { if (alive) setSlow(true) }, HOW_TO_SLOW_MS)
    setLoading(true)
    setError(false)
    setSlow(false)
    fetchHowTo(step.text, [context, facts].filter(Boolean).join('\n\n'), { signal: controller.signal })
      .then(t => {
        if (!alive) return
        const clean = t?.trim()
        if (!clean) { setError('The guide came back empty. Please try again.'); return }
        guideCache.set(step.id, { text: clean, fingerprint: evidenceFingerprint })
        setText(clean)
        onSave?.(step.id, clean, evidenceFingerprint)
      })
      .catch(err => {
        if (alive && err?.name !== 'AbortError') setError(err?.message || 'Could not load this guide.')
      })
      .finally(() => {
        clearTimeout(slowTimer)
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
      clearTimeout(slowTimer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, attempt])

  // Regenerate: situations change (raise, debt gone, account opened) — let the
  // user pull a fresh guide against their current numbers. Loading must flip
  // in the same update as the text clears — effects run after render, and a
  // frame of { text: null, loading: false } would crash the steps render.
  function regenerate() {
    guideCache.delete(step.id)
    setText(null)
    setLoading(true)
    setSlow(false)
    setAttempt(a => a + 1)
  }

  const stale = Boolean(text && cachedFingerprint && cachedFingerprint !== evidenceFingerprint)

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="section-label">How to do it</h2>
        {text && !loading && (
          <button onClick={e => { e.stopPropagation(); regenerate() }} aria-label="Rewrite this guide with my current numbers"
            title="Rewrite with my current numbers"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-readable-muted transition-colors hover:bg-white/[0.06] hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {text ? (
        <div className="space-y-1.5">
          {stale && (
            <div className="mb-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.07] px-3 py-2 text-xs leading-5 text-amber-50" role="status">
              Your financial details changed since this guide was written.{' '}
              <button type="button" onClick={regenerate} className="font-semibold text-amber-100 underline decoration-amber-100/40 underline-offset-2 hover:text-white">Refresh the guide</button>
            </div>
          )}
          {text.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-[14px] leading-6 text-readable-secondary">{line.trim()}</p>
          ))}
        </div>
      ) : error ? (
        <div className="text-[13px] leading-5 text-readable-secondary" role="alert">
          <p>{typeof error === 'string' ? error : "Couldn't load this right now."}</p>
          <button onClick={() => { setLoading(true); setSlow(false); setAttempt(a => a + 1) }}
            className="-ml-2 mt-1 min-h-11 rounded-lg px-2 font-semibold text-emerald-200 hover:bg-white/[0.05] hover:text-emerald-100">Try again</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-200 py-1" role="status" aria-live="polite">
          <Loader2 className="status-spinner w-3.5 h-3.5" aria-hidden="true" />
          {slow ? 'Finishing your personalized steps…' : 'Checking this step against your numbers…'}
        </div>
      )}
    </div>
  )
}

// One-tap apply button + its applied state (goal applies link back to the goal).
export function ApplyAction({ step, onApply }) {
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(step.applied)
  const label = applyLabel(step.apply)
  if (!label) return null
  if (applied) {
    return step.apply?.type === 'goal' ? (
      <Link to="/plan#goals" onClick={e => e.stopPropagation()}
        className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-emerald-200 hover:text-emerald-100">
        Goal added <ChevronRight className="h-4 w-4" />
      </Link>
    ) : (
      <span className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-emerald-200">
        <Check className="h-4 w-4" /> Applied to your numbers
      </span>
    )
  }
  return (
    <button disabled={busy}
      onClick={async e => { e.stopPropagation(); setBusy(true); try { await onApply(step); setApplied(true) } finally { setBusy(false) } }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-[14px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {label}
    </button>
  )
}

// ── The one emphasized element on the page ──────────────────────────────────────
// Tapping the card body opens the step's own page (title, why, and the full
// how-to) — the hero is just the top step, bigger.
export function UpNextCard({ step, onToggle, onApply, onOpen, progress, live = null, busy = false }) {
  const meta = dueMeta(step.due)
  return (
    <AnimatePresence mode="popLayout">
      <motion.div key={step.id}
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-emerald-300/25 bg-white/[0.05] p-4 sm:p-5">
        {progress && <div className="mb-3 border-b border-white/[0.08] pb-2">{progress}</div>}
        <div onClick={() => onOpen(step)} className="cursor-pointer select-none">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-emerald-200">Next</span>
            <span className="flex items-center gap-0.5 text-[13px] text-readable-muted">
              Details <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <div className="text-[17px] font-semibold leading-6 tracking-[-0.01em] text-white">{step.text}</div>
          <StepProgressBar progress={live} />
          {(step.detail || step.impact || meta) && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-readable-secondary">
              {step.detail}
              {/* Live progress supersedes the estimate made on the day the step was saved. */}
              {step.impact && !live && <span className="ml-1.5 text-emerald-200">{step.impact}</span>}
              {meta && <span className={`ml-1.5 text-xs font-semibold ${meta.color}`}>{meta.label}</span>}
            </p>
          )}
          {step.doneWhen && (
            <p className="mt-2 text-[13px] leading-5 text-readable-muted">Done when {step.doneWhen.charAt(0).toLowerCase() + step.doneWhen.slice(1)}</p>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button onClick={() => onToggle(step.id)} disabled={busy}
            className="btn-primary min-h-11 disabled:cursor-wait">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />} {busy ? 'Saving…' : 'Done'}
          </button>
          {step.apply && onApply && <ApplyAction step={step} onApply={onApply} />}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export function PlanPrerequisite({ item, onOpen, progress }) {
  if (!item) return null
  return (
    <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.04] p-4 sm:p-5">
      {progress && <div className="mb-3 border-b border-white/[0.08] pb-2">{progress}</div>}
      <p className="text-[13px] font-medium text-amber-100">Needed first</p>
      <h2 className="mt-1.5 text-[16px] font-semibold leading-6 text-white">{item.title}</h2>
      <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{item.detail}</p>
      <button type="button" onClick={() => onOpen(item)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-100 px-4 text-sm font-semibold text-[#172019] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/70">
        {item.cta}<ChevronRight className="h-4 w-4" />
      </button>
      <p className="mt-2 text-[13px] leading-5 text-readable-muted">One-time setup. It won't stay in your Plan.</p>
    </div>
  )
}

export function FocusQueue({ steps = [], onOpen, progressFor = () => null }) {
  if (!steps.length) return null
  return (
    <section aria-labelledby="after-this-title" className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.045]">
      <h2 id="after-this-title" className="section-label px-4 pb-1 pt-3">After that</h2>
      <div className="divide-y divide-white/[0.06]">
        {steps.map((step, index) => (
          <button key={step.id || step.candidateKey} type="button" disabled={step.proposed}
            onClick={() => !step.proposed && onOpen?.(step)}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70 disabled:cursor-default">
            <span className="w-4 shrink-0 text-[13px] font-medium tabular-nums text-readable-muted">{index + 2}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium leading-5 text-white/[0.88]">{step.text}</span>
              <StepProgressBar progress={progressFor(step)} compact />
            </span>
            {step.proposed
              ? <span className="shrink-0 text-xs text-readable-muted">Proposed</span>
              : <ChevronRight className="h-4 w-4 shrink-0 text-readable-muted" />}
          </button>
        ))}
      </div>
    </section>
  )
}

export function LaterAccordion({ steps = [], onOpen, onMakeNext, busy = false }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  return (
    <section className="rounded-2xl border border-white/[0.075] bg-white/[0.03]">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70">
        <span className="flex-1 text-[13px] font-medium text-readable-secondary">Later · {steps.length}</span>
        <ChevronDown className={`h-4 w-4 text-readable-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="divide-y divide-white/[0.055] border-t border-white/[0.06] px-3.5">
        {steps.map(step => <div key={step.id} className="flex min-h-12 items-center gap-2 py-2">
          <button type="button" onClick={() => onOpen?.(step)} className="min-w-0 flex-1 text-left text-[14px] leading-5 text-white/[0.78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">{step.text}</button>
          <button type="button" onClick={() => onMakeNext?.(step)} disabled={busy}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-emerald-200 transition-colors hover:bg-emerald-300/[0.08] disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
            <ArrowUp className="h-3.5 w-3.5" /> Make next
          </button>
        </div>)}
      </div>}
    </section>
  )
}

// ── Done — history tucked away, but never gone ─────────────────────────────────
export function DoneAccordion({ steps, onToggle }) {
  const [open, setOpen] = useState(false)
  if (steps.length === 0) return null
  const oldest = steps.map(s => s.completedAt).filter(Boolean).sort()[0]
  const since = oldest ? new Date(oldest).toLocaleDateString('en-US', { month: 'long' }) : null
  return (
    <div className="bg-white/[0.035] rounded-2xl border border-white/[0.07]">
      <button onClick={() => setOpen(o => !o)}
        className="min-h-11 w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
        <Check className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0" strokeWidth={3} />
        <span className="flex-1 text-[13px] font-medium text-readable-secondary">
          Done · <span className="tabular-nums">{steps.length}</span>{since ? ` since ${since}` : ''}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-2 divide-y divide-white/[0.05]">
          {steps.map(step => (
            <div key={step.id} className="flex items-center gap-2.5 py-2">
              <CheckBox done onToggle={() => onToggle(step.id)} label="Mark step not done" />
              <span className="flex-1 min-w-0 text-sm text-readable-muted line-through leading-snug">{step.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add your own step ───────────────────────────────────────────────────────────
export function AddStepRow({ onAdd, disabled = false }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    await onAdd(t)
    setText('')
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} disabled={disabled}
        className="flex min-h-11 items-center gap-1.5 px-1 py-2 text-[13px] font-medium text-readable-muted hover:text-emerald-200 transition-colors disabled:cursor-wait disabled:opacity-45">
        <Plus className="w-3.5 h-3.5" /> Add a step
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1">
      <input autoFocus value={text} onChange={e => setText(e.target.value)} disabled={disabled}
        onBlur={() => !text && setOpen(false)}
        placeholder="e.g. Cancel unused subscriptions"
        className="min-h-11 flex-1 bg-white/10 border border-white/[0.11] rounded-lg px-3 py-2 text-base md:text-xs text-white placeholder-white/35 focus:outline-none focus:border-emerald-400/50" />
      <button type="submit" disabled={!text.trim() || disabled}
        className="min-h-11 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
        Add
      </button>
    </form>
  )
}

// A resized move needs no preview gate: the change is one number, shown old
// and new side by side, so it is one tap to accept.
function AmountUpdateSheet({ review, open, onClose, onKeep, onReplace, busy }) {
  // Only changes with something to say; a retired schedule step is already
  // described by the move's own "then stop" wording.
  const changes = (review.updates || []).slice(1).filter(change => change.patch?.text)
  return (
    <BottomSheet open={open} title="Update this step" subtitle="Your numbers changed. Nothing updates until you say so." onClose={onClose} size="sm">
      <p className="text-[13px] leading-5 text-readable-secondary">{review.reason}</p>
      <div className="mt-4 space-y-2">
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] leading-5 text-readable-muted line-through decoration-white/30">{review.step.text}</p>
        <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] px-3 py-2.5">
          <p className="text-sm font-semibold leading-5 text-white">{review.replacement?.text}</p>
          {review.replacement?.impact && <p className="mt-1 text-xs leading-5 text-emerald-100">{review.replacement.impact}</p>}
        </div>
        {changes.map(change => (
          <p key={change.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-readable-secondary">
            <span className="font-semibold text-white">Also: </span>{change.patch.text}
          </p>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => onReplace?.(review.step, review.replacement)} disabled={busy} className="btn-primary min-h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {/* A final transfer happens once; "/mo" would promise a new standing amount. */}
          {review.final ? `Finish with $${Math.round(review.after).toLocaleString()}` : `Update to $${Math.round(review.after).toLocaleString()}/mo`}
        </button>
        <button type="button" onClick={() => onKeep?.(review.step)} disabled={busy} className="btn-ghost min-h-11 px-3">Keep {`$${Math.round(review.before).toLocaleString()}/mo`}</button>
      </div>
    </BottomSheet>
  )
}

export function CalmOutdatedStepReview({ review, replacement, onKeep, onReplace, busy = false }) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  if (!review?.step) return null
  if (review.kind === 'amount_update') {
    return <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.05] px-4 text-left hover:bg-emerald-300/[0.08]">
        <RefreshCw className="h-4 w-4 shrink-0 text-emerald-100" />
        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-emerald-100">Amount update</span><span className="mt-0.5 block truncate text-[13px] text-readable-secondary">{review.reason}</span></span>
        <ChevronRight className="h-4 w-4 text-readable-muted" />
      </button>
      <AmountUpdateSheet review={review} open={open} onClose={() => setOpen(false)} onKeep={onKeep} onReplace={onReplace} busy={busy} />
    </>
  }
  return <>
    <button type="button" onClick={() => setOpen(true)}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-amber-200/16 bg-amber-200/[0.04] px-4 text-left hover:bg-amber-200/[0.07]">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-100" />
      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-amber-100">Plan check</span><span className="mt-0.5 block truncate text-[13px] text-readable-secondary">{review.reason}</span></span>
      <ChevronRight className="h-4 w-4 text-readable-muted" />
    </button>
    <BottomSheet open={open} title="Review this step" subtitle="Your records changed; nothing is replaced automatically." onClose={() => { setOpen(false); setPreview(false) }} size="sm">
      <p className="text-[15px] font-semibold leading-6 text-white">{review.step.text}</p>
      <p className="mt-2 text-[13px] leading-5 text-readable-secondary">{review.reason}</p>
      {review.retire?.text && (
        <p className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] px-3.5 py-2.5 text-[13px] leading-5 text-amber-50">
          <span className="font-semibold">Also added to your Plan: </span>{review.retire.text}, since it is still set up at your bank.
        </p>
      )}
      {preview && replacement && <div className="mt-4 rounded-xl border border-white/[0.09] bg-black/10 p-3">
        <p className="text-[13px] font-medium text-emerald-200">Replaces it with</p>
        <p className="mt-1 text-[15px] font-semibold leading-6 text-white">{replacement.text}</p>
        {replacement.detail && <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{replacement.detail}</p>}
        {replacement.doneWhen && <p className="mt-2 text-[13px] leading-5 text-readable-muted">Done when {replacement.doneWhen.charAt(0).toLowerCase() + replacement.doneWhen.slice(1)}</p>}
      </div>}
      <div className="mt-5 flex flex-wrap gap-2">
        {preview ? <>
          <button type="button" onClick={() => onReplace?.(review.step, replacement)} disabled={busy || !replacement} className="btn-primary min-h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Confirm replacement
          </button>
          <button type="button" onClick={() => setPreview(false)} disabled={busy} className="btn-ghost min-h-11 px-3">Back</button>
        </> : <>
          {replacement
            ? <button type="button" onClick={() => setPreview(true)} disabled={busy} className="btn-primary min-h-11">Review replacement</button>
            : <button type="button" onClick={() => onReplace?.(review.step, null)} disabled={busy} className="btn-primary min-h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Close this step
            </button>}
          <button type="button" onClick={() => onKeep?.(review.step)} disabled={busy} className="btn-ghost min-h-11 px-3">Keep for now</button>
        </>}
      </div>
      {!replacement && <p className="mt-3 text-[13px] leading-5 text-readable-muted">Nothing else in your numbers is worth swapping in yet.</p>}
    </BottomSheet>
  </>
}

export function CalmNextChapterCard({ status, draft, error, onAdd, onDismiss, onRegenerate, onRetry, isEmpty = false }) {
  const [open, setOpen] = useState(false)
  if ((status === 'loading' || status === 'idle') && !draft?.steps?.length) {
    return <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.04] px-4" aria-live="polite"><Loader2 className="h-4 w-4 animate-spin text-emerald-200" /><span className="text-sm font-semibold text-white">Working out your next moves</span></div>
  }
  if (status === 'error' && !draft?.steps?.length) {
    return <button type="button" onClick={onRetry} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-amber-300/18 bg-amber-300/[0.04] px-4 text-left"><RefreshCw className="h-4 w-4 text-amber-100"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">Your current Plan is safe</span><span className="block truncate text-xs text-readable-secondary">{error || 'Try preparing the next chapter again.'}</span></span></button>
  }
  if (status === 'dismissed') {
    return <button type="button" onClick={onRetry} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-readable-secondary hover:bg-white/[0.04] hover:text-white"><Plus className="h-4 w-4 text-emerald-200"/>{isEmpty ? 'Suggest next steps' : 'Suggest new next steps'}</button>
  }
  if (!draft?.steps?.length) return null
  const saving = status === 'saving'
  return <>
    <button type="button" onClick={() => setOpen(true)}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.045] px-4 text-left hover:bg-emerald-300/[0.075]">
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{draft.steps.length} next {draft.steps.length === 1 ? 'move' : 'moves'} ready</span><span className="mt-0.5 block text-xs text-readable-secondary">Have a look before you add them.</span></span>
      <ChevronRight className="h-4 w-4 text-readable-muted"/>
    </button>
    <BottomSheet open={open} title={draft.title || 'Your next chapter'} subtitle="Ranked by what saves you the most. Nothing changes until you say so." onClose={() => setOpen(false)} size="sm">
      <div className="divide-y divide-white/[0.07]">
        {draft.steps.map((step, index) => <div key={step.id || `${step.text}-${index}`} className="flex gap-3 py-3">
          <span className="w-4 shrink-0 pt-px text-[13px] font-medium tabular-nums text-readable-muted">{index + 1}</span>
          <div className="min-w-0"><p className="text-sm font-semibold leading-snug text-white">{step.text}</p>{step.detail && <p className="mt-1 text-xs leading-relaxed text-readable-secondary">{step.detail}</p>}{step.doneWhen && <p className="mt-1.5 text-xs leading-5 text-white/[0.78]"><span className="font-semibold text-readable-secondary">Done when:</span> {step.doneWhen}</p>}</div>
        </div>)}
      </div>
      {status === 'error' && error && <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/[0.08] px-3 py-2 text-xs font-medium text-rose-100" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onAdd} disabled={saving} className="btn-primary min-h-11 flex-1">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}{saving ? 'Adding…' : `Add ${draft.steps.length === 1 ? 'this step' : `${draft.steps.length} steps`}`}</button>
        <button type="button" onClick={onRegenerate} disabled={saving} className="btn-ghost min-h-11 px-3"><RefreshCw className="h-4 w-4"/> Redo these</button>
        <button type="button" onClick={onDismiss} disabled={saving} className="btn-ghost min-h-11 px-3">Not now</button>
      </div>
    </BottomSheet>
  </>
}
