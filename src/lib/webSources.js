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

export function compactWebSources({ cited, searched }, limit = 6) {
  const pool = cited.size ? cited : searched
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
