import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedScheduleState } from "@/types";

const database = vi.hoisted(() => ({
  upserts: [] as Array<{ table: string; rows: unknown }>,
  deletes: [] as Array<{ table: string; column: string; values: string[] }>,
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => {
  database.from.mockImplementation((table: string) => ({
    upsert: async (rows: unknown) => {
      database.upserts.push({ table, rows });
      return { error: null };
    },
    select: async () => ({
      data: table === "day_handoffs" ? [{ date: "2026-08-26" }] : [],
      error: null,
    }),
    delete: () => ({
      in: async (column: string, values: string[]) => {
        database.deletes.push({ table, column, values });
        return { error: null };
      },
    }),
  }));

  return {
    supabase: { from: database.from },
    supabaseStatus: { isPlaceholder: false },
  };
});

import { saveScheduleState } from "@/lib/api/scheduleState";

describe("saveScheduleState", () => {
  beforeEach(() => {
    database.upserts.length = 0;
    database.deletes.length = 0;
    database.from.mockClear();
  });

  it("replaces day handoffs using their date key", async () => {
    const state: PersistedScheduleState = {
      providers: [],
      slots: [],
      startDate: "2026-08-27",
      numWeeks: 4,
      scenarios: [],
      customRules: [],
      auditLog: [],
      dayHandoffs: [{
        date: "2026-08-27",
        notes: "Day handoff",
        updatedAt: "2026-08-27T12:00:00Z",
      }],
    };

    await expect(saveScheduleState(state)).resolves.toEqual({ ok: true });
    expect(database.upserts).toContainEqual({
      table: "day_handoffs",
      rows: [{
        date: "2026-08-27",
        notes: "Day handoff",
        updated_at: "2026-08-27T12:00:00Z",
        updated_by: null,
      }],
    });
    expect(database.deletes).toContainEqual({
      table: "day_handoffs",
      column: "date",
      values: ["2026-08-26"],
    });
  });
});
