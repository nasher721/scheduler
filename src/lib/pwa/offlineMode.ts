/**
 * Offline Mode Support
 * 
 * Handles offline detection, queueing requests, and sync
 */

import { useState, useEffect, useCallback } from 'react';

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
}

/** Resolves when an IDBRequest succeeds; rejects on error. */
function idbRequest<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/** Resolves when the transaction has finished committing. */
function idbTransactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(new Error('IndexedDB transaction aborted'));
  });
}

type ServiceWorkerRegistrationWithSync = ServiceWorkerRegistration & {
  sync?: { register(tag: string): Promise<void> };
};

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Queue a request for later sync
 */
export async function queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
  const db = await openSyncDB();
  
  const queuedRequest: QueuedRequest = {
    ...request,
    id: generateId(),
    timestamp: Date.now(),
    retryCount: 0,
  };

  const tx = db.transaction('requests', 'readwrite');
  const store = tx.objectStore('requests');
  await idbRequest(store.add(queuedRequest));
  await idbTransactionDone(tx);
}

/**
 * Get all queued requests
 */
export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  const db = await openSyncDB();
  const tx = db.transaction('requests', 'readonly');
  const store = tx.objectStore('requests');
  const rows = await idbRequest<QueuedRequest[]>(store.getAll());
  await idbTransactionDone(tx);
  return rows;
}

/**
 * Remove a request from queue
 */
export async function removeQueuedRequest(id: string): Promise<void> {
  const db = await openSyncDB();
  const tx = db.transaction('requests', 'readwrite');
  const store = tx.objectStore('requests');
  await idbRequest(store.delete(id));
  await idbTransactionDone(tx);
}

/**
 * Process all queued requests
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  const requests = await getQueuedRequests();
  let success = 0;
  let failed = 0;

  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body),
      });

      if (response.ok) {
        await removeQueuedRequest(request.id);
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Register for background sync
 */
export async function registerBackgroundSync(tag: string = 'sync-queue'): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistrationWithSync;
  if (registration.sync) {
    await registration.sync.register(tag);
  }
}

/**
 * Open IndexedDB for sync queue
 */
function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('offline-sync', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('requests')) {
        const store = db.createObjectStore('requests', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for offline mode
 */
export function useOfflineMode() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSync: null,
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      syncWhenOnline();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial pending count
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = useCallback(async () => {
    const requests = await getQueuedRequests();
    setStatus((prev) => ({ ...prev, pendingCount: requests.length }));
  }, []);

  const syncWhenOnline = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await processQueue();
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        pendingCount: result.failed,
        lastSync: new Date(),
      }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  }, []);

  const queueOfflineRequest = useCallback(async (
    url: string,
    method: string,
    body: unknown,
    headers: Record<string, string> = {}
  ) => {
    await queueRequest({ url, method, body, headers });
    await updatePendingCount();
    await registerBackgroundSync();
  }, [updatePendingCount]);

  const forceSync = useCallback(async () => {
    if (navigator.onLine) {
      await syncWhenOnline();
    }
  }, [syncWhenOnline]);

  return {
    ...status,
    queueRequest: queueOfflineRequest,
    forceSync,
    refreshPendingCount: updatePendingCount,
  };
}

/**
 * Hook for offline-aware fetch
 */
export function useOfflineFetch() {
  const { isOnline, queueRequest } = useOfflineMode();

  const fetchWithOffline = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (isOnline) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        // If fetch fails, queue it
        await queueRequest(
          url,
          options.method || 'GET',
          options.body,
          options.headers as Record<string, string>
        );
        throw error;
      }
    } else {
      // Queue for later
      await queueRequest(
        url,
        options.method || 'GET',
        options.body,
        options.headers as Record<string, string>
      );
      
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }, [isOnline, queueRequest]);

  return { fetch: fetchWithOffline };
}

export default useOfflineMode;
