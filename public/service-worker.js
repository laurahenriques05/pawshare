self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: event.data?.text() || '' } }
  const title = payload.title || 'PawShare'
  const options = {
    body: payload.body || 'There is a family care update.',
    tag: payload.id || 'pawshare-notification',
    renotify: false,
    data: { route: payload.route || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const requestedRoute = event.notification.data?.route
  let target = new URL('/', self.location.origin).href
  if (typeof requestedRoute === 'string' && requestedRoute.startsWith('/') && !requestedRoute.startsWith('//')) {
    const candidate = new URL(requestedRoute, self.location.origin)
    if (candidate.origin === self.location.origin) target = candidate.href
  }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin) continue
      if ('navigate' in client) await client.navigate(target)
      return client.focus()
    }
    return self.clients.openWindow(target)
  }))
})
