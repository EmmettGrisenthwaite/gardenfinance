import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
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
    <div className="mt-2">
      <button onClick={toggle} aria-expanded={open}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[14px] font-semibold text-emerald-200 transition-colors hover:bg-white/[0.05] hover:text-emerald-100">
        {open ? 'Hide how to do it' : 'How to do it'}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 py-1 text-[13px] text-readable-secondary">
              <Loader2 className="status-spinner w-3.5 h-3.5" aria-hidden="true" /> Writing your steps…
            </div>
          ) : error ? (
            <div className="text-[13px] text-readable-secondary">
              <p>Couldn't load this right now.</p>
              <button onClick={() => { setText(null); setError(false); loadGuide() }}
                className="-ml-2 min-h-11 rounded-lg px-2 font-semibold text-emerald-200 hover:bg-white/[0.05]">Try again</button>
            </div>
          ) : (
            <div className="space-y-1">
              {text.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} className="text-[14px] leading-6 text-readable-secondary">{line.trim()}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
