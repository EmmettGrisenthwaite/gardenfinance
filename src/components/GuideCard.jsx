import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenCheck, Check, Loader2, Bookmark, ArrowRight, Clock } from 'lucide-react'
import ResourceLinks from '@/components/ResourceLinks'

// Inline advisor card: a concrete "do it today" walkthrough with reputable
// provider links. Saves into the user's Plan as a checklist (with the links).
export default function GuideCard({ guide, saved = false, onSave, onDismiss }) {
  const [saving, setSaving] = useState(false)
  const steps = guide.steps ?? []

  async function handleSave() {
    setSaving(true)
    try { await onSave?.() } finally { setSaving(false) }
  }

  return (
    <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.07] overflow-hidden">
      <div className="flex items-start gap-2 px-4 py-3 border-b border-white/10 bg-sky-500/10">
        <BookOpenCheck className="w-4 h-4 text-sky-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{guide.title}</div>
          {guide.summary && <div className="text-xs text-readable-secondary mt-0.5 leading-snug">{guide.summary}</div>}
        </div>
        {Number(guide.estimated_minutes) > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-200 bg-sky-500/15 border border-sky-400/25 rounded-full px-2 py-0.5 flex-shrink-0">
            <Clock className="w-3 h-3" /> {Math.round(guide.estimated_minutes)} min
          </span>
        )}
      </div>

      <ol className="px-4 py-1.5 divide-y divide-white/5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 py-2.5">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-[11px] font-bold text-sky-200 flex-shrink-0">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white/90 leading-snug">{s.text}</div>
              {s.detail && <div className="text-xs text-readable-secondary mt-0.5 leading-snug">{s.detail}</div>}
              <ResourceLinks resources={s.resources} />
            </div>
          </li>
        ))}
      </ol>

      <div className="px-4 py-3 border-t border-white/10">
        {saved ? (
          <Link to="/plan"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
            <Check className="w-3.5 h-3.5" /> Added to your Plan — track it as you go <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <>
            <p className="text-xs text-readable-secondary mb-2">Would you like me to add this to your Plan so you can check it off as you go?</p>
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-60">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                Yes, add to my Plan
              </button>
              {onDismiss && (
                <button onClick={onDismiss}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-readable-secondary hover:text-white hover:bg-white/5 transition-colors">
                  Not now
                </button>
              )}
            </div>
            <p className="text-[10px] text-readable-muted mt-2 leading-tight">Links open official sites — verify before entering info.</p>
          </>
        )}
      </div>
    </div>
  )
}
