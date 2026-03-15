// ============================================================
//  Thirai PWA — Service Worker  (v3)
//  Place this file at: /static/service-worker.js
// ============================================================

const CACHE_NAME = 'thirai-v3';

// Cache both the main app shell AND the offline player page
const APP_SHELL = [
  '/',
  '/offline',
  '/static/manifest.json',
  '/static/ios/icon-96x96.png',
  '/static/ios/icon-192x192.png',
  '/static/ios/icon-152x152.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API / dynamic — network only, silent fail offline
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

  // Same-origin — cache-first, refresh in background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => null);

        // Navigation fallback: serve cached version or homepage
        if (request.mode === 'navigate') {
          return cached || networkFetch || caches.match('/');
        }
        return cached || networkFetch;
      })
    );
    return;
  }

  // Cross-origin (fonts, CDN icons) — cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => null);
    })
  );
});
