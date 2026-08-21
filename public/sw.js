/* Garden Financial service worker.
 *
 * Exists for two reasons: the app should not show a browser error page when the
 * phone loses signal, and Play rejects a Trusted Web Activity that does.
 *
 * Deliberately hand-written and small. A precache manifest would have to be
 * regenerated on every build to track hashed filenames; runtime caching gets the
 * same offline guarantee with nothing to keep in sync.
 *
 * The rules, in priority order:
 *
 *   Navigations      network first, falling back to the cached shell. A stale
 *                    shell would pin users to an old deploy, and the freshest
 *                    HTML is what carries the current asset hashes.
 *   Hashed assets    cache first. The hash IS the version, so a hit is always
 *                    correct and never needs revalidating.
 *   Everything else  network only. Supabase reads must never be served stale —
 *                    money on screen that disagrees with the database is worse
 *                    than money that fails to load.
 */

const VERSION = 'v1'
const SHELL = `garden-shell-${VERSION}`
const ASSETS = `garden-assets-${VERSION}`
const OFFLINE_URL = '/index.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== SHELL && key !== ASSETS).map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

// Lets the page trigger an immediate update instead of waiting for the next
// navigation — see registerServiceWorker in src/lib/serviceWorker.js.
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

const isHashedAsset = url => url.origin === self.location.origin
  && /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|jpg|webp)$/.test(url.pathname)

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request)
        // Keep the shell current so the offline copy is not a fossil.
        const cache = await caches.open(SHELL)
        cache.put(OFFLINE_URL, fresh.clone())
        return fresh
      } catch {
        const cached = await caches.match(OFFLINE_URL)
        return cached || Response.error()
      }
    })())
    return
  }

  if (isHashedAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const fresh = await fetch(request)
      if (fresh.ok) {
        const cache = await caches.open(ASSETS)
        cache.put(request, fresh.clone())
      }
      return fresh
    })())
  }
  // Anything else — Supabase, the chat function, provider links — falls through
  // to the network untouched.
})
