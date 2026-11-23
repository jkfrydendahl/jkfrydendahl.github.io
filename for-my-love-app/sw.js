// sw.js
const APP_URL = new URL('./', self.registration.scope).href;
const CACHE_PREFIX = 'for-my-love-shell-';
const CACHE_NAME = `${CACHE_PREFIX}26.11.23.2`;
const SHELL = ['./', './app.js?v=26.11.23.2', './styles.css?v=26.11.23.2', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(SHELL.map((path) => new URL(path, APP_URL).href));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const app = new URL(APP_URL);
  if (event.request.method !== 'GET' || url.origin !== app.origin ||
      !url.href.startsWith(APP_URL)) return;
  // Never cache the cross-origin shared-display API. Only the app shell is
  // cached here; app.js keeps the last successful shared entry separately.
  const cacheKey = event.request.mode === 'navigate' ? APP_URL : event.request.url;
  if (cacheKey !== APP_URL && !SHELL.some((path) => new URL(path, APP_URL).href === cacheKey)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        // Extend the event so a quick navigation cannot interrupt the write.
        event.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      }
      return await cache.match(cacheKey) || response;
    } catch {
      return await cache.match(cacheKey) || Response.error();
    }
  })());
});

function getSafeTarget(value) {
  try {
    const target = new URL(value || APP_URL, APP_URL);
    const app = new URL(APP_URL);
    return target.origin === app.origin && target.href.startsWith(APP_URL)
      ? target.href
      : APP_URL;
  } catch {
    return APP_URL;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const url = getSafeTarget(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title || '💖 New Update 💖', {
      body: data.body || 'Your daily quote is ready!',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = getSafeTarget(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const open = list.find((client) => client.url.startsWith(APP_URL));
      if (!open) return self.clients.openWindow(target);

      if (open.url !== target) await open.navigate(target);
      return open.focus();
    })
  );
});

