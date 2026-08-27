// sw.js
const APP_URL = new URL('./', self.registration.scope).href;

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
