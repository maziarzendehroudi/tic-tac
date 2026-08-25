const CACHE_NAME = 'tic-tac-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // S'active immédiatement
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key); // Détruit les anciens caches
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network First absolu
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});