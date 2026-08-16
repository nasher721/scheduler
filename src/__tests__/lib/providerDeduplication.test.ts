import { describe, expect, it } from "vitest";
import {
  cleanProviderName,
  detectDuplicateProviders,
  mergeDuplicateProviders,
} from "@/lib/providerDeduplication";
import type { Provider, ShiftSlot } from "@/types";

describe("Provider Deduplication and Data Normalization Suite", () => {
  it("normalizes provider names and strips parentheticals, titles, and extra spacing", () => {
    expect(cleanProviderName("Kletsel (moonlighting)")).toBe("Kletsel");
    expect(cleanProviderName("  Dr. Barron, MD  ")).toBe("Barron");
    expect(cleanProviderName("Mitchell (Weekend Only)")).toBe("Mitchell");
    expect(cleanProviderName("Giampalmo and Mitchell")).toBe("Giampalmo and Mitchell");
  });

  it("detects typo-based duplicate providers with edit distance tolerances", () => {
    const providers: Provider[] = [
      {
        id: "p-1",
        name: "Barron",
        targetWeekDays: 2,
        targetWeekendDays: 1,
        targetWeekNights: 0,
        targetWeekendNights: 0,
        timeOffRequests: [],
        preferredDates: [],
        skills: ["NEURO_CRITICAL"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      },
      {
        id: "p-2",
        name: "Barrron", // typo duplicate
        targetWeekDays: 1,
        targetWeekendDays: 0,
        targetWeekNights: 0,
        targetWeekendNights: 0,
        timeOffRequests: [{ date: "2026-05-10", type: "PTO" }],
        preferredDates: [],
        skills: ["AIRWAY"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      },
      {
        id: "p-3",
        name: "Mitchell",
        targetWeekDays: 3,
        targetWeekendDays: 1,
        targetWeekNights: 1,
        targetWeekendNights: 0,
        timeOffRequests: [],
        preferredDates: [],
        skills: ["NEURO_CRITICAL"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      },
      {
        id: "p-4",
        name: "Mitchel", // typo duplicate
        targetWeekDays: 0,
        targetWeekendDays: 0,
        targetWeekNights: 0,
        targetWeekendNights: 0,
        timeOffRequests: [],
        preferredDates: [],
        skills: ["PROCEDURES"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      },
      {
        id: "p-5",
        name: "Kletsel (moonlighting)",
        targetWeekDays: 1,
        targetWeekendDays: 0,
        targetWeekNights: 0,
        targetWeekendNights: 0,
        timeOffRequests: [],
        preferredDates: [],
        skills: ["NEURO_CRITICAL"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      },
      {
        id: "p-6",
        name: "Kletsel",
        targetWeekDays: 2,
        targetWeekendDays: 1,
        targetWeekNights: 0,
        targetWeekendNights: 0,
        timeOffRequests: [],
        preferredDates: [],
        skills: ["NEURO_CRITICAL"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      },
    ];

    const duplicateGroups = detectDuplicateProviders(providers);
    expect(duplicateGroups.length).toBe(3);

    const groupNames = duplicateGroups.map((g) => g.canonical.name).sort();
    expect(groupNames).toEqual(["Barron", "Kletsel", "Mitchell"]);
  });

  it("merges duplicate providers and reassigns shift slots cleanly", () => {
    const primaryBarron: Provider = {
      id: "p-barron-1",
      name: "Barron",
      targetWeekDays: 3,
      targetWeekendDays: 1,
      targetWeekNights: 0,
      targetWeekendNights: 0,
      timeOffRequests: [{ date: "2026-05-01", type: "PTO" }],
      preferredDates: [],
      skills: ["NEURO_CRITICAL"],
      maxConsecutiveNights: 2,
      minDaysOffAfterNight: 1,
    };

    const duplicateBarrron: Provider = {
      id: "p-barron-2",
      name: "Barrron",
      targetWeekDays: 1,
      targetWeekendDays: 0,
      targetWeekNights: 1,
      targetWeekendNights: 0,
      timeOffRequests: [{ date: "2026-05-15", type: "PTO" }],
      preferredDates: [],
      skills: ["AIRWAY"],
      maxConsecutiveNights: 2,
      minDaysOffAfterNight: 1,
    };

    const slots: ShiftSlot[] = [
      {
        id: "slot-1",
        date: "2026-05-02",
        type: "DAY",
        providerId: "p-barron-1",
        isWeekendLayout: false,
        requiredSkill: "NEURO_CRITICAL",
        priority: "CRITICAL",
        location: "G20",
        locationGroup: "MAIN_CAMPUS_UNIT",
        servicePriority: "CRITICAL",
        serviceLocation: "G20",
      },
      {
        id: "slot-2",
        date: "2026-05-03",
        type: "NIGHT",
        providerId: "p-barron-2", // Assigned to typo record
        isWeekendLayout: false,
        requiredSkill: "AIRWAY",
        priority: "CRITICAL",
        location: "G20",
        locationGroup: "MAIN_CAMPUS_UNIT",
        servicePriority: "CRITICAL",
        serviceLocation: "G20",
      },
    ];

    const duplicateGroups = detectDuplicateProviders([primaryBarron, duplicateBarrron]);
    const mergeMap = duplicateGroups.map((g) => ({
      canonicalId: g.canonical.id,
      duplicateIds: g.duplicates.map((d) => d.id),
    }));
    const { mergedProviders, updatedSlots, mergedCount } = mergeDuplicateProviders(
      [primaryBarron, duplicateBarrron],
      slots,
      mergeMap,
    );

    expect(mergedCount).toBe(1);
    expect(mergedProviders.length).toBe(1);
    expect(mergedProviders[0].name).toBe("Barron");
    expect(mergedProviders[0].id).toBe("p-barron-1");
    // Skills union
    expect(mergedProviders[0].skills).toContain("NEURO_CRITICAL");
    expect(mergedProviders[0].skills).toContain("AIRWAY");
    // Time off union
    expect(mergedProviders[0].timeOffRequests).toEqual([
      { date: "2026-05-01", type: "PTO" },
      { date: "2026-05-15", type: "PTO" },
    ]);

    // Slot 2 reassigned to primary ID
    expect(updatedSlots[0].providerId).toBe("p-barron-1");
    expect(updatedSlots[1].providerId).toBe("p-barron-1");
  });
});
