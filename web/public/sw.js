// Two caches with deliberately different strategies:
// - SHELL_CACHE: the app itself (HTML/JS/CSS) — network-first, so a fresh redeploy takes effect
//   immediately for anyone with the app open or installed. The cache only exists as an offline
//   fallback, never as the first choice — cache-first would keep serving a stale shell forever.
// - IMAGE_CACHE: poster art and icons — cache-first with a background revalidate. A poster for a
//   given movie/show doesn't change once fetched (same goes for same-origin service icons), so
//   there's no reason to make every load wait on a round-trip to TMDB/TVDB/the arr server before
//   showing something already sitting in cache.
const SHELL_CACHE = 'remotarr-shell-v1';
const IMAGE_CACHE = 'remotarr-images-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Cross-origin poster fetches (TMDB, TVDB, the arr server's own CDN) resolve as opaque
// responses (status 0, ok: false) — that's expected for a no-cors image load, not a failure,
// and an opaque response is still perfectly cacheable and replayable as an <img> src.
function isUsableResponse(res) {
  return res.ok || res.type === 'opaque';
}

async function cacheFirstWithRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const revalidate = fetch(request)
    .then((res) => {
      if (isUsableResponse(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) return cached; // revalidate keeps running in the background for next time
  return (await revalidate) || fetch(request);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.destination === 'image') {
    event.respondWith(cacheFirstWithRevalidate(event.request));
    return;
  }

  const url = new URL(event.request.url);
  // A substring check (not startsWith) so this still matches when the app is served from a
  // reverse-proxy sub-path, e.g. "/remotarr/api/...".
  if (url.pathname.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.open(SHELL_CACHE).then((cache) => cache.match(event.request))),
  );
});
