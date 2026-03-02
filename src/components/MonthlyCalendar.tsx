import { useScheduleStore, type ShiftType, type Provider } from "../store";
import { useDroppable } from "@dnd-kit/core";
import {
    format,
    parseISO,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    startOfWeek,
    endOfWeek,
    isSameDay,
} from "date-fns";
import { motion } from "framer-motion";

function CalendarSlot({
    id,
    type,
    provider,
}: {
    id: string;
    type: ShiftType;
    provider?: Provider;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: { slotId: id },
    });

    const label =
        type === "DAY"
            ? "Day"
            : type === "NIGHT"
                ? "Night"
                : type === "NMET"
                    ? "NMET"
                    : "Jeopardy";

    const badgeClass = `shift-badge-${type.toLowerCase()}`;

    const bgColor = isOver
        ? "bg-blue-50/80 border-blue-400 border shadow-inner"
        : provider
            ? "bg-white/80 border-slate-200/50 shadow-sm"
            : "bg-slate-50/30 border-dashed border-slate-200/60";

    return (
        <div
            ref={setNodeRef}
            className={`min-h-[28px] rounded-md p-1.5 flex items-center justify-between gap-2 transition-all ${bgColor} border`}
        >
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                {label}
            </div>
            {provider ? (
                <motion.div
                    layoutId={`monthly-assigned-${id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`text-[11px] font-bold py-0.5 px-2 rounded-md truncate ${badgeClass}`}
                >
                    {provider.name}
                </motion.div>
            ) : (
                <div className="text-[10px] text-slate-400 italic font-medium px-1">
                    Open
                </div>
            )}
        </div>
    );
}

export function MonthlyCalendar() {
    const { slots, providers, startDate } = useScheduleStore();

    const baseDate = parseISO(startDate);
    const monthStart = startOfMonth(baseDate);
    const monthEnd = endOfMonth(monthStart);

    const startDateGrid = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const endDateGrid = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const gridDays = eachDayOfInterval({
        start: startDateGrid,
        end: endDateGrid,
    });

    return (
        <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col mt-4">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-slate-200/50 bg-white/40 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                    {format(monthStart, "MMMM yyyy")}
                </h2>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200/50 bg-slate-50/50">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div
                        key={day}
                        className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-100/50 gap-[1px]">
                {gridDays.map((day, idx) => {
                    const dayStr = format(day, "yyyy-MM-dd");
                    const daySlots = slots.filter((s) => s.date === dayStr);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.01 }}
                            key={day.toISOString()}
                            className={`min-h-[160px] p-2 flex flex-col gap-2 transition-colors ${isCurrentMonth ? "bg-white/80" : "bg-slate-50/50"
                                } hover:bg-white`}
                        >
                            {/* Day Header */}
                            <div className="flex items-center justify-between px-1 mb-1">
                                <span
                                    className={`text-sm font-semibold ${isCurrentMonth ? "text-slate-700" : "text-slate-400"
                                        } ${isToday
                                            ? "flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full shadow-md shadow-blue-500/20"
                                            : ""
                                        }`}
                                >
                                    {format(day, "d")}
                                </span>
                            </div>

                            {/* Slots Container */}
                            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px] scrollbar-thin scrollbar-thumb-slate-200">
                                {daySlots.length > 0 ? (
                                    daySlots.map((slot) => (
                                        <CalendarSlot
                                            key={slot.id}
                                            id={slot.id}
                                            type={slot.type}
                                            provider={providers.find(
                                                (p) => p.id === slot.providerId
                                            )}
                                        />
                                    ))
                                ) : (
                                    <div className="text-xs text-slate-400 italic px-2 py-4 text-center">
                                        No shifts
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
