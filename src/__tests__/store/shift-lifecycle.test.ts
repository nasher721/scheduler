import { describe, it, expect, beforeEach } from "vitest";
import { useScheduleStore } from "@/store";
import type { ShiftSlot, Provider, ShiftLifecycleStatus } from "@/types";

const TEST_SLOT: ShiftSlot = {
  id: "test-slot-1",
  date: "2026-04-01",
  type: "DAY",
  location: "NICU",
  isWeekendLayout: false,
  requiredSkill: "",
  priority: "STANDARD",
  providerId: "prov-1",
  locationGroup: "MAIN_CAMPUS_UNIT",
  servicePriority: "CRITICAL",
  serviceLocation: "G20",
};

const TEST_PROVIDER: Provider = {
  id: "prov-1",
  name: "Test Provider",
  targetWeekDays: 5,
  targetWeekendDays: 0,
  targetWeekNights: 0,
  targetWeekendNights: 0,
  timeOffRequests: [],
  preferredDates: [],
  skills: [],
  maxConsecutiveNights: 0,
  minDaysOffAfterNight: 0,
  email: "test@example.com",
  role: "CLINICIAN",
};

beforeEach(() => {
  useScheduleStore.setState({
    marketplaceShifts: [],
    broadcastHistory: [],
    escalationConfig: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 },
    slots: [TEST_SLOT],
    providers: [TEST_PROVIDER],
    lastActionMessage: null,
  });
});

describe("postShiftForCoverage", () => {
  it("creates a marketplace shift with POSTED lifecycle state", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "covering");

    const shift = useScheduleStore.getState().marketplaceShifts.find(s => s.id === shiftId);
    expect(shift).toBeDefined();
    expect(shift!.lifecycleState).toBe("POSTED");
    expect(shift!.slotId).toBe("test-slot-1");
    expect(shift!.postedByProviderId).toBe("prov-1");
    expect(shift!.notes).toBe("covering");
    expect(shift!.date).toBe("2026-04-01");
    expect(shift!.location).toBe("NICU");
    expect(shift!.shiftType).toBe("DAY");
    expect(typeof shift!.postedAt).toBe("string");
  });

  it("throws when slot is not found", () => {
    expect(() =>
      useScheduleStore.getState().postShiftForCoverage("nonexistent", "prov-1", "")
    ).toThrow("Slot nonexistent not found");
  });
});

describe("transitionShiftLifecycle", () => {
  it("advances through valid state transitions", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");

    const transitions: Array<[ShiftLifecycleStatus, ShiftLifecycleStatus]> = [
      ["POSTED", "AI_EVALUATING"],
      ["AI_EVALUATING", "BROADCASTING"],
      ["BROADCASTING", "CLAIMED"],
      ["CLAIMED", "APPROVED"],
    ];

    for (const [_from, to] of transitions) {
      useScheduleStore.getState().transitionShiftLifecycle(shiftId, to);
      const shift = useScheduleStore.getState().marketplaceShifts.find(s => s.id === shiftId);
      expect(shift!.lifecycleState).toBe(to);
    }
  });

  it("throws on invalid transition POSTED → APPROVED", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    expect(() =>
      useScheduleStore.getState().transitionShiftLifecycle(shiftId, "APPROVED")
    ).toThrow("Invalid transition: POSTED → APPROVED");
  });

  it("throws on invalid transition APPROVED → POSTED", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "AI_EVALUATING");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "BROADCASTING");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "CLAIMED");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "APPROVED");

    expect(() =>
      useScheduleStore.getState().transitionShiftLifecycle(shiftId, "POSTED")
    ).toThrow("Invalid transition: APPROVED → POSTED");
  });

  it("throws when shift is not found", () => {
    expect(() =>
      useScheduleStore.getState().transitionShiftLifecycle("nonexistent", "AI_EVALUATING")
    ).toThrow("Marketplace shift nonexistent not found");
  });
});

describe("cancelMarketplaceShift", () => {
  it("sets state to CANCELLED from POSTED", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().cancelMarketplaceShift(shiftId);

    const shift = useScheduleStore.getState().marketplaceShifts.find(s => s.id === shiftId);
    expect(shift!.lifecycleState).toBe("CANCELLED");
  });

  it("sets state to CANCELLED from AI_EVALUATING", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "AI_EVALUATING");
    useScheduleStore.getState().cancelMarketplaceShift(shiftId);

    const shift = useScheduleStore.getState().marketplaceShifts.find(s => s.id === shiftId);
    expect(shift!.lifecycleState).toBe("CANCELLED");
  });

  it("sets state to CANCELLED from BROADCASTING", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "AI_EVALUATING");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "BROADCASTING");
    useScheduleStore.getState().cancelMarketplaceShift(shiftId);

    const shift = useScheduleStore.getState().marketplaceShifts.find(s => s.id === shiftId);
    expect(shift!.lifecycleState).toBe("CANCELLED");
  });

  it("sets state to CANCELLED from CLAIMED", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "AI_EVALUATING");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "BROADCASTING");
    useScheduleStore.getState().transitionShiftLifecycle(shiftId, "CLAIMED");
    useScheduleStore.getState().cancelMarketplaceShift(shiftId);

    const shift = useScheduleStore.getState().marketplaceShifts.find(s => s.id === shiftId);
    expect(shift!.lifecycleState).toBe("CANCELLED");
  });
});
