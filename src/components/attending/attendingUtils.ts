import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Provider, ShiftSlot, TimeOffRequest } from "@/types";

/** Aggregated shift load for one provider over a window of slots. */
export interface ShiftLoad {
    total: number;
    days: number;
    nights: number;
    weekend: number;
    critical: number;
}

const emptyLoad = (): ShiftLoad => ({ total: 0, days: 0, nights: 0, weekend: 0, critical: 0 });

const isWorkingAssignment = (slot: ShiftSlot) => slot.type !== "VACATION" && slot.type !== "RECOVERY";

/** Sum a provider's assigned working shifts within a calendar month (yyyy-MM). */
export function getMonthlyLoad(slots: ShiftSlot[], providerId: string, monthKey: string): ShiftLoad {
    const load = emptyLoad();
    for (const slot of slots) {
        if (slot.providerId !== providerId) continue;
        if (!slot.date.startsWith(monthKey)) continue;
        if (!isWorkingAssignment(slot)) continue;
        load.total += 1;
        if (slot.type === "NIGHT") load.nights += 1;
        else load.days += 1;
        if (slot.isWeekendLayout) load.weekend += 1;
        if (slot.priority === "CRITICAL") load.critical += 1;
    }
    return load;
}

/**
 * Average working-shift count per provider for a month, used as the fairness
 * baseline an attending compares their own load against.
 */
export function getDepartmentAverageLoad(slots: ShiftSlot[], providers: Provider[], monthKey: string): number {
    if (providers.length === 0) return 0;
    let total = 0;
    const providerIds = new Set(providers.map((p) => p.id));
    for (const slot of slots) {
        if (!slot.providerId || !providerIds.has(slot.providerId)) continue;
        if (!slot.date.startsWith(monthKey)) continue;
        if (!isWorkingAssignment(slot)) continue;
        total += 1;
    }
    return Math.round((total / providers.length) * 10) / 10;
}

/** A provider's assigned slots on/after a date, soonest first. */
export function getUpcomingShifts(slots: ShiftSlot[], providerId: string, fromDate: string): ShiftSlot[] {
    return slots
        .filter((s) => s.providerId === providerId && s.date >= fromDate)
        .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

/** Human label for how far away an ISO date is from today (ISO). */
export function describeDaysUntil(dateISO: string, todayISO: string): string {
    const diff = differenceInCalendarDays(parseISO(dateISO), parseISO(todayISO));
    if (diff <= 0) return diff === 0 ? "Today" : `${Math.abs(diff)}d ago`;
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
}

/**
 * Expand an inclusive ISO date range into individual dates.
 * Capped at 60 days so a mistyped year cannot flood the store.
 */
export function expandDateRange(startISO: string, endISO: string): string[] {
    if (!startISO || !endISO || endISO < startISO) return [];
    const dates: string[] = [];
    let cursor = parseISO(startISO);
    const end = parseISO(endISO);
    while (cursor <= end && dates.length < 60) {
        dates.push(format(cursor, "yyyy-MM-dd"));
        cursor = addDays(cursor, 1);
    }
    return dates;
}

/**
 * Merge new time-off dates into an existing request list without duplicating
 * dates. An existing request on the same date is replaced by the new type.
 */
export function mergeTimeOffRequests(
    existing: TimeOffRequest[],
    dates: string[],
    type: TimeOffRequest["type"],
): TimeOffRequest[] {
    const incoming = new Set(dates);
    const kept = existing.filter((r) => !incoming.has(r.date));
    return [...kept, ...dates.map((date) => ({ date, type }))].sort((a, b) => a.date.localeCompare(b.date));
}

/** Time-off requests on/after a date, soonest first. */
export function getUpcomingTimeOff(requests: TimeOffRequest[], fromDate: string): TimeOffRequest[] {
    return requests
        .filter((r) => r.date >= fromDate)
        .sort((a, b) => a.date.localeCompare(b.date));
}

export interface DayRosterEntry {
    slot: ShiftSlot;
    providerName: string | null;
}

/** All slots for a date with resolved provider names, critical services first. */
export function getDayRoster(slots: ShiftSlot[], providers: Provider[], dateISO: string): DayRosterEntry[] {
    const nameById = new Map(providers.map((p) => [p.id, p.name]));
    const priorityRank = { CRITICAL: 0, STANDARD: 1, FLEXIBLE: 2 } as const;
    return slots
        .filter((s) => s.date === dateISO)
        .sort(
            (a, b) =>
                priorityRank[a.servicePriority] - priorityRank[b.servicePriority]
                || a.serviceLocation.localeCompare(b.serviceLocation),
        )
        .map((slot) => ({
            slot,
            providerName: slot.providerId ? nameById.get(slot.providerId) ?? null : null,
        }));
}
