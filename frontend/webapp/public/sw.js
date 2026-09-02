// Cache versioning - {{BUILD_VERSION}} is replaced at build time by
// scripts/stamp-sw-version.js, so every deploy gets a UNIQUE cache name and the
// activate handler evicts the previous deploy's cache. If the placeholder is
// somehow not replaced, fall back to a per-parse timestamp (still fresh, just
// less cache-efficient) — never reuse a constant name across deploys.
const BUILD_VERSION = '{{BUILD_VERSION}}';
const CACHE_VERSION = BUILD_VERSION.indexOf('{{') === -1 ? BUILD_VERSION : String(Date.now());
const CACHE_NAME = `bom-online-v${CACHE_VERSION}`;
const urlsToCache = [
  '/font/scripture.woff2',
  '/manifest.json'
  // NEVER precache HTML ('/' etc.): a navigation fetch can return the SSR shell
  // (the front door serves SSR to non-browser/crawler-classified installs), which
  // would then be served as the app forever. Navigations are network-first below.
  // Also don't pre-cache hashed JS/CSS — let them be cached on-demand.
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing with cache:', CACHE_NAME);
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip service worker for audio files - let browser handle them directly
  if (event.request.url.includes('media.bookofmormon.online/audio')) {
    // Don't intercept audio requests - let them go directly to the network
    return;
  }

  // Top-level navigations (HTML documents) are NETWORK-FIRST: always fetch the
  // live app HTML from the front door, falling back to a cached copy only when
  // the network fails (offline). Never serve a stale (possibly SSR) shell while
  // online, and never write HTML into the cache. This is what prevents a browser
  // that once received SSR from being stuck on it. See docs/bugs/2026-09-02-*.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Handle images from media.bookofmormon.online with longer cache
  if (event.request.url.includes('media.bookofmormon.online')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((fetchResponse) => {
            // Cache the image for future use
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return fetchResponse;
          });
        })
    );
  } else if (event.request.url.includes('/static/')) {
    // Handle static assets (JS, CSS) with cache busting
    event.respondWith(
      fetch(event.request).then((fetchResponse) => {
        // Always fetch fresh static assets and update cache
        const responseClone = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return fetchResponse;
      }).catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
    );
  } else {
    // Standard caching for other requests
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached version or fetch from network
          return response || fetch(event.request);
        }
      )
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating with cache:', CACHE_NAME);
  // Take control of all clients immediately
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// =============================================================================
// BACKGROUND SYNC - Sync data when connection is restored
// =============================================================================
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-notes') {
    event.waitUntil(syncNotes());
  } else if (event.tag === 'background-sync-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

async function syncNotes() {
  try {
    // TODO: Implement note synchronization
    // - Get queued notes from IndexedDB
    // - Send to server
    // - Remove from queue on success
    console.log('Syncing notes in background...');
  } catch (error) {
    console.error('Background sync failed:', error);
    throw error; // Re-throw to retry later
  }
}

async function syncReadingProgress() {
  try {
    // TODO: Implement reading progress synchronization
    // - Get reading progress from IndexedDB
    // - Send to server
    // - Update local storage
    console.log('Syncing reading progress in background...');
  } catch (error) {
    console.error('Reading progress sync failed:', error);
    throw error;
  }
}

// =============================================================================
// PERIODIC SYNC - Regular background updates
// =============================================================================
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  if (event.tag === 'content-update') {
    event.waitUntil(checkForContentUpdates());
  } else if (event.tag === 'daily-verse') {
    event.waitUntil(updateDailyVerse());
  }
});

async function checkForContentUpdates() {
  try {
    // TODO: Check for new scripture content, translations, etc.
    // - Fetch latest content version from server
    // - Compare with local version
    // - Download and cache new content if available
    console.log('Checking for content updates...');
  } catch (error) {
    console.error('Content update check failed:', error);
  }
}

async function updateDailyVerse() {
  try {
    // TODO: Update daily scripture verse/thought
    // - Fetch today's featured verse
    // - Cache for offline access
    // - Update notification badge if needed
    console.log('Updating daily verse...');
  } catch (error) {
    console.error('Daily verse update failed:', error);
  }
}

// =============================================================================
// PUSH NOTIFICATIONS - Handle incoming notifications
// =============================================================================
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const options = {
    body: 'New content available in Book of Mormon Online',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: 'bom-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/shortcut-read.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/icon-32.png'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      
      // Update badge based on notification type
      updateBadgeOnPush(data);
      
      // TODO: Handle different notification types
      switch (data.type) {
        case 'daily-verse':
          options.title = 'Daily Scripture';
          options.body = data.verse || 'Check out today\'s featured verse';
          options.tag = 'daily-verse';
          break;
          
        case 'study-reminder':
          options.title = 'Study Reminder';
          options.body = data.message || 'Time for your daily scripture study';
          options.tag = 'study-reminder';
          break;
          
        case 'new-content':
          options.title = 'New Content Available';
          options.body = data.message || 'New features and content have been added';
          options.tag = 'content-update';
          break;
          
        default:
          options.title = data.title || 'Book of Mormon Online';
          options.body = data.body || options.body;
      }
    } catch (error) {
      console.error('Error parsing push data:', error);
      options.title = 'Book of Mormon Online';
    }
  } else {
    options.title = 'Book of Mormon Online';
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  // Clear badge when notification is clicked
  clearBadgeOnClick(event.notification.tag);
  
  const action = event.action;
  
  if (action === 'dismiss') {
    return; // Just close the notification
  }
  
  // TODO: Handle different notification actions
  let urlToOpen = '/';
  
  if (event.notification.tag === 'daily-verse') {
    urlToOpen = '/read';
  } else if (event.notification.tag === 'study-reminder') {
    urlToOpen = '/study';
  } else if (action === 'open') {
    urlToOpen = '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        
        // Open new window if no existing window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
  // TODO: Track notification analytics
});

// =============================================================================
// APP BADGES - Show counts/status on app icon
// =============================================================================

// Set badge count (for unread notifications, new content, etc.)
async function setBadge(count = 0) {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await navigator.setAppBadge(count);
        console.log(`Badge set to: ${count}`);
      } else {
        await navigator.clearAppBadge();
        console.log('Badge cleared');
      }
    } else {
      console.log('App Badge API not supported');
    }
  } catch (error) {
    console.error('Failed to set app badge:', error);
  }
}

// Clear badge
async function clearBadge() {
  await setBadge(0);
}

// Update badge based on different content types
async function updateBadgeForContent(type, count) {
  switch (type) {
    case 'unread-notes':
      // TODO: Show count of unsynced notes
      await setBadge(count);
      break;
      
    case 'new-content':
      // TODO: Show when new scripture content is available
      await setBadge(count || 1);
      break;
      
    case 'daily-verse':
      // TODO: Show when daily verse is unread
      await setBadge(1);
      break;
      
    case 'study-streak':
      // TODO: Show study streak count
      await setBadge(count);
      break;
      
    case 'clear':
      await clearBadge();
      break;
      
    default:
      console.log('Unknown badge type:', type);
  }
}

// Listen for badge update messages from main app
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);
  
  if (event.data && event.data.type === 'UPDATE_BADGE') {
    const { badgeType, count } = event.data;
    updateBadgeForContent(badgeType, count);
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches and force reload
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('Force clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        // Notify all clients to reload
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'CACHE_CLEARED', reload: true });
          });
        });
      })
    );
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    // Force service worker to activate
    self.skipWaiting();
  }
});

// Update badges when push notifications arrive
function updateBadgeOnPush(notificationData) {
  if (notificationData.type === 'daily-verse') {
    updateBadgeForContent('daily-verse');
  } else if (notificationData.type === 'new-content') {
    updateBadgeForContent('new-content', notificationData.count);
  }
}

// Clear badge when notification is clicked
function clearBadgeOnClick(notificationTag) {
  if (notificationTag === 'daily-verse') {
    clearBadge();
  }
}
