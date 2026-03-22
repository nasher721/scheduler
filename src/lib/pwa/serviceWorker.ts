/**
 * Enhanced Service Worker for PWA
 * 
 * Features:
 * - Offline caching
 * - Background sync
 * - Push notifications
 * - Periodic sync for updates
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

/** Extendable sync events (Background Sync API). */
type SyncEventLike = ExtendableEvent & { readonly tag: string };

const CACHE_NAME = 'nicu-scheduler-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes to cache with network-first strategy
const API_ROUTES = ['/api/state', '/api/health'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API routes - Network first, fallback to cache
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - Cache first, fallback to network
  if (request.destination === 'image' || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests - Stale while revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirst(request));
});

// Background sync - queue requests when offline
self.addEventListener('sync', (event: Event) => {
  const e = event as SyncEventLike;
  if (e.tag === 'sync-schedule-changes') {
    e.waitUntil(syncScheduleChanges());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const baseOptions: NotificationOptions = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
  };
  const options = {
    ...baseOptions,
    ...(Array.isArray(data.actions) && data.actions.length > 0 ? { actions: data.actions } : {}),
  } as NotificationOptions;

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data;
  const action = event.action;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window or open new one
      if (clientList.length > 0) {
        const client = clientList[0];
        client.focus();
        
        // Send message to client
        client.postMessage({
          type: 'NOTIFICATION_CLICK',
          action,
          data: notificationData,
        });
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});

// Periodic background sync
self.addEventListener('periodicsync', (event: Event) => {
  const e = event as SyncEventLike;
  if (e.tag === 'check-schedule-updates') {
    e.waitUntil(checkScheduleUpdates());
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    
    case 'CACHE_SCHEDULE':
      event.waitUntil(cacheScheduleData(payload));
      break;
    
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache());
      break;
    
    case 'GET_OFFLINE_STATUS':
      event.ports[0].postMessage({ offline: !self.navigator.onLine });
      break;
  }
});

// Cache strategies

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Network error', { status: 408 });
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Network error', { status: 408 });
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      void caches.open(CACHE_NAME).then((c) => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  });
  if (cached) {
    void networkPromise.catch(() => {});
    return cached;
  }
  return networkPromise;
}

// Background sync functions

interface QueuedScheduleChange {
  id: string;
  url: string;
  method: string;
  headers: HeadersInit;
  body: unknown;
}

function idbRequest<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function idbTransactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(new Error('IndexedDB transaction aborted'));
  });
}

async function syncScheduleChanges(): Promise<void> {
  const db = await openDB('sync-queue', 1);
  const readTx = db.transaction('changes', 'readonly');
  const readStore = readTx.objectStore('changes');
  const changes = await idbRequest<QueuedScheduleChange[]>(readStore.getAll());
  await idbTransactionDone(readTx);

  for (const change of changes) {
    try {
      const response = await fetch(change.url, {
        method: change.method,
        headers: change.headers,
        body: JSON.stringify(change.body),
      });

      if (response.ok) {
        const delTx = db.transaction('changes', 'readwrite');
        const delStore = delTx.objectStore('changes');
        await idbRequest(delStore.delete(change.id));
        await idbTransactionDone(delTx);
      }
    } catch (error) {
      console.error('Sync failed for change:', change.id);
    }
  }
}

async function checkScheduleUpdates(): Promise<void> {
  try {
    const response = await fetch('/api/state');
    if (response.ok) {
      const data = await response.json();
      
      // Notify all clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'SCHEDULE_UPDATED',
          data,
        });
      });
    }
  } catch (error) {
    console.error('Failed to check schedule updates:', error);
  }
}

async function cacheScheduleData(data: unknown): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
  await cache.put('/api/state', response);
}

async function clearCache(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

// Simple IndexedDB helper
function openDB(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('changes')) {
        db.createObjectStore('changes', { keyPath: 'id' });
      }
    };
  });
}

export {};
