import { describe, expect, it } from "vitest";
import { buildScheduleRiskDigest, isCriticalCoverageSlot } from "@/lib/scheduleRisk";
import type { CustomRule, Provider, ShiftSlot } from "@/types";

const provider = (overrides: Partial<Provider> = {}): Provider => ({
  id: "provider-1",
  name: "Dr. Rivera",
  targetWeekDays: 1,
  targetWeekendDays: 0,
  targetWeekNights: 0,
  targetWeekendNights: 0,
  timeOffRequests: [],
  preferredDates: [],
  skills: ["NEURO_CRITICAL"],
  maxConsecutiveNights: 2,
  minDaysOffAfterNight: 1,
  ...overrides,
});

const slot = (overrides: Partial<ShiftSlot> = {}): ShiftSlot => ({
  id: "slot-1",
  date: "2026-04-01",
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

describe("scheduleRisk", () => {
  it("treats legacy critical priority and service priority as critical coverage", () => {
    expect(isCriticalCoverageSlot(slot({ priority: "CRITICAL", servicePriority: "STANDARD" }))).toBe(true);
    expect(isCriticalCoverageSlot(slot({ priority: "STANDARD", servicePriority: "CRITICAL" }))).toBe(true);
    expect(isCriticalCoverageSlot(slot({ priority: "STANDARD", servicePriority: "FLEXIBLE" }))).toBe(false);
  });

  it("builds a live risk digest from gaps, skill mismatches, and guardrails", () => {
    const providers = [
      provider(),
      provider({ id: "provider-2", name: "Dr. Chen", skills: ["NIGHT_FLOAT"], targetWeekDays: 0 }),
    ];
    const slots = [
      slot({ id: "critical-gap", priority: "CRITICAL" }),
      slot({ id: "mismatch", providerId: "provider-1", requiredSkill: "AIRWAY" }),
      slot({ id: "overload", providerId: "provider-1", requiredSkill: "NEURO_CRITICAL" }),
    ];
    const rules: CustomRule[] = [];

    const digest = buildScheduleRiskDigest(slots, providers, rules);

    expect(digest.coveragePercent).toBe(67);
    expect(digest.criticalUnfilled.map((s) => s.id)).toEqual(["critical-gap"]);
    expect(digest.skillMismatches).toHaveLength(1);
    expect(digest.overloadedProviders[0].providerName).toBe("Dr. Rivera");
    expect(digest.hasMaxShiftProtection).toBe(false);
    expect(digest.severity).toBe("critical");
    expect(digest.recommendedActions.some((action) => action.includes("critical coverage gap"))).toBe(true);
  });

  it("reports healthy schedules when coverage, skills, load, and rules are aligned", () => {
    const providers = [provider({ skills: ["NEURO_CRITICAL", "NIGHT_FLOAT"] })];
    const slots = [slot({ providerId: "provider-1" })];
    const rules: CustomRule[] = [
      { id: "rule-1", type: "MAX_SHIFTS_PER_WEEK", providerId: "provider-1", maxShifts: 4 },
    ];

    const digest = buildScheduleRiskDigest(slots, providers, rules);

    expect(digest.severity).toBe("healthy");
    expect(digest.recommendedActions).toEqual(["Schedule is ready for export or scenario comparison."]);
  });
});
