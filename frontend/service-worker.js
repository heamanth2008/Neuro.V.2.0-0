const CACHE_NAME = 'neuro-glass-shell-v4';
const ARTWORK_CACHE = 'neuro-artwork-v4';
const METADATA_CACHE = 'neuro-metadata-v4';
const MAX_ARTWORK_ITEMS = 200;
const MAX_METADATA_ITEMS = 500;

// Shell assets - cache first, versioned
const SHELL_ASSETS = [
  '/',
  '/glass_home.html',
  '/login.html',
  '/style.css',
  '/app.js',
  '/auth.js',
  '/api.js',
  '/lucide.js',
  '/manifest.webmanifest',
  '/fonts/fonts.css',
  '/fonts/SpaceGrotesk-Medium.ttf',
  '/fonts/SpaceGrotesk-SemiBold.ttf',
  '/fonts/SpaceGrotesk-Bold.ttf',
  '/fonts/Inter-Regular.ttf',
  '/fonts/Inter-Medium.ttf',
  '/fonts/Inter-SemiBold.ttf',
  '/fonts/Inter-Bold.ttf',
  '/icons/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

// Install - cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => !k.startsWith('neuro-')).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: LRU eviction
async function enforceCacheLimit(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

// Helper: is auth/mutating request
function isAuthOrMutating(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/auth/')) return true;
  if (url.pathname.startsWith('/api/') && request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/playlists') && request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/likes') && request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/history') && request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/settings') && request.method !== 'GET') return true;
  return false;
}

// Helper: is personal GET (user-specific data)
function isPersonalGet(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') && request.method === 'GET' && 
    (url.pathname.includes('/playlists') || url.pathname.includes('/likes') || 
     url.pathname.includes('/history') || url.pathname.includes('/settings') ||
     url.pathname === '/api/auth/me');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Never cache auth or mutating requests
  if (isAuthOrMutating(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Shell assets - cache first
  if (SHELL_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Artwork images - cache with LRU
  if (url.pathname.includes('/vi/') && (url.pathname.includes('hqdefault') || url.pathname.includes('maxres') || url.pathname.includes('sddefault') || url.pathname.includes('mqdefault'))) {
    event.respondWith(
      caches.open(ARTWORK_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Stale-while-revalidate
          fetch(request).then((resp) => {
            if (resp.ok) cache.put(request, resp.clone());
          }).catch(() => {});
          return cached;
        }
        const resp = await fetch(request);
        if (resp.ok) {
          cache.put(request, resp.clone());
          await enforceCacheLimit(ARTWORK_CACHE, MAX_ARTWORK_ITEMS);
        }
        return resp;
      })
    );
    return;
  }

  // Search API - stale-while-revalidate (non-personal GET)
  if (url.pathname === '/api/search') {
    event.respondWith(
      caches.open(METADATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((resp) => {
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Other non-personal GET APIs - stale-while-revalidate
  if (url.pathname.startsWith('/api/') && request.method === 'GET' && !isPersonalGet(request)) {
    event.respondWith(
      caches.open(METADATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((resp) => {
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Personal GETs - network only (no caching)
  if (isPersonalGet(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Default: network first, cache fallback for static assets
  event.respondWith(
    fetch(request).then((resp) => {
      if (resp.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'font')) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy));
      }
      return resp;
    }).catch(() => caches.match(request))
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearUserCaches') {
    // Clear user-specific caches on logout
    caches.keys().then((keys) => {
      keys.filter(k => k.startsWith('neuro-')).forEach(k => caches.delete(k));
    });
  }
});
