// Service Worker der Web-App (Scope /app/): App-Shell offline verfügbar machen und Web-Push anzeigen.
// Daten aus /api und Noten werden hier bewusst NIE gecacht - Noten liegen in der IndexedDB der App.
const CACHE = 'zupfer-shell-v1';
const SHELL = ['/app/', '/app/manifest.webmanifest', '/app/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/app/')) return;
  if (url.pathname.startsWith('/app/pdfjs/') && req.headers.get('range')) return;

  // Seitenaufrufe: online immer frisch (neue Version nach Deployment), offline die gecachte Shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/app/', copy));
          return res;
        })
        .catch(() => caches.match('/app/'))
    );
    return;
  }

  // Gebaute Dateien (Dateiname enthält einen Hash) und Icons/Fonts: Cache zuerst.
  event.respondWith(
    caches.match(req).then(
      hit =>
        hit ||
        fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Schwalmtalzupfer', {
      body: data.body || '',
      icon: '/app/icons/icon-192.png',
      badge: '/app/icons/icon-192.png',
      data: { url: data.url || '/app/termine' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/app/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin + '/app/') && 'focus' in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
