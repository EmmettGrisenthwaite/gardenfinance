import { useState } from 'react'
import { Sparkles, ChevronUp, Loader2 } from 'lucide-react'
import { fetchHowTo } from '@/lib/claude'

// "Show me how" that answers IN PLACE — a compact AI-generated mini-guide that
// expands inside the goal/step card instead of bouncing the user to the advisor
// chat. Fetches once, then caches for the life of the card.
export default function HowToInline({ subject, context }) {
  const [open, setOpen]       = useState(false)
  const [text, setText]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)

  async function loadGuide() {
    if (text || loading) return
    setLoading(true)
    setError(false)
    try {
      const t = await fetchHowTo(subject, context)
      setText(t?.trim() || null)
      if (!t?.trim()) setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    loadGuide()
  }

  return (
    <div className="mt-1.5">
      <button onClick={toggle}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
        <Sparkles className="w-3 h-3" />
        {open ? 'Hide the how-to' : 'Show me how'}
        {open && <ChevronUp className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-emerald-500/[0.07] border border-emerald-400/20 px-3 py-2.5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-emerald-200/80 py-1">
              <Loader2 className="status-spinner w-3.5 h-3.5" aria-hidden="true" /> Writing your steps…
            </div>
          ) : error ? (
            <div className="text-xs text-readable-secondary py-1">
              Couldn't load this right now.{' '}
              <button onClick={() => { setText(null); setError(false); loadGuide() }}
                className="font-semibold text-emerald-300 hover:text-emerald-200">Try again</button>
            </div>
          ) : (
            <div className="space-y-1">
              {text.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} className="text-xs text-white/80 leading-relaxed">{line.trim()}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
