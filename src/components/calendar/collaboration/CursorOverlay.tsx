/**
 * CursorOverlay Component
 * 
 * Displays remote user cursors and selection states for real-time collaboration.
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useEffect, useRef, useState } from 'react';
import type { CursorPosition, PresenceAwareness } from '@/types/calendar';
import { cn } from '@/lib/utils';

export interface CursorOverlayProps {
  /** Active user cursors to display */
  cursors: CursorPosition[];
  /** User awareness states */
  awareness: PresenceAwareness;
  /** Container ref for coordinate mapping */
  containerRef: React.RefObject<HTMLElement>;
  /** Current user's ID (to exclude self) */
  currentUserId: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders remote user cursors with names and activity indicators
 */
export function CursorOverlay({
  cursors,
  awareness,
  containerRef,
  currentUserId,
  className
}: CursorOverlayProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Track container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();

    // Use ResizeObserver for efficient dimension tracking
    resizeObserverRef.current = new ResizeObserver(updateDimensions);
    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [containerRef]);

  // Filter out own cursor and stale positions
  const activeCursors = cursors.filter(cursor => {
    // Exclude self
    if (cursor.userId === currentUserId) return false;
    
    // Check if cursor is within bounds
    if (cursor.x < 0 || cursor.x > dimensions.width) return false;
    if (cursor.y < 0 || cursor.y > dimensions.height) return false;
    
    // Check if cursor is recent (within 30 seconds)
    const age = Date.now() - new Date(cursor.timestamp).getTime();
    return age < 30000;
  });

  // Get user color based on ID (consistent colors)
  const getUserColor = (userId: string): string => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
    ];
    
    // Hash userId to get consistent color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Get initials from name
  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden z-50', className)}>
      {activeCursors.map(cursor => {
        const color = getUserColor(cursor.userId);
        const isIdle = cursor.state === 'idle';
        const isAway = cursor.state === 'away';
        const awarenessState = awareness[cursor.userId];

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Cursor */}
            <div className="relative">
              {/* Cursor Arrow */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className={cn(
                  'transition-opacity duration-300',
                  isIdle && 'opacity-50',
                  isAway && 'opacity-25'
                )}
                style={{ color }}
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L11.7841 12.3673H5.65376Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="1"
                />
              </svg>

              {/* User Label */}
              <div
                className={cn(
                  'absolute left-4 top-4 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap',
                  'text-white shadow-sm transition-opacity duration-300'
                )}
                style={{ backgroundColor: color }}
              >
                <span className={cn(isIdle && 'opacity-70', isAway && 'opacity-50')}>
                  {cursor.userName}
                  {awarenessState?.isEditing && ' • editing'}
                  {isIdle && ' • idle'}
                  {isAway && ' • away'}
                </span>
              </div>

              {/* Focus Indicator (if user is focused on a slot) */}
              {awarenessState?.focusedSlotId && (
                <div
                  className="absolute -left-1 -top-1 w-3 h-3 rounded-full border-2 border-white animate-pulse"
                  style={{ backgroundColor: color }}
                  title={`Viewing ${awarenessState.focusedSlotId}`}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Selection Borders for Active Edits */}
      {Object.entries(awareness)
        .filter(([userId, state]) => userId !== currentUserId && state.isEditing && state.focusedSlotId)
        .map(([userId, state]) => {
          const color = getUserColor(userId);
          return (
            <div
              key={`selection-${userId}`}
              className="absolute pointer-events-none"
              style={{
                // These would need to be calculated based on the actual slot element position
                // For now, this is a placeholder that would be enhanced with actual slot refs
                border: `2px solid ${color}`,
                borderRadius: '4px',
                boxShadow: `0 0 0 2px ${color}20`,
                // The actual position would come from the slot element's getBoundingClientRect
                // relative to the container
              }}
            />
          );
        })}
    </div>
  );
}

// Hook for smooth cursor interpolation
export function useSmoothCursors(
  cursors: CursorPosition[],
  smoothing: number = 0.3
): CursorPosition[] {
  const [smoothed, setSmoothed] = useState<CursorPosition[]>(cursors);
  const rafRef = useRef<number>();
  const targetRef = useRef<CursorPosition[]>(cursors);

  useEffect(() => {
    targetRef.current = cursors;
  }, [cursors]);

  useEffect(() => {
    const animate = () => {
      setSmoothed(prev => {
        return targetRef.current.map(target => {
          const current = prev.find(c => c.userId === target.userId);
          if (!current) return target;

          return {
            ...target,
            x: current.x + (target.x - current.x) * smoothing,
            y: current.y + (target.y - current.y) * smoothing
          };
        });
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [smoothing]);

  return smoothed;
}

// Awareness indicator for user list
interface AwarenessIndicatorProps {
  awareness: PresenceAwareness;
  currentUserId: string;
}

export function AwarenessIndicator({ awareness, currentUserId }: AwarenessIndicatorProps) {
  const users = Object.entries(awareness).filter(([id]) => id !== currentUserId);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map(([userId, state]) => (
          <div
            key={userId}
            className={cn(
              'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium text-white',
              state.state === 'active' && 'bg-green-500',
              state.state === 'idle' && 'bg-amber-500',
              state.state === 'away' && 'bg-slate-400'
            )}
            title={`${state.userName} (${state.state})`}
          >
            {state.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
        ))}
        {users.length > 3 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600">
            +{users.length - 3}
          </div>
        )}
      </div>
      <span className="text-xs text-slate-500">
        {users.length} online
      </span>
    </div>
  );
}

export default CursorOverlay;
