// Minimal service worker for Web Push

// Take control ASAP
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Receive a push and show a notification
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    // non-JSON payloads fallback to defaults
  }

  const title = data.title || 'For My Love';
  const body  = data.body  || '💖 Dagens citat er klar!';
  const url   = data.url   || './';
  const tag   = data.tag   || 'for-my-love';    // groups notifications from this app

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      data: { url }
    })
  );
});

// Focus an existing tab or open one when the user taps the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an open tab if possible
      const match = clients.find((c) => c.url.includes('/for-my-love/'));
      if (match) return match.focus();
      return self.clients.openWindow(url);
    })
  );
});
