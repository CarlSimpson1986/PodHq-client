// Service worker: push notifications (as before) plus a basic offline/
// flaky-connection shell. Deliberately not a full precache-everything setup
// (no next-pwa/workbox — podHq dropped that dependency entirely, see its
// ROADMAP Stage 11) — this only caches the static app shell (hashed
// /_next/static assets, icons, manifest) and falls back to a cached page or
// /offline for navigations. It never touches /api/* — those must always hit
// the network so auth/session state and payment/booking actions can't be
// served stale.

const CACHE_VERSION = "v1";
const CACHE_NAME = `podhq-client-${CACHE_VERSION}`;
const PRECACHE_URLS = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

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

  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });

  try {
    return await withTimeout(networkFetch, NAVIGATION_TIMEOUT_MS);
  } catch {
    // Network is slow/dead — serve whatever's cached for this exact page if
    // we have it, otherwise the generic offline page. The network fetch
    // above keeps running unhandled; if it eventually succeeds it still
    // updates the cache for the next visit.
    const cached = await cache.match(request);
    if (cached) return cached;
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
