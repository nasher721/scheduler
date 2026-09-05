import { differenceInCalendarDays, isValid, parseISO } from "date-fns";

/** Fractional weeks retain the exact anchor date across month boundaries and DST. */
export function weekOffsetForDate(startDate: string, date: Date): number | null {
  const base = parseISO(startDate);
  if (!isValid(base) || !isValid(date)) return null;
  return differenceInCalendarDays(date, base) / 7;
}
