/**
 * Shared Memory
 * Always-updated in-memory state with persistence and sync capabilities
 */

import { eventBus, emitMemoryChange, emitSyncError } from './eventBus';
import {
  MemoryEntry,
  MemoryChangeEvent,
  MemoryQuery,
  MemorySnapshot,
  SyncStatus,
  SharedMemoryConfig,
  SyncOptions,
  ConflictResolution,
} from './types';

// In-memory storage
const memoryStore = new Map<string, MemoryEntry>();
const keySubscribers = new Map<string, Set<(value: any) => void>>();

// Default configuration
const DEFAULT_CONFIG: SharedMemoryConfig = {
  namespace: 'nicu-schedule',
  persist: true,
  syncInterval: 5000,
  maxHistorySize: 1000,
  enableLogging: process.env.NODE_ENV === 'development',
};

let config: SharedMemoryConfig = { ...DEFAULT_CONFIG };
let syncIntervalId: NodeJS.Timeout | null = null;
let syncStatus: SyncStatus = {
  status: 'idle',
  lastSync: null,
  pendingChanges: 0,
  conflicts: 0,
};

// Change history for undo/redo support
const changeHistory: MemoryChangeEvent[] = [];

/**
 * Initialize shared memory with configuration
 */
export function initializeSharedMemory(userConfig: Partial<SharedMemoryConfig> = {}): void {
  config = { ...DEFAULT_CONFIG, ...userConfig };

  // Load from localStorage if persist is enabled
  if (config.persist && typeof window !== 'undefined') {
    loadFromStorage();
  }

  // Start sync interval
  if (config.syncInterval && config.syncInterval > 0) {
    startSyncInterval();
  }

  if (config.enableLogging) {
    console.log('[SharedMemory] Initialized with config:', config);
  }
}

/**
 * Set a value in shared memory
 */
export function set<T>(key: string, value: T, options: { ttl?: number; source?: string } = {}): void {
  const oldEntry = memoryStore.get(key);
  const oldValue = oldEntry?.value;

  const entry: MemoryEntry<T> = {
    key,
    value,
    version: (oldEntry?.version || 0) + 1,
    timestamp: Date.now(),
    source: options.source || 'client',
    ttl: options.ttl,
  };

  memoryStore.set(key, entry);

  // Persist to localStorage
  if (config.persist && typeof window !== 'undefined') {
    persistKey(key);
  }

  // Create change event
  const changeEvent: MemoryChangeEvent<T> = {
    key,
    oldValue,
    newValue: value,
    version: entry.version,
    timestamp: entry.timestamp,
    source: entry.source,
    type: oldEntry ? 'update' : 'set',
  };

  // Add to history
  changeHistory.push(changeEvent);
  if (changeHistory.length > (config.maxHistorySize || 1000)) {
    changeHistory.shift();
  }

  // Emit events
  emitMemoryChange(changeEvent);

  // Notify direct subscribers
  const subscribers = keySubscribers.get(key);
  if (subscribers) {
    subscribers.forEach((callback) => {
      try {
        callback(value);
      } catch (error) {
        console.error(`[SharedMemory] Error notifying subscriber for ${key}:`, error);
      }
    });
  }

  if (config.enableLogging) {
    console.log(`[SharedMemory] Set ${key}:`, value);
  }
}

/**
 * Get a value from shared memory
 */
export function get<T>(key: string): T | undefined {
  const entry = memoryStore.get(key);

  // Check TTL
  if (entry?.ttl && Date.now() > entry.timestamp + entry.ttl) {
    memoryStore.delete(key);
    return undefined;
  }

  return entry?.value as T;
}

/**
 * Get a value with metadata
 */
export function getEntry<T>(key: string): MemoryEntry<T> | undefined {
  return memoryStore.get(key) as MemoryEntry<T> | undefined;
}

/**
 * Update a value using a function
 */
export function update<T>(key: string, updater: (current: T | undefined) => T, options?: { source?: string }): void {
  const current = get<T>(key);
  const newValue = updater(current);
  set(key, newValue, options);
}

/**
 * Merge partial updates into an object
 */
export function merge<T extends Record<string, any>>(
  key: string,
  partial: Partial<T>,
  options?: { source?: string }
): void {
  const current = get<T>(key) || ({} as T);
  const merged = { ...current, ...partial };
  set(key, merged, { ...options, source: options?.source || 'merge' });
}

/**
 * Delete a value from shared memory
 */
export function remove(key: string, options?: { source?: string }): void {
  const oldEntry = memoryStore.get(key);
  if (!oldEntry) return;

  memoryStore.delete(key);

  // Remove from localStorage
  if (config.persist && typeof window !== 'undefined') {
    const storageKey = `${config.namespace}:${key}`;
    localStorage.removeItem(storageKey);
  }

  const changeEvent: MemoryChangeEvent = {
    key,
    oldValue: oldEntry.value,
    newValue: undefined,
    version: oldEntry.version + 1,
    timestamp: Date.now(),
    source: options?.source || 'client',
    type: 'delete',
  };

  changeHistory.push(changeEvent);
  emitMemoryChange(changeEvent);

  if (config.enableLogging) {
    console.log(`[SharedMemory] Deleted ${key}`);
  }
}

/**
 * Check if a key exists
 */
export function has(key: string): boolean {
  return memoryStore.has(key);
}

/**
 * Get all keys matching a pattern
 */
export function keys(pattern?: string): string[] {
  const allKeys = Array.from(memoryStore.keys());
  if (!pattern) return allKeys;

  const regex = new RegExp(pattern.replace('*', '.*'));
  return allKeys.filter((key) => regex.test(key));
}

/**
 * Query memory entries
 */
export function query(query: MemoryQuery): MemoryEntry[] {
  let results = Array.from(memoryStore.values());

  if (query.key) {
    results = results.filter((e) => e.key === query.key);
  }

  if (query.pattern) {
    const regex = new RegExp(query.pattern.replace('*', '.*'));
    results = results.filter((e) => regex.test(e.key));
  }

  if (query.source) {
    results = results.filter((e) => e.source === query.source);
  }

  if (query.since) {
    results = results.filter((e) => e.timestamp >= query.since);
  }

  return results;
}

/**
 * Create a snapshot of current memory state
 */
export function snapshot(): MemorySnapshot {
  return {
    entries: Array.from(memoryStore.values()),
    version: Date.now(),
    timestamp: Date.now(),
  };
}

/**
 * Restore from a snapshot
 */
export function restore(snapshot: MemorySnapshot, options?: { source?: string }): void {
  memoryStore.clear();

  for (const entry of snapshot.entries) {
    memoryStore.set(entry.key, entry);
  }

  if (config.persist && typeof window !== 'undefined') {
    saveToStorage();
  }

  eventBus.emit('memory:restore', snapshot);

  if (config.enableLogging) {
    console.log(`[SharedMemory] Restored ${snapshot.entries.length} entries`);
  }
}

/**
 * Clear all memory
 */
export function clear(): void {
  memoryStore.clear();

  if (config.persist && typeof window !== 'undefined') {
    const allKeys = Object.keys(localStorage).filter((k) => k.startsWith(`${config.namespace}:`));
    allKeys.forEach((k) => localStorage.removeItem(k));
  }

  eventBus.emit('memory:clear');

  if (config.enableLogging) {
    console.log('[SharedMemory] Cleared all memory');
  }
}

/**
 * Subscribe to changes on a specific key
 */
export function subscribe<T>(key: string, callback: (value: T) => void): () => void {
  if (!keySubscribers.has(key)) {
    keySubscribers.set(key, new Set());
  }
  keySubscribers.get(key)!.add(callback);

  // Return unsubscribe function
  return () => {
    keySubscribers.get(key)?.delete(callback);
  };
}

/**
 * Watch multiple keys for changes
 */
export function watch<T extends Record<string, any>>(
  keys: string[],
  callback: (values: Partial<T>) => void
): () => void {
  const values: Partial<T> = {};

  const updateValue = (key: string) => {
    (values as any)[key] = get(key);
    callback({ ...values });
  };

  // Get initial values
  keys.forEach((key) => {
    (values as any)[key] = get(key);
  });
  callback(values);

  // Subscribe to changes
  const unsubscribers = keys.map((key) => subscribe(key, () => updateValue(key)));

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Get change history
 */
export function getHistory(limit?: number): MemoryChangeEvent[] {
  if (limit) {
    return changeHistory.slice(-limit);
  }
  return [...changeHistory];
}

/**
 * Get sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Start automatic sync interval
 */
export function startSyncInterval(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  syncIntervalId = setInterval(() => {
    syncWithServer();
  }, config.syncInterval);
}

/**
 * Stop automatic sync
 */
export function stopSyncInterval(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

/**
 * Sync with server
 */
export async function syncWithServer(): Promise<void> {
  if (syncStatus.status === 'syncing') return;

  syncStatus.status = 'syncing';
  eventBus.emit('memory:sync:start');

  try {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error('Failed to fetch state');

    const data = await response.json();

    // GET /api/state returns { state, updatedAt } (schedule state), not key-value memory.
    // Do not merge as key-value to avoid corrupting local shared-memory. Schedule UI
    // uses Supabase realtime + loadScheduleState; shared-memory is for other keys only.
    const isScheduleStateShape = data != null && typeof data.state === 'object' && !Array.isArray(data.state);
    if (isScheduleStateShape) {
      // No-op: schedule state is not stored in shared-memory; main UI syncs via Supabase.
    } else {
      const serverState = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(serverState)) {
        const serverEntry = value as MemoryEntry;
        if (serverEntry && typeof serverEntry === 'object' && 'value' in serverEntry) {
          const current = getEntry(key);
          if (!current || (serverEntry.version != null && serverEntry.version > (current.version ?? 0))) {
            set(key, serverEntry.value, { source: 'server' });
          }
        }
      }
    }

    syncStatus.lastSync = Date.now();
    syncStatus.status = 'idle';
    syncStatus.pendingChanges = 0;

    eventBus.emit('memory:sync:complete', syncStatus.lastSync);
  } catch (error) {
    syncStatus.status = 'error';
    emitSyncError(error as Error);
  }
}

/**
 * Persist to localStorage
 */
function persistKey(key: string): void {
  const entry = memoryStore.get(key);
  if (!entry) return;

  const storageKey = `${config.namespace}:${key}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch (e) {
    console.error(`[SharedMemory] Failed to persist ${key}:`, e);
  }
}

/**
 * Save all to localStorage
 */
function saveToStorage(): void {
  for (const key of memoryStore.keys()) {
    persistKey(key);
  }
}

/**
 * Load from localStorage
 */
function loadFromStorage(): void {
  const prefix = `${config.namespace}:`;

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey?.startsWith(prefix)) continue;

    const key = storageKey.slice(prefix.length);
    try {
      const entry = JSON.parse(localStorage.getItem(storageKey)!);
      memoryStore.set(key, entry);
    } catch (e) {
      console.error(`[SharedMemory] Failed to load ${key}:`, e);
    }
  }

  if (config.enableLogging) {
    console.log(`[SharedMemory] Loaded ${memoryStore.size} entries from storage`);
  }
}

/**
 * Get memory statistics
 */
export function getStats(): {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
} {
  const entries = Array.from(memoryStore.values());
  const timestamps = entries.map((e) => e.timestamp);

  return {
    totalEntries: entries.length,
    totalSize: JSON.stringify(entries).length,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps),
  };
}

// Export the shared memory API
export const sharedMemory = {
  set,
  get,
  getEntry,
  update,
  merge,
  remove,
  has,
  keys,
  query,
  snapshot,
  restore,
  clear,
  subscribe,
  watch,
  getHistory,
  getSyncStatus,
  syncWithServer,
  startSyncInterval,
  stopSyncInterval,
  initialize: initializeSharedMemory,
  getStats,
};

export default sharedMemory;
