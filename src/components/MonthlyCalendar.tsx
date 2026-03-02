import { useScheduleStore, type ShiftType, type Provider, type ShiftSlot } from "../store";
import { useDroppable } from "@dnd-kit/core";
import { parseISO, format, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { Sun, Moon, AlertTriangle, Sparkles, MapPin, Activity, Stethoscope } from "lucide-react";
import React, { useState } from "react";
import Calendar from "react-lightweight-calendar";
import "react-lightweight-calendar/dist/styles/styles.css";

const shiftConfig: Record<ShiftType, { label: string; icon: React.ReactNode; colorClass: string; bgClass: string }> = {
  DAY: {
    label: 'Day',
    icon: <Sun className="w-3 h-3" />,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50 border-emerald-200'
  },
  NIGHT: {
    label: 'Night',
    icon: <Moon className="w-3 h-3" />,
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50 border-indigo-200'
  },
  NMET: {
    label: 'NMET',
    icon: <Sparkles className="w-3 h-3" />,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50 border-amber-200'
  },
  JEOPARDY: {
    label: 'Jeopardy',
    icon: <AlertTriangle className="w-3 h-3" />,
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50 border-rose-200'
  },
  RECOVERY: {
    label: 'Recovery',
    icon: <Activity className="w-3 h-3" />,
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50 border-teal-200'
  },
  CONSULTS: {
    label: 'Consults',
    icon: <Stethoscope className="w-3 h-3" />,
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-50 border-sky-200'
  },
  VACATION: {
    label: 'Vacation',
    icon: <Moon className="w-3 h-3" />,
    colorClass: 'text-slate-500',
    bgClass: 'bg-slate-100 border-slate-200'
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01, translateY: -1 }}
      className={`min-h-[34px] rounded-xl p-2.5 mb-1.5 flex items-center justify-between gap-3 transition-all border ${isOver
        ? 'border-blue-500 bg-blue-50/90 shadow-lg ring-2 ring-blue-500/20'
        : provider
          ? 'bg-white/95 border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80'
          : 'bg-slate-50/40 border-dashed border-slate-300/40 hover:bg-slate-100/60'
        } ${slot.isBackup || slot.type === 'JEOPARDY' ? 'ring-1 ring-rose-200 bg-rose-50/30' : ''}`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${config.colorClass}`}>
          {config.icon}
          <span>{slot.isBackup ? 'BACKUP' : config.label}</span>
        </div>
        {slot.location && (
          <div className="flex items-center gap-1 text-slate-400 font-medium text-[8px]" title={slot.location}>
            <MapPin className="w-2 h-2" />
            <span className="truncate max-w-[60px]">{slot.location}</span>
          </div>
        )}
      </div>
      {provider ? (
        <motion.div
          layoutId={`monthly-assigned-${slot.id}`}
          className={`text-[10.5px] font-bold py-1 px-3 rounded-lg truncate shadow-sm border ${config.bgClass} ${config.colorClass} border-white/40 backdrop-blur-sm`}
        >
          {provider.name}
        </motion.div>
      ) : (
        <div className="text-[10px] text-slate-400 font-bold px-2 py-1 rounded-md bg-slate-100/30 border border-slate-200/20 italic">
          OPEN
        </div>
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
    <div className="flex-1 glass-panel-heavy overflow-hidden flex flex-col monthly-calendar-container">
      {/* Calendar Header */}
      <div className="px-6 py-5 border-b border-slate-200/50 bg-gradient-to-r from-white/60 to-white/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              {format(monthStart, "MMMM yyyy")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {slots.length} shifts • {slots.filter(s => s.providerId).length} assigned
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-4">
          {Object.entries(shiftConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${config.bgClass} border`}></div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{config.label}</span>
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
