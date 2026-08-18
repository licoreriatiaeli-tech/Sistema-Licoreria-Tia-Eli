const CACHE = 'tiaeli-v6';
const CACHE_IMAGES = 'tiaeli-img-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './ventas.js',
  './sync.js',
  './charts.js',
  './extras.js',
  './gestion.js',
  './lucide.min.js',
  './firebase-config.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== CACHE_IMAGES).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('firebase') || url.includes('googleapis.com')) {
    return;
  }

  const isImage = e.request.destination === 'image' ||
    url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/i);

  // Imágenes: caché primero (rápido, no cambian seguido)
  if (isImage) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_IMAGES).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // HTML/CSS/JS: network-first (siempre descargar lo nuevo si hay internet)
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});