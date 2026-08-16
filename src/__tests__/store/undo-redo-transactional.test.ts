import { beforeEach, describe, expect, it } from "vitest";
import { useScheduleStore } from "@/store";
import type { Provider, ShiftSlot } from "@/types";

const mockProvider: Provider = {
  id: "p-test-1",
  name: "Dr. Adams",
  targetWeekDays: 2,
  targetWeekendDays: 1,
  targetWeekNights: 0,
  targetWeekendNights: 0,
  timeOffRequests: [],
  preferredDates: [],
  skills: ["NEURO_CRITICAL"],
  maxConsecutiveNights: 2,
  minDaysOffAfterNight: 1,
};

const mockSlot: ShiftSlot = {
  id: "s-test-1",
  date: "2026-05-01",
  type: "DAY",
  providerId: null,
  isWeekendLayout: false,
  requiredSkill: "NEURO_CRITICAL",
  priority: "CRITICAL",
  location: "G20",
  locationGroup: "MAIN_CAMPUS_UNIT",
  servicePriority: "CRITICAL",
  serviceLocation: "G20",
};

describe("Store Undo/Redo & Transactional State Management", () => {
  beforeEach(() => {
    const baseProviders = [mockProvider];
    const baseSlots = [mockSlot];
    // Reset store state with initial baseline snapshot
    useScheduleStore.setState({
      providers: baseProviders,
      slots: baseSlots,
      customRules: [],
      history: [
        {
          providers: structuredClone(baseProviders),
          slots: structuredClone(baseSlots),
          customRules: [],
          startDate: "2026-05-01",
          numWeeks: 4,
          dayHandoffs: [],
          auditLog: [],
        },
      ],
      historyIndex: 0,
      scenarios: [],
    });
  });

  it("pushes immutable snapshots and successfully undos shift assignments", () => {
    const store = useScheduleStore.getState();
    expect(store.slots[0].providerId).toBeNull();
    expect(store.canUndo()).toBe(false);

    // Mutation 1: Assign shift
    store.assignShift("s-test-1", "p-test-1");
    expect(useScheduleStore.getState().slots[0].providerId).toBe("p-test-1");
    expect(useScheduleStore.getState().canUndo()).toBe(true);

    // Undo Mutation 1
    useScheduleStore.getState().undo();
    expect(useScheduleStore.getState().slots[0].providerId).toBeNull();
    expect(useScheduleStore.getState().canRedo()).toBe(true);

    // Redo Mutation 1
    useScheduleStore.getState().redo();
    expect(useScheduleStore.getState().slots[0].providerId).toBe("p-test-1");
  });

  it("handles sequential mutations without snapshot corruption", () => {
    const store = useScheduleStore.getState();

    // Mutation 1: Add provider
    const newProvider: Provider = {
      ...mockProvider,
      id: "p-test-2",
      name: "Dr. Baker",
    };
    store.addProvider(newProvider);
    expect(useScheduleStore.getState().providers.length).toBe(2);

    // Mutation 2: Assign shift to new provider
    store.assignShift("s-test-1", "p-test-2");
    expect(useScheduleStore.getState().slots[0].providerId).toBe("p-test-2");

    // Mutation 3: Clear schedule
    store.clearSchedule();
    expect(useScheduleStore.getState().slots[0].providerId).toBeNull();

    // Step-by-step undo
    useScheduleStore.getState().undo(); // Undoes clearSchedule -> should restore "p-test-2"
    expect(useScheduleStore.getState().slots[0].providerId).toBe("p-test-2");

    useScheduleStore.getState().undo(); // Undoes assignShift -> should be null
    expect(useScheduleStore.getState().slots[0].providerId).toBeNull();
    expect(useScheduleStore.getState().providers.length).toBe(2);

    useScheduleStore.getState().undo(); // Undoes addProvider -> should have 1 provider
    expect(useScheduleStore.getState().providers.length).toBe(1);
    expect(useScheduleStore.getState().canUndo()).toBe(false);
  });

  it("restores last known good schedule in disaster recovery", () => {
    const store = useScheduleStore.getState();

    // Assign shift
    store.assignShift("s-test-1", "p-test-1");
    expect(useScheduleStore.getState().slots[0].providerId).toBe("p-test-1");

    // Clear staff and corrupt schedule
    store.clearStaff();
    expect(useScheduleStore.getState().providers.length).toBe(0);

    // Emergency recovery
    store.restoreLastKnownGoodSchedule();
    expect(useScheduleStore.getState().providers.length).toBeGreaterThan(0);
  });
});
