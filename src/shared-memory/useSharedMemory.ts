/**
 * React Hooks for Shared Memory
 * Provides reactive access to shared memory values
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { sharedMemory, subscribe, watch, getSyncStatus, syncWithServer } from './sharedMemory';
import { eventBus } from './eventBus';
import { MemoryChangeEvent, SyncStatus, MEMORY_KEYS } from './types';

/**
 * Hook to read and write a value from shared memory
 */
export function useSharedMemory<T>(key: string): [T | undefined, (value: T) => void, boolean] {
  const [isLoading, setIsLoading] = useState(true);

  // Use syncExternalStore for React 18+ concurrent features support
  const value = useSyncExternalStore(
    (callback) => subscribe<T>(key, callback),
    () => sharedMemory.get<T>(key),
    () => undefined // Server snapshot
  );

  const setValue = useCallback(
    (newValue: T) => {
      sharedMemory.set(key, newValue, { source: 'react-hook' });
    },
    [key]
  );

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return [value, setValue, isLoading];
}

/**
 * Hook to watch multiple keys
 */
export function useSharedMemoryWatch<T extends Record<string, any>>(
  keys: string[]
): Partial<T> {
  // Sort keys to ensure stable dependency array regardless of order
  const sortedKeys = useRef(keys.sort());
  
  // Update ref if keys actually change (ignoring order)
  useEffect(() => {
    const newSorted = [...keys].sort();
    if (JSON.stringify(newSorted) !== JSON.stringify(sortedKeys.current)) {
      sortedKeys.current = newSorted;
    }
  }, [keys]);

  const [values, setValues] = useState<Partial<T>>(() => {
    const initial: Partial<T> = {};
    for (const key of sortedKeys.current) {
      (initial as any)[key] = sharedMemory.get(key);
    }
    return initial;
  });

  useEffect(() => {
    return watch<T>(sortedKeys.current, setValues);
  }, [sortedKeys.current.join(',')]);

  return values;
}

/**
 * Hook to get sync status
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);

  useEffect(() => {
    const unsubscribeStart = eventBus.on('memory:sync:start', () => {
      setStatus((prev) => ({ ...prev, status: 'syncing' }));
    });

    const unsubscribeComplete = eventBus.on('memory:sync:complete', () => {
      setStatus(getSyncStatus());
    });

    const unsubscribeError = eventBus.on('memory:sync:error', () => {
      setStatus(getSyncStatus());
    });

    return () => {
      unsubscribeStart();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  return status;
}

/**
 * Hook to trigger manual sync
 */
export function useSync(): {
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastSync: number | null;
  error: Error | null;
} {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      await syncWithServer();
      setLastSync(Date.now());
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { sync, isSyncing, lastSync, error };
}

/**
 * Hook to listen for specific memory events
 */
export function useMemoryEvent(
  eventType: string,
  handler: (event: any) => void
): void {
  useEffect(() => {
    return eventBus.on(eventType, handler);
  }, [eventType, handler]);
}

/**
 * Hook to get change history
 */
export function useMemoryHistory(limit?: number): MemoryChangeEvent[] {
  const [history, setHistory] = useState<MemoryChangeEvent[]>(() =>
    sharedMemory.getHistory(limit)
  );

  useEffect(() => {
    return eventBus.on('memory:change', () => {
      setHistory(sharedMemory.getHistory(limit));
    });
  }, [limit]);

  return history;
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  key: string,
  options: { 
    syncDuration?: number;
    onError?: (error: Error) => void;
    onSuccess?: () => void;
  } = {}
): {
  value: T | undefined;
  update: (updater: (current: T | undefined) => T) => Promise<void>;
  isPending: boolean;
  error: Error | null;
  rollback: () => void;
  resetError: () => void;
} {
  const { syncDuration = 500, onError, onSuccess } = options;
  const [value, _setValue] = useSharedMemory<T>(key);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const rollbackValue = useRef<T | undefined>(undefined);
  const abortController = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const update = useCallback(
    async (updater: (current: T | undefined) => T) => {
      // Cancel any pending operation
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();
      
      setIsPending(true);
      setError(null);

      // Save for potential rollback
      rollbackValue.current = value;

      // Optimistically update
      const newValue = updater(value);
      sharedMemory.set(key, newValue, { source: 'optimistic' });

      try {
        // Simulate server sync (replace with actual API call)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, syncDuration);
          
          abortController.current?.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Operation aborted'));
          });
        });
        
        setIsPending(false);
        onSuccess?.();
      } catch (err) {
        if ((err as Error).message !== 'Operation aborted') {
          setError(err as Error);
          onError?.(err as Error);
          setIsPending(false);
          // Revert on error
          if (rollbackValue.current !== undefined) {
            sharedMemory.set(key, rollbackValue.current, { source: 'rollback' });
          }
        }
      }
    },
    [key, value, syncDuration, onSuccess, onError]
  );

  const rollback = useCallback(() => {
    if (rollbackValue.current !== undefined) {
      sharedMemory.set(key, rollbackValue.current, { source: 'rollback' });
    }
  }, [key]);

  return { value, update, isPending, error, rollback, resetError };
}

/**
 * Hook for real-time collaboration cursor/selection
 */
export function useCollaborativeCursor(userId: string): {
  cursors: Record<string, { x: number; y: number; timestamp: number }>;
  updateCursor: (x: number, y: number) => void;
} {
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; timestamp: number }>>({});
  const staleTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cursorKey = `cursor:${userId}`;

  useEffect(() => {
    // Subscribe to all cursor updates
    const unsubscribe = eventBus.on('memory:change', (event: MemoryChangeEvent) => {
      if (event.key.startsWith('cursor:') && event.key !== cursorKey) {
        const otherUserId = event.key.replace('cursor:', '');
        setCursors((prev) => ({
          ...prev,
          [otherUserId]: event.newValue,
        }));
      }
    });

    // Cleanup stale cursors periodically
    staleTimeoutRef.current = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const updated = { ...prev };
        let hasChanges = false;
        for (const [id, cursor] of Object.entries(updated)) {
          if (now - cursor.timestamp > 10000) { // 10 second stale threshold
            delete updated[id];
            hasChanges = true;
          }
        }
        return hasChanges ? updated : prev;
      });
    }, 5000);

    return () => {
      unsubscribe();
      if (staleTimeoutRef.current) {
        clearInterval(staleTimeoutRef.current);
      }
    };
  }, [userId, cursorKey]);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      sharedMemory.set(cursorKey, { x, y, timestamp: Date.now() }, {
        ttl: 5000, // 5 second TTL for cursors
        source: 'cursor',
      });
    },
    [cursorKey]
  );

  // Cleanup cursor on unmount
  useEffect(() => {
    return () => {
      sharedMemory.remove(cursorKey);
    };
  }, [cursorKey]);

  return { cursors, updateCursor };
}

/**
 * Hook for presence/online status
 */
export function usePresence(userId: string, userInfo: Record<string, any>): {
  onlineUsers: Array<{ id: string; info: any; lastSeen: number }>;
  isOnline: boolean;
} {
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; info: any; lastSeen: number }>>([]);

  const presenceKey = `presence:${userId}`;

  useEffect(() => {
    // Update presence every 10 seconds
    const updatePresence = () => {
      sharedMemory.set(presenceKey, { ...userInfo, lastSeen: Date.now() }, {
        ttl: 30000, // 30 second TTL
        source: 'presence',
      });
    };

    updatePresence();
    const interval = setInterval(updatePresence, 10000);

    // Listen for other users
    const unsubscribe = eventBus.on('memory:change', (event: MemoryChangeEvent) => {
      if (event.key.startsWith('presence:') && event.key !== presenceKey) {
        const otherUserId = event.key.replace('presence:', '');
        if (event.newValue) {
          setOnlineUsers((prev) => {
            const filtered = prev.filter((u) => u.id !== otherUserId);
            return [...filtered, { id: otherUserId, ...event.newValue }];
          });
        } else {
          setOnlineUsers((prev) => prev.filter((u) => u.id !== otherUserId));
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
      sharedMemory.remove(presenceKey);
    };
  }, [userId, presenceKey, userInfo]);

  return { onlineUsers, isOnline: true };
}

/**
 * Hook for activity feed
 */
export function useActivityFeed(limit: number = 50): {
  activities: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: number;
    user?: string;
  }>;
  addActivity: (type: string, message: string, user?: string) => void;
} {
  const [activities, setActivities] = useState<Array<{
    id: string;
    type: string;
    message: string;
    timestamp: number;
    user?: string;
  }>>(() => sharedMemory.get('activities') || []);

  const addActivity = useCallback((type: string, message: string, user?: string) => {
    const newActivity = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      user,
    };

    sharedMemory.update('activities', (current: any[] = []) => {
      const updated = [newActivity, ...current].slice(0, limit);
      return updated;
    });
  }, [limit]);

  useEffect(() => {
    return subscribe('activities', setActivities);
  }, []);

  return { activities, addActivity };
}

// Export typed hooks for specific memory keys
export function useScheduleState() {
  return useSharedMemory(MEMORY_KEYS.SCHEDULE_STATE);
}

export function useProviders() {
  return useSharedMemory(MEMORY_KEYS.PROVIDERS);
}

export function useSlots() {
  return useSharedMemory(MEMORY_KEYS.SLOTS);
}

export function useScenarios() {
  return useSharedMemory(MEMORY_KEYS.SCENARIOS);
}

export function useShiftRequests() {
  return useSharedMemory(MEMORY_KEYS.SHIFT_REQUESTS);
}

export default useSharedMemory;
