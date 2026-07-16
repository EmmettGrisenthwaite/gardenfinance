import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, Loader2, Calendar, X, ChevronDown, ChevronRight, Sparkles, RefreshCw } from 'lucide-react'
import { applyLabel } from '@/lib/advisorPlans'
import { fetchHowTo } from '@/lib/claude'
import { HOW_TO_SLOW_MS } from '@/lib/howToGuide'

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
      <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold cursor-pointer transition-colors ${
        meta ? meta.chip : 'text-white/40 bg-white/[0.065] border-white/10 hover:text-white/65 hover:border-white/20'}`}>
        <Calendar className="w-3 h-3" />
        {meta ? meta.label : 'Add due date'}
        <input type="date" value={due || ''} onChange={e => onSet(e.target.value || null)}
          className="sr-only" aria-label="Set due date" />
      </label>
      {due && (
        <button onClick={() => onSet(null)} aria-label="Clear due date"
          className="ml-1 p-1 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
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

export function StepGuide({ step, context, onSave }) {
  const cached = step.guide ?? guideCache.get(step.id) ?? null
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
    fetchHowTo(step.text, context, { signal: controller.signal })
      .then(t => {
        if (!alive) return
        const clean = t?.trim()
        if (!clean) { setError('The guide came back empty. Please try again.'); return }
        guideCache.set(step.id, clean)
        setText(clean)
        onSave?.(step.id, clean)
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

  return (
    <div className="rounded-xl bg-emerald-500/[0.07] border border-emerald-400/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 mb-1.5">
        <Sparkles className="w-3 h-3" /> How to do this
        {text && !loading && (
          <button onClick={e => { e.stopPropagation(); regenerate() }} aria-label="Refresh this guide"
            title="Rewrite with my current numbers"
            className="ml-auto p-1 -m-1 text-emerald-300/40 hover:text-emerald-300 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>
      {text ? (
        <div className="space-y-1.5">
          {text.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-[13px] text-readable-secondary leading-relaxed">{line.trim()}</p>
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-readable-secondary py-1" role="alert">
          {typeof error === 'string' ? error : "Couldn't load this right now."}{' '}
          <button onClick={() => { setLoading(true); setSlow(false); setAttempt(a => a + 1) }}
            className="font-semibold text-emerald-300 hover:text-emerald-200">Try again</button>
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
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">
        <Check className="w-3 h-3" /> Goal planted → view it
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
        <Check className="w-3 h-3" /> Applied to your numbers
      </span>
    )
  }
  return (
    <button disabled={busy}
      onClick={async e => { e.stopPropagation(); setBusy(true); try { await onApply(step); setApplied(true) } finally { setBusy(false) } }}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 transition-colors disabled:opacity-60">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {label}
    </button>
  )
}

// ── The one emphasized element on the page ──────────────────────────────────────
// Tapping the card body opens the step's own page (title, why, and the full
// how-to) — the hero is just the top step, bigger.
export function UpNextCard({ step, onToggle, onApply, onOpen, progress }) {
  const meta = dueMeta(step.due)
  return (
    <AnimatePresence mode="popLayout">
      <motion.div key={step.id}
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl bg-gradient-to-br from-emerald-500/[0.13] to-white/[0.035] border border-emerald-400/25 p-4 sm:p-5 shadow-xl shadow-black/10">
        {progress && <div className="mb-3 border-b border-white/[0.08] pb-2">{progress}</div>}
        <div onClick={() => onOpen(step)} className="cursor-pointer select-none">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">Up next</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300/70">
              Details <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="text-[15px] font-semibold text-white leading-snug">{step.text}</div>
          {(step.detail || step.impact || meta) && (
            <div className="mt-1 text-xs text-white/60 leading-relaxed">
              {step.detail}
              {step.impact && <span className="ml-1.5 text-emerald-200/90">{step.impact}</span>}
              {meta && <span className={`ml-1.5 text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => onToggle(step.id)}
            className="inline-flex min-h-11 items-center gap-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
            <Check className="w-4 h-4" strokeWidth={3} /> Done
          </button>
          {step.apply && onApply && <ApplyAction step={step} onApply={onApply} />}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Quiet rows: checkbox + title + a small arrow. Nothing else. ────────────────
// Tapping a row opens the step's own page with the full how-to.
function QuietRow({ step, onToggle, onOpen }) {
  return (
    <motion.div layout="position" className="border-b border-white/[0.06] last:border-0">
      <div onClick={() => onOpen(step)}
        className="flex items-center gap-2.5 py-3 cursor-pointer select-none">
        <CheckBox done={step.done} onToggle={() => onToggle(step.id)}
          label={step.done ? 'Mark step not done' : 'Mark step done'} />
        <span className="flex-1 min-w-0 text-sm text-white/85 leading-snug">{step.text}</span>
        <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
      </div>
    </motion.div>
  )
}

export function StepList({ steps, onToggle, onOpen }) {
  if (steps.length === 0) return null
  return (
    <div className="bg-white/[0.05] rounded-2xl border border-white/[0.09] px-3.5">
      {steps.map(step => (
        <QuietRow key={step.id} step={step} onToggle={onToggle} onOpen={onOpen} />
      ))}
    </div>
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
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
        <Check className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0" strokeWidth={3} />
        <span className="flex-1 text-xs font-semibold text-white/50">
          Done · <span className="tabular-nums">{steps.length}</span>{since ? ` since ${since}` : ''}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-2 divide-y divide-white/[0.05]">
          {steps.map(step => (
            <div key={step.id} className="flex items-center gap-2.5 py-2">
              <CheckBox done onToggle={() => onToggle(step.id)} label="Mark step not done" />
              <span className="flex-1 min-w-0 text-sm text-white/35 line-through leading-snug">{step.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add your own step ───────────────────────────────────────────────────────────
export function AddStepRow({ onAdd }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-1 py-2 text-xs font-medium text-white/45 hover:text-emerald-200 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add a step
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1">
      <input autoFocus value={text} onChange={e => setText(e.target.value)}
        onBlur={() => !text && setOpen(false)}
        placeholder="e.g. Cancel unused subscriptions"
        className="flex-1 bg-white/10 border border-white/[0.11] rounded-lg px-3 py-2 text-base md:text-xs text-white placeholder-white/35 focus:outline-none focus:border-emerald-400/50" />
      <button type="submit" disabled={!text.trim()}
        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
        Add
      </button>
    </form>
  )
}

// ── One suggestion, whispered — shown only when the plan is running low ─────────
export function SuggestionRow({ suggestion, onRun, onDismiss }) {
  if (!suggestion) return null
  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${
      suggestion.urgent ? 'bg-amber-400/[0.07] border-amber-400/20' : 'bg-white/[0.045] border-white/[0.08]'}`}>
      <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${suggestion.urgent ? 'text-amber-300' : 'text-emerald-300/80'}`} />
      <span className="flex-1 min-w-0 text-xs text-white/70 leading-snug">{suggestion.q}</span>
      <button onClick={() => onRun(suggestion.action)}
        className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
          suggestion.urgent ? 'text-amber-300 hover:text-amber-200' : 'text-emerald-300 hover:text-emerald-200'}`}>
        {suggestion.cta}
      </button>
      <button onClick={() => onDismiss(suggestion.id)} aria-label="Dismiss suggestion"
        className="p-1 -m-1 text-white/25 hover:text-white/55 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// A reviewable replenishment set. It is generated automatically when the queue
// runs low, but nothing changes in the durable plan until the user approves it.
export function NextChapterCard({ status, draft, error, onAdd, onDismiss, onRegenerate, onRetry, isEmpty = false }) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-4" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-200">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Preparing your next chapter</p>
            <p className="mt-0.5 text-xs text-readable-secondary">Looking at what you finished and what your numbers need next.</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error' && !draft?.steps?.length) {
    return (
      <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4" role="status">
        <p className="text-sm font-semibold text-white">Your current plan is safe.</p>
        <p className="mt-1 text-xs text-readable-secondary">{error || 'We could not prepare new steps just now.'}</p>
        <button type="button" onClick={onRetry}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/10 px-4 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    )
  }

  if (status === 'dismissed') {
    if (!isEmpty) {
      return (
        <button type="button" onClick={onRetry}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-readable-secondary transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
          <Sparkles className="h-4 w-4 text-emerald-200" /> Generate a new next chapter
        </button>
      )
    }
    return (
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-5 text-center">
        <p className="text-sm font-semibold text-white">Your plan is ready when you are.</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-readable-secondary">Generate a personalized starting set, or add your own first move.</p>
        <button type="button" onClick={onRetry} className="btn-primary mt-4 min-h-11">
          <Sparkles className="h-4 w-4" /> Generate next steps
        </button>
      </div>
    )
  }

  if (!draft?.steps?.length) return null
  const saving = status === 'saving'
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-400/[0.11] to-white/[0.04] shadow-xl shadow-black/10">
      <div className="flex items-start gap-3 border-b border-white/[0.08] px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-200">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-200">Next chapter</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{draft.title || 'Keep your momentum growing'}</p>
          <p className="mt-1 text-xs text-readable-secondary">Review these suggestions. Nothing is added until you approve.</p>
        </div>
      </div>
      <div className="divide-y divide-white/[0.07] px-4">
        {draft.steps.map((step, index) => (
          <div key={step.id || `${step.text}-${index}`} className="flex gap-3 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-[11px] font-bold text-emerald-100">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-white">{step.text}</p>
              {step.detail && <p className="mt-1 text-xs leading-relaxed text-readable-secondary">{step.detail}</p>}
              {step.impact && <p className="mt-1 text-xs font-semibold text-emerald-200">{step.impact}</p>}
            </div>
          </div>
        ))}
      </div>
      {status === 'error' && error && (
        <p className="mx-4 mt-3 rounded-xl border border-rose-300/25 bg-rose-300/[0.08] px-3 py-2 text-xs font-medium text-rose-100" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-white/[0.08] px-4 py-3.5">
        <button type="button" onClick={onAdd} disabled={saving} className="btn-primary min-h-11 flex-1 sm:flex-none">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Adding…' : 'Add to my plan'}
        </button>
        <button type="button" onClick={onRegenerate} disabled={saving} className="btn-ghost min-h-11 px-3">
          <RefreshCw className="h-4 w-4" /> Regenerate
        </button>
        <button type="button" onClick={onDismiss} disabled={saving} className="btn-ghost min-h-11 px-3">Not now</button>
      </div>
    </div>
  )
}
