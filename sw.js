var CACHE_NAME = 'awake-v17.4';
var ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Allow the page to tell a waiting worker to take over immediately.
self.addEventListener('message', function(e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Treat page navigations / HTML as network-first so a freshly deployed
  // version always loads when the user is online. Falls back to cache offline.
  var accept = req.headers.get('accept') || '';
  var isHTML = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;

  if (isHTML) {
    e.respondWith(
      fetch(req).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put('./index.html', clone); });
        }
        return res;
      }).catch(function() {
        return caches.match('./index.html').then(function(m) {
          return m || caches.match('./');
        });
      })
    );
    return;
  }

  // Everything else: cache-first with a background refresh.
  e.respondWith(
    caches.match(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
