import { describe, expect, it } from "vitest";
import { weekOffsetForDate } from "./scheduleViewportUtils";
import { addDays, format, parseISO } from "date-fns";

describe("schedule viewport date navigation", () => {
  it("retains the selected date relative to the schedule's Monday", () => {
    expect(weekOffsetForDate("2026-09-07", new Date("2026-09-16T12:00:00"))).toBe(9 / 7);
    expect(weekOffsetForDate("2026-09-07", new Date("2026-08-31T12:00:00"))).toBe(-1);
  });

  it("keeps October navigation in October when its first week starts in September", () => {
    const offset = weekOffsetForDate("2026-09-07", parseISO("2026-10-01"));
    expect(format(addDays(parseISO("2026-09-07"), Math.round(offset! * 7)), "yyyy-MM-dd")).toBe("2026-10-01");
  });

  it("uses calendar days across daylight saving changes", () => {
    expect(weekOffsetForDate("2026-10-26", parseISO("2026-11-02"))).toBe(1);
  });

  it("rejects invalid dates", () => {
    expect(weekOffsetForDate("bad-date", new Date("2026-09-16T12:00:00"))).toBeNull();
  });
});
