// After a deploy, a tab still holding the old index.html requests chunk hashes
// that no longer exist on the server — the dynamic import (or a script) rejects
// and trips the error boundary ("Something went wrong"). The fix is to reload
// once so the browser pulls the fresh index.html + chunk manifest.

export function isChunkError(err) {
  const m = String((err && (err.message || err.name)) || err || '')
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Failed to fetch dynamically imported module|Loading chunk \d+ failed|'text\/html' is not a valid JavaScript MIME type/i.test(m)
}

// Reload at most once per 10s window — enough to recover from a stale deploy,
// but guards against an infinite loop if the import fails for a real reason.
export function reloadOnce() {
  try {
    const KEY = 'chunk-reload-at'
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(KEY, String(Date.now()))
      window.location.reload()
      return true
    }
  } catch { /* sessionStorage unavailable */ }
  return false
}
