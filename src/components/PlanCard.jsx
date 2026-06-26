import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Check, Plus, Loader2, Bookmark, Trash2, ArrowRight, PartyPopper, Calendar, X, ArrowUpRight } from 'lucide-react'
import { applyLabel } from '@/lib/advisorPlans'
import ResourceLinks from '@/components/ResourceLinks'

// Friendly relative label + urgency color for a due date.
function dueMeta(due) {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  const days = Math.round((d - today) / 86400000)
  const label = days < 0 ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow'
    : days <= 7 ? `Due in ${days}d`
    : `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  const color = days < 0 ? 'text-rose-200 bg-rose-500/15 border-rose-400/30'
    : days <= 2 ? 'text-amber-200 bg-amber-400/15 border-amber-400/30'
    : 'text-white/60 bg-white/[0.085] border-white/10'
  return { label, color }
}

// A due-date chip: tap to pick a date (native picker), × to clear.
function DueChip({ due, onSet }) {
  const meta = dueMeta(due)
  return (
    <span className="inline-flex items-center mt-1.5">
      <label className={`inline-flex items-center gap-1 pl-2 pr-2 py-0.5 rounded-md border text-[10px] font-semibold cursor-pointer transition-colors ${meta ? meta.color : 'text-white/40 bg-white/[0.065] border-white/10 hover:text-white/65 hover:border-white/20'}`}>
        <Calendar className="w-3 h-3" />
        {meta ? meta.label : 'Add due date'}
        <input type="date" value={due || ''} onChange={e => onSet(e.target.value || null)}
          className="sr-only" aria-label="Set due date" />
      </label>
      {due && (
        <button onClick={() => onSet(null)} aria-label="Clear due date"
          className="ml-1 p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
      )}
    </span>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// A single action step row: optional checkbox, text + detail, one-tap apply.
function StepRow({ step, onToggle, onApply, onSetDue, onHowTo }) {
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(step.applied)
  const label = applyLabel(step.apply)

  async function handleApply() {
    setBusy(true)
    try { await onApply(step); setApplied(true) } finally { setBusy(false) }
  }

  return (
    <div className="flex items-start gap-2.5 py-2">
      {onToggle && (
        <button onClick={() => onToggle(step.id)} aria-label={step.done ? 'Mark step not done' : 'Mark step done'}
          className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
            step.done ? 'bg-emerald-500 border-emerald-500' : 'border-white/30 hover:border-emerald-400'}`}>
          {step.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-sm leading-snug transition-colors ${step.done ? 'text-white/40 line-through' : 'text-white/90'}`}>
          {step.text}
        </div>
        {step.detail && !step.done && <div className="text-xs text-white/45 mt-0.5 leading-snug">{step.detail}</div>}
        {!step.done && <ResourceLinks resources={step.resources} />}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5">
          {onSetDue && !step.done && <DueChip due={step.due} onSet={d => onSetDue(step.id, d)} />}
          {onHowTo && !step.done && (
            <button onClick={() => onHowTo(step)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
              Show me how <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {label && !step.done && (
          applied ? (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <Check className="w-3 h-3" /> Added to your garden
            </span>
          ) : (
            <button onClick={handleApply} disabled={busy}
              className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 transition-colors disabled:opacity-60">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {label}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// Inline "add your own step" row (page variant only).
function AddStepRow({ onAdd }) {
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
        className="flex items-center gap-1.5 w-full px-4 py-2.5 text-xs font-medium text-white/45 hover:text-emerald-200 hover:bg-white/[0.045] transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add your own step
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-4 py-2.5">
      <input autoFocus value={text} onChange={e => setText(e.target.value)}
        onBlur={() => !text && setOpen(false)}
        placeholder="e.g. Cancel unused subscriptions"
        className="flex-1 bg-white/10 border border-white/[0.11] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-emerald-400/50" />
      <button type="submit" disabled={!text.trim()}
        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
        Add
      </button>
    </form>
  )
}

// Plan card. variant 'chat' shows a Save button; 'page' shows checkboxes,
// a progress bar, an "add your own step" row, and a completion celebration.
export default function PlanCard({ plan, variant = 'chat', saved = false, onSave, onApply, onToggle, onDelete, onAddStep, onSetDue, onHowTo }) {
  const [saving, setSaving] = useState(false)
  const steps = plan.steps ?? []
  const doneCount = steps.filter(s => s.done).length
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0
  const complete = steps.length > 0 && doneCount === steps.length

  async function handleSave() {
    setSaving(true)
    try { await onSave?.() } finally { setSaving(false) }
  }

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] overflow-hidden">
      {/* Progress strip (page variant) */}
      {variant === 'page' && (
        <div className="h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-emerald-500/10">
        <ClipboardList className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{plan.title}</div>
          {variant === 'page' && plan.created_at && (
            <div className="text-[10px] text-white/40">Saved {timeAgo(plan.created_at)}</div>
          )}
        </div>
        {variant === 'page' && (
          <span className={`text-[11px] font-bold flex-shrink-0 ${complete ? 'text-emerald-300' : 'text-white/45'}`}>
            {doneCount}/{steps.length}
          </span>
        )}
        {variant === 'page' && onDelete && (
          <button onClick={onDelete} aria-label="Delete plan"
            className="p-1 -mr-1 text-white/35 hover:text-rose-300 transition-colors flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="px-4 py-1.5 divide-y divide-white/5">
        {steps.map(step => (
          <StepRow key={step.id}
            step={step}
            onToggle={variant === 'page' ? onToggle : undefined}
            onSetDue={variant === 'page' ? onSetDue : undefined}
            onHowTo={variant === 'page' ? onHowTo : undefined}
            onApply={onApply} />
        ))}
      </div>

      {/* Completion celebration (page variant) */}
      {variant === 'page' && complete && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/15 border-t border-emerald-400/20 text-xs font-semibold text-emerald-200">
          <PartyPopper className="w-4 h-4" /> Every step done — your garden thanks you.
        </div>
      )}

      {/* Add-your-own-step (page variant) */}
      {variant === 'page' && onAddStep && !complete && (
        <div className="border-t border-white/10">
          <AddStepRow onAdd={onAddStep} />
        </div>
      )}

      {/* Save / view (chat variant) */}
      {variant === 'chat' && (
        <div className="px-4 py-3 border-t border-white/10">
          {saved ? (
            <Link to="/plan"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
              <Check className="w-3.5 h-3.5" /> Added to your Plan — track it as you go <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <p className="text-xs text-white/75 mb-2">Would you like me to add this to your Plan so you can check it off as you go?</p>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-60">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                Yes, add to my Plan
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
