import { useScheduleStore, type ShiftType, type Provider, type ShiftSlot } from "../store";
import { useDroppable } from "@dnd-kit/core";
import { parseISO, format, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { Sun, Moon, AlertTriangle, Sparkles, Activity, Stethoscope, CalendarDays } from "lucide-react";
import React, { useState } from "react";
import Calendar from "react-lightweight-calendar";
import "react-lightweight-calendar/dist/styles/styles.css";

const shiftConfig: Record<ShiftType, { label: string; icon: React.ReactNode; colorClass: string; bgClass: string; borderClass: string }> = {
  DAY: {
    label: 'Day Shift',
    icon: <Sun className="w-3 h-3" />,
    colorClass: 'text-success',
    bgClass: 'bg-success-muted/30',
    borderClass: 'border-success/20'
  },
  NIGHT: {
    label: 'Night Shift',
    icon: <Moon className="w-3 h-3" />,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/5',
    borderClass: 'border-primary/10'
  },
  NMET: {
    label: 'NMET',
    icon: <Sparkles className="w-3 h-3" />,
    colorClass: 'text-warning',
    bgClass: 'bg-warning-muted/30',
    borderClass: 'border-warning/20'
  },
  JEOPARDY: {
    label: 'Jeopardy',
    icon: <AlertTriangle className="w-3 h-3" />,
    colorClass: 'text-error',
    bgClass: 'bg-error-muted/30',
    borderClass: 'border-error/20'
  },
  RECOVERY: {
    label: 'Recovery',
    icon: <Activity className="w-3 h-3" />,
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50/50',
    borderClass: 'border-teal-200/50'
  },
  CONSULTS: {
    label: 'Consults',
    icon: <Stethoscope className="w-3 h-3" />,
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-50/50',
    borderClass: 'border-sky-200/50'
  },
  VACATION: {
    label: 'Out of Office',
    icon: <Moon className="w-3 h-3 opacity-0" />,
    colorClass: 'text-slate-400',
    bgClass: 'bg-slate-100/50',
    borderClass: 'border-slate-200/50'
  },
};

function CalendarSlot({
  slot,
  provider,
}: {
  slot: ShiftSlot;
  provider?: Provider;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    data: { slotId: slot.id },
  });

  const config = shiftConfig[slot.type];

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, zIndex: 20 }}
      className={`group relative overflow-hidden rounded-lg p-2 mb-1 transition-all duration-300 ${isOver
        ? "ring-2 ring-primary bg-primary/5 shadow-lg border-primary/20 scale-[1.03]"
        : provider
          ? `${config.bgClass} border ${config.borderClass} shadow-xs hover:shadow-sm`
          : "bg-slate-50/50 border border-dashed border-slate-200 hover:bg-white hover:border-slate-300"
        } ${slot.isBackup ? "border-dashed border-rose-300 ring-1 ring-rose-100" : ""}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${provider ? 'bg-white/60 shadow-xs' : 'bg-slate-100/50'}`}>
          {React.cloneElement(config.icon as React.ReactElement, {
            className: `w-3 h-3 ${provider ? config.colorClass : 'text-slate-300'}`
          })}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[8px] font-bold uppercase tracking-[0.15em] truncate ${provider ? 'text-slate-500' : 'text-slate-400'}`}>
              {slot.isBackup ? 'Backup Priority' : config.label}
            </span>
            {slot.location && (
              <span className="text-[7px] text-slate-300 font-medium px-1.5 py-0.5 rounded-full border border-slate-200/50 bg-white/30 truncate max-w-[40px]">
                {slot.location}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            {provider ? (
              <span className={`text-[10px] font-bold tracking-tight truncate ${config.colorClass}`}>
                {provider.name}
              </span>
            ) : (
              <span className="text-[10px] font-medium italic text-slate-300">
                Unassigned
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Atmospheric Highlight for assigned slots */}
      {provider && (
        <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full blur-2xl opacity-40 transition-opacity group-hover:opacity-60 ${config.bgClass}`} />
      )}
    </motion.div>
  );
}

// Override component CSS to fix the calendar internal styles to match our premium UI
import "./MonthlyCalendarOverrides.css";

export function MonthlyCalendar() {
  const { slots, providers, startDate } = useScheduleStore();

  // Need local state for calendar navigation
  const [currentDate, setCurrentDate] = useState(startDate || format(new Date(), 'yyyy-MM-dd'));

  const baseDate = parseISO(currentDate);
  const monthStart = startOfMonth(baseDate);

  // Map our slots format to the format required by react-lightweight-calendar
  const calendarData = slots.map(slot => {
    return {
      id: slot.id,
      // Date must be ISO 8601, typically we can construct one like "2023-06-02T00:00:00Z"
      // Assuming slot.date is "YYYY-MM-DD"
      startTime: `${slot.date}T00:00:00Z`,
      endTime: `${slot.date}T23:59:59Z`,
      // Original data properties are passed down too
      type: slot.type,
      providerId: slot.providerId,
      isBackup: slot.isBackup,
      _slot: slot, // Pass the whole slot reference for the renderItem
    };
  });

  return (
    <div className="flex-1 satin-panel overflow-hidden flex flex-col monthly-calendar-container m-6 border-slate-200/40 shadow-xl">
      {/* Calendar Header */}
      <div className="px-8 py-7 border-b border-slate-200/40 bg-white/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/60 shadow-inner flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-slate-400 stroke-[1.5]" />
          </div>
          <div>
            <h2 className="text-3xl font-serif text-slate-900 tracking-tight leading-none">
              {format(monthStart, "MMMM")} <span className="text-slate-300 font-light">{format(monthStart, "yyyy")}</span>
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Inventory Status:</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-full text-[9px] font-bold text-slate-500">
                  {slots.length} Total Nodes
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-full text-[9px] font-bold text-primary">
                  {slots.filter(s => s.providerId).length} Assigned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-6">
          {Object.entries(shiftConfig).slice(0, 4).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${config.bgClass} border ${config.borderClass}`}></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-slate-50/50 relative overflow-y-auto w-full h-full p-2">
        <Calendar
          data={calendarData}
          currentView='MONTH'
          currentDate={currentDate}
          setCurrentDate={(date) => setCurrentDate(typeof date === 'string' ? date : format(date, 'yyyy-MM-dd'))}
          activeTimeDateField='startTime'
          weekStartsOn={1}
          renderItem={(data) => {
            const itemData = data as Record<string, unknown>;
            const provider = providers.find((p) => p.id === itemData.providerId);
            return (
              <CalendarSlot
                slot={itemData._slot as ShiftSlot}
                provider={provider}
              />
            );
          }}
          disableHoverEffect={true}
        />
      </div>
    </div>
  );
}
