/**
 * Server-Side Shared Memory Service
 * Provides real-time state synchronization for the Neuro ICU Scheduler
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Server-side memory entry
 */
class MemoryEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.version = options.version || 1;
    this.timestamp = options.timestamp || Date.now();
    this.source = options.source || 'server';
    this.ttl = options.ttl || null;
  }

  isExpired() {
    if (!this.ttl) return false;
    return Date.now() > this.timestamp + this.ttl;
  }

  toJSON() {
    return {
      key: this.key,
      value: this.value,
      version: this.version,
      timestamp: this.timestamp,
      source: this.source,
      ttl: this.ttl,
    };
  }

  static fromJSON(data) {
    const entry = new MemoryEntry(data.key, data.value, {
      version: data.version,
      timestamp: data.timestamp,
      source: data.source,
      ttl: data.ttl,
    });
    return entry;
  }
}

/**
 * Server-side Shared Memory
 */
class SharedMemoryService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.store = new Map();
    this.subscribers = new Map();
    this.changeHistory = [];
    this.maxHistorySize = options.maxHistorySize || 10000;
    this.persistencePath = options.persistencePath || path.join(__dirname, '../data/shared-memory.json');
    this.namespace = options.namespace || 'nicu-schedule';
    this.enableLogging = options.enableLogging || process.env.NODE_ENV === 'development';

    // Load persisted data on init
    this.loadFromDisk();

    // Periodic cleanup and persistence
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
    this.persistInterval = setInterval(() => this.persistToDisk(), 30000); // Every 30 seconds
  }

  /**
   * Log messages if logging is enabled
   */
  log(...args) {
    if (this.enableLogging) {
      console.log('[SharedMemoryService]', ...args);
    }
  }

  /**
   * Set a value in memory
   */
  set(key, value, options = {}) {
    const existing = this.store.get(key);
    const version = existing ? existing.version + 1 : 1;

    const entry = new MemoryEntry(key, value, {
      ...options,
      version,
      timestamp: Date.now(),
    });

    this.store.set(key, entry);

    // Track change
    const changeEvent = {
      key,
      oldValue: existing?.value,
      newValue: value,
      version,
      timestamp: entry.timestamp,
      source: options.source || 'server',
      type: existing ? 'update' : 'set',
    };

    this.addToHistory(changeEvent);

    // Emit events
    this.emit('change', changeEvent);
    this.emit(`change:${key}`, changeEvent);

    // Notify subscribers
    this.notifySubscribers(key, changeEvent);

    this.log(`Set ${key}:`, value);
    return entry;
  }

  /**
   * Get a value from memory
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.isExpired()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Get full entry with metadata
   */
  getEntry(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.isExpired()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.toJSON();
  }

  /**
   * Update a value using a function
   */
  update(key, updater, options = {}) {
    const current = this.get(key);
    const newValue = updater(current);
    return this.set(key, newValue, options);
  }

  /**
   * Merge partial updates
   */
  merge(key, partial, options = {}) {
    const current = this.get(key) || {};
    const merged = { ...current, ...partial };
    return this.set(key, merged, { ...options, source: options.source || 'merge' });
  }

  /**
   * Delete a value
   */
  remove(key, options = {}) {
    const existing = this.store.get(key);
    if (!existing) return false;

    this.store.delete(key);

    const changeEvent = {
      key,
      oldValue: existing.value,
      newValue: undefined,
      version: existing.version + 1,
      timestamp: Date.now(),
      source: options.source || 'server',
      type: 'delete',
    };

    this.addToHistory(changeEvent);
    this.emit('change', changeEvent);
    this.emit(`change:${key}`, changeEvent);
    this.notifySubscribers(key, changeEvent);

    this.log(`Deleted ${key}`);
    return true;
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.store.has(key);
  }

  /**
   * Get all keys matching pattern
   */
  keys(pattern) {
    const allKeys = Array.from(this.store.keys());
    if (!pattern) return allKeys;

    const regex = new RegExp(pattern.replace('*', '.*'));
    return allKeys.filter((key) => regex.test(key));
  }

  /**
   * Query entries
   */
  query(queryOptions = {}) {
    let results = Array.from(this.store.values());

    if (queryOptions.key) {
      results = results.filter((e) => e.key === queryOptions.key);
    }

    if (queryOptions.pattern) {
      const regex = new RegExp(queryOptions.pattern.replace('*', '.*'));
      results = results.filter((e) => regex.test(e.key));
    }

    if (queryOptions.source) {
      results = results.filter((e) => e.source === queryOptions.source);
    }

    if (queryOptions.since) {
      results = results.filter((e) => e.timestamp >= queryOptions.since);
    }

    return results.map((e) => e.toJSON());
  }

  /**
   * Get all entries
   */
  getAll() {
    const result = {};
    for (const [key, entry] of this.store) {
      if (!entry.isExpired()) {
        result[key] = entry.toJSON();
      }
    }
    return result;
  }

  /**
   * Create snapshot
   */
  snapshot() {
    return {
      entries: Array.from(this.store.values())
        .filter((e) => !e.isExpired())
        .map((e) => e.toJSON()),
      version: Date.now(),
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot) {
    this.store.clear();

    for (const entryData of snapshot.entries) {
      const entry = MemoryEntry.fromJSON(entryData);
      this.store.set(entry.key, entry);
    }

    this.emit('restore', snapshot);
    this.log(`Restored ${snapshot.entries.length} entries`);
    return true;
  }

  /**
   * Clear all data
   */
  clear() {
    this.store.clear();
    this.emit('clear');
    this.log('Cleared all memory');
  }

  /**
   * Subscribe to changes on a key
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of a change
   */
  notifySubscribers(key, event) {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error notifying subscriber for ${key}:`, error);
        }
      });
    }
  }

  /**
   * Add to change history
   */
  addToHistory(changeEvent) {
    this.changeHistory.push(changeEvent);
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  /**
   * Get change history
   */
  getHistory(limit) {
    if (limit) {
      return this.changeHistory.slice(-limit);
    }
    return [...this.changeHistory];
  }

  /**
   * Persist to disk
   */
  async persistToDisk() {
    try {
      const data = {
        namespace: this.namespace,
        timestamp: Date.now(),
        entries: this.snapshot().entries,
      };

      // Ensure directory exists
      const dir = path.dirname(this.persistencePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(this.persistencePath, JSON.stringify(data, null, 2));
      this.log('Persisted to disk');
    } catch (error) {
      console.error('Failed to persist to disk:', error);
    }
  }

  /**
   * Load from disk
   */
  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf-8');
      const parsed = JSON.parse(data);

      for (const entryData of parsed.entries) {
        const entry = MemoryEntry.fromJSON(entryData);
        if (!entry.isExpired()) {
          this.store.set(entry.key, entry);
        }
      }

      this.log(`Loaded ${this.store.size} entries from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load from disk:', error);
      }
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (entry.isExpired()) {
        this.store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.log(`Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const entries = Array.from(this.store.values());
    const timestamps = entries.map((e) => e.timestamp);

    return {
      totalEntries: entries.length,
      totalSize: JSON.stringify(entries).length,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      historySize: this.changeHistory.length,
    };
  }

  /**
   * Destroy the service
   */
  async destroy() {
    clearInterval(this.cleanupInterval);
    clearInterval(this.persistInterval);
    await this.persistToDisk();
    this.removeAllListeners();
    this.store.clear();
    this.subscribers.clear();
  }
}

// Singleton instance
let sharedMemoryService = null;

export function getSharedMemoryService(options = {}) {
  if (!sharedMemoryService) {
    sharedMemoryService = new SharedMemoryService(options);
  }
  return sharedMemoryService;
}

export function createSharedMemoryService(options = {}) {
  return new SharedMemoryService(options);
}

export { SharedMemoryService };
export default getSharedMemoryService;
