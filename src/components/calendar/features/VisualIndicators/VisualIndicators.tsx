/**
 * VisualIndicators Component
 * 
 * Enhanced visual indicators for the calendar:
 * - Continuity lines for consecutive shifts
 * - Fatigue risk warnings
 * - Credential expiration alerts
 * - Provider continuity highlighting
 * 
 * Part of Phase 3: Visualization & Analytics
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import { format, parseISO, differenceInDays, isWeekend, isSameDay, addDays } from 'date-fns';
import { AlertTriangle, AlertCircle, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualIndicatorsProps {
  slots: ShiftSlot[];
  providers: Provider[];
  containerRef: React.RefObject<HTMLElement>;
}

// Continuity line configuration
interface ContinuityGroup {
  providerId: string;
  providerName: string;
  providerColor: string;
  shifts: ShiftSlot[];
  isConsecutive: boolean;
}

// Fatigue risk configuration
interface FatigueRisk {
  providerId: string;
  providerName: string;
  riskLevel: 'high' | 'medium' | 'low';
  reasons: string[];
  slotIds: string[];
}

// Credential alert
interface CredentialAlert {
  providerId: string;
  providerName: string;
  credentialType: string;
  expiresAt: string;
  daysUntilExpiry: number;
  slotIds: string[];
}

export function VisualIndicators({ slots, providers, containerRef }: VisualIndicatorsProps) {
  // Calculate continuity groups
  const continuityGroups = useMemo<ContinuityGroup[]>(() => {
    const groups: ContinuityGroup[] = [];
    
    providers.forEach((provider, index) => {
      const providerSlots = slots
        .filter(s => s.providerId === provider.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      
      if (providerSlots.length < 2) return;
      
      // Find consecutive sequences
      let currentSequence: ShiftSlot[] = [providerSlots[0]];
      
      for (let i = 1; i < providerSlots.length; i++) {
        const prevDate = parseISO(providerSlots[i - 1].date);
        const currDate = parseISO(providerSlots[i].date);
        const daysDiff = differenceInDays(currDate, prevDate);
        
        if (daysDiff <= 1) {
          currentSequence.push(providerSlots[i]);
        } else {
          if (currentSequence.length >= 2) {
            groups.push({
              providerId: provider.id,
              providerName: provider.name,
              providerColor: getProviderColor(index),
              shifts: [...currentSequence],
              isConsecutive: true
            });
          }
          currentSequence = [providerSlots[i]];
        }
      }
      
      if (currentSequence.length >= 2) {
        groups.push({
          providerId: provider.id,
          providerName: provider.name,
          providerColor: getProviderColor(index),
          shifts: [...currentSequence],
          isConsecutive: true
        });
      }
    });
    
    return groups;
  }, [slots, providers]);

  // Calculate fatigue risks
  const fatigueRisks = useMemo<FatigueRisk[]>(() => {
    const risks: FatigueRisk[] = [];
    
    providers.forEach(provider => {
      const providerSlots = slots
        .filter(s => s.providerId === provider.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      
      if (providerSlots.length === 0) return;
      
      const reasons: string[] = [];
      const riskySlotIds: string[] = [];
      
      // Check consecutive shifts
      let consecutiveCount = 1;
      let nightCount = 0;
      
      for (let i = 1; i < providerSlots.length; i++) {
        const prevDate = parseISO(providerSlots[i - 1].date);
        const currDate = parseISO(providerSlots[i].date);
        const daysDiff = differenceInDays(currDate, prevDate);
        
        if (daysDiff <= 1) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
        }
        
        // Count consecutive nights
        if (providerSlots[i].type === 'NIGHT') {
          nightCount++;
        } else {
          nightCount = 0;
        }
        
        // Flag risky patterns
        if (consecutiveCount >= 5) {
          reasons.push(`${consecutiveCount} consecutive shifts`);
          riskySlotIds.push(providerSlots[i].id);
        }
        
        if (nightCount >= provider.maxConsecutiveNights) {
          reasons.push(`${nightCount} consecutive nights`);
          riskySlotIds.push(providerSlots[i].id);
        }
      }
      
      // Check total hours in week
      const weekWorkloads = calculateWeeklyWorkload(providerSlots);
      weekWorkloads.forEach((hours, weekKey) => {
        if (hours > 60) {
          reasons.push(`High workload: ${hours}h in one week`);
        }
      });
      
      if (reasons.length > 0) {
        const uniqueReasons = [...new Set(reasons)];
        const riskLevel: FatigueRisk['riskLevel'] = 
          uniqueReasons.some(r => r.includes('5') || r.includes('60')) ? 'high' :
          uniqueReasons.some(r => r.includes('4') || r.includes('50')) ? 'medium' : 'low';
        
        risks.push({
          providerId: provider.id,
          providerName: provider.name,
          riskLevel,
          reasons: uniqueReasons.slice(0, 3),
          slotIds: [...new Set(riskySlotIds)]
        });
      }
    });
    
    return risks;
  }, [slots, providers]);

  // Calculate credential alerts
  const credentialAlerts = useMemo<CredentialAlert[]>(() => {
    const alerts: CredentialAlert[] = [];
    const today = new Date();
    
    providers.forEach(provider => {
      if (!provider.credentials) return;
      
      provider.credentials.forEach(cred => {
        if (!cred.expiresAt) return;
        
        const expiryDate = parseISO(cred.expiresAt);
        const daysUntilExpiry = differenceInDays(expiryDate, today);
        
        // Alert if expiring within 30 days or already expired
        if (daysUntilExpiry <= 30) {
          const providerSlots = slots.filter(s => s.providerId === provider.id);
          
          alerts.push({
            providerId: provider.id,
            providerName: provider.name,
            credentialType: cred.type,
            expiresAt: cred.expiresAt,
            daysUntilExpiry,
            slotIds: providerSlots.map(s => s.id)
          });
        }
      });
    });
    
    return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [slots, providers]);

  // Get unique provider color
  function getProviderColor(index: number): string {
    const colors = [
      '#3B82F6', // blue
      '#8B5CF6', // violet
      '#EC4899', // pink
      '#F59E0B', // amber
      '#10B981', // emerald
      '#06B6D4', // cyan
      '#F97316', // orange
      '#6366F1', // indigo
    ];
    return colors[index % colors.length];
  }

  // Calculate weekly workload
  function calculateWeeklyWorkload(providerSlots: ShiftSlot[]): Map<string, number> {
    const weekWorkloads = new Map<string, number>();
    
    providerSlots.forEach(slot => {
      const date = parseISO(slot.date);
      const weekStart = format(date, 'yyyy-MM-dd');
      const current = weekWorkloads.get(weekStart) || 0;
      weekWorkloads.set(weekStart, current + getShiftDuration(slot.type));
    });
    
    return weekWorkloads;
  }

  // Get shift duration
  function getShiftDuration(type: string): number {
    const durations: Record<string, number> = {
      DAY: 12, NIGHT: 12, NMET: 12, JEOPARDY: 8,
      RECOVERY: 8, CONSULTS: 8, VACATION: 0
    };
    return durations[type] || 8;
  }

  return (
    <div className="visual-indicators">
      {/* Continuity Lines Overlay */}
      <ContinuityLinesOverlay groups={continuityGroups} />
      
      {/* Fatigue Risk Indicators */}
      <FatigueRiskOverlay risks={fatigueRisks} />
      
      {/* Credential Alerts */}
      <CredentialAlertOverlay alerts={credentialAlerts} />
    </div>
  );
}

// Continuity Lines SVG Overlay
function ContinuityLinesOverlay({ groups }: { groups: ContinuityGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <svg 
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {groups.map((group, index) => (
          <marker
            key={`marker-${index}`}
            id={`arrow-${index}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={group.providerColor} />
          </marker>
        ))}
      </defs>
      
      {groups.map((group, index) => (
        <g key={group.providerId}>
          {/* Draw connection line */}
          {group.shifts.slice(0, -1).map((shift, shiftIndex) => {
            const nextShift = group.shifts[shiftIndex + 1];
            
            return (
              <path
                key={`${shift.id}-${nextShift.id}`}
                d={`M ${getShiftX(shift)} ${getShiftY(shift)} 
                    Q ${getControlPointX(shift, nextShift)} ${getControlPointY(shift, nextShift)}
                    ${getShiftX(nextShift)} ${getShiftY(nextShift)}`}
                fill="none"
                stroke={group.providerColor}
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.6"
              />
            );
          })}
          
          {/* Provider label on first shift */}
          <foreignObject
            x={getShiftX(group.shifts[0]) - 50}
            y={getShiftY(group.shifts[0]) - 30}
            width="100"
            height="20"
          >
            <div 
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white text-center truncate"
              style={{ backgroundColor: group.providerColor }}
            >
              {group.providerName.split(' ')[0]}
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
}

// Helper functions for positioning (would need actual DOM measurements)
function getShiftX(shift: ShiftSlot): number {
  // Placeholder - would calculate based on DOM position
  return 100;
}

function getShiftY(shift: ShiftSlot): number {
  // Placeholder - would calculate based on DOM position
  return 100;
}

function getControlPointX(shift1: ShiftSlot, shift2: ShiftSlot): number {
  return (getShiftX(shift1) + getShiftX(shift2)) / 2;
}

function getControlPointY(shift1: ShiftSlot, shift2: ShiftSlot): number {
  return (getShiftY(shift1) + getShiftY(shift2)) / 2 + 30;
}

// Fatigue Risk Badges
function FatigueRiskOverlay({ risks }: { risks: FatigueRisk[] }) {
  if (risks.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-20 space-y-2 max-w-xs">
      {risks.slice(0, 3).map(risk => (
        <div
          key={risk.providerId}
          className={cn(
            'p-3 rounded-lg border shadow-sm',
            risk.riskLevel === 'high' ? 'bg-rose-50 border-rose-200' :
            risk.riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' :
            'bg-yellow-50 border-yellow-200'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={cn(
              'w-4 h-4',
              risk.riskLevel === 'high' ? 'text-rose-500' :
              risk.riskLevel === 'medium' ? 'text-amber-500' :
              'text-yellow-500'
            )} />
            <span className={cn(
              'font-medium text-sm',
              risk.riskLevel === 'high' ? 'text-rose-700' :
              risk.riskLevel === 'medium' ? 'text-amber-700' :
              'text-yellow-700'
            )}>
              {risk.providerName}
            </span>
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs capitalize',
                risk.riskLevel === 'high' ? 'border-rose-200 text-rose-600' :
                risk.riskLevel === 'medium' ? 'border-amber-200 text-amber-600' :
                'border-yellow-200 text-yellow-600'
              )}
            >
              {risk.riskLevel} Risk
            </Badge>
          </div>
          <ul className="space-y-0.5">
            {risk.reasons.map((reason, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      ))}
      
      {risks.length > 3 && (
        <div className="text-xs text-slate-500 text-center">
          +{risks.length - 3} more providers at risk
        </div>
      )}
    </div>
  );
}

// Credential Alerts Panel
function CredentialAlertOverlay({ alerts }: { alerts: CredentialAlert[] }) {
  const criticalAlerts = alerts.filter(a => a.daysUntilExpiry <= 7);
  const warningAlerts = alerts.filter(a => a.daysUntilExpiry > 7 && a.daysUntilExpiry <= 30);
  
  if (alerts.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-20">
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-2">
          {criticalAlerts.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-rose-500" />
                <span className="font-medium text-sm text-rose-700">
                  Expiring Credentials
                </span>
                <Badge variant="outline" className="border-rose-200 text-rose-600">
                  {criticalAlerts.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {criticalAlerts.slice(0, 2).map((alert, i) => (
                  <div key={i} className="text-xs text-rose-600">
                    {alert.providerName} - {alert.credentialType}
                    {' '}
                    <span className="font-medium">
                      ({alert.daysUntilExpiry <= 0 ? 'Expired' : `${alert.daysUntilExpiry} days`})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {warningAlerts.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm text-amber-700">
                  Credentials Expiring Soon
                </span>
                <Badge variant="outline" className="border-amber-200 text-amber-600">
                  {warningAlerts.length}
                </Badge>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Provider Continuity Badge (for shift cards)
export function ContinuityBadge({ 
  providerId, 
  slotDate,
  slots 
}: { 
  providerId: string; 
  slotDate: string;
  slots: ShiftSlot[];
}) {
  const { providers } = useScheduleStore();
  
  const isConsecutive = useMemo(() => {
    const providerSlots = slots
      .filter(s => s.providerId === providerId)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const currentIndex = providerSlots.findIndex(s => s.date === slotDate);
    if (currentIndex === -1) return false;
    
    // Check if previous or next shift is consecutive
    const hasPrevConsecutive = currentIndex > 0 && 
      differenceInDays(parseISO(slotDate), parseISO(providerSlots[currentIndex - 1].date)) === 1;
    const hasNextConsecutive = currentIndex < providerSlots.length - 1 &&
      differenceInDays(parseISO(providerSlots[currentIndex + 1].date), parseISO(slotDate)) === 1;
    
    return hasPrevConsecutive || hasNextConsecutive;
  }, [providerId, slotDate, slots]);
  
  if (!isConsecutive) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded">
      <Clock className="w-3 h-3" />
      Continuity
    </span>
  );
}

// Fatigue Risk Indicator (for shift cards)
export function FatigueRiskIndicator({
  providerId,
  slotId
}: {
  providerId: string;
  slotId: string;
}) {
  const { slots, providers } = useScheduleStore();
  
  const risk = useMemo(() => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return null;
    
    const providerSlots = slots
      .filter(s => s.providerId === providerId)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    let consecutiveCount = 1;
    let nightCount = 0;
    
    for (let i = 1; i < providerSlots.length; i++) {
      if (providerSlots[i].id === slotId) {
        // Count up to this slot
        const prevDate = parseISO(providerSlots[i - 1].date);
        const currDate = parseISO(providerSlots[i].date);
        
        if (differenceInDays(currDate, prevDate) <= 1) {
          consecutiveCount++;
        }
        
        if (providerSlots[i].type === 'NIGHT') {
          nightCount++;
        }
        
        if (consecutiveCount >= 5 || nightCount >= provider.maxConsecutiveNights) {
          return {
            level: consecutiveCount >= 5 || nightCount >= provider.maxConsecutiveNights ? 'high' : 'medium' as const,
            message: consecutiveCount >= 5 ? `${consecutiveCount} consecutive shifts` : `${nightCount} consecutive nights`
          };
        }
      }
    }
    
    return null;
  }, [providerId, slotId, slots, providers]);
  
  if (!risk) return null;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded',
      risk.level === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
    )}>
      <AlertTriangle className="w-3 h-3" />
      {risk.message}
    </span>
  );
}

// Credential Warning (for shift cards)
export function CredentialWarning({
  providerId
}: {
  providerId: string;
}) {
  const { providers } = useScheduleStore();
  
  const alert = useMemo(() => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider?.credentials) return null;
    
    const today = new Date();
    
    for (const cred of provider.credentials) {
      if (!cred.expiresAt) continue;
      
      const daysUntil = differenceInDays(parseISO(cred.expiresAt), today);
      
      if (daysUntil <= 30) {
        return {
          type: cred.type,
          daysUntil,
          isExpired: daysUntil <= 0
        };
      }
    }
    
    return null;
  }, [providerId, providers]);
  
  if (!alert) return null;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded',
      alert.isExpired ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
    )}>
      <Shield className="w-3 h-3" />
      {alert.type} {alert.isExpired ? 'Expired' : `${alert.daysUntil}d`}
    </span>
  );
}
