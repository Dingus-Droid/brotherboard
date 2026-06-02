const CACHE = 'rsvp4dingus-v2';
const ASSETS = [
  '/brotherboard/',
  '/brotherboard/index.html',
  '/brotherboard/manifest.json',
  '/brotherboard/icon-192.png',
  '/brotherboard/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.endsWith('index.html') || e.request.url.endsWith('/brotherboard/')) {
    // Network-first for HTML
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for everything else (icons, manifest)
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
