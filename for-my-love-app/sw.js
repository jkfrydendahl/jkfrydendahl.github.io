// sw.js
const APP_URL = new URL('./', self.registration.scope).href;

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const url = data.url || APP_URL;
  event.waitUntil(
    self.registration.showNotification(data.title || 'For My Love', {
      body: data.body || '💖 Dagens citat er klar!',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || APP_URL;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.startsWith(APP_URL));
      return open ? open.focus() : self.clients.openWindow(target);
    })
  );
});
