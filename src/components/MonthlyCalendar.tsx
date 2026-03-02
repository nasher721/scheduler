import { useScheduleStore, type ShiftType, type Provider, type ShiftSlot } from "../store";
import { useDroppable } from "@dnd-kit/core";
import { parseISO, format, startOfMonth, isToday } from "date-fns";
import { motion } from "framer-motion";
import { Sun, Moon, AlertTriangle, Sparkles, Activity, Stethoscope, CalendarDays, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import React, { useMemo, useState } from "react";
import Calendar from "react-lightweight-calendar";
import "react-lightweight-calendar/dist/styles/styles.css";
import "./MonthlyCalendarOverrides.css";

const shiftConfig: Record<ShiftType, { label: string; icon: React.ReactNode; colorClass: string; bgClass: string; borderClass: string }> = {
  DAY: { label: 'Day Shift', icon: <Sun className="w-3 h-3" />, colorClass: 'text-success', bgClass: 'bg-success-muted/30', borderClass: 'border-success/20' },
  NIGHT: { label: 'Night Shift', icon: <Moon className="w-3 h-3" />, colorClass: 'text-primary', bgClass: 'bg-primary/5', borderClass: 'border-primary/10' },
  NMET: { label: 'NMET', icon: <Sparkles className="w-3 h-3" />, colorClass: 'text-warning', bgClass: 'bg-warning-muted/30', borderClass: 'border-warning/20' },
  JEOPARDY: { label: 'Jeopardy', icon: <AlertTriangle className="w-3 h-3" />, colorClass: 'text-error', bgClass: 'bg-error-muted/30', borderClass: 'border-error/20' },
  RECOVERY: { label: 'Recovery', icon: <Activity className="w-3 h-3" />, colorClass: 'text-teal-600', bgClass: 'bg-teal-50/50', borderClass: 'border-teal-200/50' },
  CONSULTS: { label: 'Consults', icon: <Stethoscope className="w-3 h-3" />, colorClass: 'text-sky-600', bgClass: 'bg-sky-50/50', borderClass: 'border-sky-200/50' },
  VACATION: { label: 'Out of Office', icon: <Moon className="w-3 h-3 opacity-0" />, colorClass: 'text-slate-400', bgClass: 'bg-slate-100/50', borderClass: 'border-slate-200/50' },
};

function CalendarSlot({ slot, provider }: { slot: ShiftSlot; provider?: Provider }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id, data: { slotId: slot.id } });
  const config = shiftConfig[slot.type];
  const isUnassignedCritical = slot.priority === "CRITICAL" && !provider;

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, zIndex: 20 }}
      aria-label={`${slot.type} ${slot.location} ${provider ? provider.name : "unassigned"}`}
      className={`group relative overflow-hidden rounded-lg p-2 mb-1 transition-all duration-200 ${isOver ? "ring-2 ring-primary bg-primary/5 shadow-lg" : provider ? `${config.bgClass} border ${config.borderClass} shadow-xs hover:shadow-sm` : "bg-slate-50/50 border border-dashed border-slate-200 hover:bg-white"} ${slot.isBackup ? "border-dashed border-rose-300 ring-1 ring-rose-100" : ""}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${provider ? 'bg-white/60 shadow-xs' : 'bg-slate-100/50'}`}>
          {React.cloneElement(config.icon as React.ReactElement, { className: `w-3 h-3 ${provider ? config.colorClass : 'text-slate-300'}` })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[8px] font-bold uppercase tracking-[0.15em] truncate ${provider ? 'text-slate-500' : 'text-slate-400'}`}>{slot.isBackup ? 'Backup Priority' : config.label}</span>
            {isUnassignedCritical && <span className="text-[8px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">Unresolved</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {provider ? <span className={`text-[10px] font-bold tracking-tight truncate ${config.colorClass}`}>{provider.name}</span> : <span className="text-[10px] font-medium italic text-slate-400">Unassigned</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function MonthlyCalendar() {
  const { slots, providers, startDate } = useScheduleStore();
  const [currentDate, setCurrentDate] = useState(startDate || format(new Date(), 'yyyy-MM-dd'));
  const [selectedDate, setSelectedDate] = useState(startDate || format(new Date(), 'yyyy-MM-dd'));

  const baseDate = parseISO(currentDate);
  const monthStart = startOfMonth(baseDate);

  const daySummaries = useMemo(() => {
    const grouped = new Map<string, ShiftSlot[]>();
    slots.forEach((slot) => {
      if (!grouped.has(slot.date)) grouped.set(slot.date, []);
      grouped.get(slot.date)?.push(slot);
    });

    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, daySlots]) => {
      const assigned = daySlots.filter((slot) => slot.providerId).length;
      const criticalUnfilled = daySlots.filter((slot) => slot.priority === "CRITICAL" && !slot.providerId).length;
      const unassigned = daySlots.length - assigned;
      const riskLevel = criticalUnfilled > 0 ? "high" : unassigned > 1 ? "medium" : "low";
      return { date, total: daySlots.length, assigned, unassigned, criticalUnfilled, riskLevel };
    });
  }, [slots]);

  const selectedDaySlots = useMemo(() => slots.filter((slot) => slot.date === selectedDate), [slots, selectedDate]);

  const calendarData = slots.map((slot) => ({
    id: slot.id,
    startTime: `${slot.date}T00:00:00Z`,
    endTime: `${slot.date}T23:59:59Z`,
    type: slot.type,
    providerId: slot.providerId,
    _slot: slot,
  }));

  const onDaySummarySelect = (date: string) => {
    setSelectedDate(date);
    setCurrentDate(date);
  };

  return (
    <div className="flex-1 satin-panel overflow-hidden flex flex-col monthly-calendar-container m-6 border-slate-200/40 shadow-xl" role="region" aria-label="Monthly staffing calendar">
      <div className="px-8 py-7 border-b border-slate-200/40 bg-white/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/60 shadow-inner flex items-center justify-center"><CalendarDays className="w-6 h-6 text-slate-400 stroke-[1.5]" /></div>
          <div>
            <h2 className="text-3xl font-serif text-slate-900 tracking-tight leading-none">{format(monthStart, "MMMM")} <span className="text-slate-300 font-light">{format(monthStart, "yyyy")}</span></h2>
            <p className="text-xs text-slate-500 mt-2">Today stays highlighted in the summary rail. Selected date: <span className="font-semibold text-slate-700">{selectedDate}</span></p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b bg-white/70 overflow-x-auto">
        <div className="flex gap-2 min-w-max" role="listbox" aria-label="Daily coverage summary">
          {daySummaries.map((day) => {
            const isSelected = selectedDate === day.date;
            const isCurrentDay = isToday(parseISO(day.date));
            const riskClass = day.riskLevel === "high" ? "border-rose-300 bg-rose-50" : day.riskLevel === "medium" ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50";
            return (
              <button
                key={day.date}
                onClick={() => onDaySummarySelect(day.date)}
                onKeyDown={(e) => {
                  const index = daySummaries.findIndex((d) => d.date === day.date);
                  if (e.key === "ArrowRight" && daySummaries[index + 1]) onDaySummarySelect(daySummaries[index + 1].date);
                  if (e.key === "ArrowLeft" && daySummaries[index - 1]) onDaySummarySelect(daySummaries[index - 1].date);
                }}
                className={`px-3 py-2 rounded-lg border text-left min-w-36 ${riskClass} ${isSelected ? "ring-2 ring-primary" : ""}`}
                aria-selected={isSelected}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  <span>{format(parseISO(day.date), "MMM d")}{isCurrentDay ? " • Today" : ""}</span>
                  {day.riskLevel === "high" ? <CircleAlert className="w-3.5 h-3.5 text-rose-600" /> : day.riskLevel === "medium" ? <TriangleAlert className="w-3.5 h-3.5 text-amber-700" /> : <CircleCheck className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div className="text-xs text-slate-700 mt-1">Coverage: {day.assigned}/{day.total}</div>
                <div className="text-[11px] text-slate-600">{day.criticalUnfilled > 0 ? `${day.criticalUnfilled} critical gaps` : `${day.unassigned} open slots`}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-0 flex-1 min-h-0">
        <div className="bg-slate-50/50 relative overflow-y-auto w-full h-full p-2">
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
              return <CalendarSlot slot={itemData._slot as ShiftSlot} provider={provider} />;
            }}
            disableHoverEffect={true}
          />
        </div>

        <aside className="border-l bg-white/80 p-4 overflow-y-auto" aria-label="Selected day quick peek">
          <h3 className="text-sm font-semibold text-slate-900">{format(parseISO(selectedDate), "EEEE, MMMM d")}</h3>
          <p className="text-xs text-slate-500 mb-3">Quick peek details without leaving the calendar.</p>
          <div className="space-y-2">
            {selectedDaySlots.map((slot) => {
              const provider = providers.find((p) => p.id === slot.providerId);
              return (
                <div key={slot.id} className="border rounded-lg p-2">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">{slot.type} • {slot.location}</div>
                  <div className="text-sm text-slate-800">{provider?.name ?? "Unassigned"}</div>
                </div>
              );
            })}
            {selectedDaySlots.length === 0 && <p className="text-xs text-slate-500">No slots available for this date.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
