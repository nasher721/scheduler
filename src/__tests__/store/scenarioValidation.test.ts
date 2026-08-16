import { beforeEach, describe, expect, it } from "vitest";
import { useScheduleStore } from "@/store";

describe("Scenario Validation and Management", () => {
  beforeEach(() => {
    useScheduleStore.setState({
      scenarios: [],
      history: [],
      historyIndex: 0,
      providers: [],
      slots: [],
    });
  });

  it("rejects empty or whitespace-only scenario names", () => {
    const store = useScheduleStore.getState();

    store.createScenario("");
    expect(useScheduleStore.getState().scenarios.length).toBe(0);

    store.createScenario("   ");
    expect(useScheduleStore.getState().scenarios.length).toBe(0);
  });

  it("creates valid named scenarios and prevents duplicate names", () => {
    const store = useScheduleStore.getState();

    store.createScenario("Baseline Fall 2026");
    expect(useScheduleStore.getState().scenarios.length).toBe(1);
    expect(useScheduleStore.getState().scenarios[0].name).toBe("Baseline Fall 2026");

    // Duplicate name
    store.createScenario("Baseline Fall 2026");
    expect(useScheduleStore.getState().scenarios.length).toBe(1);

    // Case-insensitive duplicate name
    store.createScenario("baseline fall 2026");
    expect(useScheduleStore.getState().scenarios.length).toBe(1);

    // Distinct name succeeds
    store.createScenario("Optimized Fall 2026");
    expect(useScheduleStore.getState().scenarios.length).toBe(2);
  });
});
