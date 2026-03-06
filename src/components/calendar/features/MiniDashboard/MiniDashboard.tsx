/**
 * MiniDashboard Component
 * 
 * Compact dashboard widgets for the calendar:
 * - Daily coverage scorecard
 * - Provider workload mini-charts
 * - Critical unfilled alerts
 * - Priority breakdown visualization
 * 
 * Part of Phase 3: Visualization & Analytics
 */

import { useMemo } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider, type ServicePriority } from '@/store';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle2,
  Users,
  Clock,
  TrendingUp,
  Calendar,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoverageStats } from '@/types/calendar';

interface MiniDashboardProps {
  className?: string;
}

export function MiniDashboard({ className }: MiniDashboardProps) {
  const { slots, providers } = useScheduleStore();

  // Calculate overall coverage stats
  const coverageStats = useMemo<CoverageStats>(() => {
    const byPriority: Record<ServicePriority, { required: number; filled: number }> = {
      CRITICAL: { required: 0, filled: 0 },
      STANDARD: { required: 0, filled: 0 },
      FLEXIBLE: { required: 0, filled: 0 }
    };

    slots.forEach(slot => {
      byPriority[slot.servicePriority].required++;
      if (slot.providerId) {
        byPriority[slot.servicePriority].filled++;
      }
    });

    const totalFilled = Object.values(byPriority).reduce((sum, p) => sum + p.filled, 0);
    const totalRequired = Object.values(byPriority).reduce((sum, p) => sum + p.required, 0);

    return {
      date: format(new Date(), 'yyyy-MM-dd'),
      byPriority: {
        CRITICAL: {
          ...byPriority.CRITICAL,
          score: byPriority.CRITICAL.required > 0 
            ? (byPriority.CRITICAL.filled / byPriority.CRITICAL.required) * 100 
            : 100
        },
        STANDARD: {
          ...byPriority.STANDARD,
          score: byPriority.STANDARD.required > 0 
            ? (byPriority.STANDARD.filled / byPriority.STANDARD.required) * 100 
            : 100
        },
        FLEXIBLE: {
          ...byPriority.FLEXIBLE,
          score: byPriority.FLEXIBLE.required > 0 
            ? (byPriority.FLEXIBLE.filled / byPriority.FLEXIBLE.required) * 100 
            : 100
        }
      },
      overall: {
        filled: totalFilled,
        total: totalRequired,
        percentage: totalRequired > 0 ? (totalFilled / totalRequired) * 100 : 0
      },
      alerts: []
    };
  }, [slots]);

  // Calculate provider workload stats
  const providerWorkloads = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);

    return providers.map(provider => {
      const providerSlots = slots.filter(s => 
        s.providerId === provider.id &&
        isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd })
      );

      const hours = providerSlots.reduce((sum, slot) => {
        const duration: Record<string, number> = {
          DAY: 12, NIGHT: 12, NMET: 12, JEOPARDY: 8,
          RECOVERY: 8, CONSULTS: 8, VACATION: 0
        };
        return sum + (duration[slot.type] || 8);
      }, 0);

      const targetHours = (provider.targetWeekDays + provider.targetWeekendDays) * 8;
      const percentage = targetHours > 0 ? (hours / targetHours) * 100 : 0;

      return {
        provider,
        hours,
        targetHours,
        percentage,
        shiftCount: providerSlots.length
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [slots, providers]);

  // Get critical unfilled shifts
  const criticalUnfilled = useMemo(() => {
    return slots
      .filter(s => s.servicePriority === 'CRITICAL' && !s.providerId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [slots]);

  // Get upcoming shifts needing coverage
  const upcomingUnfilled = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return slots
      .filter(s => !s.providerId && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [slots]);

  return (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        {/* Coverage Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Coverage Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Overall Coverage</span>
                <span className="font-semibold">
                  {Math.round(coverageStats.overall.percentage)}%
                </span>
              </div>
              <Progress 
                value={coverageStats.overall.percentage} 
                className={cn(
                  coverageStats.overall.percentage < 50 ? 'bg-rose-100' :
                  coverageStats.overall.percentage < 80 ? 'bg-amber-100' :
                  'bg-emerald-100'
                )}
              />
              <p className="text-xs text-slate-500">
                {coverageStats.overall.filled} of {coverageStats.overall.total} shifts filled
              </p>
            </div>

            {/* Priority Breakdown */}
            <div className="space-y-2">
              {(['CRITICAL', 'STANDARD', 'FLEXIBLE'] as ServicePriority[]).map(priority => {
                const stat = coverageStats.byPriority[priority];
                if (stat.required === 0) return null;
                
                return (
                  <Tooltip key={priority}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          priority === 'CRITICAL' ? 'bg-rose-500' :
                          priority === 'STANDARD' ? 'bg-amber-500' :
                          'bg-slate-400'
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-600">{priority}</span>
                            <span className={cn(
                              'font-medium',
                              priority === 'CRITICAL' && stat.score < 100 ? 'text-rose-600' :
                              'text-slate-900'
                            )}>
                              {stat.filled}/{stat.required}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                'h-full rounded-full transition-all',
                                priority === 'CRITICAL' ? 'bg-rose-500' :
                                priority === 'STANDARD' ? 'bg-amber-500' :
                                'bg-slate-400'
                              )}
                              style={{ width: `${stat.score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{Math.round(stat.score)}% coverage</p>
                      <p className="text-xs text-slate-400">
                        {stat.required - stat.filled} unfilled
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Critical Unfilled Alert */}
        {criticalUnfilled.length > 0 && (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-4 h-4" />
                Critical Unfilled ({criticalUnfilled.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {criticalUnfilled.map(slot => (
                  <div 
                    key={slot.id}
                    className="flex items-center justify-between p-2 bg-white rounded border border-rose-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {format(parseISO(slot.date), 'MMM d')} - {slot.type}
                      </p>
                      <p className="text-xs text-slate-500">{slot.serviceLocation}</p>
                    </div>
                    <Badge variant="outline" className="border-rose-200 text-rose-600">
                      Unfilled
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Provider Workload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Weekly Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {providerWorkloads.slice(0, 5).map(({ provider, hours, percentage, shiftCount }) => (
                <Tooltip key={provider.id}>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-semibold">
                            {provider.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-700 truncate max-w-[100px]">
                            {provider.name.split(' ')[0]}
                          </span>
                        </div>
                        <span className={cn(
                          'font-medium',
                          percentage > 100 ? 'text-rose-600' :
                          percentage > 80 ? 'text-amber-600' :
                          'text-emerald-600'
                        )}>
                          {hours}h
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            'h-full rounded-full transition-all',
                            percentage > 100 ? 'bg-rose-500' :
                            percentage > 80 ? 'bg-amber-500' :
                            'bg-emerald-500'
                          )}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-xs text-slate-400">
                      {hours} hours • {shiftCount} shifts
                    </p>
                    <p className="text-xs text-slate-400">
                      {Math.round(percentage)}% of target
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
              
              {providerWorkloads.length > 5 && (
                <p className="text-xs text-slate-400 text-center">
                  +{providerWorkloads.length - 5} more providers
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Unfilled */}
        {upcomingUnfilled.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Need Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingUnfilled.map(slot => (
                  <div 
                    key={slot.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded border',
                      slot.servicePriority === 'CRITICAL' 
                        ? 'bg-rose-50 border-rose-100' 
                        : 'bg-slate-50 border-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        slot.servicePriority === 'CRITICAL' ? 'bg-rose-500' :
                        slot.servicePriority === 'STANDARD' ? 'bg-amber-500' :
                        'bg-slate-400'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {format(parseISO(slot.date), 'MMM d')}
                        </p>
                        <p className="text-xs text-slate-500">{slot.type}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {slot.serviceLocation}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

// Compact version for toolbar integration
export function CompactCoverageIndicator({ className }: { className?: string }) {
  const { slots } = useScheduleStore();
  
  const stats = useMemo(() => {
    const critical = slots.filter(s => s.servicePriority === 'CRITICAL');
    const criticalUnfilled = critical.filter(s => !s.providerId).length;
    const totalFilled = slots.filter(s => s.providerId).length;
    const total = slots.length;
    
    return { criticalUnfilled, totalFilled, total };
  }, [slots]);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {stats.criticalUnfilled > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-xs font-medium text-rose-700">
            {stats.criticalUnfilled} critical
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-slate-700">
          {stats.totalFilled}/{stats.total}
        </span>
      </div>
    </div>
  );
}

// Daily coverage card (for sidebar)
export function DailyCoverageCard({ date }: { date: Date }) {
  const { slots } = useScheduleStore();
  
  const stats = useMemo(() => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySlots = slots.filter(s => s.date === dateStr);
    
    return {
      total: daySlots.length,
      filled: daySlots.filter(s => s.providerId).length,
      critical: daySlots.filter(s => s.servicePriority === 'CRITICAL'),
      criticalUnfilled: daySlots.filter(s => s.servicePriority === 'CRITICAL' && !s.providerId).length
    };
  }, [slots, date]);

  const percentage = stats.total > 0 ? (stats.filled / stats.total) * 100 : 0;

  return (
    <div className={cn(
      'p-3 rounded-lg border',
      stats.criticalUnfilled > 0 ? 'bg-rose-50 border-rose-200' :
      percentage < 80 ? 'bg-amber-50 border-amber-200' :
      'bg-emerald-50 border-emerald-200'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {format(date, 'EEEE, MMM d')}
        </span>
        <span className={cn(
          'text-sm font-semibold',
          stats.criticalUnfilled > 0 ? 'text-rose-600' :
          percentage < 80 ? 'text-amber-600' :
          'text-emerald-600'
        )}>
          {Math.round(percentage)}%
        </span>
      </div>
      
      <div className="space-y-1">
        <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all',
              stats.criticalUnfilled > 0 ? 'bg-rose-500' :
              percentage < 80 ? 'bg-amber-500' :
              'bg-emerald-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {stats.filled}/{stats.total} filled
          </span>
          {stats.criticalUnfilled > 0 && (
            <span className="text-rose-600 font-medium">
              {stats.criticalUnfilled} critical unfilled
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
