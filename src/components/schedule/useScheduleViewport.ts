import { useShallow } from 'zustand/react/shallow';
import { addDays, format, parseISO, isValid } from "date-fns";
import { useMemo } from "react";
import { useScheduleStore, type ShiftSlot } from "@/store";

export function useScheduleViewport() {
  const { startDate, scheduleViewport, setCurrentWeekOffset, shiftWeekOffset, setShiftTypeFilter, setShowConflictsOnly, setShowUnfilledOnly, setProviderSearchTerm, resetScheduleViewportFilters } = useScheduleStore(useShallow((s) => ({ startDate: s.startDate, scheduleViewport: s.scheduleViewport, setCurrentWeekOffset: s.setCurrentWeekOffset, shiftWeekOffset: s.shiftWeekOffset, setShiftTypeFilter: s.setShiftTypeFilter, setShowConflictsOnly: s.setShowConflictsOnly, setShowUnfilledOnly: s.setShowUnfilledOnly, setProviderSearchTerm: s.setProviderSearchTerm, resetScheduleViewportFilters: s.resetScheduleViewportFilters })));

  const weekDates = useMemo(() => {
    let baseStart = parseISO(startDate);
    if (!isValid(baseStart)) {
      console.warn(`Invalid schedule startDate found: "${startDate}". Falling back to today.`);
      baseStart = new Date();
    }
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
