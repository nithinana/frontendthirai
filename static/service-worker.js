// ============================================================
//  Thirai PWA — Service Worker
//  Place this file at: /static/service-worker.js
// ============================================================

const CACHE_NAME = 'thirai-v1';

// Core "app shell" — everything needed to render the page offline.
// Add any other local JS/CSS/image paths your page needs.
const APP_SHELL = [
  '/',                                    // the main HTML page
  '/static/manifest.json',
  '/static/ios/icon-96x96.png',
  '/static/ios/icon-192x192.png',
  '/static/ios/icon-152x152.png',
];

// ── INSTALL: pre-cache the app shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // Take over immediately — don't wait for old SW to expire
  self.skipWaiting();
});

// ── ACTIVATE: delete stale caches from old versions ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Claim all open tabs immediately
  self.clients.claim();
});

// ── FETCH: network-first for API calls, cache-first for shell ─
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // --- 1. Skip non-GET requests and browser extensions ----------
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // --- 2. API / dynamic calls — network only (no caching) ------
  //    Adjust this path to match your API's base URL if needed
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cache/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // --- 3. App shell (same origin) — cache-first, then network --
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        // Serve from cache instantly; refresh cache in background
        const networkFetch = fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => null);

        return cached || networkFetch || offlineFallback(request);
      })
    );
    return;
  }

  // --- 4. Cross-origin assets (fonts, CDN, etc.) — cache-first -
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => null);
    })
  );
});

// ── OFFLINE FALLBACK ──────────────────────────────────────────
function offlineFallback(request) {
  // For navigation requests (page loads), serve the cached homepage
  if (request.mode === 'navigate') {
    return caches.match('/');
  }
  return new Response('', { status: 408, statusText: 'Offline' });
}
