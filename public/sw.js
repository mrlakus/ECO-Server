// Сервис-воркер: делает сайт устанавливаемым и загружающимся без сети (оболочка из кэша).
// Стратегия «сначала сеть, при ошибке — кэш», поэтому после обновления сервера пользователь всегда получает свежую версию.
const CACHE = 'tri-sestry-shell-v1';
const SHELL = ['/', '/style.css', '/app.js', '/manifest.webmanifest', '/art/icon.svg', '/art/icon-192.png', '/art/farm.svg', '/art/garden.svg', '/art/barn.svg', '/art/apiary.svg', '/art/orchard.svg', '/art/flowers.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname === '/healthz' || url.pathname === '/ws') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error()))),
  );
});
