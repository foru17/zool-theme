/*
 * Self-destructing service worker.
 *
 * Komari's built-in frontend is a PWA: it registers /sw.js, which precaches index.html
 * and answers navigations from that cache. After switching themes the precached HTML
 * still points at the previous theme's hashed assets, which no longer exist — the page
 * goes blank. Browsers check /sw.js on navigation, so shipping this file lets the stale
 * worker be replaced by one that clears every cache, unregisters itself and reloads.
 *
 * zool-theme registers no service worker of its own.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch {
        /* storage may be unavailable */
      }
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) client.navigate(client.url)
    })(),
  )
})

// Always go to the network; never serve a cached response.
self.addEventListener('fetch', () => {})
