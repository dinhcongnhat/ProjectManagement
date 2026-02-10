// Custom Service Worker for PWA Real-time Support
// Version: 1.0.131

const CACHE_NAME = 'pwa-cache-1770706050844';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/Logo.png',
  '/Icon.jpg',
  '/icons/icon-192x192.png',
  '/icons/icon-72x72.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      // Take control of all clients immediately
      self.clients.claim(),
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
    ])
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // CRITICAL: Never cache WebSocket, Socket.io, API requests, or avatars
  // These need to go directly to network for real-time functionality
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/avatar') ||
    url.pathname.includes('/version.json') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    event.request.url.includes('socket.io') ||
    event.request.headers.get('upgrade') === 'websocket'
  ) {
    // Don't intercept - let it pass through to network
    return;
  }

  // For navigation requests, try network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the response for offline use
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Only cache successful responses
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '1.0.3' });
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = { 
    title: 'Thông báo mới', 
    body: 'Bạn có thông báo mới',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {}
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
    tag: data.tag || `notification-${Date.now()}`, // Unique tag to allow multiple notifications
    renotify: true, // Re-notify even with same tag
    requireInteraction: data.requireInteraction !== false, // Default to true for important notifications
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Mở' },
      { action: 'dismiss', title: 'Bỏ qua' }
    ],
    silent: false,
    // Ensure notification shows even when app is in foreground
    timestamp: Date.now()
  };
  
  console.log('[SW] Showing notification with options:', options);
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch(err => console.error('[SW] Error showing notification:', err))
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  console.log('[SW] Action:', event.action);
  console.log('[SW] Notification data:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  
  // Handle action buttons first
  if (event.action === 'dismiss') {
    console.log('[SW] Dismiss action clicked');
    return; // Just close notification, don't open app
  }
  
  // Build a fallback URL for when no client window is open
  // The app will handle role-based routing on load
  let fallbackUrl = '/';
  if (data.type === 'chat' && data.conversationId) {
    fallbackUrl = `/?openChat=${data.conversationId}`;
  } else if (data.type === 'mention' && data.conversationId) {
    fallbackUrl = `/?openChat=${data.conversationId}`;
  } else if (data.type === 'mention' && data.projectId) {
    fallbackUrl = `/?notificationType=mention&projectId=${data.projectId}`;
  } else if (data.type === 'discussion' && data.projectId) {
    fallbackUrl = `/?notificationType=discussion&projectId=${data.projectId}`;
  } else if (data.type === 'task' && data.projectId) {
    fallbackUrl = `/?notificationType=task&projectId=${data.projectId}`;
  } else if (data.type === 'task' && data.taskId) {
    fallbackUrl = `/?notificationType=task&taskId=${data.taskId}`;
  } else if (data.type === 'file' && data.projectId) {
    fallbackUrl = `/?notificationType=file&projectId=${data.projectId}`;
  } else if (data.type === 'result' && data.projectId) {
    fallbackUrl = `/?notificationType=result&projectId=${data.projectId}`;
  } else if (data.type === 'activity' && data.projectId) {
    fallbackUrl = `/?notificationType=project&projectId=${data.projectId}`;
  } else if (data.type === 'project' && data.projectId) {
    fallbackUrl = `/?notificationType=project&projectId=${data.projectId}`;
  }
  
  console.log('[SW] Fallback URL:', fallbackUrl);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
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
              targetUrl: fallbackUrl
            });
            console.log('[SW] Focusing existing client and sending NOTIFICATION_CLICK');
            return client.focus();
          }
        }
        
        // No window found, open new one with query params
        // The app will read these params on mount and navigate accordingly
        console.log('[SW] Opening new window:', fallbackUrl);
        if (clients.openWindow) {
          return clients.openWindow(fallbackUrl);
        }
      })
      .catch(err => console.error('[SW] Error handling notification click:', err))
  );
});

// Background sync support
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'send-messages') {
    event.waitUntil(
      // Handle queued messages when back online
      sendQueuedMessages()
    );
  }
});

async function sendQueuedMessages() {
  // This would be implemented to send any queued messages
  // when the user comes back online
  console.log('[SW] Sending queued messages...');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'check-messages') {
    event.waitUntil(checkForNewMessages());
  }
});

async function checkForNewMessages() {
  console.log('[SW] Checking for new messages...');
}

console.log('[SW] Service Worker loaded');
