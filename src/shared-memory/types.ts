/**
 * Shared Memory Types
 * Type definitions for the always-updated shared memory system
 */

export interface MemoryEntry<T = any> {
  key: string;
  value: T;
  version: number;
  timestamp: number;
  source: string;
  ttl?: number;
}

export interface MemoryChangeEvent<T = any> {
  key: string;
  oldValue: T | undefined;
  newValue: T;
  version: number;
  timestamp: number;
  source: string;
  type: 'set' | 'update' | 'delete' | 'merge';
}

export interface MemoryQuery {
  key?: string;
  pattern?: string;
  source?: string;
  since?: number;
}

export interface MemorySnapshot {
  entries: MemoryEntry[];
  version: number;
  timestamp: number;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSync: number | null;
  pendingChanges: number;
  conflicts: number;
}

export interface ConflictResolution<T = any> {
  key: string;
  localValue: T;
  serverValue: T;
  resolution: 'local' | 'server' | 'merge';
  mergedValue?: T;
}

export type MemoryEventType = 
  | 'change'
  | 'sync'
  | 'conflict'
  | 'error'
  | 'connect'
  | 'disconnect';

export interface MemoryEventHandler<T = any> {
  (event: MemoryChangeEvent<T>): void;
}

export interface SyncOptions {
  optimistic?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  conflictResolution?: 'local-wins' | 'server-wins' | 'manual';
}

export interface SharedMemoryConfig {
  namespace: string;
  persist?: boolean;
  syncInterval?: number;
  maxHistorySize?: number;
  enableLogging?: boolean;
}

// Project-specific memory keys
export const MEMORY_KEYS = {
  SCHEDULE_STATE: 'schedule:state',
  PROVIDERS: 'schedule:providers',
  SLOTS: 'schedule:slots',
  SCENARIOS: 'schedule:scenarios',
  ACTIVE_SCENARIO: 'schedule:activeScenario',
  ANALYTICS: 'schedule:analytics',
  SHIFT_REQUESTS: 'schedule:shiftRequests',
  NOTIFICATIONS: 'schedule:notifications',
  USER_PREFERENCES: 'user:preferences',
  UI_STATE: 'ui:state',
  AUDIT_LOG: 'audit:log',
} as const;

export type MemoryKey = typeof MEMORY_KEYS[keyof typeof MEMORY_KEYS];
