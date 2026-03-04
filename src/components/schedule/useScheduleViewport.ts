import { addDays, format, parseISO } from "date-fns";
import { useMemo } from "react";
import { useScheduleStore, type ShiftSlot } from "@/store";

export function useScheduleViewport() {
  const {
    startDate,
    scheduleViewport,
    setCurrentWeekOffset,
    shiftWeekOffset,
    setShiftTypeFilter,
    setShowConflictsOnly,
    setShowUnfilledOnly,
    setProviderSearchTerm,
    resetScheduleViewportFilters,
  } = useScheduleStore();

  const weekDates = useMemo(() => {
    const baseStart = parseISO(startDate);
    const weekStart = addDays(baseStart, scheduleViewport.currentWeekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [startDate, scheduleViewport.currentWeekOffset]);

  const weekDateStrings = useMemo(() => weekDates.map((date) => format(date, "yyyy-MM-dd")), [weekDates]);

  const isSlotInVisibleWeek = (slot: ShiftSlot): boolean => weekDateStrings.includes(slot.date);

  return {
    scheduleViewport,
    weekDates,
    weekDateStrings,
    isSlotInVisibleWeek,
    setCurrentWeekOffset,
    shiftWeekOffset,
    setShiftTypeFilter,
    setShowConflictsOnly,
    setShowUnfilledOnly,
    setProviderSearchTerm,
    resetScheduleViewportFilters,
  };
}
