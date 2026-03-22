/**
 * Zustand Middleware for Shared Memory
 * Keeps Zustand store always in sync with shared memory
 */

import { StateCreator } from 'zustand';
import { sharedMemory, getSyncStatus, syncWithServer } from './sharedMemory';
import { eventBus } from './eventBus';
import { MemoryChangeEvent, SyncStatus } from './types';

interface SharedMemoryOptions<T> {
  /**
   * Memory key prefix for this store
   */
  namespace: string;

  /**
   * Keys to sync with shared memory (all if not specified)
   */
  syncKeys?: (keyof T)[];

  /**
   * Keys to exclude from sync
   */
  excludeKeys?: (keyof T)[];

  /**
   * Enable optimistic updates
   */
  optimistic?: boolean;

  /**
   * Auto-sync interval in ms (0 to disable)
   */
  syncInterval?: number;

  /**
   * Custom serializers for specific keys
   */
  serializers?: {
    [K in keyof T]?: {
      serialize: (value: T[K]) => any;
      deserialize: (value: any) => T[K];
    };
  };

  /**
   * Called when sync status changes
   */
  onSyncStatusChange?: (status: SyncStatus) => void;

  /**
   * Called on conflict
   */
  onConflict?: (key: string, local: any, server: any) => 'local' | 'server' | 'merge';
}

declare module 'zustand' {
  interface StoreApi<T> {
    syncWithMemory: () => Promise<void>;
    getSyncStatus: () => SyncStatus;
    pauseSync: () => void;
    resumeSync: () => void;
  }
}

/**
 * Zustand middleware that syncs store with shared memory
 */
export const sharedMemoryMiddleware = <T extends Record<string, any>>(
  initializer: StateCreator<T, [], []>,
  options: SharedMemoryOptions<T>
): StateCreator<T, [], []> => {
  return (set, get, api) => {
    // Track if we're currently syncing to prevent loops
    let isSyncing = false;
    let syncIntervalId: NodeJS.Timeout | null = null;
    let isPaused = false;

    const shouldSyncKey = (key: keyof T): boolean => {
      if (options.excludeKeys?.includes(key)) return false;
      if (options.syncKeys && !options.syncKeys.includes(key)) return false;
      return true;
    };

    const getMemoryKey = (key: keyof T): string => {
      return `${options.namespace}:${String(key)}`;
    };

    const serialize = (key: keyof T, value: any): any => {
      const serializer = options.serializers?.[key];
      return serializer ? serializer.serialize(value) : value;
    };

    const deserialize = (key: keyof T, value: any): any => {
      const serializer = options.serializers?.[key];
      return serializer ? serializer.deserialize(value) : value;
    };

    // Enhanced set function that syncs to shared memory
    const enhancedSet: typeof set = (partial, replace) => {
      if (isSyncing) {
        if (replace === true) {
          set(partial as T, true);
        } else {
          set(partial);
        }
        return;
      }

      const prevState = get();
      if (replace === true) {
        set(partial as T, true);
      } else {
        set(partial);
      }
      const nextState = get();

      // Sync changed keys to shared memory
      const changedKeys = Object.keys(nextState).filter((key) => {
        return prevState[key as keyof T] !== nextState[key as keyof T];
      }) as (keyof T)[];

      for (const key of changedKeys) {
        if (shouldSyncKey(key)) {
          const memoryKey = getMemoryKey(key);
          const serialized = serialize(key, nextState[key]);
          sharedMemory.set(memoryKey, serialized, { source: 'zustand' });
        }
      }
    };

    // Initialize store from shared memory
    const initializeFromMemory = () => {
      const state = get();
      const updates: Partial<T> = {};

      for (const key of Object.keys(state) as (keyof T)[]) {
        if (!shouldSyncKey(key)) continue;

        const memoryKey = getMemoryKey(key);
        const memoryValue = sharedMemory.get(memoryKey);

        if (memoryValue !== undefined) {
          (updates as any)[key] = deserialize(key, memoryValue);
        }
      }

      if (Object.keys(updates).length > 0) {
        isSyncing = true;
        set(updates as any);
        isSyncing = false;
      }
    };

    // Listen for shared memory changes
    const unsubscribe = eventBus.onAnyChange((event: MemoryChangeEvent) => {
      if (isPaused) return;

      const prefix = `${options.namespace}:`;
      if (!event.key.startsWith(prefix)) return;

      const key = event.key.slice(prefix.length) as keyof T;
      if (!shouldSyncKey(key)) return;

      // Skip if change came from zustand to avoid loops
      if (event.source === 'zustand') return;

      isSyncing = true;
      const deserialized = deserialize(key, event.newValue);
      set({ [key]: deserialized } as any);
      isSyncing = false;
    });

    // Listen for sync events
    const unsubscribeSync = eventBus.on('memory:sync:complete', () => {
      initializeFromMemory();
      options.onSyncStatusChange?.(getSyncStatus());
    });

    const unsubscribeError = eventBus.on('memory:sync:error', () => {
      options.onSyncStatusChange?.(getSyncStatus());
    });

    // Create the store
    const store = initializer(enhancedSet, get, api);

    // Initialize from memory
    initializeFromMemory();

    // Start sync interval if specified
    if (options.syncInterval && options.syncInterval > 0) {
      syncIntervalId = setInterval(() => {
        if (!isPaused) {
          syncWithServer();
        }
      }, options.syncInterval);
    }

    // Add API methods
    (api as any).syncWithMemory = async () => {
      await syncWithServer();
    };

    (api as any).getSyncStatus = getSyncStatus;

    (api as any).pauseSync = () => {
      isPaused = true;
    };

    (api as any).resumeSync = () => {
      isPaused = false;
    };

    // Cleanup on store destroy
    const originalDestroy = (api as any).destroy;
    (api as any).destroy = () => {
      unsubscribe();
      unsubscribeSync();
      unsubscribeError();
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
      }
      if (originalDestroy) {
        originalDestroy();
      }
    };

    return store;
  };
};

/**
 * Helper to create a store with shared memory sync
 */
export function createSharedMemoryStore<T extends Record<string, any>>(
  initializer: StateCreator<T, [], []>,
  options: SharedMemoryOptions<T>
) {
  return sharedMemoryMiddleware(initializer, options);
}

export default sharedMemoryMiddleware;
