/**
 * Service worker registration.
 *
 * The worker exists so the app opens offline instead of showing a browser error
 * — which is also what Play requires of a Trusted Web Activity.
 *
 * Two things this deliberately does NOT do:
 *
 *   It does not register in development. A cached shell during dev turns every
 *   edit into a mystery about whether you are looking at your change.
 *
 *   It does not prompt about updates. A finance app that interrupts you to talk
 *   about itself is worse than one that quietly picks up the new version on the
 *   next navigation, which is what happens anyway.
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      // A waiting worker means a newer build is ready. Activate it immediately:
      // the alternative is a user sitting on old code until they close every
      // tab, and chunkReload already handles the mid-session asset mismatch.
      if (registration.waiting) registration.waiting.postMessage('skip-waiting')

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage('skip-waiting')
          }
        })
      })
    }).catch(() => {
      // Registration failing is not worth a user-visible error — the app works
      // exactly as before, just without the offline copy.
    })
  })
}

/**
 * Removes any worker and cache this app previously installed.
 *
 * Kept because a stale worker outlives the code that registered it: without a
 * way to clear one, a bad deploy could serve an old shell to a returning user
 * indefinitely, and they have no obvious way out.
 */
export async function unregisterServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(registration => registration.unregister()))
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('garden-')).map(key => caches.delete(key)))
  }
}
