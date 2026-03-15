const CACHE_NAME = 'thirai-v1';

// Files to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/static/manifest.json',
  '/static/ios/icon-96x96.png',
  '/static/ios/icon-192x192.png',
  '/static/ios/icon-152x152.png',
];

// Install: pre-cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache when offline, otherwise go to network and cache the response
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (API calls, TMDB, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        // Try network first
        const networkResponse = await fetch(event.request);
        // Cache successful responses for same-origin pages/assets
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        // Offline: serve from cache
        const cached = await cache.match(event.request);
        if (cached) return cached;

        // For navigation requests (loading the page), serve index.html
        if (event.request.mode === 'navigate') {
          const index = await cache.match('/') || await cache.match('/index.html');
          if (index) return index;
        }

        // Nothing available
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })
  );
});
