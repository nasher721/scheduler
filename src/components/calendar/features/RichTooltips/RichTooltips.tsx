/**
 * RichTooltips Component
 * 
 * Enhanced contextual tooltips with detailed information:
 * - Provider cards with workload and recent shifts
 * - Shift preview with impact analysis
 * - Availability preview
 * - Quick stats
 * 
 * Part of Phase 3: Visualization & Analytics
 */

import { useMemo } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import { format, parseISO, subWeeks, isAfter, differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  User,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Star,
  Activity,
  Shield,
  Moon,
  Sun,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShiftType } from '../../utils/accessibilityUtils';

// ============================================================================
// Provider Tooltip
// ============================================================================

interface ProviderTooltipProps {
  provider: Provider;
  children: React.ReactNode;
}

export function ProviderTooltip({ provider, children }: ProviderTooltipProps) {
  const { slots } = useScheduleStore();
  
  const stats = useMemo(() => {
    const providerSlots = slots.filter(s => s.providerId === provider.id);
    
    // Recent shifts (last 2 weeks)
    const twoWeeksAgo = subWeeks(new Date(), 2);
    const recentShifts = providerSlots
      .filter(s => isAfter(parseISO(s.date), twoWeeksAgo))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    
    // Weekly workload
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    
    const hoursThisWeek = providerSlots
      .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
      .reduce((sum, s) => sum + getShiftDuration(s.type), 0);
    
    const targetHours = (provider.targetWeekDays + provider.targetWeekendDays) * 8;
    const percentage = targetHours > 0 ? (hoursThisWeek / targetHours) * 100 : 0;
    
    // Weekend/night distribution
    const weekendShifts = providerSlots.filter(s => {
      const date = parseISO(s.date);
      return date.getDay() === 0 || date.getDay() === 6;
    }).length;
    
    const nightShifts = providerSlots.filter(s => s.type === 'NIGHT').length;
    
    // Check credentials
    const expiringCreds = provider.credentials?.filter(c => {
      if (!c.expiresAt) return false;
      return differenceInDays(parseISO(c.expiresAt), today) <= 30;
    }) || [];
    
    return {
      totalShifts: providerSlots.length,
      recentShifts,
      hoursThisWeek,
      percentage,
      targetHours,
      weekendShifts,
      nightShifts,
      expiringCreds
    };
  }, [provider, slots]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          align="start"
          className="w-80 p-0 bg-white border shadow-lg"
        >
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                {provider.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{provider.name}</p>
                <p className="text-sm text-slate-500">
                  {provider.skills.slice(0, 3).join(', ')}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {provider.credentials?.slice(0, 2).map(cred => (
                    <Badge key={cred.type} variant="outline" className="text-[10px]">
                      {cred.type}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekly Workload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  This Week
                </span>
                <span className={cn(
                  'font-semibold',
                  stats.percentage > 100 ? 'text-rose-600' :
                  stats.percentage > 80 ? 'text-amber-600' :
                  'text-emerald-600'
                )}>
                  {stats.hoursThisWeek}h / {stats.targetHours}h
                </span>
              </div>
              <Progress 
                value={Math.min(stats.percentage, 100)}
                className={cn(
                  'h-2',
                  stats.percentage > 100 ? 'bg-rose-100' :
                  stats.percentage > 80 ? 'bg-amber-100' :
                  'bg-emerald-100'
                )}
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-slate-50 rounded-lg">
                <p className="text-lg font-semibold text-slate-900">
                  {stats.totalShifts}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Total
                </p>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <p className="text-lg font-semibold text-slate-900">
                  {stats.weekendShifts}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Weekends
                </p>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <p className="text-lg font-semibold text-slate-900">
                  {stats.nightShifts}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Nights
                </p>
              </div>
            </div>

            {/* Recent Shifts */}
            {stats.recentShifts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Recent Shifts
                </p>
                <div className="space-y-1.5">
                  {stats.recentShifts.map(shift => (
                    <div key={shift.id} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400 text-xs w-16">
                        {format(parseISO(shift.date), 'MMM d')}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {shift.type}
                      </Badge>
                      <span className="text-slate-600 truncate">
                        {shift.serviceLocation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credential Alerts */}
            {stats.expiringCreds.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-700">
                    Credentials Expiring Soon
                  </p>
                  <p className="text-xs text-amber-600">
                    {stats.expiringCreds.map(c => c.type).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Shift Tooltip
// ============================================================================

interface ShiftTooltipProps {
  slot: ShiftSlot;
  assignedProvider?: Provider;
  children: React.ReactNode;
}

export function ShiftTooltip({ slot, assignedProvider, children }: ShiftTooltipProps) {
  const { providers, slots } = useScheduleStore();
  
  const impact = useMemo(() => {
    if (!assignedProvider) return null;
    
    const providerSlots = slots.filter(s => s.providerId === assignedProvider.id);
    const slotDate = parseISO(slot.date);
    
    // Calculate current workload
    const weekStart = startOfWeek(slotDate);
    const weekEnd = endOfWeek(slotDate);
    
    const currentHours = providerSlots
      .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
      .reduce((sum, s) => sum + getShiftDuration(s.type), 0);
    
    const newHours = currentHours + getShiftDuration(slot.type);
    const targetHours = (assignedProvider.targetWeekDays + assignedProvider.targetWeekendDays) * 8;
    
    // Check for conflicts
    const sameDayShift = providerSlots.find(s => s.date === slot.date);
    const consecutiveShifts = providerSlots.filter(s => {
      const daysDiff = Math.abs(differenceInDays(parseISO(s.date), slotDate));
      return daysDiff <= 1;
    }).length;
    
    return {
      currentHours,
      newHours,
      targetHours,
      percentage: (newHours / targetHours) * 100,
      hasConflict: !!sameDayShift,
      consecutiveCount: consecutiveShifts
    };
  }, [slot, assignedProvider, slots]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center"
          className="w-72 p-0 bg-white border shadow-lg"
        >
          <div className="p-4 space-y-3">
            {/* Shift Info */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {formatShiftType(slot.type)} Shift
                </p>
                <p className="text-sm text-slate-500">
                  {format(parseISO(slot.date), 'EEEE, MMMM do')}
                </p>
              </div>
              <Badge 
                variant="outline"
                className={cn(
                  slot.servicePriority === 'CRITICAL' ? 'border-rose-200 text-rose-600 bg-rose-50' :
                  slot.servicePriority === 'STANDARD' ? 'border-amber-200 text-amber-600 bg-amber-50' :
                  'border-slate-200 text-slate-600 bg-slate-50'
                )}
              >
                {slot.servicePriority}
              </Badge>
            </div>

            {/* Location & Details */}
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4" />
                {slot.serviceLocation}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4" />
                {getShiftDuration(slot.type)} hours
              </div>
              {slot.requiredSkill && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Shield className="w-4 h-4" />
                  Requires: {slot.requiredSkill}
                </div>
              )}
            </div>

            {/* Assignment Impact */}
            {impact && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Assignment Impact on {assignedProvider.name.split(' ')[0]}
                </p>
                
                {/* Workload Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Weekly Hours</span>
                    <span className={cn(
                      'font-medium',
                      impact.percentage > 100 ? 'text-rose-600' :
                      impact.percentage > 80 ? 'text-amber-600' :
                      'text-emerald-600'
                    )}>
                      {impact.currentHours}h → {impact.newHours}h
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        'h-full rounded-full transition-all',
                        impact.percentage > 100 ? 'bg-rose-500' :
                        impact.percentage > 80 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(impact.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Warnings */}
                {impact.hasConflict && (
                  <div className="flex items-center gap-2 text-xs text-rose-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Already scheduled this day
                  </div>
                )}
                
                {impact.consecutiveCount >= 3 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {impact.consecutiveCount} consecutive shifts
                  </div>
                )}

                {impact.percentage <= 100 && !impact.hasConflict && impact.consecutiveCount < 3 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Good fit
                  </div>
                )}
              </div>
            )}

            {/* Unassigned Notice */}
            {!assignedProvider && (
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-sm text-rose-700">
                    {slot.servicePriority === 'CRITICAL' ? 'Critical shift unfilled' : 'Shift needs coverage'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Date Tooltip
// ============================================================================

interface DateTooltipProps {
  date: Date;
  slots: ShiftSlot[];
  children: React.ReactNode;
}

export function DateTooltip({ date, slots, children }: DateTooltipProps) {
  const stats = useMemo(() => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySlots = slots.filter(s => s.date === dateStr);
    
    return {
      total: daySlots.length,
      filled: daySlots.filter(s => s.providerId).length,
      byType: daySlots.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [date, slots]);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="p-3 bg-white border shadow-lg"
        >
          <div className="space-y-2">
            <p className="font-semibold">
              {format(date, 'EEEE, MMMM do')}
            </p>
            
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">
                {stats.filled}/{stats.total} filled
              </span>
              <div className="h-4 w-px bg-slate-200" />
              <span className={cn(
                'font-medium',
                stats.filled === stats.total ? 'text-emerald-600' :
                stats.filled >= stats.total * 0.8 ? 'text-amber-600' :
                'text-rose-600'
              )}>
                {Math.round((stats.filled / stats.total) * 100)}%
              </span>
            </div>

            {Object.entries(stats.byType).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-[10px]">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Helper function
function getShiftDuration(type: string): number {
  const durations: Record<string, number> = {
    DAY: 12, NIGHT: 12, NMET: 12, JEOPARDY: 8,
    RECOVERY: 8, CONSULTS: 8, VACATION: 0
  };
  return durations[type] || 8;
}
