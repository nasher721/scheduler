/**
 * PresenceIndicator Component
 * 
 * Real-time user presence and awareness for collaborative scheduling.
 * Shows who's viewing/editing the schedule with live cursors and activity.
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useScheduleStore, type Provider } from '@/store';
import type { PresenceState, ActivityEvent } from '@/types/calendar';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Users,
  Circle,
  Pencil,
  Eye,
  MousePointer2,
  Clock,
  MoreHorizontal
} from 'lucide-react';

interface PresenceIndicatorProps {
  className?: string;
}

// Mock presence data for demo
const MOCK_PRESENCE: PresenceState[] = [
  {
    userId: 'user-1',
    userName: 'Dr. Sarah Chen',
    userRole: 'SCHEDULER',
    currentView: 'grid',
    isEditing: true,
    lastActivity: new Date().toISOString(),
    onlineAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    userId: 'user-2',
    userName: 'Dr. Michael Ross',
    userRole: 'CLINICIAN',
    currentView: 'week',
    isEditing: false,
    lastActivity: new Date(Date.now() - 120000).toISOString(),
    onlineAt: new Date(Date.now() - 1800000).toISOString()
  }
];

export function PresenceIndicator({ className }: PresenceIndicatorProps) {
  const { currentUser } = useScheduleStore();
  const [presence, setPresence] = useState<PresenceState[]>(MOCK_PRESENCE);
  const [showDetails, setShowDetails] = useState(false);

  // Filter out current user
  const otherUsers = presence.filter(p => p.userId !== currentUser?.id);
  const activeEditors = otherUsers.filter(p => p.isEditing);
  const viewers = otherUsers.filter(p => !p.isEditing);

  // Get status color
  const getStatusColor = (lastActivity: string) => {
    const minutesAgo = (Date.now() - new Date(lastActivity).getTime()) / 60000;
    if (minutesAgo < 2) return 'bg-emerald-500';
    if (minutesAgo < 5) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  // Get initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <TooltipProvider>
      <div className={cn('relative', className)}>
        {/* Collapsed View - Avatar Stack */}
        <div 
          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded-lg p-2 transition-colors"
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="flex -space-x-2">
            {otherUsers.slice(0, 3).map((user, index) => (
              <Tooltip key={user.userId}>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      'relative w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium',
                      user.isEditing ? 'ring-2 ring-primary ring-offset-1' : ''
                    )}
                    style={{ 
                      backgroundColor: getUserColor(index),
                      color: 'white',
                      zIndex: otherUsers.length - index
                    }}
                  >
                    {getInitials(user.userName)}
                    <span className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                      getStatusColor(user.lastActivity)
                    )} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-sm">
                    <p className="font-medium">{user.userName}</p>
                    <p className="text-xs text-slate-400">
                      {user.isEditing ? 'Editing' : 'Viewing'} • {user.currentView} view
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
            
            {otherUsers.length > 3 && (
              <div 
                className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600"
                style={{ zIndex: 0 }}
              >
                +{otherUsers.length - 3}
              </div>
            )}
          </div>

          <div className="text-sm text-slate-600">
            {otherUsers.length > 0 ? (
              <>
                <span className="font-medium">{otherUsers.length}</span>
                <span className="hidden sm:inline"> other{otherUsers.length !== 1 ? 's' : ''} online</span>
              </>
            ) : (
              <span className="text-slate-400">Just you</span>
            )}
          </div>

          {activeEditors.length > 0 && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Pencil className="w-3 h-3 mr-1" />
              {activeEditors.length} editing
            </Badge>
          )}
        </div>

        {/* Expanded Details Panel */}
        {showDetails && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  Active Users ({otherUsers.length + 1})
                </h3>
                <button 
                  onClick={() => setShowDetails(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <ScrollArea className="max-h-80">
              <div className="p-2 space-y-1">
                {/* Current User */}
                {currentUser && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={currentUser.avatar} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(currentUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{currentUser.name} (You)</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        Editing
                      </p>
                    </div>
                  </div>
                )}

                {/* Active Editors */}
                {activeEditors.length > 0 && (
                  <>
                    <div className="px-2 pt-2 pb-1">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        Editing ({activeEditors.length})
                      </p>
                    </div>
                    {activeEditors.map(user => (
                      <UserPresenceItem 
                        key={user.userId} 
                        user={user} 
                        statusColor={getStatusColor(user.lastActivity)}
                      />
                    ))}
                  </>
                )}

                {/* Viewers */}
                {viewers.length > 0 && (
                  <>
                    <div className="px-2 pt-2 pb-1">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        Viewing ({viewers.length})
                      </p>
                    </div>
                    {viewers.map(user => (
                      <UserPresenceItem 
                        key={user.userId} 
                        user={user} 
                        statusColor={getStatusColor(user.lastActivity)}
                      />
                    ))}
                  </>
                )}

                {otherUsers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No one else is online</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Individual user presence item
function UserPresenceItem({ 
  user, 
  statusColor 
}: { 
  user: PresenceState; 
  statusColor: string;
}) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="relative">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
          style={{ backgroundColor: getUserColor(user.userId.length) }}
        >
          {getInitials(user.userName)}
        </div>
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
          statusColor
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{user.userName}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          {user.isEditing ? (
            <>
              <Pencil className="w-3 h-3" />
              Editing
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              Viewing {user.currentView}
            </>
          )}
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-slate-400">
            {formatDistanceToNow(new Date(user.lastActivity), { addSuffix: true })}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Last active: {format(new Date(user.lastActivity), 'h:mm a')}</p>
          <p>Online since: {format(new Date(user.onlineAt), 'h:mm a')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// Live cursor indicator
export function LiveCursor({ 
  user, 
  position 
}: { 
  user: PresenceState; 
  position: { x: number; y: number };
}) {
  const color = getUserColor(user.userId.length);
  
  return (
    <div 
      className="fixed pointer-events-none z-50 transition-all duration-150 ease-out"
      style={{ left: position.x, top: position.y }}
    >
      <MousePointer2 
        className="w-5 h-5"
        style={{ color, fill: color, fillOpacity: 0.2 }}
      />
      <div 
        className="absolute left-4 top-4 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {user.userName.split(' ')[0]}
      </div>
    </div>
  );
}

// Editing lock indicator
export function EditingLock({ 
  lockedBy, 
  onRequestAccess 
}: { 
  lockedBy?: PresenceState;
  onRequestAccess?: () => void;
}) {
  if (!lockedBy) return null;

  return (
    <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Pencil className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Currently Being Edited</h3>
        <p className="text-slate-600 mb-4">
          <span className="font-medium" style={{ color: getUserColor(lockedBy.userId.length) }}>
            {lockedBy.userName}
          </span>{' '}
          is currently making changes to this schedule.
        </p>
        <div className="flex gap-3 justify-center">
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Go Back
          </button>
          <button 
            onClick={onRequestAccess}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Request Access
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to get consistent colors for users
function getUserColor(index: number): string {
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#84CC16', // lime
    '#14B8A6', // teal
  ];
  return colors[index % colors.length];
}

// Hook for presence management
export function usePresence(channelName: string = 'calendar-presence') {
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number }>>({});

  // Subscribe to presence channel
  useEffect(() => {
    // TODO: Implement real WebSocket subscription
    // For now, return mock data
    
    const interval = setInterval(() => {
      // Simulate cursor movements
      setCursors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(userId => {
          next[userId] = {
            x: next[userId].x + (Math.random() - 0.5) * 20,
            y: next[userId].y + (Math.random() - 0.5) * 20
          };
        });
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [channelName]);

  const updatePresence = useCallback((updates: Partial<PresenceState>) => {
    // TODO: Send presence update to server
  }, []);

  return {
    presence,
    cursors,
    updatePresence,
    onlineCount: presence.length
  };
}
