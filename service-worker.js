// 오프라인 지원을 위한 런타임 캐싱 (경로에 무관하게 동작하도록 절대 경로 프리캐시 대신 network-first 전략 사용)
const CACHE_NAME = 'ptw-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(event.request);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })
  );
});
