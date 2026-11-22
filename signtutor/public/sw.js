/**
 * SignTutor Service Worker
 * Handles offline caching for models, CDN assets, and app shell
 */

const CACHE_NAME = 'signtutor-v1';
const MODEL_CACHE = 'signtutor-models-v1';
const CDN_CACHE = 'signtutor-cdn-v1';
const STATIC_CACHE = 'signtutor-static-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Models: Cache first, never expire (large files)
  models: {
    pattern: /\/models\/.*\.onnx$/,
    strategy: 'cache-first',
    cacheName: MODEL_CACHE,
  },
  // Model metadata: Stale while revalidate
  modelMeta: {
    pattern: /\/models\/.*\.json$/,
    strategy: 'stale-while-revalidate',
    cacheName: MODEL_CACHE,
  },
  // MediaPipe & ONNX CDN: Cache first, 30 days
  cdn: {
    pattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
    strategy: 'cache-first',
    cacheName: CDN_CACHE,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  // Next.js static assets: Cache first, 1 year
  static: {
    pattern: /\/_next\/static\/.*/,
    strategy: 'cache-first',
    cacheName: STATIC_CACHE,
    maxAge: 365 * 24 * 60 * 60 * 1000,
  },
  // Fonts: Stale while revalidate
  fonts: {
    pattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
    strategy: 'stale-while-revalidate',
    cacheName: 'signtutor-fonts-v1',
  },
};

// Install event - precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith('signtutor-'))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // Find matching strategy
  let matchedStrategy = null;
  let matchedCacheName = null;

  for (const strategy of Object.values(CACHE_STRATEGIES)) {
    if (strategy.pattern.test(request.url)) {
      matchedStrategy = strategy.strategy;
      matchedCacheName = strategy.cacheName;
      break;
    }
  }

  // Default: Network first for navigation, cache first for static
  if (!matchedStrategy) {
    if (request.mode === 'navigate') {
      matchedStrategy = 'network-first';
      matchedCacheName = CACHE_NAME;
    } else {
      matchedStrategy = 'cache-first';
      matchedCacheName = STATIC_CACHE;
    }
  }

  event.respondWith(handleRequest(request, matchedStrategy, matchedCacheName));
});

async function handleRequest(request, strategy, cacheName) {
  const cache = await caches.open(cacheName);

  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request, cache);
    case 'network-first':
      return networkFirst(request, cache);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, cache);
    default:
      return fetch(request);
  }
}

// Cache first - check cache, then network
async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network first - try network, fallback to cache
async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Stale while revalidate - serve cached, update in background
async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
    event.ports[0].postMessage({ cleared: true });
  }
});

// Background sync for data collection (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-collected-data') {
    event.waitUntil(syncCollectedData());
  }
});

async function syncCollectedData() {
  // This would sync IndexedDB data to server when online
  // Implementation depends on your data sync strategy
  console.log('Background sync triggered');
}