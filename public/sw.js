/* E-Learn service worker.
 * - Precaches the offline page.
 * - Navigations: network first, falls back to /offline. Pages are not cached:
 *   they are per-user (dashboards, grades) and must not outlive a logout.
 * - /_next/static/ and /icons/: cache first (content-hashed / immutable).
 * - Never caches /api/ or non-GET requests.
 * Bump VERSION to drop old caches on the next activation.
 */
const VERSION = "v1"
const PRECACHE = `elearn-precache-${VERSION}`
const RUNTIME = `elearn-runtime-${VERSION}`
const OFFLINE_URL = "/offline"
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  const keep = [PRECACHE, RUNTIME]
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("elearn-") && !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function networkFirstPage(request) {
  try {
    return await fetch(request)
  } catch {
    const offline = await caches.match(OFFLINE_URL)
    return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === "basic") {
    const copy = response.clone()
    caches.open(RUNTIME).then((cache) => cache.put(request, copy))
  }
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request))
    return
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request))
  }
})

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting()
})
