export const MAX_CHAT_LINKS = 3

const EXPLICIT_LINK_INTENT = /\b(link|links|website|site|url|source|sources|cite|citation)\b/i
const SETUP_ACTION = /\b(open|apply|enroll|sign\s?up|register|create|switch|roll\s?over|transfer|buy|purchase|file|freeze|compare|choose)\b/i
const LINK_DESTINATION = /\b(account|bank|brokerage|ira|roth|401k|403b|hsa|hysa|savings|insurance|marketplace|credit|loan|tax|provider|fund|etf|bond)\b/i

// Raw search results are noisier than explicit citations, so they are only a
// fallback when the user actually asked for a destination they can visit.
// Current-fact answers can still show sources when Claude cites them directly.
export function needsActionLinks(message = '') {
  return EXPLICIT_LINK_INTENT.test(message)
    || (SETUP_ACTION.test(message) && LINK_DESTINATION.test(message))
}

export function collectWebSources(value, sourceSets) {
  if (Array.isArray(value)) {
    value.forEach(item => collectWebSources(item, sourceSets))
    return
  }
  if (!value || typeof value !== 'object') return
  const isWebSource = value.type === 'web_search_result' || value.type === 'web_search_result_location'
  const url = value.url || (value.type === 'web_search_result_location' ? value.source : null)
  const target = value.type === 'web_search_result_location' ? sourceSets.cited : sourceSets.searched
  if (isWebSource && /^https?:\/\//i.test(url || '') && !target.has(url)) {
    target.set(url, { label: value.title || url, url })
  }
  collectWebSources(value.citations, sourceSets)
  collectWebSources(value.content, sourceSets)
}

export function compactWebSources(
  { cited, searched },
  { limit = MAX_CHAT_LINKS, allowSearchFallback = false } = {},
) {
  const pool = cited.size ? cited : (allowSearchFallback ? searched : new Map())
  const hosts = new Set()
  const compact = []
  for (const source of pool.values()) {
    let host = source.url
    try { host = new URL(source.url).hostname.replace(/^www\./, '') } catch { /* URL validated above */ }
    if (hosts.has(host)) continue
    hosts.add(host)
    compact.push(source)
    if (compact.length === limit) break
  }
  return compact
}

// A setup guide can contain resources on several steps. Apply one shared cap
// to the whole card so it never turns into a directory of provider links.
export function limitGuideLinks(guide, limit = MAX_CHAT_LINKS) {
  if (!guide || !Array.isArray(guide.steps)) return guide
  const seen = new Set()
  let remaining = limit
  return {
    ...guide,
    steps: guide.steps.map(step => {
      const resources = []
      for (const resource of Array.isArray(step.resources) ? step.resources : []) {
        if (remaining === 0) break
        if (!resource?.url || !/^https?:\/\//i.test(resource.url) || seen.has(resource.url)) continue
        seen.add(resource.url)
        resources.push(resource)
        remaining -= 1
      }
      const next = { ...step }
      if (resources.length) next.resources = resources
      else delete next.resources
      return next
    }),
  }
}
