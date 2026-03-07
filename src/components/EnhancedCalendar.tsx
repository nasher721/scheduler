import { useState, useMemo } from "react";
import { useScheduleStore, type ShiftSlot, type Provider, type Conflict, type CalendarPresentationMode, type ShiftType, type ServicePriority } from "../store";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { format, parseISO, isToday, isWeekend, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth } from "date-fns";
import {
  GripVertical,
  Sun,
  Moon,
  AlertTriangle,
  Sparkles,
  Activity,
  Stethoscope,
  Calendar as CalendarIcon,
  Clock,
  User,
  Bot,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Grid3X3,
  List,
  CalendarDays,
  Clock4,
  StickyNote,
  ArrowRightLeft,
  CheckSquare,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShiftEditModal } from './ShiftEditModal';
import { useScheduleViewport } from './schedule/useScheduleViewport';
import { DayHandoffCard, DayHandoffIndicator } from './DayHandoffCard';
import { SmartQuickAssign, ProviderWorkloadBadge, WorkloadHeatmapToggle } from './SmartQuickAssign';
import { ShiftSwapBoard } from './ShiftSwapBoard';
import { ProviderAvailabilityPanel } from './ProviderAvailabilityPanel';
import { BulkAssignmentMode } from './BulkAssignmentMode';
import { CoverageAlertDashboard, AlertBadge } from './CoverageAlertDashboard';
import { ShiftHistoryView } from './ShiftHistoryView';
import { PrintScheduleView, PrintButton } from './PrintScheduleView';

// Service priority configuration
const servicePriorityConfig: Record<ServicePriority, {
  label: string;
  badgeColor: string;
  indicatorColor: string;
  borderColor: string;
}> = {
  CRITICAL: {
    label: "Priority 1",
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
    indicatorColor: "bg-rose-500",
    borderColor: "border-rose-200"
  },
  STANDARD: {
    label: "Priority 2",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    indicatorColor: "bg-amber-500",
    borderColor: "border-amber-200"
  },
  FLEXIBLE: {
    label: "Priority 3",
    badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
    indicatorColor: "bg-slate-400",
    borderColor: "border-slate-200"
  }
};

const shiftConfig: Record<ShiftType, {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  DAY: {
    label: 'Day',
    icon: <Sun className="w-3.5 h-3.5" />,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200'
  },
  NIGHT: {
    label: 'Night',
    icon: <Moon className="w-3.5 h-3.5" />,
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200'
  },
  NMET: {
    label: 'NMET',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200'
  },
  JEOPARDY: {
    label: 'Jeopardy',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200'
  },
  RECOVERY: {
    label: 'Recovery',
    icon: <Activity className="w-3.5 h-3.5" />,
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200'
  },
  CONSULTS: {
    label: 'Consults',
    icon: <Stethoscope className="w-3.5 h-3.5" />,
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200'
  },
  VACATION: {
    label: 'Vacation',
    icon: <Clock className="w-3.5 h-3.5" />,
    colorClass: 'text-slate-500',
    bgClass: 'bg-slate-100',
    borderClass: 'border-slate-200'
  },
};



// Provider Avatar Component
function ProviderAvatar({ provider, size = "md", showConflict = false }: {
  provider?: Provider;
  size?: "sm" | "md" | "lg";
  showConflict?: boolean;
}) {
  if (!provider) return null;

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm"
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-sm ${showConflict ? 'ring-2 ring-error' : ''}`}>
      {provider.name.charAt(0).toUpperCase()}
    </div>
  );
}

// Priority Badge
function PriorityBadge({ priority, showLabel = false }: { priority: ServicePriority; showLabel?: boolean }) {
  const config = servicePriorityConfig[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${config.badgeColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.indicatorColor}`} />
      {showLabel && config.label}
    </span>
  );
}

// Shift Card Component with Click-to-Edit
interface ShiftCardProps {
  slot: ShiftSlot;
  provider?: Provider;
  hasConflict?: boolean;
  onClick: (slot: ShiftSlot) => void;
  compact?: boolean;
  showWorkload?: boolean;
}

function ShiftCard({ slot, provider, hasConflict, onClick, compact = false, showWorkload = false }: ShiftCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    data: { slotId: slot.id }
  });

  const config = shiftConfig[slot.type];
  const priorityConfig = servicePriorityConfig[slot.servicePriority];
  const isCriticalUnfilled = slot.servicePriority === "CRITICAL" && !provider;

  if (compact) {
    return (
      <motion.div
        ref={setNodeRef}
        whileHover={{ scale: 1.02 }}
        onClick={() => onClick(slot)}
        className={`p-2 rounded-lg border cursor-pointer transition-all ${isOver ? 'border-primary bg-primary/5' : ''
          } ${provider
            ? `${config.bgClass} ${config.borderClass}`
            : isCriticalUnfilled
              ? 'bg-rose-50 border-rose-200'
              : 'bg-white border-slate-200'
          } ${hasConflict ? 'ring-1 ring-error' : ''}`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-1 h-6 rounded-full ${priorityConfig.indicatorColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {config.icon}
              <span className={`text-[10px] font-bold ${config.colorClass}`}>{slot.serviceLocation}</span>
            </div>
            {provider ? (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-700 truncate">{provider.name}</span>
                {showWorkload && <ProviderWorkloadBadge providerId={provider.id} slot={slot} />}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className={`text-xs italic ${isCriticalUnfilled ? 'text-rose-500' : 'text-slate-400'}`}>
                  {isCriticalUnfilled ? 'Required' : 'Empty'}
                </span>
                {!provider && <SmartQuickAssign slot={slot} />}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={() => onClick(slot)}
      className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer ${isOver ? 'border-primary bg-primary/5 scale-105' : ''
        } ${provider
          ? `${config.bgClass} ${config.borderClass}`
          : isCriticalUnfilled
            ? 'bg-rose-50 border-rose-300'
            : 'bg-white border-slate-200 hover:border-slate-300'
        } ${hasConflict ? 'ring-2 ring-error/50' : ''}`}
    >
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${priorityConfig.indicatorColor}`} />

      <div className="flex items-center justify-between mb-2 pl-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bgClass}`}>
          {config.icon}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${config.colorClass}`}>
            {slot.serviceLocation}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {slot.notes && (
            <span className="p-1 bg-amber-100 text-amber-600 rounded-full" title={slot.notes}>
              <StickyNote className="w-3 h-3" />
            </span>
          )}
          {isCriticalUnfilled && (
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-bold rounded-full">
              Required
            </span>
          )}
          <PriorityBadge priority={slot.servicePriority} />
        </div>
      </div>

      <div className="flex items-center gap-2 pl-2">
        {provider ? (
          <>
            <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
            <span className="text-sm font-medium text-slate-700 truncate">{provider.name}</span>
            {showWorkload && <ProviderWorkloadBadge providerId={provider.id} slot={slot} />}
            {slot.isSharedAssignment && slot.secondaryProviderIds && slot.secondaryProviderIds.length > 0 && (
              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[8px] rounded-full">
                +{slot.secondaryProviderIds.length}
              </span>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <SmartQuickAssign slot={slot} />
            <div className={`w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center ${isCriticalUnfilled ? 'border-rose-300' : 'border-slate-300'
              }`}>
              <User className="w-3 h-3" />
            </div>
            <span className={`text-xs italic ${isCriticalUnfilled ? 'text-rose-400 font-medium' : ''}`}>
              {isCriticalUnfilled ? 'Unfilled' : 'Unassigned'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============ VIEW COMPONENTS ============

// 1. GRID VIEW (Default)
function GridView({
  slots,
  providers,
  conflicts,
  weekDates,
  onShiftClick,
  showWorkload = false,
}: {
  slots: ShiftSlot[];
  providers: Provider[];
  conflicts: Conflict[];
  weekDates: Date[];
  onShiftClick: (slot: ShiftSlot) => void;
  showWorkload?: boolean;
}) {
  return (
    <div className="space-y-6">
      {weekDates.map((date, idx) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const daySlots = slots.filter(s => s.date === dateStr);
        if (daySlots.length === 0) return null;

        const isWeekendDay = isWeekend(date);
        const isTodayDay = isToday(date);

        const slotsByPriority = {
          CRITICAL: daySlots.filter(s => s.servicePriority === "CRITICAL"),
          STANDARD: daySlots.filter(s => s.servicePriority === "STANDARD"),
          FLEXIBLE: daySlots.filter(s => s.servicePriority === "FLEXIBLE"),
        };

        return (
          <motion.div
            key={dateStr}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg ${isTodayDay
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg'
                : isWeekendDay
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
                }`}>
                {format(date, "d")}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {format(date, "EEEE, MMMM d")}
                </h3>
                {(isTodayDay || isWeekendDay) && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isTodayDay ? 'text-primary' : 'text-amber-600'
                    }`}>
                    {isTodayDay && 'Today'}
                    {isTodayDay && isWeekendDay && ' • '}
                    {isWeekendDay && 'Weekend'}
                  </span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <DayHandoffIndicator date={date} onClick={() => {}} />
                <span className="text-xs text-slate-400">
                  {daySlots.filter(s => s.providerId).length} / {daySlots.length} filled
                </span>
              </div>
            </div>

            {/* Daily Handoff Card */}
            <DayHandoffCard date={date} />

            <div className="space-y-4">
              {(Object.entries(slotsByPriority) as [ServicePriority, ShiftSlot[]][]).map(([priority, prioritySlots]) => {
                if (prioritySlots.length === 0) return null;
                const config = servicePriorityConfig[priority];

                return (
                  <div key={priority} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-1 h-4 rounded-full ${config.indicatorColor}`} />
                      <span className={`text-xs font-bold ${config.badgeColor.split(' ')[0].replace('bg-', 'text-').replace('100', '700')}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({prioritySlots.filter(s => s.providerId).length}/{prioritySlots.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {prioritySlots.map((slot) => {
                        const provider = providers.find(p => p.id === slot.providerId);
                        const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);

                        return (
                          <ShiftCard
                            key={slot.id}
                            slot={slot}
                            provider={provider}
                            hasConflict={hasConflict}
                            onClick={onShiftClick}
                            showWorkload={showWorkload}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// 2. LIST VIEW
function ListView({
  slots,
  providers,
  conflicts,
  onShiftClick,
  showWorkload = false,
}: {
  slots: ShiftSlot[];
  providers: Provider[];
  conflicts: Conflict[];
  onShiftClick: (slot: ShiftSlot) => void;
  showWorkload?: boolean;
}) {
  const sortedSlots = [...slots].sort((a, b) => {
    // Sort by date, then by priority
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    const priorityOrder = { CRITICAL: 0, STANDARD: 1, FLEXIBLE: 2 };
    return priorityOrder[a.servicePriority] - priorityOrder[b.servicePriority];
  });

  return (
    <div className="space-y-2">
      {sortedSlots.map((slot) => {
        const provider = providers.find(p => p.id === slot.providerId);
        const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
        const config = shiftConfig[slot.type];
        const priorityConfig = servicePriorityConfig[slot.servicePriority];
        const isCriticalUnfilled = slot.servicePriority === "CRITICAL" && !provider;

        return (
          <motion.div
            key={slot.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => onShiftClick(slot)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isCriticalUnfilled ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
              } ${hasConflict ? 'ring-1 ring-error' : ''}`}
          >
            <div className={`w-1 h-10 rounded-full ${priorityConfig.indicatorColor}`} />

            <div className={`p-2 rounded-lg ${config.bgClass} ${config.colorClass}`}>
              {config.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${config.colorClass}`}>{slot.serviceLocation}</span>
                <PriorityBadge priority={slot.servicePriority} />
                <span className="text-[10px] text-slate-400">
                  {format(parseISO(slot.date), "MMM d")}
                </span>
              </div>
              {provider ? (
                <div className="flex items-center gap-2 mt-1">
                  <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
                  <span className="text-sm font-medium text-slate-700">{provider.name}</span>
                  {showWorkload && <ProviderWorkloadBadge providerId={provider.id} slot={slot} />}
                </div>
              ) : (
                <span className={`text-xs italic ${isCriticalUnfilled ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
                  {isCriticalUnfilled ? '⚠ Required shift unfilled' : 'Click to assign'}
                </span>
              )}
            </div>

            {isCriticalUnfilled && (
              <span className="px-2 py-1 bg-rose-100 text-rose-600 text-[9px] font-bold rounded-full">
                Critical
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// 3. BAR VIEW (Timeline-style bars)
function BarView({
  slots,
  providers,
  conflicts,
  weekDates,
  onShiftClick,
}: {
  slots: ShiftSlot[];
  providers: Provider[];
  conflicts: Conflict[];
  weekDates: Date[];
  onShiftClick: (slot: ShiftSlot) => void;
}) {
  // Group by provider for a Gantt-like view
  const providerSlots = useMemo(() => {
    const byProvider = new Map<string, ShiftSlot[]>();

    // Add all providers
    providers.forEach(p => byProvider.set(p.id, []));

    // Group slots
    slots.forEach(slot => {
      if (slot.providerId) {
        const list = byProvider.get(slot.providerId) || [];
        list.push(slot);
        byProvider.set(slot.providerId, list);
      }
    });

    return byProvider;
  }, [slots, providers]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Date Header */}
        <div className="flex border-b border-slate-200">
          <div className="w-40 p-3 bg-slate-50 text-xs font-bold text-slate-500 sticky left-0">Provider</div>
          {weekDates.map(date => (
            <div key={format(date, "yyyy-MM-dd")} className={`flex-1 p-3 text-center text-xs font-bold border-l border-slate-200 ${isToday(date) ? 'bg-blue-50 text-blue-700' : isWeekend(date) ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
              }`}>
              <div>{format(date, "EEE")}</div>
              <div>{format(date, "MMM d")}</div>
            </div>
          ))}
        </div>

        {/* Provider Rows */}
        {providers.map((provider) => {
          const pSlots = providerSlots.get(provider.id) || [];

          return (
            <div key={provider.id} className="flex border-b border-slate-100 hover:bg-slate-50/50">
              <div className="w-40 p-3 flex items-center gap-2 sticky left-0 bg-white">
                <ProviderAvatar provider={provider} size="sm" />
                <span className="text-sm font-medium text-slate-700 truncate">{provider.name}</span>
              </div>

              {weekDates.map(date => {
                const dateStr = format(date, "yyyy-MM-dd");
                const slot = pSlots.find(s => s.date === dateStr);

                if (!slot) {
                  return <div key={dateStr} className="flex-1 border-l border-slate-100 p-1" />;
                }

                const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
                const config = shiftConfig[slot.type];
                const priorityConfig = servicePriorityConfig[slot.servicePriority];

                return (
                  <div key={dateStr} className="flex-1 border-l border-slate-100 p-1">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      onClick={() => onShiftClick(slot)}
                      className={`h-8 rounded-lg ${config.bgClass} ${config.borderClass} border flex items-center justify-center gap-1 cursor-pointer ${hasConflict ? 'ring-1 ring-error' : ''
                        }`}
                      title={`${slot.serviceLocation} - ${format(parseISO(slot.date), "MMM d")}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.indicatorColor}`} />
                      <span className={`text-[10px] font-bold ${config.colorClass} truncate px-1`}>
                        {slot.serviceLocation}
                      </span>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Unassigned Row */}
        <div className="flex border-b border-slate-200 bg-amber-50/30">
          <div className="w-40 p-3 flex items-center gap-2 sticky left-0 bg-amber-50/50">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-amber-700">Unassigned</span>
          </div>

          {weekDates.map(date => {
            const dateStr = format(date, "yyyy-MM-dd");
            const unassignedSlots = slots.filter(s => s.date === dateStr && !s.providerId);
            const criticalCount = unassignedSlots.filter(s => s.servicePriority === "CRITICAL").length;

            return (
              <div key={dateStr} className="flex-1 border-l border-slate-200 p-2">
                {unassignedSlots.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {unassignedSlots.slice(0, 4).map((slot) => {
                      const config = shiftConfig[slot.type];
                      return (
                        <motion.div
                          key={slot.id}
                          whileHover={{ scale: 1.1 }}
                          onClick={() => onShiftClick(slot)}
                          className={`w-6 h-6 rounded ${config.bgClass} ${config.borderClass} border flex items-center justify-center cursor-pointer`}
                          title={slot.serviceLocation}
                        >
                          <span className="text-[8px] font-bold">{slot.serviceLocation.slice(0, 2)}</span>
                        </motion.div>
                      );
                    })}
                    {unassignedSlots.length > 4 && (
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[8px] text-slate-500">
                        +{unassignedSlots.length - 4}
                      </div>
                    )}
                  </div>
                )}
                {criticalCount > 0 && (
                  <div className="mt-1 text-[9px] text-rose-600 font-bold">
                    {criticalCount} critical
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 4. WEEK VIEW (Compact weekly overview)
function WeekView({
  slots,
  providers,
  conflicts,
  weekDates,
  onShiftClick,
  showWorkload = false,
}: {
  slots: ShiftSlot[];
  providers: Provider[];
  conflicts: Conflict[];
  weekDates: Date[];
  onShiftClick: (slot: ShiftSlot) => void;
  showWorkload?: boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {weekDates.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const daySlots = slots.filter(s => s.date === dateStr);
        const isWeekendDay = isWeekend(date);
        const isTodayDay = isToday(date);

        return (
          <motion.div
            key={dateStr}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`min-h-[300px] rounded-2xl border-2 p-3 ${isTodayDay
              ? 'border-primary bg-primary/5'
              : isWeekendDay
                ? 'border-amber-200 bg-amber-50/30'
                : 'border-slate-200 bg-white'
              }`}
          >
            {/* Day Header */}
            <div className={`text-center pb-3 mb-3 border-b ${isTodayDay ? 'border-primary/20' : 'border-slate-100'
              }`}>
              <div className={`text-xs font-bold uppercase ${isWeekendDay ? 'text-amber-600' : 'text-slate-500'}`}>
                {format(date, "EEE")}
              </div>
              <div className={`text-2xl font-bold ${isTodayDay ? 'text-primary' : 'text-slate-800'}`}>
                {format(date, "d")}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {format(date, "MMM")}
              </div>
              <div className="text-[10px] text-slate-400">
                {daySlots.filter(s => s.providerId).length}/{daySlots.length}
              </div>
              {daySlots.length > 0 && <DayHandoffIndicator date={date} />}
            </div>

            {/* Daily Handoff Card */}
            <div className="mb-3">
              <DayHandoffCard date={date} />
            </div>

            {/* Shifts */}
            <div className="space-y-2">
              {/* Critical First */}
              {daySlots
                .filter(s => s.servicePriority === "CRITICAL")
                .map((slot) => {
                  const provider = providers.find(p => p.id === slot.providerId);
                  const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
                  return (
                    <ShiftCard
                      key={slot.id}
                      slot={slot}
                      provider={provider}
                      hasConflict={hasConflict}
                      onClick={onShiftClick}
                      compact
                      showWorkload={showWorkload}
                    />
                  );
                })}

              {/* Standard */}
              {daySlots
                .filter(s => s.servicePriority === "STANDARD")
                .map((slot) => {
                  const provider = providers.find(p => p.id === slot.providerId);
                  const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
                  return (
                    <ShiftCard
                      key={slot.id}
                      slot={slot}
                      provider={provider}
                      hasConflict={hasConflict}
                      onClick={onShiftClick}
                      compact
                      showWorkload={showWorkload}
                    />
                  );
                })}

              {/* Flexible */}
              {daySlots
                .filter(s => s.servicePriority === "FLEXIBLE")
                .map((slot) => {
                  const provider = providers.find(p => p.id === slot.providerId);
                  const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
                  return (
                    <ShiftCard
                      key={slot.id}
                      slot={slot}
                      provider={provider}
                      hasConflict={hasConflict}
                      onClick={onShiftClick}
                      compact
                      showWorkload={showWorkload}
                    />
                  );
                })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// 5. MONTH VIEW
function MonthView({
  slots,
  anchorDate,
  onShiftClick
}: {
  slots: ShiftSlot[];
  anchorDate: Date;
  providers: Provider[];
  conflicts: Conflict[];
  onShiftClick: (slot: ShiftSlot) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(anchorDate);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          title="Previous month"
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-slate-800">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          title="Next month"
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Week Day Headers */}
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center text-xs font-bold text-slate-500 uppercase">
            {day}
          </div>
        ))}

        {/* Days */}
        {monthDays.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const daySlots = slots.filter(s => s.date === dateStr);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isWeekendDay = isWeekend(date);
          const isTodayDay = isToday(date);

          const criticalUnfilled = daySlots.filter(s => s.servicePriority === "CRITICAL" && !s.providerId).length;
          const totalFilled = daySlots.filter(s => s.providerId).length;
          const totalSlots = daySlots.length;

          return (
            <motion.div
              key={dateStr}
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                if (daySlots.length > 0) {
                  onShiftClick(daySlots[0]);
                }
              }}
              className={`min-h-[100px] p-2 rounded-xl border cursor-pointer transition-all ${!isCurrentMonth
                ? 'bg-slate-50 border-slate-100 opacity-50'
                : isTodayDay
                  ? 'bg-primary/5 border-primary'
                  : isWeekendDay
                    ? 'bg-amber-50/30 border-amber-100'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
              <div className={`text-sm font-bold mb-1 ${isTodayDay ? 'text-primary' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                }`}>
                {format(date, "d")}
              </div>

              {daySlots.length > 0 && (
                <div className="space-y-1">
                  {/* Indicators */}
                  <div className="flex flex-wrap gap-0.5">
                    {daySlots.slice(0, 6).map((slot, idx) => {
                      const config = servicePriorityConfig[slot.servicePriority];
                      const isFilled = !!slot.providerId;
                      return (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full ${isFilled ? config.indicatorColor : 'bg-slate-200'
                            }`}
                          title={slot.serviceLocation}
                        />
                      );
                    })}
                    {daySlots.length > 6 && (
                      <div className="w-2 h-2 rounded-full bg-slate-300 text-[6px] flex items-center justify-center">
                        +
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="text-[9px] text-slate-500">
                    {totalFilled}/{totalSlots}
                  </div>

                  {criticalUnfilled > 0 && (
                    <div className="text-[9px] text-rose-600 font-bold">
                      {criticalUnfilled} critical
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// 6. TIMELINE VIEW
function TimelineView({
  slots,
  providers,
  conflicts,
  weekDates
}: {
  slots: ShiftSlot[];
  providers: Provider[];
  conflicts: Conflict[];
  weekDates: Date[];
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const priorityOrder: ServicePriority[] = ["CRITICAL", "STANDARD", "FLEXIBLE"];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="flex gap-4 mb-4 px-4">
          {priorityOrder.map(priority => (
            <div key={priority} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${servicePriorityConfig[priority].indicatorColor}`} />
              <span className="text-xs text-slate-600">{servicePriorityConfig[priority].label}</span>
            </div>
          ))}
        </div>

        <div className="flex border-b border-slate-200">
          <div className="w-20 p-2 bg-slate-50 text-xs font-bold text-slate-500">Time</div>
          {weekDates.map(date => (
            <div key={date.toISOString()} className="flex-1 p-2 bg-slate-50 text-xs font-bold text-slate-700 text-center border-l border-slate-200">
              {format(date, "EEE, MMM d")}
            </div>
          ))}
        </div>

        {hours.map(hour => (
          <div key={hour} className="flex border-b border-slate-100">
            <div className="w-20 p-2 text-[10px] text-slate-400 flex items-center">
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {weekDates.map(date => {
              const dateStr = format(date, "yyyy-MM-dd");
              const slot = slots.find(s => s.date === dateStr && (
                (s.type === "NIGHT" && hour >= 19) ||
                (s.type === "NIGHT" && hour < 7) ||
                (s.type === "DAY" && hour >= 7 && hour < 19)
              ));

              if (!slot) return <div key={`${dateStr}-${hour}`} className="flex-1 border-l border-slate-100" />;

              const provider = providers.find(p => p.id === slot.providerId);
              const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
              const priorityConfig = servicePriorityConfig[slot.servicePriority];

              return (
                <div key={`${dateStr}-${hour}`} className={`flex-1 border-l border-slate-100 p-1 ${slot.providerId ? shiftConfig[slot.type].bgClass : ''}`}>
                  {slot.providerId && provider && (
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${priorityConfig.indicatorColor}`} />
                      <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
                      <span className="text-[10px] truncate">{provider.name.split(" ")[0]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Coverage Summary Component
function CoverageSummary({ slots }: { slots: ShiftSlot[] }) {
  const stats = useMemo(() => {
    const byPriority: Record<ServicePriority, { total: number; filled: number }> = {
      CRITICAL: { total: 0, filled: 0 },
      STANDARD: { total: 0, filled: 0 },
      FLEXIBLE: { total: 0, filled: 0 }
    };

    slots.forEach(slot => {
      byPriority[slot.servicePriority].total++;
      if (slot.providerId) {
        byPriority[slot.servicePriority].filled++;
      }
    });

    return byPriority;
  }, [slots]);

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {(Object.entries(stats) as [ServicePriority, { total: number; filled: number }][]).map(([priority, stat]) => {
        const percentage = stat.total > 0 ? Math.round((stat.filled / stat.total) * 100) : 0;
        const config = servicePriorityConfig[priority];
        return (
          <div key={priority} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${config.badgeColor}`}>
            <span className={`w-2 h-2 rounded-full ${config.indicatorColor}`} />
            <span className="text-xs font-bold">{config.label}</span>
            <span className="text-sm font-bold">
              {stat.filled}/{stat.total}
            </span>
            <span className="text-xs opacity-75">({percentage}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// View Selector Component
function ViewSelector({
  currentMode,
  onChange
}: {
  currentMode: CalendarPresentationMode;
  onChange: (mode: CalendarPresentationMode) => void;
}) {
  const views: { mode: CalendarPresentationMode; label: string; icon: React.ReactNode }[] = [
    { mode: "grid", label: "Grid", icon: <Grid3X3 className="w-4 h-4" /> },
    { mode: "list", label: "List", icon: <List className="w-4 h-4" /> },
    { mode: "bar", label: "Bar", icon: <BarChart3 className="w-4 h-4" /> },
    { mode: "week", label: "Week", icon: <CalendarDays className="w-4 h-4" /> },
    { mode: "month", label: "Month", icon: <CalendarIcon className="w-4 h-4" /> },
    { mode: "timeline", label: "Timeline", icon: <Clock4 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
      {views.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentMode === mode
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// Main Enhanced Calendar Component
export function EnhancedCalendar() {
  const { slots, providers, conflicts, setSelectedDate, setCalendarPresentationMode } = useScheduleStore();
  const { scheduleViewport, weekDates } = useScheduleViewport();

  // Edit modal state
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Workload heatmap toggle
  const [showWorkload, setShowWorkload] = useState(false);
  
  // New feature modals
  const [isSwapBoardOpen, setIsSwapBoardOpen] = useState(false);
  const [isAvailabilityPanelOpen, setIsAvailabilityPanelOpen] = useState(false);
  const [selectedSlotForAvailability, _setSelectedSlotForAvailability] = useState<ShiftSlot | null>(null);
  const [isBulkModeOpen, setIsBulkModeOpen] = useState(false);
  const [isAlertDashboardOpen, setIsAlertDashboardOpen] = useState(false);
  const [isHistoryViewOpen, setIsHistoryViewOpen] = useState(false);
  const [selectedSlotForHistory, _setSelectedSlotForHistory] = useState<string | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);

  const activeMonthLabel = useMemo(() => {
    const monthLabels = Array.from(new Set(weekDates.map((date) => format(date, "MMMM yyyy"))));
    return monthLabels.join(" · ");
  }, [weekDates]);

  // Filter slots for current view
  const visibleSlots = useMemo(() => {
    const dateStrs = weekDates.map(d => format(d, "yyyy-MM-dd"));

    return slots.filter(s => {
      if (scheduleViewport.shiftTypeFilter !== "all" && s.type !== scheduleViewport.shiftTypeFilter) return false;
      if (scheduleViewport.showConflictsOnly) {
        return conflicts.some(c => c.slotId === s.id && !c.resolvedAt);
      }
      if (scheduleViewport.showUnfilledOnly && s.providerId) return false;

      // For non-month views, filter to the active week range.
      if (scheduleViewport.calendarPresentationMode !== "month" && !dateStrs.includes(s.date)) return false;

      if (scheduleViewport.providerSearchTerm) {
        const provider = providers.find((p) => p.id === s.providerId);
        if (!provider) return false;
        return provider.name.toLowerCase().includes(scheduleViewport.providerSearchTerm.toLowerCase());
      }

      return true;
    });
  }, [slots, weekDates, scheduleViewport, conflicts, providers]);

  const handleShiftClick = (slot: ShiftSlot) => {
    setEditingSlotId(slot.id);
    setSelectedDate(slot.date);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingSlotId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel bg-white/60 rounded-[2rem] border border-slate-200/40 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-slate-900">Calendar</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                {visibleSlots.length} shifts
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1">{activeMonthLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Alert Badge */}
            <button
              onClick={() => setIsAlertDashboardOpen(true)}
              className="flex items-center gap-2"
            >
              <AlertBadge count={conflicts.filter(c => !c.acknowledged && c.severity === 'CRITICAL').length} />
            </button>
            
            {/* Workload Heatmap Toggle */}
            <WorkloadHeatmapToggle 
              isActive={showWorkload} 
              onToggle={() => setShowWorkload(!showWorkload)} 
            />
            
            {/* View Selector */}
            <ViewSelector
              currentMode={scheduleViewport.calendarPresentationMode}
              onChange={setCalendarPresentationMode}
            />
            
            {/* Feature Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setIsSwapBoardOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 hover:shadow-sm transition-all"
                title="Shift Swap Board"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Swaps</span>
              </button>
              <button
                onClick={() => setIsBulkModeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 hover:shadow-sm transition-all"
                title="Bulk Assignment"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk</span>
              </button>
              <button
                onClick={() => setIsHistoryViewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 hover:shadow-sm transition-all"
                title="History"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History</span>
              </button>
              <PrintButton onClick={() => setIsPrintViewOpen(true)} />
            </div>

            {/* AI Assistant Button */}
            <button
              onClick={() => useScheduleStore.getState().toggleCopilot()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:shadow-lg hover:scale-105 transition-all"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>
          </div>
        </div>

        {/* Coverage Summary */}
        <div className="mt-4">
          <CoverageSummary slots={visibleSlots} />
        </div>
      </div>

      {/* Calendar Content */}
      <div className="p-6 overflow-auto max-h-[calc(100vh-350px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={scheduleViewport.calendarPresentationMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {scheduleViewport.calendarPresentationMode === "grid" && (
              <GridView
                slots={visibleSlots}
                providers={providers}
                conflicts={conflicts}
                weekDates={weekDates}
                onShiftClick={handleShiftClick}
                showWorkload={showWorkload}
              />
            )}

            {scheduleViewport.calendarPresentationMode === "list" && (
              <ListView
                slots={visibleSlots}
                providers={providers}
                conflicts={conflicts}
                onShiftClick={handleShiftClick}
                showWorkload={showWorkload}
              />
            )}

            {scheduleViewport.calendarPresentationMode === "bar" && (
              <BarView
                slots={visibleSlots}
                providers={providers}
                conflicts={conflicts}
                weekDates={weekDates}
                onShiftClick={handleShiftClick}
              />
            )}

            {scheduleViewport.calendarPresentationMode === "week" && (
              <WeekView
                slots={visibleSlots}
                providers={providers}
                conflicts={conflicts}
                weekDates={weekDates}
                onShiftClick={handleShiftClick}
                showWorkload={showWorkload}
              />
            )}

            {scheduleViewport.calendarPresentationMode === "month" && (
              <MonthView
                key={format(weekDates[0], "yyyy-MM")}
                slots={visibleSlots}
                anchorDate={weekDates[0]}
                providers={providers}
                conflicts={conflicts}
                onShiftClick={handleShiftClick}
              />
            )}

            {scheduleViewport.calendarPresentationMode === "timeline" && (
              <TimelineView
                slots={visibleSlots}
                providers={providers}
                conflicts={conflicts}
                weekDates={weekDates}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit Modal */}
      <ShiftEditModal
        slotId={editingSlotId}
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
      />
      
      {/* Feature Modals */}
      <ShiftSwapBoard
        isOpen={isSwapBoardOpen}
        onClose={() => setIsSwapBoardOpen(false)}
      />
      
      <ProviderAvailabilityPanel
        isOpen={isAvailabilityPanelOpen}
        onClose={() => setIsAvailabilityPanelOpen(false)}
        selectedSlot={selectedSlotForAvailability}
      />
      
      <BulkAssignmentMode
        isOpen={isBulkModeOpen}
        onClose={() => setIsBulkModeOpen(false)}
        slots={slots}
      />
      
      <CoverageAlertDashboard
        isOpen={isAlertDashboardOpen}
        onClose={() => setIsAlertDashboardOpen(false)}
      />
      
      <ShiftHistoryView
        isOpen={isHistoryViewOpen}
        onClose={() => setIsHistoryViewOpen(false)}
        selectedSlotId={selectedSlotForHistory}
      />
      
      <PrintScheduleView
        isOpen={isPrintViewOpen}
        onClose={() => setIsPrintViewOpen(false)}
      />
    </motion.div>
  );
}

export function DraggableProvider({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `provider-drag-${id}`,
    data: { providerId: id }
  });

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : undefined
      }}
      {...listeners}
      {...attributes}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-2 group cursor-grab active:cursor-grabbing font-medium
        ${isDragging ? 'opacity-50' : 'hover:text-blue-600'} transition-colors`}
    >
      <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
      <span className="truncate">{name}</span>
    </motion.div>
  );
}
