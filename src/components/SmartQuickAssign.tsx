import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type ShiftSlot, type Provider } from "../store";
import { parseISO, addDays } from "date-fns";
import { 
  UserPlus, 
  Check, 
  AlertCircle,
  Target,
  TrendingUp,
  Award,
  X
} from "lucide-react";

interface SmartQuickAssignProps {
  slot: ShiftSlot;
  onAssign?: (providerId: string) => void;
}

interface ProviderMatch {
  provider: Provider;
  score: number;
  reason: string;
  isUnderTarget: boolean;
  weeklyLoad: {
    days: number;
    nights: number;
    targetDays: number;
    targetNights: number;
  };
}

export function SmartQuickAssign({ slot, onAssign }: SmartQuickAssignProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { providers, slots, assignShift } = useScheduleStore();

  const matches = useMemo((): ProviderMatch[] => {
    // Get all slots for the current week to calculate load
    const slotDate = parseISO(slot.date);
    const weekStart = addDays(slotDate, -slotDate.getDay() + 1); // Monday
    const weekEnd = addDays(weekStart, 6);
    
    const weekSlots = slots.filter(s => {
      const sDate = parseISO(s.date);
      return sDate >= weekStart && sDate <= weekEnd && s.providerId;
    });
    
    // Helper function to check if provider can be assigned
    const checkCanAssign = (provider: Provider): { canAssign: boolean; reason?: string } => {
      // Check time off
      if (provider.timeOffRequests.some(r => r.date === slot.date)) {
        return { canAssign: false, reason: "Time off" };
      }
      // Check skills
      if (!provider.skills.includes(slot.requiredSkill)) {
        return { canAssign: false, reason: "Missing skill" };
      }
      return { canAssign: true };
    };

    return providers
      .map((provider): ProviderMatch | null => {
        // Check basic eligibility
        const canAssign = checkCanAssign(provider);
        if (!canAssign.canAssign) return null;

        // Calculate weekly load
        const providerWeekSlots = weekSlots.filter(s => s.providerId === provider.id);
        const weekDays = providerWeekSlots.filter(s => s.type === "DAY").length;
        const weekNights = providerWeekSlots.filter(s => s.type === "NIGHT").length;

        // Determine if under target
        const isDayShift = slot.type === "DAY";
        const isWeekend = slot.isWeekendLayout;
        
        let isUnderTarget = false;
        
        if (isDayShift && !isWeekend) {
          isUnderTarget = weekDays < provider.targetWeekDays;
        } else if (isDayShift && isWeekend) {
          isUnderTarget = weekDays < provider.targetWeekendDays;
        } else {
          isUnderTarget = weekNights < provider.targetWeekNights;
        }

        // Calculate score (0-100)
        let score = 50;
        let reason = "Eligible";

        if (isUnderTarget) {
          score += 30;
          reason = "Under target - great fit";
        }

        // Boost for providers with more availability
        const totalLoad = weekDays + weekNights;
        const totalTarget = provider.targetWeekDays + provider.targetWeekNights;
        if (totalLoad < totalTarget * 0.5) {
          score += 15;
        }

        // Preferred dates boost
        if (provider.preferredDates.includes(slot.date)) {
          score += 10;
          reason = "Preferred date!";
        }

        return {
          provider,
          score: Math.min(100, score),
          reason,
          isUnderTarget,
          weeklyLoad: {
            days: weekDays,
            nights: weekNights,
            targetDays: isWeekend ? provider.targetWeekendDays : provider.targetWeekDays,
            targetNights: provider.targetWeekNights,
          }
        };
      })
      .filter((m): m is ProviderMatch => m !== null)
      .sort((a, b) => b.score - a.score);
  }, [slot, providers, slots]);

  const topMatches = matches.slice(0, 5);
  const hasMatches = topMatches.length > 0;

  const handleAssign = (providerId: string) => {
    assignShift(slot.id, providerId);
    setIsOpen(false);
    onAssign?.(providerId);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
          hasMatches
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        <UserPlus className="w-3 h-3" />
        {hasMatches ? `${matches.length} available` : 'No matches'}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
            >
              {/* Header */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Quick Assign
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              {/* Provider List */}
              <div className="max-h-64 overflow-y-auto">
                {hasMatches ? (
                  <div className="divide-y divide-slate-100">
                    {topMatches.map((match) => (
                      <button
                        key={match.provider.id}
                        onClick={() => handleAssign(match.provider.id)}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {match.provider.name.charAt(0).toUpperCase()}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-900 truncate">
                                {match.provider.name}
                              </span>
                              {match.score >= 80 && (
                                <div title="Great match!">
                                  <Award className="w-3.5 h-3.5 text-amber-500" />
                                </div>
                              )}
                            </div>
                            
                            {/* Score bar */}
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    match.score >= 80 ? 'bg-emerald-500' :
                                    match.score >= 60 ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${match.score}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {match.score}%
                              </span>
                            </div>
                            
                            {/* Details */}
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                              <span className={match.isUnderTarget ? 'text-emerald-600 font-medium' : ''}>
                                {slot.type === "DAY" 
                                  ? `${match.weeklyLoad.days}/${match.weeklyLoad.targetDays} days`
                                  : `${match.weeklyLoad.nights}/${match.weeklyLoad.targetNights} nights`
                                }
                              </span>
                              <span>•</span>
                              <span className="truncate">{match.reason}</span>
                            </div>
                          </div>
                          
                          {/* Assign icon */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-1 bg-emerald-100 text-emerald-600 rounded">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No eligible providers</p>
                    <p className="text-xs text-slate-400 mt-1">
                      All providers have conflicts or are at capacity
                    </p>
                  </div>
                )}
              </div>

              {/* Footer hint */}
              {hasMatches && (
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                  Click provider to assign immediately
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ProviderWorkloadBadgeProps {
  providerId: string;
  slot: ShiftSlot;
}

export function ProviderWorkloadBadge({ providerId, slot }: ProviderWorkloadBadgeProps) {
  const { providers, slots } = useScheduleStore();
  const provider = providers.find(p => p.id === providerId);
  
  if (!provider) return null;

  // Calculate current load
  const providerSlots = slots.filter(s => s.providerId === provider.id);
  const weekDays = providerSlots.filter(s => s.type === "DAY" && !s.isWeekendLayout).length;
  const weekendDays = providerSlots.filter(s => s.type === "DAY" && s.isWeekendLayout).length;
  const weekNights = providerSlots.filter(s => s.type === "NIGHT" && !s.isWeekendLayout).length;
  const weekendNights = providerSlots.filter(s => s.type === "NIGHT" && s.isWeekendLayout).length;

  // Determine status for this shift type
  const isDayShift = slot.type === "DAY";
  const isWeekend = slot.isWeekendLayout;

  let current = 0;
  let target = 0;
  let label = "";

  if (isDayShift && !isWeekend) {
    current = weekDays;
    target = provider.targetWeekDays;
    label = "Week Days";
  } else if (isDayShift && isWeekend) {
    current = weekendDays;
    target = provider.targetWeekendDays;
    label = "Wknd Days";
  } else {
    current = weekNights + weekendNights;
    target = provider.targetWeekNights;
    label = "FTE Nights";
  }

  const percentage = target > 0 ? (current / target) * 100 : 0;
  
  let colorClass = "bg-emerald-100 text-emerald-700";
  if (percentage >= 100) {
    colorClass = "bg-rose-100 text-rose-700";
  } else if (percentage >= 80) {
    colorClass = "bg-amber-100 text-amber-700";
  }

  return (
    <div 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${colorClass}`}
      title={`${label}: ${current}/${target} (${Math.round(percentage)}%)`}
    >
      <Target className="w-3 h-3" />
      {current}/{target}
    </div>
  );
}

interface WorkloadHeatmapToggleProps {
  isActive: boolean;
  onToggle: () => void;
}

export function WorkloadHeatmapToggle({ isActive, onToggle }: WorkloadHeatmapToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        isActive
          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
      }`}
    >
      <TrendingUp className="w-3.5 h-3.5" />
      {isActive ? 'Hide Workload' : 'Show Workload'}
    </button>
  );
}
