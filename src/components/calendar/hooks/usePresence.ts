/**
 * usePresence Hook
 * 
 * Real-time user presence tracking with cursors and awareness state.
 * Uses BroadcastChannel API for cross-tab communication (MVP version).
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { 
  CursorPosition, 
  PresenceState, 
  PresenceAwareness,
  UserState 
} from '@/types/calendar';

export interface UsePresenceOptions {
  /** Current user ID */
  userId: string;
  /** Current user name for display */
  userName: string;
  /** User role */
  userRole?: string;
  /** Container element for cursor tracking */
  containerRef?: React.RefObject<HTMLElement>;
  /** Channel name for BroadcastChannel */
  channelName?: string;
  /** Idle timeout in ms (default: 5 minutes) */
  idleTimeout?: number;
  /** Away timeout in ms (default: 15 minutes) */
  awayTimeout?: number;
  /** Cursor throttle interval in ms (default: 50ms) */
  cursorThrottle?: number;
  /** Enable cursor tracking */
  enableCursors?: boolean;
  /** Enable awareness state */
  enableAwareness?: boolean;
}

export interface UsePresenceReturn {
  /** Current local user state */
  localUser: PresenceState;
  /** Map of all users' awareness states */
  awareness: PresenceAwareness;
  /** Array of cursor positions for rendering */
  cursors: CursorPosition[];
  /** Currently focused slot ID */
  focusedSlotId: string | null;
  /** Set the focused slot */
  setFocusedSlot: (slotId: string | null) => void;
  /** Set editing state */
  setEditing: (isEditing: boolean) => void;
  /** Broadcast a custom event */
  broadcast: (type: string, payload: unknown) => void;
  /** List of online user IDs */
  onlineUsers: string[];
  /** Check if a user is online */
  isUserOnline: (userId: string) => boolean;
}

const DEFAULT_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_AWAY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const DEFAULT_CURSOR_THROTTLE = 50; // 50ms
const PRESENCE_CHANNEL = 'nicu-schedule-presence';

/**
 * Hook for real-time presence tracking
 * 
 * @example
 * ```tsx
 * const { cursors, awareness, setFocusedSlot } = usePresence({
 *   userId: currentUser.id,
 *   userName: currentUser.name,
 *   containerRef: calendarRef,
 *   enableCursors: true
 * });
 * ```
 */
export function usePresence({
  userId,
  userName,
  userRole = 'viewer',
  containerRef,
  channelName = PRESENCE_CHANNEL,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
  awayTimeout = DEFAULT_AWAY_TIMEOUT,
  cursorThrottle = DEFAULT_CURSOR_THROTTLE,
  enableCursors = true,
  enableAwareness = true
}: UsePresenceOptions): UsePresenceReturn {
  // Local user state
  const [localUser, setLocalUser] = useState<PresenceState>({
    userId,
    userName,
    userRole,
    currentView: window.location.pathname,
    isEditing: false,
    lastActivity: new Date().toISOString(),
    onlineAt: new Date().toISOString()
  });

  // Awareness state for all users
  const [awareness, setAwareness] = useState<PresenceAwareness>({});
  
  // Cursor positions
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  
  // Focus tracking
  const [focusedSlotId, setFocusedSlotId] = useState<string | null>(null);
  
  // Refs
  const channelRef = useRef<BroadcastChannel | null>(null);
  const cursorThrottleRef = useRef<number>(0);
  const lastActivityRef = useRef<Date>(new Date());
  const stateRef = useRef({ localUser, awareness, cursors });

  // Keep refs in sync
  useEffect(() => {
    stateRef.current = { localUser, awareness, cursors };
  }, [localUser, awareness, cursors]);

  // Initialize BroadcastChannel
  useEffect(() => {
    if (!enableAwareness) return;

    // Check for BroadcastChannel support
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported, falling back to localStorage');
      return;
    }

    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Announce presence on join
    channel.postMessage({
      type: 'presence:join',
      payload: {
        userId,
        userName,
        userRole,
        timestamp: new Date().toISOString()
      }
    });

    // Listen for messages
    channel.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'presence:join':
          // Reply to new user with our state
          if (payload.userId !== userId) {
            channel.postMessage({
              type: 'presence:state',
              payload: stateRef.current.localUser
            });
          }
          break;

        case 'presence:state':
          if (payload.userId !== userId) {
            setAwareness(prev => ({
              ...prev,
              [payload.userId]: payload
            }));
          }
          break;

        case 'presence:update':
          if (payload.userId !== userId) {
            setAwareness(prev => ({
              ...prev,
              [payload.userId]: { ...prev[payload.userId], ...payload }
            }));
          }
          break;

        case 'presence:leave':
          if (payload.userId !== userId) {
            setAwareness(prev => {
              const next = { ...prev };
              delete next[payload.userId];
              return next;
            });
            setCursors(prev => prev.filter(c => c.userId !== payload.userId));
          }
          break;

        case 'cursor:move':
          if (payload.userId !== userId) {
            setCursors(prev => {
              const existing = prev.findIndex(c => c.userId === payload.userId);
              if (existing >= 0) {
                const next = [...prev];
                next[existing] = payload;
                return next;
              }
              return [...prev, payload];
            });
          }
          break;

        case 'cursor:leave':
          setCursors(prev => prev.filter(c => c.userId !== payload.userId));
          break;

        case 'custom':
          // Handle custom events
          break;
      }
    };

    // Cleanup on unmount
    return () => {
      channel.postMessage({
        type: 'presence:leave',
        payload: { userId }
      });
      channel.close();
    };
  }, [channelName, userId, userName, userRole, enableAwareness]);

  // Cursor tracking
  useEffect(() => {
    if (!enableCursors || !containerRef?.current) return;

    const container = containerRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - cursorThrottleRef.current < cursorThrottle) return;
      cursorThrottleRef.current = now;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Only send if within bounds
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        const cursorUpdate: CursorPosition = {
          userId,
          userName,
          x,
          y,
          state: localUser.state || 'active',
          timestamp: new Date().toISOString()
        };

        channelRef.current?.postMessage({
          type: 'cursor:move',
          payload: cursorUpdate
        });

        // Update last activity
        lastActivityRef.current = new Date();
      }
    };

    const handleMouseLeave = () => {
      channelRef.current?.postMessage({
        type: 'cursor:leave',
        payload: { userId }
      });
    };

    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enableCursors, containerRef, userId, userName, localUser.state, cursorThrottle]);

  // Activity state management (idle/away detection)
  useEffect(() => {
    if (!enableAwareness) return;

    const checkActivity = () => {
      const now = new Date();
      const lastActivity = lastActivityRef.current;
      const timeSinceActivity = now.getTime() - lastActivity.getTime();

      let newState: UserState = 'active';
      if (timeSinceActivity > awayTimeout) {
        newState = 'away';
      } else if (timeSinceActivity > idleTimeout) {
        newState = 'idle';
      }

      if (newState !== localUser.state) {
        const updated = {
          ...localUser,
          state: newState,
          lastActivity: lastActivity.toISOString()
        };
        setLocalUser(updated);

        channelRef.current?.postMessage({
          type: 'presence:update',
          payload: updated
        });
      }
    };

    const interval = setInterval(checkActivity, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [enableAwareness, localUser, idleTimeout, awayTimeout]);

  // Track document visibility
  useEffect(() => {
    if (!enableAwareness) return;

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      const updated = {
        ...localUser,
        isVisible,
        lastActivity: new Date().toISOString()
      };
      setLocalUser(updated);

      channelRef.current?.postMessage({
        type: 'presence:update',
        payload: updated
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enableAwareness, localUser]);

  // Set focused slot
  const setFocusedSlot = useCallback((slotId: string | null) => {
    setFocusedSlotId(slotId);
    
    const updated = {
      ...localUser,
      focusedSlotId: slotId || undefined,
      lastActivity: new Date().toISOString()
    };
    setLocalUser(updated);

    channelRef.current?.postMessage({
      type: 'presence:update',
      payload: updated
    });
  }, [localUser]);

  // Set editing state
  const setEditing = useCallback((isEditing: boolean) => {
    const updated = {
      ...localUser,
      isEditing,
      lastActivity: new Date().toISOString()
    };
    setLocalUser(updated);

    channelRef.current?.postMessage({
      type: 'presence:update',
      payload: updated
    });
  }, [localUser]);

  // Broadcast custom event
  const broadcast = useCallback((type: string, payload: unknown) => {
    channelRef.current?.postMessage({
      type: 'custom',
      customType: type,
      payload
    });
  }, []);

  // Derived state
  const onlineUsers = useMemo(() => {
    return Object.keys(awareness).filter(id => {
      const user = awareness[id];
      return user && user.state !== 'away';
    });
  }, [awareness]);

  const isUserOnline = useCallback((id: string) => {
    const user = awareness[id];
    return user && user.state !== 'away';
  }, [awareness]);

  return {
    localUser,
    awareness,
    cursors,
    focusedSlotId,
    setFocusedSlot,
    setEditing,
    broadcast,
    onlineUsers,
    isUserOnline
  };
}

// Hook for individual user presence
export function useUserPresence(userId: string, awareness: PresenceAwareness) {
  return useMemo(() => awareness[userId], [userId, awareness]);
}

export default usePresence;
