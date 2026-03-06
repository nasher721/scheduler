/**
 * ActivityFeed Component
 * 
 * Real-time activity stream showing schedule changes, comments, and user actions.
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useState, useMemo } from 'react';
import type { ActivityEvent } from '@/types/calendar';
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  UserCheck,
  UserX,
  MessageSquare,
  Repeat,
  FileText,
  MoreHorizontal,
  Check,
  Clock,
  Filter,
  RefreshCw
} from 'lucide-react';

export interface ActivityFeedProps {
  /** List of activity events */
  activities: ActivityEvent[];
  /** Callback when user clicks on an activity */
  onActivityClick?: (activity: ActivityEvent) => void;
  /** Callback to mark all as read */
  onMarkAllRead?: () => void;
  /** Maximum number of items to show (0 = unlimited) */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
}

type ActivityType = ActivityEvent['type'];

const activityConfig: Record<ActivityType, {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}> = {
  assignment: {
    icon: <UserCheck className="w-4 h-4" />,
    label: 'Assigned',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  unassignment: {
    icon: <UserX className="w-4 h-4" />,
    label: 'Unassigned',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50'
  },
  edit: {
    icon: <FileText className="w-4 h-4" />,
    label: 'Edited',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  comment: {
    icon: <MessageSquare className="w-4 h-4" />,
    label: 'Comment',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50'
  },
  swap: {
    icon: <Repeat className="w-4 h-4" />,
    label: 'Swapped',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50'
  },
  template_applied: {
    icon: <FileText className="w-4 h-4" />,
    label: 'Template',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50'
  }
};

/**
 * Activity feed showing recent schedule changes and interactions
 */
export function ActivityFeed({
  activities,
  onActivityClick,
  onMarkAllRead,
  limit = 0,
  className
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set(
    activities.slice(0, 10).map(a => a.id)
  ));

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let filtered = filter === 'all' 
      ? activities 
      : activities.filter(a => a.type === filter);
    
    // Sort by timestamp descending
    filtered = filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    if (limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    
    return filtered;
  }, [activities, filter, limit]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, ActivityEvent[]> = {
      today: [],
      yesterday: [],
      earlier: []
    };

    filteredActivities.forEach(activity => {
      const date = parseISO(activity.timestamp);
      if (isToday(date)) {
        groups.today.push(activity);
      } else if (isYesterday(date)) {
        groups.yesterday.push(activity);
      } else {
        groups.earlier.push(activity);
      }
    });

    return groups;
  }, [filteredActivities]);

  // Mark single item as read
  const markAsRead = (id: string) => {
    setUnreadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Mark all as read
  const markAllAsRead = () => {
    setUnreadIds(new Set());
    onMarkAllRead?.();
  };

  // Get unread count
  const unreadCount = unreadIds.size;

  return (
    <div className={cn('flex flex-col h-full bg-white border rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Activity</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={markAllAsRead}
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-2 py-2 border-b overflow-x-auto">
        <FilterButton 
          active={filter === 'all'} 
          onClick={() => setFilter('all')}
          count={activities.length}
        >
          All
        </FilterButton>
        {(['assignment', 'unassignment', 'swap', 'comment'] as ActivityType[]).map(type => (
          <FilterButton
            key={type}
            active={filter === type}
            onClick={() => setFilter(type)}
            count={activities.filter(a => a.type === type).length}
          >
            {activityConfig[type].label}
          </FilterButton>
        ))}
      </div>

      {/* Activities List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {grouped.today.length > 0 && (
            <ActivityGroup
              title="Today"
              activities={grouped.today}
              unreadIds={unreadIds}
              onClick={onActivityClick}
              onRead={markAsRead}
            />
          )}
          
          {grouped.yesterday.length > 0 && (
            <ActivityGroup
              title="Yesterday"
              activities={grouped.yesterday}
              unreadIds={unreadIds}
              onClick={onActivityClick}
              onRead={markAsRead}
            />
          )}
          
          {grouped.earlier.length > 0 && (
            <ActivityGroup
              title="Earlier"
              activities={grouped.earlier}
              unreadIds={unreadIds}
              onClick={onActivityClick}
              onRead={markAsRead}
            />
          )}

          {filteredActivities.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activities yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Filter button component
function FilterButton({
  active,
  onClick,
  count,
  children
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
        active 
          ? 'bg-primary text-white' 
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {children}
      <span className={cn('ml-1', active ? 'text-white/70' : 'text-slate-400')}>
        {count}
      </span>
    </button>
  );
}

// Activity group component
interface ActivityGroupProps {
  title: string;
  activities: ActivityEvent[];
  unreadIds: Set<string>;
  onClick?: (activity: ActivityEvent) => void;
  onRead: (id: string) => void;
}

function ActivityGroup({ title, activities, unreadIds, onClick, onRead }: ActivityGroupProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
        {title}
      </h4>
      <div className="space-y-1">
        {activities.map(activity => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            isUnread={unreadIds.has(activity.id)}
            onClick={() => {
              onRead(activity.id);
              onClick?.(activity);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Individual activity card
interface ActivityCardProps {
  activity: ActivityEvent;
  isUnread: boolean;
  onClick: () => void;
}

function ActivityCard({ activity, isUnread, onClick }: ActivityCardProps) {
  const config = activityConfig[activity.type];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
        isUnread 
          ? 'bg-blue-50 hover:bg-blue-100' 
          : 'hover:bg-slate-50'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        config.bgColor,
        config.color
      )}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 leading-snug">
          <span className="font-medium">{activity.userName}</span>{' '}
          {activity.description}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}
        </p>

        {/* Metadata if available */}
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {activity.metadata.slotDate && (
              <Badge variant="outline" className="text-[10px]">
                {format(parseISO(activity.metadata.slotDate as string), 'MMM d')}
              </Badge>
            )}
            {activity.metadata.providerName && (
              <Badge variant="outline" className="text-[10px]">
                {activity.metadata.providerName as string}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Unread indicator */}
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
      )}
    </button>
  );
}

// Compact activity indicator for headers
interface ActivityIndicatorProps {
  count: number;
  onClick?: () => void;
}

export function ActivityIndicator({ count, onClick }: ActivityIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-2 rounded-lg transition-colors',
        count > 0 ? 'hover:bg-slate-100' : 'opacity-50'
      )}
    >
      <RefreshCw className="w-5 h-5 text-slate-600" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

export default ActivityFeed;
