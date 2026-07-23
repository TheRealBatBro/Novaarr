// Minimal app-shell cache — deliberately not a full offline-caching worker.
// Never touches /api/* so live dashboard data always hits the network.
const CACHE = 'mediaremote-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Network-first: a fresh redeploy must take effect immediately for anyone with the
  // app open or installed. The cache only exists as an offline fallback, never as the
  // first choice — cache-first would keep serving a stale shell after every update.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.open(CACHE).then((cache) => cache.match(event.request))),
  );
});
