import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ChevronRight } from 'lucide-react'
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
    <section aria-label={guide.title} className="rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[15px] font-semibold leading-6 text-white">{guide.title}</h4>
        {Number(guide.estimated_minutes) > 0 && (
          <span className="shrink-0 text-[13px] tabular-nums text-readable-muted">{Math.round(guide.estimated_minutes)} min</span>
        )}
      </div>
      {guide.summary && <p className="mt-1 text-[14px] leading-5 text-readable-secondary">{guide.summary}</p>}

      <ol className="mt-3 divide-y divide-white/[0.06] border-t border-white/[0.07]">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <span className="w-4 shrink-0 pt-px text-right text-[14px] tabular-nums text-readable-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-6 text-white">{s.text}</p>
              {s.detail && <p className="mt-0.5 text-[14px] leading-5 text-readable-secondary">{s.detail}</p>}
              <ResourceLinks resources={s.resources} />
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t border-white/[0.07] pt-3">
        {saved ? (
          <Link to="/plan"
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-emerald-200 transition-colors hover:text-emerald-100">
            Added to your Plan <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <>
            <p className="text-[14px] leading-5 text-readable-secondary">Add this to your Plan so you can check it off as you go?</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-[14px] disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add to my Plan
              </button>
              {onDismiss && (
                <button type="button" onClick={onDismiss}
                  className="min-h-11 rounded-xl px-3 text-[14px] font-semibold text-readable-secondary transition-colors hover:bg-white/5 hover:text-white">
                  Not now
                </button>
              )}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-readable-muted">Links open official sites. Check the address before entering anything.</p>
          </>
        )}
      </div>
    </section>
  )
}
