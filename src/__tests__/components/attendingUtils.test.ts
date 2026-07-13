import { describe, expect, it } from "vitest";
import {
    describeDaysUntil,
    expandDateRange,
    getDayRoster,
    getDepartmentAverageLoad,
    getMonthlyLoad,
    getUpcomingShifts,
    getUpcomingTimeOff,
    mergeTimeOffRequests,
} from "@/components/attending/attendingUtils";
import type { Provider, ShiftSlot } from "@/types";

const provider = (overrides: Partial<Provider> = {}): Provider => ({
    id: "provider-1",
    name: "Dr. Rivera",
    targetWeekDays: 4,
    targetWeekendDays: 1,
    targetWeekNights: 2,
    targetWeekendNights: 1,
    timeOffRequests: [],
    preferredDates: [],
    skills: ["NEURO_CRITICAL"],
    maxConsecutiveNights: 2,
    minDaysOffAfterNight: 1,
    ...overrides,
});

const slot = (overrides: Partial<ShiftSlot> = {}): ShiftSlot => ({
    id: `slot-${Math.random()}`,
    date: "2026-07-01",
    type: "DAY",
    providerId: null,
    isWeekendLayout: false,
    requiredSkill: "NEURO_CRITICAL",
    priority: "STANDARD",
    location: "G20",
    locationGroup: "MAIN_CAMPUS_UNIT",
    servicePriority: "STANDARD",
    serviceLocation: "G20",
    ...overrides,
});

describe("getMonthlyLoad", () => {
    it("counts only the provider's working shifts inside the month", () => {
        const slots = [
            slot({ providerId: "provider-1", date: "2026-07-02", type: "DAY", priority: "CRITICAL" }),
            slot({ providerId: "provider-1", date: "2026-07-04", type: "NIGHT", isWeekendLayout: true }),
            slot({ providerId: "provider-1", date: "2026-07-10", type: "VACATION" }),
            slot({ providerId: "provider-1", date: "2026-08-01", type: "DAY" }),
            slot({ providerId: "provider-2", date: "2026-07-02", type: "DAY" }),
        ];
        const load = getMonthlyLoad(slots, "provider-1", "2026-07");
        expect(load).toEqual({ total: 2, days: 1, nights: 1, weekend: 1, critical: 1 });
    });
});

describe("getDepartmentAverageLoad", () => {
    it("averages working shifts across all providers", () => {
        const providers = [provider(), provider({ id: "provider-2", name: "Dr. Chen" })];
        const slots = [
            slot({ providerId: "provider-1", date: "2026-07-02" }),
            slot({ providerId: "provider-1", date: "2026-07-03" }),
            slot({ providerId: "provider-2", date: "2026-07-03" }),
            slot({ providerId: "provider-2", date: "2026-07-05", type: "RECOVERY" }),
        ];
        expect(getDepartmentAverageLoad(slots, providers, "2026-07")).toBe(1.5);
    });

    it("returns 0 with no providers", () => {
        expect(getDepartmentAverageLoad([], [], "2026-07")).toBe(0);
    });
});

describe("getUpcomingShifts", () => {
    it("returns the provider's shifts on or after the date, sorted", () => {
        const slots = [
            slot({ providerId: "provider-1", date: "2026-07-20" }),
            slot({ providerId: "provider-1", date: "2026-07-10" }),
            slot({ providerId: "provider-1", date: "2026-07-01" }),
            slot({ providerId: "provider-2", date: "2026-07-15" }),
        ];
        const upcoming = getUpcomingShifts(slots, "provider-1", "2026-07-05");
        expect(upcoming.map((s) => s.date)).toEqual(["2026-07-10", "2026-07-20"]);
    });
});

describe("describeDaysUntil", () => {
    it("labels today, tomorrow, and future dates", () => {
        expect(describeDaysUntil("2026-07-13", "2026-07-13")).toBe("Today");
        expect(describeDaysUntil("2026-07-14", "2026-07-13")).toBe("Tomorrow");
        expect(describeDaysUntil("2026-07-20", "2026-07-13")).toBe("In 7 days");
        expect(describeDaysUntil("2026-07-10", "2026-07-13")).toBe("3d ago");
    });
});

describe("expandDateRange", () => {
    it("expands an inclusive range", () => {
        expect(expandDateRange("2026-07-01", "2026-07-03")).toEqual([
            "2026-07-01",
            "2026-07-02",
            "2026-07-03",
        ]);
    });

    it("returns empty for inverted or missing ranges", () => {
        expect(expandDateRange("2026-07-05", "2026-07-01")).toEqual([]);
        expect(expandDateRange("", "2026-07-01")).toEqual([]);
    });

    it("caps runaway ranges at 60 days", () => {
        expect(expandDateRange("2026-01-01", "2027-01-01")).toHaveLength(60);
    });
});

describe("mergeTimeOffRequests", () => {
    it("adds new dates and replaces conflicts on the same date", () => {
        const merged = mergeTimeOffRequests(
            [{ date: "2026-07-02", type: "SICK" }, { date: "2026-07-01", type: "PTO" }],
            ["2026-07-02", "2026-07-03"],
            "CME",
        );
        expect(merged).toEqual([
            { date: "2026-07-01", type: "PTO" },
            { date: "2026-07-02", type: "CME" },
            { date: "2026-07-03", type: "CME" },
        ]);
    });
});

describe("getUpcomingTimeOff", () => {
    it("filters out past requests and sorts ascending", () => {
        const upcoming = getUpcomingTimeOff(
            [
                { date: "2026-07-20", type: "PTO" },
                { date: "2026-07-01", type: "PTO" },
                { date: "2026-07-15", type: "CME" },
            ],
            "2026-07-13",
        );
        expect(upcoming.map((r) => r.date)).toEqual(["2026-07-15", "2026-07-20"]);
    });
});

describe("getDayRoster", () => {
    it("resolves provider names and puts critical services first", () => {
        const providers = [provider()];
        const slots = [
            slot({ date: "2026-07-13", servicePriority: "FLEXIBLE", serviceLocation: "Jeopardy" }),
            slot({ date: "2026-07-13", servicePriority: "CRITICAL", serviceLocation: "G20", providerId: "provider-1" }),
            slot({ date: "2026-07-14", servicePriority: "CRITICAL", serviceLocation: "H22" }),
        ];
        const roster = getDayRoster(slots, providers, "2026-07-13");
        expect(roster.map((e) => e.slot.serviceLocation)).toEqual(["G20", "Jeopardy"]);
        expect(roster[0].providerName).toBe("Dr. Rivera");
        expect(roster[1].providerName).toBeNull();
    });
});
