import { useShallow } from 'zustand/react/shallow';
import { addDays, format, parseISO, isValid, startOfWeek } from "date-fns";
import { useMemo } from "react";
import { useScheduleStore, type ShiftSlot } from "@/store";
import { weekOffsetForDate } from "./scheduleViewportUtils";

export function useScheduleViewport() {
  const { startDate, scheduleViewport, setCurrentWeekOffset, shiftWeekOffset, setShiftTypeFilter, setShowConflictsOnly, setShowUnfilledOnly, setProviderSearchTerm, resetScheduleViewportFilters } = useScheduleStore(useShallow((s) => ({ startDate: s.startDate, scheduleViewport: s.scheduleViewport, setCurrentWeekOffset: s.setCurrentWeekOffset, shiftWeekOffset: s.shiftWeekOffset, setShiftTypeFilter: s.setShiftTypeFilter, setShowConflictsOnly: s.setShowConflictsOnly, setShowUnfilledOnly: s.setShowUnfilledOnly, setProviderSearchTerm: s.setProviderSearchTerm, resetScheduleViewportFilters: s.resetScheduleViewportFilters })));

  const anchorDate = useMemo(() => {
    let baseStart = parseISO(startDate);
    if (!isValid(baseStart)) {
      console.warn(`Invalid schedule startDate found: "${startDate}". Falling back to today.`);
      baseStart = new Date();
    }
    return addDays(baseStart, Math.round(scheduleViewport.currentWeekOffset * 7));
  }, [startDate, scheduleViewport.currentWeekOffset]);

  const weekDates = useMemo(() => {
    const first = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }, [anchorDate]);

  const weekDateStrings = useMemo(() => weekDates.map((date) => format(date, "yyyy-MM-dd")), [weekDates]);

  const isSlotInVisibleWeek = (slot: ShiftSlot): boolean => weekDateStrings.includes(slot.date);

  // All calendar views use the same week offset, so month navigation and the
  // toolbar stay in sync instead of maintaining two independent cursors.
  const goToDate = (date: Date) => {
    const offset = weekOffsetForDate(startDate, date);
    if (offset !== null) setCurrentWeekOffset(offset);
  };

  return {
    scheduleViewport,
    weekDates,
    anchorDate,
    weekDateStrings,
    isSlotInVisibleWeek,
    goToDate,
    setCurrentWeekOffset,
    shiftWeekOffset,
    setShiftTypeFilter,
    setShowConflictsOnly,
    setShowUnfilledOnly,
    setProviderSearchTerm,
    resetScheduleViewportFilters,
  };
}
