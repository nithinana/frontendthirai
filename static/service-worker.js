// Thirai Service Worker
// Caches offline.html and its UI dependencies so offline playback works with no network.

const CACHE_NAME = 'thirai-shell-v3';

// Files that MUST be available offline for the player to work.
// The video data itself lives in IndexedDB — no need to cache it here.
const SHELL_ASSETS = [
  '/offline.html',
  '/static/favicon.png',
  // Bootstrap Icons CSS + the woff2 font it references
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2',
];

// ── Install: pre-cache shell assets ─────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache each asset individually so one failure doesn't abort the whole install
      return Promise.allSettled(
        SHELL_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Failed to cache:', url, err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache-first for shell assets, network-first for everything else ──
self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // API calls and video proxy — always go to network, never cache
  if (url.includes('api.thirai.me') || url.includes('/proxy?')) return;

  // Socket.io & Cast SDK — try network, don't cache (not needed offline)
  if (url.includes('socket.io') || url.includes('gstatic.com')) return;

  // Shell assets (offline.html, BI CSS/font, icons) — cache-first
  const isShellAsset = SHELL_ASSETS.some(function(a) { return url === a || url.endsWith(a); })
    || url.includes('bootstrap-icons')
    || url.endsWith('/offline.html')
    || url.includes('/static/');

  if (isShellAsset) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // Not in cache yet — fetch and store
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() {
          // Offline and not cached — nothing we can do
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});
