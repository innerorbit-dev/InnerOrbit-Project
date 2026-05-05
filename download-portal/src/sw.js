const CACHE_NAME = 'innerorbit-portal-v2';
const OFFLINE_URL = '/src/offline.html';
const ASSETS_TO_CACHE = [
    OFFLINE_URL,
    '/src/assets/favicons/error-favicon.svg',
    '/src/assets/logos/innerorbit-logo.png'
];

// Install Event: Cache offline assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching offline assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Network-first for everything, fallback to offline page for navigation
self.addEventListener('fetch', (event) => {
    // 1. Handle ping.txt - ALWAYS try network, never return cached 200 OK
    if (event.request.url.includes('ping.txt')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }).catch(() => {
                // Return 503 so the frontend knows we are definitely offline
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            })
        );
        return;
    }

    // 2. Navigation requests (HTML pages)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // If network fails, return the cached offline page
                return caches.match(OFFLINE_URL);
            })
        );
        return;
    }

    // 3. Static assets & others - Stale-while-revalidate or Network-first
    // For now, let's just do Network falling back to Cache (if we cached anything else)
    // But we only cached offline assets.
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
