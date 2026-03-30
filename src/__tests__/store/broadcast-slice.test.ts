import { describe, it, expect, beforeEach } from "vitest";
import { useScheduleStore } from "@/store";
import type { ShiftSlot, Provider } from "@/types";

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

describe("updateEscalationConfig", () => {
  it("updates autoEscalationDelayMinutes", () => {
    useScheduleStore.getState().updateEscalationConfig({ autoEscalationDelayMinutes: 30 });

    const config = useScheduleStore.getState().escalationConfig;
    expect(config.autoEscalationDelayMinutes).toBe(30);
    expect(config.maxEscalationTiers).toBe(3);
  });

  it("updates maxEscalationTiers", () => {
    useScheduleStore.getState().updateEscalationConfig({ maxEscalationTiers: 5 });

    const config = useScheduleStore.getState().escalationConfig;
    expect(config.maxEscalationTiers).toBe(5);
    expect(config.autoEscalationDelayMinutes).toBe(60);
  });

  it("merges partial updates without losing other fields", () => {
    useScheduleStore.getState().updateEscalationConfig({ autoEscalationDelayMinutes: 45 });
    useScheduleStore.getState().updateEscalationConfig({ maxEscalationTiers: 7 });

    const config = useScheduleStore.getState().escalationConfig;
    expect(config.autoEscalationDelayMinutes).toBe(45);
    expect(config.maxEscalationTiers).toBe(7);
  });
});

describe("addBroadcastEntry", () => {
  it("adds a broadcast history entry with tier 1 for first broadcast", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");

    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "email");

    const history = useScheduleStore.getState().broadcastHistory;
    expect(history).toHaveLength(1);
    expect(history[0].marketplaceShiftId).toBe(shiftId);
    expect(history[0].tier).toBe(1);
    expect(history[0].channel).toBe("email");
    expect(history[0].status).toBe("sent");
    expect(typeof history[0].sentAt).toBe("string");
  });

  it("auto-increments tier for subsequent broadcasts on same shift", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");

    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "email");
    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "sms");
    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "push");

    const history = useScheduleStore.getState().broadcastHistory;
    expect(history).toHaveLength(3);
    expect(history[0].tier).toBe(1);
    expect(history[1].tier).toBe(2);
    expect(history[2].tier).toBe(3);
  });

  it("tracks tiers independently per shift", () => {
    useScheduleStore.setState({
      slots: [
        { ...TEST_SLOT, id: "slot-a" },
        { ...TEST_SLOT, id: "slot-b" },
      ],
    });

    const shiftA = useScheduleStore.getState().postShiftForCoverage("slot-a", "prov-1", "");
    const shiftB = useScheduleStore.getState().postShiftForCoverage("slot-b", "prov-1", "");

    useScheduleStore.getState().addBroadcastEntry(shiftA, [], "email");
    useScheduleStore.getState().addBroadcastEntry(shiftB, [], "sms");
    useScheduleStore.getState().addBroadcastEntry(shiftA, [], "push");

    const history = useScheduleStore.getState().broadcastHistory;
    expect(history[0].tier).toBe(1);
    expect(history[0].marketplaceShiftId).toBe(shiftA);
    expect(history[1].tier).toBe(1);
    expect(history[1].marketplaceShiftId).toBe(shiftB);
    expect(history[2].tier).toBe(2);
    expect(history[2].marketplaceShiftId).toBe(shiftA);
  });
});

describe("updateBroadcastRecipientStatus", () => {
  it("updates entry status to delivered", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "email");

    const entryId = useScheduleStore.getState().broadcastHistory[0].id;
    useScheduleStore.getState().updateBroadcastRecipientStatus(entryId, "prov-1", "delivered");

    const entry = useScheduleStore.getState().broadcastHistory[0];
    expect(entry.status).toBe("delivered");
  });

  it("updates entry status to failed", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "email");

    const entryId = useScheduleStore.getState().broadcastHistory[0].id;
    useScheduleStore.getState().updateBroadcastRecipientStatus(entryId, "prov-1", "failed");

    const entry = useScheduleStore.getState().broadcastHistory[0];
    expect(entry.status).toBe("failed");
  });

  it("does not modify other entries", () => {
    const shiftId = useScheduleStore.getState().postShiftForCoverage("test-slot-1", "prov-1", "");
    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "email");
    useScheduleStore.getState().addBroadcastEntry(shiftId, [], "sms");

    const firstEntryId = useScheduleStore.getState().broadcastHistory[0].id;
    useScheduleStore.getState().updateBroadcastRecipientStatus(firstEntryId, "prov-1", "delivered");

    const history = useScheduleStore.getState().broadcastHistory;
    expect(history[0].status).toBe("delivered");
    expect(history[1].status).toBe("sent");
  });
});
