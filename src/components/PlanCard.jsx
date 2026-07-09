import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Check, Loader2, Bookmark, ArrowRight } from 'lucide-react'
import ResourceLinks from '@/components/ResourceLinks'

// The advisor's plan PROPOSAL card, shown in chat: a clean read-only list of
// steps with one save action that appends them into the user's single plan.
// (Checking off, due dates, apply actions, etc. all live on the Plan page —
// see PlanSteps.jsx.)
export default function PlanCard({ plan, saved = false, onSave }) {
  const [saving, setSaving] = useState(false)
  const steps = plan.steps ?? []

  async function handleSave() {
    setSaving(true)
    try { await onSave?.() } finally { setSaving(false) }
  }

  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border-b border-white/10">
        <ClipboardList className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <div className="text-sm font-semibold text-white truncate">{plan.title}</div>
      </div>

      <div className="px-4 py-1.5 divide-y divide-white/5">
        {steps.map((step, i) => (
          <div key={step.id ?? i} className="py-2">
            <div className="text-sm text-white/90 leading-snug">{step.text}</div>
            {step.detail && <div className="text-xs text-white/45 mt-0.5 leading-snug">{step.detail}</div>}
            {step.impact && (
              <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-emerald-500/[0.14] text-emerald-200 text-[10px] font-semibold">{step.impact}</span>
            )}
            <ResourceLinks resources={step.resources} />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-white/10">
        {saved ? (
          <Link to="/plan"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
            <Check className="w-3.5 h-3.5" /> Added to your Plan — track it as you go <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <>
            <p className="text-xs text-white/75 mb-2">Would you like me to add {steps.length === 1 ? 'this step' : `these ${steps.length} steps`} to your Plan so you can check them off as you go?</p>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
              Yes, add to my Plan
            </button>
          </>
        )}
      </div>
    </div>
  )
}
