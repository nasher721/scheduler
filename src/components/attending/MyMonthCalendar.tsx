import { useMemo } from "react";
import { addMonths, endOfMonth, format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShiftColorClasses } from "@/lib/shiftColors";
import { isCriticalCoverageSlot } from "@/lib/scheduleRisk";
import type { ShiftSlot } from "@/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MyMonthCalendarProps {
    month: Date;
    onMonthChange: (next: Date) => void;
    slots: ShiftSlot[];
    providerId: string;
    timeOffDates: Set<string>;
    selectedDate: string | null;
    onSelectDate: (date: string | null) => void;
}

interface DayCell {
    dateISO: string;
    dayOfMonth: number;
    myShifts: ShiftSlot[];
    hasTimeOff: boolean;
    unfilledCritical: number;
}

/**
 * Personal month grid for an attending: their own shifts as colored chips,
 * time-off markers, and a red indicator on days where the department still
 * has unfilled critical coverage. Clicking a day opens the full-day roster.
 */
export function MyMonthCalendar({
    month,
    onMonthChange,
    slots,
    providerId,
    timeOffDates,
    selectedDate,
    onSelectDate,
}: MyMonthCalendarProps) {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    const monthKey = format(month, "yyyy-MM");

    const cells = useMemo<(DayCell | null)[]>(() => {
        const monthSlots = slots.filter((s) => s.date.startsWith(monthKey));
        const byDate = new Map<string, ShiftSlot[]>();
        for (const slot of monthSlots) {
            const list = byDate.get(slot.date);
            if (list) list.push(slot);
            else byDate.set(slot.date, [slot]);
        }

        const leadingBlanks = getDay(startOfMonth(month));
        const dayCount = getDaysInMonth(month);
        const result: (DayCell | null)[] = Array.from({ length: leadingBlanks }, () => null);

        for (let day = 1; day <= dayCount; day += 1) {
            const dateISO = `${monthKey}-${String(day).padStart(2, "0")}`;
            const daySlots = byDate.get(dateISO) ?? [];
            result.push({
                dateISO,
                dayOfMonth: day,
                myShifts: daySlots.filter((s) => s.providerId === providerId),
                hasTimeOff: timeOffDates.has(dateISO),
                unfilledCritical: daySlots.filter((s) => !s.providerId && isCriticalCoverageSlot(s)).length,
            });
        }
        return result;
    }, [slots, monthKey, month, providerId, timeOffDates]);

    const hasScheduleData = useMemo(
        () => slots.some((s) => s.date >= format(startOfMonth(month), "yyyy-MM-dd") && s.date <= format(endOfMonth(month), "yyyy-MM-dd")),
        [slots, month],
    );

    return (
        <section className="satin-panel p-4 sm:p-6" aria-label="My month calendar">
            <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">{format(month, "MMMM yyyy")}</h3>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onMonthChange(new Date())}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-secondary/60"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => onMonthChange(addMonths(month, -1))}
                        className="rounded-lg border border-border p-1.5 text-foreground-muted transition-colors hover:bg-secondary/60"
                        aria-label="Previous month"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMonthChange(addMonths(month, 1))}
                        className="rounded-lg border border-border p-1.5 text-foreground-muted transition-colors hover:bg-secondary/60"
                        aria-label="Next month"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1" role="grid">
                {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                        {label}
                    </div>
                ))}
                {cells.map((cell, idx) =>
                    cell === null ? (
                        <div key={`blank-${idx}`} aria-hidden />
                    ) : (
                        <button
                            key={cell.dateISO}
                            type="button"
                            onClick={() => onSelectDate(selectedDate === cell.dateISO ? null : cell.dateISO)}
                            aria-pressed={selectedDate === cell.dateISO}
                            aria-label={`${cell.dateISO}, ${cell.myShifts.length} shift${cell.myShifts.length === 1 ? "" : "s"}`}
                            className={cn(
                                "flex min-h-[3.5rem] flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left transition-colors sm:min-h-[4.25rem]",
                                selectedDate === cell.dateISO
                                    ? "border-primary bg-primary/10"
                                    : "border-border/60 hover:border-primary/40 hover:bg-secondary/40",
                                cell.hasTimeOff && "bg-secondary/50",
                            )}
                        >
                            <span className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        "text-xs font-semibold",
                                        cell.dateISO === todayISO
                                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground"
                                            : "text-foreground-secondary",
                                    )}
                                >
                                    {cell.dayOfMonth}
                                </span>
                                {cell.unfilledCritical > 0 && (
                                    <span
                                        className="h-1.5 w-1.5 rounded-full bg-error"
                                        title={`${cell.unfilledCritical} unfilled critical slot(s)`}
                                    />
                                )}
                            </span>
                            {cell.hasTimeOff && (
                                <span className="truncate rounded border border-border bg-surface px-1 text-[9px] font-bold uppercase tracking-wide text-foreground-muted">
                                    Off
                                </span>
                            )}
                            {cell.myShifts.slice(0, 2).map((shift) => (
                                <span
                                    key={shift.id}
                                    className={cn(
                                        "truncate rounded border px-1 text-[9px] font-bold uppercase tracking-wide",
                                        getShiftColorClasses(shift.type),
                                    )}
                                >
                                    {shift.type === "DAY" ? shift.serviceLocation : shift.type}
                                </span>
                            ))}
                            {cell.myShifts.length > 2 && (
                                <span className="text-[9px] font-semibold text-foreground-muted">+{cell.myShifts.length - 2} more</span>
                            )}
                        </button>
                    ),
                )}
            </div>

            {!hasScheduleData && (
                <p className="mt-3 text-xs text-foreground-muted">
                    No schedule has been published for this month yet.
                </p>
            )}
        </section>
    );
}
