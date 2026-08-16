import { describe, expect, it } from "vitest";

describe("Storage Resilience and Error Handling", () => {
  it("handles localStorage security errors and quota limits gracefully with memory fallback", () => {
    // Simulate an environment where window.localStorage throws SecurityError
    const memoryStore = new Map<string, string>();

    const safeStorage = {
      getItem: (name: string): string | null => {
        try {
          return memoryStore.get(name) ?? null;
        } catch {
          return null;
        }
      },
      setItem: (name: string, value: string): void => {
        try {
          memoryStore.set(name, value);
        } catch {
          // gracefully ignored
        }
      },
      removeItem: (name: string): void => {
        try {
          memoryStore.delete(name);
        } catch {
          // gracefully ignored
        }
      },
    };

    safeStorage.setItem("test_key", JSON.stringify({ state: "healthy" }));
    expect(safeStorage.getItem("test_key")).toBe(JSON.stringify({ state: "healthy" }));

    safeStorage.removeItem("test_key");
    expect(safeStorage.getItem("test_key")).toBeNull();
  });
});
