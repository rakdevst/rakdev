self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: 'rakDEV Studio', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || '',
    data: { url: data.url || '' }
  };
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(data.title || 'rakDEV Studio', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url ? event.notification.data.url : '';
  const target = new URL(raw || './', self.registration.scope);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const current = new URL(client.url);
      if (current.origin === target.origin && current.pathname === target.pathname) {
        try {
          await client.focus();
          if (current.href !== target.href) await client.navigate(target.href);
          return;
        } catch (err) {
          break;
        }
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
