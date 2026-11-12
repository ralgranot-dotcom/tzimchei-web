/* Offline support: the app and its data are kept on the phone after the first visit. */
const V = 'tz-__VERSION__';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png',
  'data/plants.json', 'data/plants-0.json', 'data/plants-1.json', 'data/plants-2.json', 'data/toxic.json', 'data/garden.json', 'data/grow.json', 'data/guide.json', 'data/edible.json', 'data/medicinal.json', 'data/rambam.json', 'data/nursery.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tz-') && k !== V && k !== 'tz-img').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (req.destination === 'image' || /inaturalist|wikimedia|gbif/.test(url.host)) {
    e.respondWith(caches.open('tz-img').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; } catch (err) { return hit || Response.error(); }
    }));
  }
});
