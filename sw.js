const CACHE = 'subtrop-crm-v1';
const STATIC = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Only cache GET requests for same-origin or fonts
  if(e.request.method !== 'GET') return;
  if(e.request.url.includes('firebaseio.com')) return;
  if(e.request.url.includes('onrender.com')) return;
  
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        return response;
      }).catch(function() {
        if(e.request.url.includes('index.html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
