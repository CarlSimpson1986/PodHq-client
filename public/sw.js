// Service worker: push notifications (as before) plus a basic offline/
// flaky-connection shell. Deliberately not a full precache-everything setup
// (no next-pwa/workbox — podHq dropped that dependency entirely, see its
// ROADMAP Stage 11) — this only caches the static app shell (hashed
// /_next/static assets, icons, manifest) and falls back to a cached page or
// /offline for navigations. It never touches /api/* — those must always hit
// the network so auth/session state and payment/booking actions can't be
// served stale.

const CACHE_VERSION = "v2";
const CACHE_NAME = `podhq-client-${CACHE_VERSION}`;
const PRECACHE_URLS = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// Only these navigations are ever written to the cache — every other route
// (profile, bookings, book, buy-credits, etc.) renders member-specific data
// server-side and must never be served stale to a different person on a
// shared device. Found in the 2026-08-16 OWASP audit: the old version cached
// every successful navigation regardless of content, so logging out and back
// in as someone else on the same device/browser could serve the previous
// member's cached profile/bookings page if the network hit the timeout below.
const CACHEABLE_NAVIGATION_PATHS = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/offline"]);

// On a genuinely bad connection, fetch() doesn't reject quickly — it just
// hangs until the browser's own long timeout. Racing it against a short
// timer means a member with rubbish signal sees the cached shell almost
// immediately instead of staring at a blank tab, while the real network
// fetch keeps running in the background to refresh the cache for next time.
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  );
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function navigationHandler(request) {
  const cache = await caches.open(CACHE_NAME);
  const path = new URL(request.url).pathname;
  const cacheable = CACHEABLE_NAVIGATION_PATHS.has(path);

  const networkFetch = fetch(request).then((response) => {
    if (response.ok && cacheable) cache.put(request, response.clone());
    return response;
  });

  try {
    return await withTimeout(networkFetch, NAVIGATION_TIMEOUT_MS);
  } catch {
    // Network is slow/dead. Only ever serve a cached copy for the small
    // allowlisted set of public pages above — every other route falls
    // straight through to the generic offline page rather than risk
    // serving another member's cached, personalized HTML. The network
    // fetch above keeps running unhandled; if it eventually succeeds it
    // still updates the cache for next time (allowlisted paths only).
    if (cacheable) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    const offline = await cache.match("/offline");
    if (offline) return offline;
    return networkFetch;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "My Fit Pod";
  const options = {
    body: payload.body || "",
    // Without an icon/badge, Android renders a bare generic notification —
    // found live 2026-08-17, a real test push was flagged as "possible
    // spam" on the recipient's device, most likely because it carried no
    // branding at all to distinguish it from a low-effort/unwanted one.
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
