import { ExternalLink } from 'lucide-react'

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Renders a step's reputable provider/resource links as chips. The visible
// hostname keeps it honest about where the link goes; links open in a new tab
// with no referrer/opener.
export default function ResourceLinks({ resources }) {
  if (!resources?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {resources.map((r, i) => (
        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg bg-sky-500/[0.12] border border-sky-400/25 text-[11px] text-sky-100 hover:bg-sky-500/20 hover:border-sky-400/50 transition-colors">
          <ExternalLink className="w-3 h-3 text-sky-300 flex-shrink-0" />
          <span className="font-semibold">{r.label}</span>
          {hostOf(r.url) && <span className="text-sky-200/45">{hostOf(r.url)}</span>}
        </a>
      ))}
    </div>
  )
}
