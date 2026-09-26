self.addEventListener('push', (event) => {
  let payload = {};
  try {
    const parsed = event.data?.json();
    payload = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  let target = '/';
  try {
    const href = new URL(
      typeof payload.href === 'string' ? payload.href : '/',
      self.location.origin,
    );
    if (href.origin === self.location.origin) target = href.href;
  } catch {
    // Fall back to the BOUGHT home page for malformed notification data.
  }
  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.slice(0, 100)
      : 'BOUGHT market update';

  event.waitUntil(
    self.registration.showNotification(title, {
      body:
        typeof payload.body === 'string'
          ? payload.body.slice(0, 500)
          : 'The BOUGHT market ladder just moved.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag:
        typeof payload.id === 'string'
          ? payload.id.slice(0, 100)
          : `bought:${Date.now()}`,
      data: { href: target },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.href || '/',
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => 'focus' in client);
        if (existing) {
          return existing.navigate(target.href).then(() => existing.focus());
        }
        return self.clients.openWindow(target.href);
      }),
  );
});
