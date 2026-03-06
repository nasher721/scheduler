/**
 * Shared Memory System - Main Export
 * Always-updated shared state for the Neuro ICU Scheduler
 */

// Core modules
export { eventBus, emitMemoryChange, emitSyncStart, emitSyncComplete, emitSyncError, emitConflict } from './eventBus';
export {
  sharedMemory,
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
  initializeSharedMemory,
  getStats,
} from './sharedMemory';

// Middleware
export { sharedMemoryMiddleware, createSharedMemoryStore } from './zustandMiddleware';

// React hooks
export {
  useSharedMemory,
  useSharedMemoryWatch,
  useSyncStatus,
  useSync,
  useMemoryEvent,
  useMemoryHistory,
  useOptimisticUpdate,
  useCollaborativeCursor,
  usePresence,
  useActivityFeed,
  useScheduleState,
  useProviders,
  useSlots,
  useScenarios,
  useShiftRequests,
} from './useSharedMemory';

// Types
export type {
  MemoryEntry,
  MemoryChangeEvent,
  MemoryQuery,
  MemorySnapshot,
  SyncStatus,
  ConflictResolution,
  MemoryEventType,
  MemoryEventHandler,
  SyncOptions,
  SharedMemoryConfig,
  MemoryKey,
} from './types';

export { MEMORY_KEYS } from './types';

// Re-export as default
export { sharedMemory as default } from './sharedMemory';
