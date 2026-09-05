import { useState, useMemo } from "react";
import { WeekSchedule } from "./schedule/WeekSchedule";
import { MonthSchedule } from "./schedule/MonthSchedule";
import { useShallow } from "zustand/react/shallow";
import { useScheduleStore, type ShiftSlot, type Provider, type Conflict, type ShiftType, type ServicePriority } from "../store";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { format, parseISO, isToday, isWeekend } from "date-fns";
import {
  GripVertical,
  Sun,
  Moon,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Activity,
  Stethoscope,
  Clock,
  User,
  StickyNote,
  ArrowRightLeft,
  History,
  Plus,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShiftEditModal } from './ShiftEditModal';
import { useScheduleViewport } from './schedule/useScheduleViewport';
import { DayHandoffCard, DayHandoffIndicator } from './DayHandoffCard';
import { SmartQuickAssign, ProviderWorkloadBadge, WorkloadHeatmapToggle } from './SmartQuickAssign';
import { ShiftSwapBoard } from './ShiftSwapBoard';
import { ProviderAvailabilityPanel } from './ProviderAvailabilityPanel';
import { getShiftColorClasses } from '@/lib/shiftColors';
import { BulkAssignmentMode } from './BulkAssignmentMode';
import { CoverageAlertDashboard, AlertBadge } from './CoverageAlertDashboard';
import { ShiftHistoryView } from './ShiftHistoryView';
import { PrintScheduleView, PrintButton } from './PrintScheduleView';
import { ShiftIssuesDrawer } from './ShiftIssuesDrawer';
import { getShiftIssueMarkers, shouldOpenIssuesDrawerFirst } from '../lib/shiftConflictUtils';
import { cn, getInitials, getAvatarColor } from "@/lib/utils";

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

// Per-render lookup indices: the subviews below render one card per slot, and
// per-slot providers.find / conflicts.some scans made each render
// O(slots x (providers + conflicts)).
const buildProviderIndex = (providers: Provider[]) => new Map(providers.map((p) => [p.id, p]));
const buildConflictIndex = (conflicts: Conflict[]) => {
  const ids = new Set<string>();
  conflicts.forEach((c) => {
    if (c.slotId && !c.resolvedAt) ids.add(c.slotId);
  });
  return ids;
};

function ProviderAvatar({ provider, size = "md", showConflict = false }: {
  provider?: Provider;
  size?: "sm" | "md" | "lg";
  showConflict?: boolean;
}) {
  if (!provider) return null;

  const sizeClasses = {
    sm: "w-5 h-5 text-[9px]",
    md: "w-6 h-6 text-[10px]",
    lg: "w-8 h-8 text-xs"
  };

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center text-white font-bold shadow-sm",
        sizeClasses[size],
        getAvatarColor(provider.name),
        showConflict && "ring-2 ring-error"
      )}
      title={provider.name}
    >
      {getInitials(provider.name)}
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

function ShiftIssueMarkersInline({ slot, conflicts }: { slot: ShiftSlot; conflicts: Conflict[] }) {
  const markers = getShiftIssueMarkers(slot, conflicts);
  if (!markers.hasUnresolvedConflict && !markers.isCriticalCoverageGap) return null;
  return (
    <div className="flex items-center gap-0.5 shrink-0" aria-hidden>
      {markers.isCriticalCoverageGap && (
        <span className="h-2 w-2 rounded-full bg-rose-500 ring-1 ring-white shadow-sm" title="Critical coverage gap" />
      )}
      {markers.hasUnresolvedConflict && markers.maxSeverity && (
        <span
          className={`h-2 w-2 rounded-full ring-1 ring-white shadow-sm ${
            markers.maxSeverity === "CRITICAL"
              ? "bg-rose-600"
              : markers.maxSeverity === "WARNING"
                ? "bg-amber-500"
                : "bg-sky-500"
          }`}
          title={`Issue: ${markers.maxSeverity}`}
        />
      )}
    </div>
  );
}

// Shift Card Component with Click-to-Edit
interface ShiftCardProps {
  slot: ShiftSlot;
  provider?: Provider;
  hasConflict?: boolean;
  conflicts: Conflict[];
  onClick: (slot: ShiftSlot) => void;
  compact?: boolean;
  showWorkload?: boolean;
}

function ShiftCard({ slot, provider, hasConflict, conflicts, onClick, compact = false, showWorkload = false }: ShiftCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    data: { slotId: slot.id }
  });

  const config = shiftConfig[slot.type];
  const priorityConfig = servicePriorityConfig[slot.servicePriority];
  const isCriticalUnfilled = slot.servicePriority === "CRITICAL" && !provider;

  const isUnassigned = !provider;
  const visualState = hasConflict ? 'conflict' : isUnassigned ? 'unassigned' : 'normal';

  if (compact) {
    return (
      <motion.div
        ref={setNodeRef}
        whileHover={{ scale: 1.02 }}
        onClick={() => onClick(slot)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick(slot);
          }
        }}
        tabIndex={0}
        aria-label={`${slot.serviceLocation}, ${provider?.name ?? "open shift"}`}
        className={cn(
          "p-2 rounded-lg border cursor-pointer transition-all",
          isOver ? 'border-primary bg-primary/5' : '',
          visualState === 'conflict' && 'bg-red-50 border-red-200 border-solid',
          visualState === 'unassigned' && 'border-dashed border-slate-300 bg-slate-50/50 dark:bg-slate-800/30',
          visualState === 'normal' && provider && `${config.bgClass} ${config.borderClass}`,
          visualState === 'normal' && isCriticalUnfilled && 'bg-rose-50 border-rose-200',
          visualState === 'normal' && !provider && !isCriticalUnfilled && 'bg-white border-slate-200',
          hasConflict && 'ring-1 ring-error'
        )}
      >
        <div className="flex items-center gap-2">
          <span className={`w-1 h-6 rounded-full ${priorityConfig.indicatorColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 justify-between">
              <div className="flex items-center gap-1 min-w-0">
                {config.icon}
                <span className={`text-[10px] font-bold truncate ${config.colorClass}`}>{slot.serviceLocation}</span>
              </div>
              <div className="flex items-center gap-1">
                {visualState === 'conflict' && <AlertCircle className="w-3 h-3 text-red-500" />}
                {visualState === 'unassigned' && <Plus className="w-3 h-3 text-slate-400" />}
                <ShiftIssueMarkersInline slot={slot} conflicts={conflicts} />
              </div>
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
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(slot);
        }
      }}
      tabIndex={0}
      aria-label={`${slot.serviceLocation}, ${provider?.name ?? "open shift"}`}
      className={cn(
        "relative p-3 rounded-2xl border-2 transition-all cursor-pointer",
        isOver ? 'border-primary bg-primary/5 scale-105' : '',
        visualState === 'conflict' && 'bg-red-50 border-red-300',
        visualState === 'unassigned' && 'border-dashed border-slate-300 bg-slate-50/50 dark:bg-slate-800/30',
        visualState === 'normal' && provider && `${config.bgClass} ${config.borderClass}`,
        visualState === 'normal' && isCriticalUnfilled && 'bg-rose-50 border-rose-300',
        visualState === 'normal' && !provider && !isCriticalUnfilled && 'bg-white border-slate-200 hover:border-slate-300',
        hasConflict && 'ring-2 ring-error/50'
      )}
    >
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${priorityConfig.indicatorColor}`} />

      <div className="flex items-center justify-between mb-2 pl-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bgClass}`}>
          {config.icon}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${config.colorClass}`}>
            {slot.serviceLocation}
          </span>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border ${getShiftColorClasses(slot.type)}`}>
            {slot.type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {visualState === 'conflict' && <AlertCircle className="w-3 h-3 text-red-500" />}
          {visualState === 'unassigned' && <Plus className="w-3 h-3 text-slate-400" />}
          <ShiftIssueMarkersInline slot={slot} conflicts={conflicts} />
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
  const providerById = buildProviderIndex(providers);
  const conflictedSlotIds = buildConflictIndex(conflicts);
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
                        const provider = slot.providerId ? providerById.get(slot.providerId) : undefined;
                        const hasConflict = conflictedSlotIds.has(slot.id);

                        return (
                          <ShiftCard
                            key={slot.id}
                            slot={slot}
                            provider={provider}
                            hasConflict={hasConflict}
                            conflicts={conflicts}
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
  const providerById = buildProviderIndex(providers);
  const conflictedSlotIds = buildConflictIndex(conflicts);
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
        const provider = slot.providerId ? providerById.get(slot.providerId) : undefined;
        const hasConflict = conflictedSlotIds.has(slot.id);
        const config = shiftConfig[slot.type];
        const priorityConfig = servicePriorityConfig[slot.servicePriority];
        const isCriticalUnfilled = slot.servicePriority === "CRITICAL" && !provider;

        return (
          <motion.div
            key={slot.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            role="button"
            tabIndex={0}
            aria-label={`${slot.serviceLocation}, ${slot.date}: ${provider?.name || "Assign open shift"}`}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onShiftClick(slot); } }}
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

            <ShiftIssueMarkersInline slot={slot} conflicts={conflicts} />

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
  const conflictedSlotIds = buildConflictIndex(conflicts);
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

                const hasConflict = conflictedSlotIds.has(slot.id);
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
                      <ShiftIssueMarkersInline slot={slot} conflicts={conflicts} />
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

// 6. TIMELINE VIEW
function TimelineView({
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
  const providerById = buildProviderIndex(providers);
  const conflictedSlotIds = buildConflictIndex(conflicts);
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

              const provider = slot.providerId ? providerById.get(slot.providerId) : undefined;
              const hasConflict = conflictedSlotIds.has(slot.id);
              const priorityConfig = servicePriorityConfig[slot.servicePriority];
              const isCriticalUnfilled = slot.servicePriority === "CRITICAL" && !slot.providerId;
              const cellBg = slot.providerId
                ? shiftConfig[slot.type].bgClass
                : isCriticalUnfilled
                  ? "bg-rose-50/70"
                  : "bg-slate-50/50";

              return (
                <div
                  key={`${dateStr}-${hour}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onShiftClick(slot)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onShiftClick(slot);
                    }
                  }}
                  className={`flex-1 border-l border-slate-100 p-1 ${cellBg} cursor-pointer rounded-sm hover:ring-1 hover:ring-primary/30 focus:outline-none focus:ring-2 focus:ring-primary`}
                >
                  <div className="flex items-center justify-between gap-1 min-h-[1.75rem]">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {slot.providerId && provider ? (
                        <>
                          <span className={`w-2 h-2 shrink-0 rounded-full ${priorityConfig.indicatorColor}`} />
                          <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
                          <span className="text-[10px] truncate">{provider.name.split(" ")[0]}</span>
                        </>
                      ) : (
                        <span className={`text-[10px] truncate italic ${isCriticalUnfilled ? "text-rose-600 font-medium" : "text-slate-500"}`}>
                          {isCriticalUnfilled ? "Unfilled" : "Open"}
                        </span>
                      )}
                    </div>
                    <ShiftIssueMarkersInline slot={slot} conflicts={conflicts} />
                  </div>
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
export function EnhancedCalendar() {
  const { slots, providers, conflicts, setSelectedDate } = useScheduleStore(
    useShallow((s) => ({
      slots: s.slots,
      providers: s.providers,
      conflicts: s.conflicts,
      setSelectedDate: s.setSelectedDate,
    })),
  );
  const { scheduleViewport, weekDates, anchorDate } = useScheduleViewport();

  // Edit modal state
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [issuesDrawerSlotId, setIssuesDrawerSlotId] = useState<string | null>(null);

  // Workload heatmap toggle
  const [showWorkload, setShowWorkload] = useState(false);

  // New feature modals
  const [isSwapBoardOpen, setIsSwapBoardOpen] = useState(false);
  const [isAvailabilityPanelOpen, setIsAvailabilityPanelOpen] = useState(false);
  const [selectedSlotForAvailability] = useState<ShiftSlot | null>(null);
  const [isBulkModeOpen, setIsBulkModeOpen] = useState(false);
  const [isAlertDashboardOpen, setIsAlertDashboardOpen] = useState(false);
  const [isHistoryViewOpen, setIsHistoryViewOpen] = useState(false);
  const [selectedSlotForHistory] = useState<string | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);

  // Filter slots for current view
  const visibleSlots = useMemo(() => {
    const dateStrs = weekDates.map(d => format(d, "yyyy-MM-dd"));

    return slots.filter(s => {
      if (scheduleViewport.shiftTypeFilter !== "all" && s.type !== scheduleViewport.shiftTypeFilter) return false;
      if (scheduleViewport.showConflictsOnly && !conflicts.some(c => c.slotId === s.id && !c.resolvedAt)) return false;
      if (scheduleViewport.showUnfilledOnly && (s.providerId || s.type === "VACATION")) return false;

      // For non-month views, filter to the active week range.
      if (scheduleViewport.calendarPresentationMode !== "month" && !dateStrs.includes(s.date)) return false;

      if (scheduleViewport.providerSearchTerm) {
        const query = scheduleViewport.providerSearchTerm.toLowerCase();
        const providerIds = [s.providerId, ...(s.secondaryProviderIds ?? [])].filter(Boolean);
        return providerIds.some((providerId) => providers.find((p) => p.id === providerId)?.name.toLowerCase().includes(query));
      }

      return true;
    });
  }, [slots, weekDates, scheduleViewport, conflicts, providers]);

  const handleShiftClick = (slot: ShiftSlot) => {
    if (shouldOpenIssuesDrawerFirst(slot, conflicts)) {
      setIssuesDrawerSlotId(slot.id);
      return;
    }
    setEditingSlotId(slot.id);
    setSelectedDate(slot.date);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingSlotId(null);
  };

  const handleCloseIssuesDrawer = () => {
    setIssuesDrawerSlotId(null);
  };

  const handleEditFromIssuesDrawer = () => {
    if (!issuesDrawerSlotId) return;
    const slotId = issuesDrawerSlotId;
    setIssuesDrawerSlotId(null);
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    setEditingSlotId(slot.id);
    setSelectedDate(slot.date);
    setIsEditModalOpen(true);
  };

  const issuesDrawerSlot = issuesDrawerSlotId ? slots.find((s) => s.id === issuesDrawerSlotId) ?? null : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-w-0"
    >
      {/* Calendar Content */}
      <div className="min-w-0">
        {visibleSlots.length === 0 && <div className="mb-3 rounded-lg border border-border bg-surface p-8 text-center"><h3 className="text-lg font-semibold">No matching shifts</h3><p className="mt-2 text-sm text-foreground-secondary">Try another date or clear the filters to see more of the schedule.</p></div>}
        <AnimatePresence mode="wait">
          <motion.div
            key={scheduleViewport.calendarPresentationMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {scheduleViewport.calendarPresentationMode === "grid" && (
              <WeekSchedule slots={visibleSlots} providers={providers} conflicts={conflicts} dates={weekDates} onEdit={handleShiftClick} />
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
              <GridView slots={visibleSlots} providers={providers} conflicts={conflicts} weekDates={weekDates} onShiftClick={handleShiftClick} showWorkload={showWorkload} />
            )}
            {scheduleViewport.calendarPresentationMode === "month" && (
              <MonthSchedule key={format(anchorDate, "yyyy-MM")} slots={visibleSlots} providers={providers} anchor={anchorDate} onEdit={handleShiftClick} />
            )}

            {scheduleViewport.calendarPresentationMode === "timeline" && (
              <TimelineView
                slots={visibleSlots}
                providers={providers}
                conflicts={conflicts}
                weekDates={weekDates}
                onShiftClick={handleShiftClick}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-sm text-foreground-secondary">Select any shift to edit. Drag a physician onto a shift to assign.</p>
      <details className="no-print mt-4 rounded-lg border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">Scheduling tools</summary>
      <div className="border-t border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1" />

          <button
            onClick={() => setIsAlertDashboardOpen(true)}
            className="flex items-center gap-2"
            aria-label="Open coverage alerts"
          >
            <AlertBadge count={conflicts.filter(c => !c.acknowledged && c.severity === 'CRITICAL').length} />
          </button>

          <WorkloadHeatmapToggle
            isActive={showWorkload}
            onToggle={() => setShowWorkload(!showWorkload)}
          />

          <div className="flex items-center gap-0.5 rounded-lg bg-secondary/70 p-0.5">
            <button
              onClick={() => setIsSwapBoardOpen(true)}
              className="flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface hover:text-foreground"
              title="Shift swap board"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Swaps</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkModeOpen(true)}
              className="flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface hover:text-foreground"
              title="Bulk assignment"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk</span>
            </button>
            <button
              onClick={() => setIsHistoryViewOpen(true)}
              className="flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface hover:text-foreground"
              title="History"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
            <PrintButton onClick={() => setIsPrintViewOpen(true)} />
          </div>
        </div>

      </div>
      </details>


      <ShiftIssuesDrawer
        slot={issuesDrawerSlot}
        conflicts={conflicts}
        isOpen={issuesDrawerSlotId !== null && issuesDrawerSlot !== null}
        onClose={handleCloseIssuesDrawer}
        onEditShift={handleEditFromIssuesDrawer}
      />

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
