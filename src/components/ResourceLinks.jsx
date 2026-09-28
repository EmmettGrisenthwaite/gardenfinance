import { ExternalLink } from 'lucide-react'

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Renders a step's reputable provider/resource links. The visible hostname
// keeps it honest about where the link goes; links open in a new tab with no
// referrer/opener. `list` is for pages where the link IS the next action — full
// rows a thumb can hit, rather than chips beside other content.
export default function ResourceLinks({ resources, limit = 3, variant = 'chips' }) {
  if (!resources?.length) return null
  if (variant === 'list') {
    return (
      <div className="mt-2 divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-sky-400/20 bg-sky-500/[0.06]">
        {resources.slice(0, limit).map(r => (
          <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-sky-500/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/70">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold leading-5 text-sky-50">{r.label}</span>
              {hostOf(r.url) && <span className="block text-[12px] leading-5 text-sky-200/70">{hostOf(r.url)}</span>}
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
          </a>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {resources.slice(0, limit).map((r, i) => (
        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sky-400/25 bg-sky-500/[0.1] px-3 text-[13px] text-sky-100 transition-colors hover:border-sky-400/50 hover:bg-sky-500/20">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-sky-300" />
          <span className="font-semibold">{r.label}</span>
          {hostOf(r.url) && <span className="text-sky-200/60">{hostOf(r.url)}</span>}
        </a>
      ))}
    </div>
  )
}
