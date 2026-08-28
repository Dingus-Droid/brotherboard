/* Bumped so the activate handler clears out v3 -- both to pick up the new
   manifest and to sweep away any per-share entries it accumulated. */
const CACHE = 'rsvp4dingus-v4';

const ASSETS = [
  '/brotherboard/',
  '/brotherboard/index.html',
  '/brotherboard/manifest.json',
  '/brotherboard/icon-192.png',
  '/brotherboard/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  /* Shared text arrives as a one-off URL like /brotherboard/?text=...
     Caching those would stash a separate copy of the whole app for every
     selection anyone ever shares, growing without limit. Serve them
     without saving, and offline fall back to the plain app shell, since
     the exact shared URL will never be in the cache. */
  const url = new URL(e.request.url);
  const isSharedText = ['text', 'url', 'title'].some(k => url.searchParams.has(k));

  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        if (!isSharedText) {
          const copy = res.clone();

          caches.open(CACHE).then(cache => {
            cache.put(e.request, copy);
          });
        }

        return res;
      })
      .catch(() => caches.match(isSharedText ? '/brotherboard/' : e.request))
  );
});
