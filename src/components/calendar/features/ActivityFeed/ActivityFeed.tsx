/**
 * ActivityFeed Component
 * 
 * Real-time activity feed showing schedule changes, assignments, and events.
 * Provides audit trail and recent changes overview.
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import type { ActivityEvent } from '@/types/calendar';
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Activity,
  UserPlus,
  UserMinus,
  Edit3,
  MessageSquare,
  ArrowRightLeft,
  FileText,
  CheckCircle2,
  X,
  Filter,
  ChevronDown,
  Bell,
  RotateCcw,
  Calendar,
  Clock
} from 'lucide-react';

interface ActivityFeedProps {
  className?: string;
  maxItems?: number;
  showFilter?: boolean;
}

// Mock activity data
const MOCK_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act-1',
    type: 'assignment',
    userId: 'user-1',
    userName: 'Dr. Sarah Chen',
    description: 'assigned Dr. Michael Ross to Night shift',
    slotId: 'slot-1',
    providerId: 'provider-2',
    timestamp: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: 'act-2',
    type: 'unassignment',
    userId: 'user-1',
    userName: 'Dr. Sarah Chen',
    description: 'removed assignment from Day shift',
    slotId: 'slot-2',
    timestamp: new Date(Date.now() - 600000).toISOString()
  },
  {
    id: 'act-3',
    type: 'edit',
    userId: 'user-2',
    userName: 'Dr. Michael Ross',
    description: 'updated shift location to MICU',
    slotId: 'slot-3',
    timestamp: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'act-4',
    type: 'swap',
    userId: 'user-3',
    userName: 'Dr. Emily Wang',
    description: 'requested swap with Dr. John Smith',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'act-5',
    type: 'comment',
    userId: 'user-1',
    userName: 'Dr. Sarah Chen',
    description: 'commented on Friday Night shift',
    slotId: 'slot-5',
    timestamp: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'act-6',
    type: 'template_applied',
    userId: 'user-1',
    userName: 'Dr. Sarah Chen',
    description: 'applied "Standard Week" template',
    timestamp: new Date(Date.now() - 86400000).toISOString()
  }
];

const ACTIVITY_ICONS = {
  assignment: { icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  unassignment: { icon: UserMinus, color: 'text-rose-500', bg: 'bg-rose-50' },
  edit: { icon: Edit3, color: 'text-blue-500', bg: 'bg-blue-50' },
  comment: { icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-50' },
  swap: { icon: ArrowRightLeft, color: 'text-amber-500', bg: 'bg-amber-50' },
  template_applied: { icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-50' }
};

export function ActivityFeed({ className, maxItems = 50, showFilter = true }: ActivityFeedProps) {
  const { slots, providers } = useScheduleStore();
  const [activities, setActivities] = useState<ActivityEvent[]>(MOCK_ACTIVITIES);
  const [filter, setFilter] = useState<ActivityEvent['type'] | 'all'>('all');
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    if (filter !== 'all') {
      filtered = activities.filter(a => a.type === filter);
    }
    
    return filtered.slice(0, maxItems);
  }, [activities, filter, maxItems]);

  // Group by date
  const groupedActivities = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>();
    
    filteredActivities.forEach(activity => {
      const date = parseISO(activity.timestamp);
      let key: string;
      
      if (isToday(date)) {
        key = 'Today';
      } else if (isYesterday(date)) {
        key = 'Yesterday';
      } else {
        key = format(date, 'MMMM d, yyyy');
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(activity);
    });
    
    return groups;
  }, [filteredActivities]);

  // Load more activities
  const loadMore = () => {
    // TODO: Fetch more from API
    console.log('Loading more activities...');
  };

  // Clear all activities
  const clearAll = () => {
    if (confirm('Clear all activity history?')) {
      setActivities([]);
    }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Activity Feed
            <Badge variant="secondary" className="text-xs">
              {filteredActivities.length}
            </Badge>
          </CardTitle>
          
          {showFilter && (
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="text-xs border rounded-md px-2 py-1 bg-white"
              >
                <option value="all">All</option>
                <option value="assignment">Assignments</option>
                <option value="unassignment">Unassignments</option>
                <option value="edit">Edits</option>
                <option value="comment">Comments</option>
                <option value="swap">Swaps</option>
              </select>
              
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearAll}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-6">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No activity yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Changes to the schedule will appear here
                </p>
              </div>
            ) : (
              Array.from(groupedActivities.entries()).map(([date, items]) => (
                <div key={date}>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3 sticky top-0 bg-white py-2">
                    {date}
                  </h4>
                  <div className="space-y-3">
                    {items.map(activity => (
                      <ActivityItem 
                        key={activity.id} 
                        activity={activity}
                        onClick={() => {
                          // TODO: Navigate to related slot or show details
                          console.log('Clicked activity:', activity);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
            
            {hasMore && filteredActivities.length >= maxItems && (
              <div className="text-center pt-4">
                <Button variant="ghost" size="sm" onClick={loadMore}>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Load more
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Individual activity item
function ActivityItem({ 
  activity, 
  onClick 
}: { 
  activity: ActivityEvent; 
  onClick?: () => void;
}) {
  const config = ACTIVITY_ICONS[activity.type];
  const Icon = config.icon;
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer',
        'hover:bg-slate-50 border border-transparent hover:border-slate-100'
      )}
    >
      {/* Icon */}
      <div className={cn('p-2 rounded-lg flex-shrink-0', config.bg)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-slate-900 leading-relaxed">
            <span className="font-medium">{activity.userName}</span>{' '}
            <span className="text-slate-600">{activity.description}</span>
          </p>
          <time className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
            {formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}
          </time>
        </div>
        
        {/* Metadata */}
        {(activity.slotId || activity.providerId) && (
          <div className="flex items-center gap-2 mt-2">
            {activity.providerId && (
              <Badge variant="outline" className="text-[10px]">
                <UserPlus className="w-3 h-3 mr-1" />
                Provider
              </Badge>
            )}
            {activity.slotId && (
              <Badge variant="outline" className="text-[10px]">
                <Calendar className="w-3 h-3 mr-1" />
                Shift
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact activity indicator for toolbar
export function ActivityIndicator({ className }: { className?: string }) {
  const [unreadCount, setUnreadCount] = useState(3);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 z-50">
          <ActivityFeed maxItems={5} showFilter={false} />
        </div>
      )}
    </div>
  );
}

// Activity summary for dashboard
export function ActivitySummary({ className }: { className?: string }) {
  const activities = MOCK_ACTIVITIES;
  
  const stats = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return {
      today: activities.filter(a => parseISO(a.timestamp) >= todayStart).length,
      assignments: activities.filter(a => a.type === 'assignment').length,
      edits: activities.filter(a => a.type === 'edit').length,
      comments: activities.filter(a => a.type === 'comment').length
    };
  }, [activities]);

  return (
    <div className={cn('grid grid-cols-4 gap-4', className)}>
      <div className="text-center p-3 bg-slate-50 rounded-lg">
        <p className="text-2xl font-bold text-slate-900">{stats.today}</p>
        <p className="text-xs text-slate-500">Today</p>
      </div>
      <div className="text-center p-3 bg-emerald-50 rounded-lg">
        <p className="text-2xl font-bold text-emerald-600">{stats.assignments}</p>
        <p className="text-xs text-slate-500">Assignments</p>
      </div>
      <div className="text-center p-3 bg-blue-50 rounded-lg">
        <p className="text-2xl font-bold text-blue-600">{stats.edits}</p>
        <p className="text-xs text-slate-500">Edits</p>
      </div>
      <div className="text-center p-3 bg-violet-50 rounded-lg">
        <p className="text-2xl font-bold text-violet-600">{stats.comments}</p>
        <p className="text-xs text-slate-500">Comments</p>
      </div>
    </div>
  );
}

// Hook for activity tracking
export function useActivityFeed() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  const addActivity = (activity: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const newActivity: ActivityEvent = {
      ...activity,
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    
    setActivities(prev => [newActivity, ...prev]);
  };

  return {
    activities,
    addActivity
  };
}
