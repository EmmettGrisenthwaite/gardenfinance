import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, Loader2, Calendar, X, ChevronDown, ChevronRight, Sparkles, Trash2, RefreshCw } from 'lucide-react'
import { applyLabel } from '@/lib/advisorPlans'
import { fetchHowTo } from '@/lib/claude'
import ResourceLinks from '@/components/ResourceLinks'

// ── Due-date helpers ────────────────────────────────────────────────────────────
function dueMeta(due) {
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

// Tap to pick a date (native picker), × to clear. Expanded view only.
function DueChip({ due, onSet }) {
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

// ── The step's how-to, loaded the moment you click into it ─────────────────────
// Decisive marching orders for THIS step (see fetchHowTo — one provider, one
// sequence, their numbers). Fetches automatically on first open, then lives on
// the step itself (`step.guide`, persisted by the parent via onSave) so
// reopening — this session or next — is instant and free.
const guideCache = new Map()   // stepId → text, survives collapse/expand within a session

function StepGuide({ step, context, onSave }) {
  const cached = step.guide ?? guideCache.get(step.id) ?? null
  const [text, setText]       = useState(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError]     = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (text) return
    let alive = true
    setLoading(true)
    setError(false)
    fetchHowTo(step.text, context)
      .then(t => {
        if (!alive) return
        const clean = t?.trim()
        if (!clean) { setError(true); return }
        guideCache.set(step.id, clean)
        setText(clean)
        onSave?.(step.id, clean)
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
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
        <div className="space-y-1">
          {text.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-xs text-white/80 leading-relaxed">{line.trim()}</p>
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-white/55 py-1">
          Couldn't load this right now.{' '}
          <button onClick={() => { setLoading(true); setAttempt(a => a + 1) }}
            className="font-semibold text-emerald-300 hover:text-emerald-200">Try again</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-200/80 py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working out your best move…
        </div>
      )}
    </div>
  )
}

// One-tap apply button + its applied state (goal applies link back to the goal).
function ApplyAction({ step, onApply }) {
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
// Tapping the card body opens the step's how-to right here (auto-loaded), same
// as every other row — the hero is just the top step, bigger.
export function UpNextCard({ step, onToggle, onApply, howToContext, onGuide }) {
  const meta = dueMeta(step.due)
  const [showHow, setShowHow] = useState(false)
  // A new step sliding up into the card starts closed.
  useEffect(() => { setShowHow(false) }, [step.id])

  return (
    <AnimatePresence mode="popLayout">
      <motion.div key={step.id}
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl bg-emerald-500/[0.08] border border-emerald-400/25 p-4">
        <div onClick={() => setShowHow(s => !s)} className="cursor-pointer select-none">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">Up next</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300/70">
              {showHow ? 'hide how' : 'tap for how'}
              <ChevronRight className={`w-3 h-3 transition-transform ${showHow ? 'rotate-90' : ''}`} />
            </span>
          </div>
          <div className="text-[15px] font-semibold text-white leading-snug">{step.text}</div>
          {(step.detail || step.impact || meta) && (
            <div className="mt-1 text-xs text-white/60 leading-relaxed">
              {step.detail}
              {step.impact && <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-emerald-500/[0.14] text-emerald-200 text-[10px] font-semibold align-middle">{step.impact}</span>}
              {meta && <span className={`ml-1.5 text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>}
            </div>
          )}
        </div>
        <ResourceLinks resources={step.resources} />
        {showHow && (
          <div className="mt-3">
            <StepGuide step={step} context={howToContext} onSave={onGuide} />
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => onToggle(step.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-colors">
            <Check className="w-4 h-4" strokeWidth={3} /> Done
          </button>
          {step.apply && onApply && <ApplyAction step={step} onApply={onApply} />}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Quiet rows: checkbox + text (+ one tiny hint). Tap to expand — the step's
// how-to loads right there, automatically. ──────────────────────────────────────
function QuietRow({ step, expanded, onExpand, onToggle, onApply, onSetDue, onDelete, howToContext, onGuide }) {
  const meta = dueMeta(step.due)
  const hint = meta
    ? <span className={`text-[10px] font-semibold whitespace-nowrap ${meta.color}`}>{meta.label}</span>
    : step.impact
      ? <span className="text-[10px] font-semibold text-emerald-300/80 whitespace-nowrap">{step.impact}</span>
      : null
  // Deleting is destructive — two-tap arm, auto-disarms.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 2500)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <motion.div layout="position" className="border-b border-white/[0.06] last:border-0">
      <div onClick={() => onExpand(expanded ? null : step.id)}
        className="flex items-center gap-2.5 py-2.5 cursor-pointer select-none">
        <CheckBox done={step.done} onToggle={() => onToggle(step.id)}
          label={step.done ? 'Mark step not done' : 'Mark step done'} />
        <span className="flex-1 min-w-0 text-sm text-white/85 leading-snug">{step.text}</span>
        {!expanded && hint}
        <ChevronRight className={`w-3.5 h-3.5 text-white/25 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>

      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.18 }} className="overflow-hidden">
          <div className="pl-[30px] pb-3 space-y-2" onClick={e => e.stopPropagation()}>
            {step.detail && <p className="text-xs text-white/55 leading-relaxed">{step.detail}</p>}
            {step.impact && (
              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/[0.14] text-emerald-200 text-[10px] font-semibold">{step.impact}</span>
            )}
            <ResourceLinks resources={step.resources} />
            {/* The whole point of clicking in: how to actually do it, decided for them */}
            {howToContext !== undefined && <StepGuide step={step} context={howToContext} onSave={onGuide} />}
            <div className="flex items-center gap-3 flex-wrap">
              {step.apply && onApply && <ApplyAction step={step} onApply={onApply} />}
              {onSetDue && <DueChip due={step.due} onSet={d => onSetDue(step.id, d)} />}
              {onDelete && (
                <button
                  onClick={() => { if (armed) onDelete(step.id); else setArmed(true) }}
                  aria-label={armed ? 'Tap again to remove step' : 'Remove step'}
                  className={`inline-flex items-center gap-1 rounded-md transition-colors text-[10px] font-semibold ${
                    armed ? 'px-2 py-1 text-rose-200 bg-rose-500/20 border border-rose-400/40'
                          : 'p-1 text-white/25 hover:text-rose-300'}`}>
                  <Trash2 className="w-3 h-3" />
                  {armed && 'Remove?'}
                </button>
              )}
            </div>
            {step.group && <p className="text-[10px] text-white/30">from: {step.group}</p>}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export function StepList({ steps, expandedId, onExpand, onToggle, onApply, onSetDue, onDelete, howToContext, onGuide }) {
  if (steps.length === 0) return null
  return (
    <div className="bg-white/[0.05] rounded-2xl border border-white/[0.09] px-3.5">
      {steps.map(step => (
        <QuietRow key={step.id} step={step}
          expanded={expandedId === step.id} onExpand={onExpand}
          onToggle={onToggle} onApply={onApply} onSetDue={onSetDue} onDelete={onDelete}
          howToContext={howToContext} onGuide={onGuide} />
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
  const [busy, setBusy] = useState(false)
  if (!suggestion) return null

  async function run() {
    if (busy) return
    setBusy(true)
    try { await onRun(suggestion.action) } finally { setBusy(false) }
  }

  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${
      suggestion.urgent ? 'bg-amber-400/[0.07] border-amber-400/20' : 'bg-white/[0.045] border-white/[0.08]'}`}>
      <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${suggestion.urgent ? 'text-amber-300' : 'text-emerald-300/80'}`} />
      <span className="flex-1 min-w-0 text-xs text-white/70 leading-snug">{suggestion.q}</span>
      <button onClick={run} disabled={busy}
        className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
          suggestion.urgent ? 'text-amber-300 hover:text-amber-200' : 'text-emerald-300 hover:text-emerald-200'} disabled:opacity-50`}>
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : suggestion.cta}
      </button>
      <button onClick={() => onDismiss(suggestion.id)} aria-label="Dismiss suggestion"
        className="p-1 -m-1 text-white/25 hover:text-white/55 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}
