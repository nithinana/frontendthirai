// static/service-worker.js
const CACHE_NAME = 'thirai-cache-v1';
const urlsToCache = [
    '/', // Your root URL
    '/index.html', // This might need to be '/templates/index.html' if your Flask app serves it that way, or rely on Flask's routing for root. For PWA, the browser sees the rendered HTML as the root.
    '/static/manifest.json', // Now in static folder
    '/static/ios/icon-72x72.png',
    '/static/ios/icon-96x96.png',
    '/static/ios/icon-128x128.png',
    '/static/ios/icon-144x144.png',
    '/static/ios/icon-152x152.png',
    '/static/ios/icon-192x192.png',
    '/static/ios/icon-384x384.png',
    '/static/ios/icon-512x512.png',
    '/static/thiraiblack.png',
    '/static/thiraiwhite.png',
    '/static/favicon.png',
    '/static/splash/launch-750x1334.png',
    '/static/splash/launch-1242x2208.png',
    '/static/splash/launch-1125x2436.png',
    '/static/splash/launch-828x1792.png',
    '/static/splash/launch-1242x2688.png',
    '/static/splash/launch-1080x2340.png',
    '/static/splash/launch-1170x2532.png',
    '/static/splash/launch-1284x2778.png',
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
    // Ensure all other static assets (CSS, JS, images, etc. that your app uses)
    // are listed here with their correct /static/ paths
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // Ensure all cache paths are relative to the domain root
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
