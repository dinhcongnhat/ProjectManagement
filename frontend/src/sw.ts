/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Self-skip waiting
self.skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precache files - injected by Vite PWA
precacheAndRoute(self.__WB_MANIFEST);

// Network only for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api'),
  new NetworkOnly()
);

// Network only for avatar endpoints (never cache user avatars)
registerRoute(
  ({ url }) => url.pathname.includes('/avatar'),
  new NetworkOnly()
);

// Network only for Socket.io
registerRoute(
  ({ url }) => url.pathname.startsWith('/socket.io'),
  new NetworkOnly()
);

// Never cache manifest.json - always fetch fresh so icon updates are picked up
registerRoute(
  ({ url }) => url.pathname === '/manifest.json',
  new NetworkOnly()
);

// Use StaleWhileRevalidate for PWA icons so they update in the background
// Icons are served immediately from cache, but also fetched from network to update cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/icons/'),
  new StaleWhileRevalidate({
    cacheName: 'pwa-icons-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }) // 30 days
    ]
  })
);

// Cache Google Fonts stylesheets
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
);

// Cache Google Fonts webfont files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
);

// ==================== PUSH NOTIFICATION HANDLERS ====================

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Thông báo mới',
    body: 'Bạn có thông báo mới',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {} as Record<string, unknown>
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      console.log('[SW] Push data parsed:', pushData);
      data = { ...data, ...pushData };
    } catch (e) {
      console.log('[SW] Push data parse error, using text:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    tag: (data as { tag?: string }).tag || `notification-${Date.now()}`,
    renotify: true,
    requireInteraction: (data as { requireInteraction?: boolean }).requireInteraction !== false,
    data: data.data || {},
    actions: (data as { actions?: Array<{ action: string; title: string }> }).actions || [
      { action: 'open', title: 'Mở' },
      { action: 'dismiss', title: 'Bỏ qua' }
    ],
    silent: false,
    timestamp: Date.now()
  } as NotificationOptions & { vibrate?: number[]; renotify?: boolean; actions?: Array<{ action: string; title: string }> };

  console.log('[SW] Showing notification with options:', options);

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err: Error) => console.error('[SW] Error showing notification:', err))
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  console.log('[SW] Action:', event.action);
  console.log('[SW] Notification data:', event.notification.data);

  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Handle dismiss action
  if (event.action === 'dismiss') {
    console.log('[SW] Dismiss action clicked');
    return;
  }

  // Determine target URL based on notification type
  if (data.url) {
    targetUrl = data.url;
  } else if (data.type === 'chat' && data.conversationId) {
    targetUrl = `/?openChat=${data.conversationId}`;
  } else if (data.type === 'project' && data.projectId) {
    targetUrl = `/projects/${data.projectId}`;
  } else if (data.type === 'discussion' && data.projectId) {
    targetUrl = `/projects/${data.projectId}`;
  } else if (data.type === 'task') {
    targetUrl = '/my-tasks';
  }

  console.log('[SW] Target URL:', targetUrl);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        console.log('[SW] Found', clientList.length, 'client(s)');

        // Try to find an existing window and focus it
        for (const client of clientList) {
          console.log('[SW] Checking client:', client.url);

          if ('focus' in client) {
            // Send message to the client to navigate/handle the notification
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data,
              targetUrl: targetUrl
            });
            console.log('[SW] Focusing existing client');
            return (client as WindowClient).focus();
          }
        }

        // No window found, open new one
        console.log('[SW] Opening new window:', targetUrl);
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
      .catch((err: Error) => console.error('[SW] Error handling notification click:', err))
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: '1.0.3' });
  }

  // Handle icon cache clear request (for PWA icon updates)
  if (event.data && event.data.type === 'CLEAR_ICON_CACHE') {
    caches.open('pwa-icons-cache').then(cache => {
      cache.keys().then(keys => {
        keys.forEach(key => cache.delete(key));
        console.log('[SW] Icon cache cleared for PWA icon update');
      });
    });
  }
});

console.log('[SW] Service Worker loaded v1.0.3');
