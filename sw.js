// Network-first app shell: whenever the phone is online, it always fetches
// the latest index.html/style.css/script.js from the server — no manual
// cache-version bump needed on every deploy. The cache is only a fallback
// for when the device is genuinely offline.
const CACHE = 'ensura-shell';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './data/stations.json',
  './manifest.json',
  './favicon.png',
  './favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls — they must always hit the network (live data).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'offline' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // App shell: network-first. Try the network for the freshest file;
  // only fall back to the cached copy if the network request fails
  // (i.e. the device is actually offline). Successful network responses
  // refresh the cache in the background for the next offline visit.
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
