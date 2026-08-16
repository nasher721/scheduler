import { describe, expect, it } from "vitest";
import {
  buildAuthoritativeMetrics,
  isCriticalCoverageSlot,
  validateScheduleConsistency,
} from "@/lib/scheduleRisk";
import type { CustomRule, Provider, ShiftSlot } from "@/types";

const mockProvider = (overrides: Partial<Provider> = {}): Provider => ({
  id: "p-1",
  name: "Dr. Gregory",
  targetWeekDays: 2,
  targetWeekendDays: 1,
  targetWeekNights: 1,
  targetWeekendNights: 0,
  timeOffRequests: [],
  preferredDates: [],
  skills: ["NEURO_CRITICAL"],
  maxConsecutiveNights: 2,
  minDaysOffAfterNight: 1,
  ...overrides,
});

const mockSlot = (overrides: Partial<ShiftSlot> = {}): ShiftSlot => ({
  id: "s-1",
  date: "2026-05-01",
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

describe("Authoritative Schedule Metrics Single Source of Truth", () => {
  it("detects critical coverage slots consistently by priority, servicePriority, and critical location", () => {
    // 1. servicePriority CRITICAL
    expect(isCriticalCoverageSlot(mockSlot({ servicePriority: "CRITICAL", serviceLocation: "Jeopardy", locationGroup: "SUPPORT_SERVICE" }))).toBe(true);
    // 2. legacy priority CRITICAL
    expect(isCriticalCoverageSlot(mockSlot({ priority: "CRITICAL", servicePriority: "STANDARD", serviceLocation: "Jeopardy", locationGroup: "SUPPORT_SERVICE" }))).toBe(true);
    // 3. locationGroup MAIN_CAMPUS_UNIT
    expect(isCriticalCoverageSlot(mockSlot({ locationGroup: "MAIN_CAMPUS_UNIT", servicePriority: "STANDARD", priority: "STANDARD" }))).toBe(true);
    // 4. service locations G20, H22, Akron
    expect(isCriticalCoverageSlot(mockSlot({ serviceLocation: "G20", locationGroup: "SUPPORT_SERVICE", servicePriority: "STANDARD" }))).toBe(true);
    expect(isCriticalCoverageSlot(mockSlot({ serviceLocation: "H22", locationGroup: "SUPPORT_SERVICE", servicePriority: "STANDARD" }))).toBe(true);
    expect(isCriticalCoverageSlot(mockSlot({ serviceLocation: "Akron", locationGroup: "SUPPORT_SERVICE", servicePriority: "STANDARD" }))).toBe(true);
    // 5. non-critical slot
    expect(isCriticalCoverageSlot(mockSlot({ serviceLocation: "Jeopardy", locationGroup: "SUPPORT_SERVICE", servicePriority: "STANDARD", priority: "STANDARD" }))).toBe(false);
  });

  it("calculates exact unified metrics across gaps, mismatches, fatigue, and anomalies", () => {
    const providers = [
      mockProvider({ id: "p-1", name: "Dr. Gregory", skills: ["NEURO_CRITICAL"], targetWeekNights: 0 }),
      mockProvider({ id: "p-2", name: "Dr. House", skills: ["NIGHT_FLOAT"], targetWeekNights: 2 }),
    ];

    const slots = [
      // 1 filled valid slot
      mockSlot({ id: "s-1", providerId: "p-1", requiredSkill: "NEURO_CRITICAL", servicePriority: "CRITICAL" }),
      // 1 unfilled critical slot
      mockSlot({ id: "s-2", providerId: null, servicePriority: "CRITICAL", date: "2026-05-02" }),
      // 1 skill mismatch (p-2 has NIGHT_FLOAT but slot requires NEURO_CRITICAL)
      mockSlot({ id: "s-3", providerId: "p-2", requiredSkill: "NEURO_CRITICAL", servicePriority: "STANDARD" }),
      // 1 night shift assigned to p-1 who has 0 target night shifts (causing fatigue alert)
      mockSlot({ id: "s-4", providerId: "p-1", type: "NIGHT", servicePriority: "STANDARD" }),
    ];

    const rules: CustomRule[] = [];
    const anomalyAlertsCount = 3;

    const metrics = buildAuthoritativeMetrics(slots, providers, rules, anomalyAlertsCount);

    expect(metrics.totalSlots).toBe(4);
    expect(metrics.filledSlots).toBe(3);
    expect(metrics.unfilledSlots).toBe(1);
    expect(metrics.coveragePercent).toBe(75);
    expect(metrics.criticalUnfilledCount).toBe(1);
    expect(metrics.criticalUnfilledSlots[0].id).toBe("s-2");
    expect(metrics.skillMismatchCount).toBe(1);
    expect(metrics.skillMismatches[0].slot.id).toBe("s-3");
    expect(metrics.fatigueExposureCount).toBe(1);
    expect(metrics.fatiguedProviders[0].providerId).toBe("p-1");

    // Total alerts formula: criticalUnfilledCount (1) + skillMismatchCount (1) + fatigueExposureCount (1) + anomalyAlertsCount (3) = 6
    expect(metrics.totalAlertCount).toBe(6);
    expect(metrics.severity).toBe("critical");
  });

  it("validates schedule consistency and flags orphaned provider references", () => {
    const providers = [mockProvider({ id: "p-1" })];
    const slots = [
      mockSlot({ id: "s-1", providerId: "p-1" }),
      mockSlot({ id: "s-2", providerId: "p-deleted" }), // orphaned ID
      mockSlot({ id: "s-3", providerId: null, servicePriority: "CRITICAL" }), // critical gap
    ];

    const consistency = validateScheduleConsistency(slots, providers);
    expect(consistency.isValid).toBe(false);
    expect(consistency.issues.some((issue) => issue.includes("non-existent provider IDs"))).toBe(true);
    expect(consistency.issues.some((issue) => issue.includes("critical shift"))).toBe(true);
  });
});
