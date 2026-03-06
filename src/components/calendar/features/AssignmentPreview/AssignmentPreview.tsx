/**
 * AssignmentPreview Component
 * 
 * Shows detailed analysis before confirming a shift assignment.
 * Displays warnings, conflicts, workload impact, and skill matching.
 * Part of Phase 2: Shift Management
 */

import { useState, useMemo } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import type { AssignmentAnalysis } from '@/types/calendar';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, isAfter, subWeeks, differenceInDays } from 'date-fns';
import { generateShiftAriaLabel } from '../../utils/accessibilityUtils';
import { useAnnounce } from '../../hooks/useAnnounce';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  User,
  Clock,
  Calendar,
  AlertCircle,
  TrendingUp,
  Shield,
  Zap,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignmentPreviewProps {
  slot: ShiftSlot;
  provider: Provider;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function AssignmentPreview({
  slot,
  provider,
  isOpen,
  onClose,
  onConfirm
}: AssignmentPreviewProps) {
  const { slots, assignShift } = useScheduleStore();
  const { announceAssignment } = useAnnounce();
  const [isConfirming, setIsConfirming] = useState(false);

  // Perform assignment analysis
  const analysis: AssignmentAnalysis = useMemo(() => {
    const warnings: string[] = [];
    const conflicts: string[] = [];

    // Get provider's existing shifts
    const providerSlots = slots.filter(s => s.providerId === provider.id);
    const slotDate = parseISO(slot.date);

    // Check consecutive shifts
    const consecutiveShifts = providerSlots.filter(s => {
      const sDate = parseISO(s.date);
      const daysDiff = Math.abs(differenceInDays(sDate, slotDate));
      return daysDiff <= 1;
    });

    if (consecutiveShifts.length >= 3) {
      warnings.push(`Provider has ${consecutiveShifts.length} consecutive shifts scheduled`);
    }

    // Check max consecutive nights
    if (slot.type === 'NIGHT') {
      const recentNights = providerSlots.filter(s => {
        if (s.type !== 'NIGHT') return false;
        const sDate = parseISO(s.date);
        return isAfter(slotDate, subWeeks(sDate, 1)) && isAfter(sDate, subWeeks(slotDate, 1));
      });

      if (recentNights.length >= provider.maxConsecutiveNights) {
        conflicts.push(`Exceeds max consecutive nights (${provider.maxConsecutiveNights})`);
      }

      // Check rest after night
      const lastNight = recentNights
        .filter(s => parseISO(s.date) < slotDate)
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];

      if (lastNight) {
        const daysSinceLastNight = differenceInDays(slotDate, parseISO(lastNight.date));
        if (daysSinceLastNight < provider.minDaysOffAfterNight) {
          conflicts.push(`Only ${daysSinceLastNight} days since last night shift (min: ${provider.minDaysOffAfterNight})`);
        }
      }
    }

    // Check credentials
    if (provider.credentials) {
      const expiredCreds = provider.credentials.filter(c => {
        if (!c.expiresAt) return false;
        return isAfter(slotDate, parseISO(c.expiresAt));
      });

      if (expiredCreds.length > 0) {
        conflicts.push(`Expired credentials: ${expiredCreds.map(c => c.type).join(', ')}`);
      }

      const expiringSoon = provider.credentials.filter(c => {
        if (!c.expiresAt) return false;
        const daysUntilExpiry = differenceInDays(parseISO(c.expiresAt), slotDate);
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
      });

      if (expiringSoon.length > 0) {
        warnings.push(`Credentials expiring soon: ${expiringSoon.map(c => c.type).join(', ')}`);
      }
    }

    // Calculate workload
    const weekStart = startOfWeek(slotDate);
    const weekEnd = endOfWeek(slotDate);

    const hoursThisWeek = providerSlots
      .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
      .reduce((sum, s) => sum + getShiftDuration(s.type), 0);

    const hoursAfter = hoursThisWeek + getShiftDuration(slot.type);
    const targetHours = provider.targetWeekDays * 8; // Approximate

    // Workload warnings
    if (hoursAfter > targetHours * 1.2) {
      warnings.push(`Assignment exceeds target hours by ${Math.round((hoursAfter / targetHours - 1) * 100)}%`);
    }

    // Skill matching
    const requiredSkills = slot.requiredSkill ? slot.requiredSkill.split(',').map(s => s.trim()) : [];
    const matchedSkills = requiredSkills.filter(skill => 
      provider.skills.some(ps => ps.toLowerCase() === skill.toLowerCase())
    );
    const missingSkills = requiredSkills.filter(skill => 
      !provider.skills.some(ps => ps.toLowerCase() === skill.toLowerCase())
    );

    if (slot.servicePriority === 'CRITICAL' && missingSkills.length > 0) {
      warnings.push(`Missing preferred skills for critical shift: ${missingSkills.join(', ')}`);
    }

    // Check for double booking
    const sameDayShifts = providerSlots.filter(s => s.date === slot.date);
    if (sameDayShifts.length > 0) {
      conflicts.push(`Already scheduled for ${format(parseISO(slot.date), 'MMMM do')}`);
    }

    return {
      warnings,
      conflicts,
      workload: {
        hoursThisWeek,
        hoursAfter,
        percentage: Math.min((hoursAfter / targetHours) * 100, 150),
        target: targetHours
      },
      skillMatch: {
        required: requiredSkills,
        matched: matchedSkills,
        missing: missingSkills,
        score: requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) * 100 : 100
      },
      availability: {
        hasTimeOff: false,
        consecutiveShifts: consecutiveShifts.length,
        restHours: 0
      }
    };
  }, [slot, provider, slots]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    
    try {
      await assignShift(slot.id, provider.id);
      announceAssignment(provider.name, slot.type, slot.date);
      onConfirm();
      onClose();
    } catch (error) {
      console.error('Assignment failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const hasBlockingConflicts = analysis.conflicts.length > 0;
  const workloadColor = analysis.workload.percentage > 100 ? 'text-rose-600' : 
                        analysis.workload.percentage > 80 ? 'text-amber-600' : 
                        'text-emerald-600';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Assignment Preview
          </DialogTitle>
          <DialogDescription>
            Review assignment details before confirming
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Provider & Shift Info */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                {provider.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                <p className="text-sm text-slate-500">
                  {formatShiftType(slot.type)} shift on {format(parseISO(slot.date), 'MMMM do, yyyy')}
                </p>
                <p className="text-sm text-slate-500">{slot.serviceLocation}</p>
              </div>
            </div>

            {/* Conflicts */}
            {analysis.conflicts.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-600">
                  <XCircle className="w-4 h-4" />
                  Blocking Conflicts ({analysis.conflicts.length})
                </h4>
                <div className="space-y-2">
                  {analysis.conflicts.map((conflict, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-rose-700">{conflict}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {analysis.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings ({analysis.warnings.length})
                </h4>
                <div className="space-y-2">
                  {analysis.warnings.map((warning, i) => (
                    <div 
                      key={i}
                      className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-amber-700">{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workload Impact */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <TrendingUp className="w-4 h-4" />
                Workload Impact
              </h4>
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">This Week</span>
                  <span className={cn('font-semibold', workloadColor)}>
                    {analysis.workload.hoursAfter}h / {analysis.workload.target}h
                  </span>
                </div>
                <div className="space-y-1">
                  <Progress 
                    value={Math.min(analysis.workload.percentage, 100)} 
                    className={cn(
                      analysis.workload.percentage > 100 ? 'bg-rose-100' :
                      analysis.workload.percentage > 80 ? 'bg-amber-100' :
                      'bg-emerald-100'
                    )}
                  />
                  <p className="text-xs text-slate-500 text-right">
                    {Math.round(analysis.workload.percentage)}% of weekly target
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-slate-600 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Current: {analysis.workload.hoursThisWeek}h
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    After: {analysis.workload.hoursAfter}h
                  </div>
                </div>
              </div>
            </div>

            {/* Skill Match */}
            {analysis.skillMatch.required.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Shield className="w-4 h-4" />
                  Skill Match
                </h4>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Match Score</span>
                    <Badge 
                      variant={analysis.skillMatch.score === 100 ? 'default' : 'secondary'}
                      className={cn(
                        analysis.skillMatch.score === 100 ? 'bg-emerald-500' :
                        analysis.skillMatch.score >= 50 ? 'bg-amber-500' :
                        'bg-rose-500'
                      )}
                    >
                      {Math.round(analysis.skillMatch.score)}%
                    </Badge>
                  </div>
                  
                  {analysis.skillMatch.matched.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysis.skillMatch.matched.map(skill => (
                        <Badge key={skill} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {analysis.skillMatch.missing.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysis.skillMatch.missing.map(skill => (
                        <Badge key={skill} variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All Good Message */}
            {analysis.warnings.length === 0 && analysis.conflicts.length === 0 && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-900">Ready to Assign</p>
                  <p className="text-sm text-emerald-700">
                    No conflicts or warnings detected
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={hasBlockingConflicts || isConfirming}
            className={cn(hasBlockingConflicts && 'opacity-50 cursor-not-allowed')}
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Confirm Assignment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to get shift duration
function getShiftDuration(type: string): number {
  const durations: Record<string, number> = {
    DAY: 12,
    NIGHT: 12,
    NMET: 12,
    JEOPARDY: 8,
    RECOVERY: 8,
    CONSULTS: 8,
    VACATION: 0
  };
  return durations[type] || 8;
}

// Quick assign button with preview
export function QuickAssignButton({
  slot,
  provider,
  onAssigned,
  className
}: {
  slot: ShiftSlot;
  provider: Provider;
  onAssigned?: () => void;
  className?: string;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowPreview(true)}
        className={className}
      >
        Assign
      </Button>
      <AssignmentPreview
        slot={slot}
        provider={provider}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={onAssigned || (() => {})}
      />
    </>
  );
}
