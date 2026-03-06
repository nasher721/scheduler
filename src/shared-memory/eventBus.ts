/**
 * Event Bus
 * Central event system for shared memory communication
 */

import { MemoryChangeEvent, MemoryEventType, MemoryEventHandler } from './types';

type EventCallback = (...args: any[]) => void;

class EventBus {
  private events: Map<string, Set<EventCallback>> = new Map();
  private globalHandlers: Set<MemoryEventHandler> = new Set();
  private history: Array<{ type: string; payload: any; timestamp: number }> = [];
  private maxHistorySize: number = 1000;

  /**
   * Subscribe to a specific event type
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.events.get(event)?.delete(callback);
    };
  }

  /**
   * Subscribe to a specific event type (once)
   */
  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    this.on(event, onceCallback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback): void {
    this.events.get(event)?.delete(callback);
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: string, ...args: any[]): void {
    // Add to history
    this.history.push({
      type: event,
      payload: args,
      timestamp: Date.now(),
    });

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Notify specific subscribers
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }

    // Notify global handlers for memory change events
    if (event.startsWith('memory:')) {
      const changeEvent = args[0] as MemoryChangeEvent;
      this.globalHandlers.forEach((handler) => {
        try {
          handler(changeEvent);
        } catch (error) {
          console.error('Error in global memory handler:', error);
        }
      });
    }
  }

  /**
   * Subscribe to all memory change events
   */
  onAnyChange(handler: MemoryEventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Get event history
   */
  getHistory(event?: string, limit: number = 100): Array<{ type: string; payload: any; timestamp: number }> {
    let result = this.history;
    if (event) {
      result = result.filter((h) => h.type === event);
    }
    return result.slice(-limit);
  }

  /**
   * Clear all subscribers and history
   */
  clear(): void {
    this.events.clear();
    this.globalHandlers.clear();
    this.history = [];
  }

  /**
   * Get active subscriber count
   */
  getSubscriberCount(event?: string): number {
    if (event) {
      return this.events.get(event)?.size || 0;
    }
    return Array.from(this.events.values()).reduce((sum, set) => sum + set.size, 0);
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Helper functions for common events
export const emitMemoryChange = <T>(event: MemoryChangeEvent<T>): void => {
  eventBus.emit(`memory:change:${event.key}`, event);
  eventBus.emit('memory:change', event);
};

export const emitSyncStart = (): void => {
  eventBus.emit('memory:sync:start');
};

export const emitSyncComplete = (timestamp: number): void => {
  eventBus.emit('memory:sync:complete', timestamp);
};

export const emitSyncError = (error: Error): void => {
  eventBus.emit('memory:sync:error', error);
};

export const emitConflict = <T>(conflict: { key: string; local: T; server: T }): void => {
  eventBus.emit('memory:conflict', conflict);
};

export default eventBus;
