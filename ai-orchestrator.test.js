import test from "node:test";
import assert from "node:assert/strict";
import {
  listProviders,
  buildRecommendations,
  optimizeSchedule,
  simulateScenario,
  detectConflicts,
  explainDecision,
} from "./ai-orchestrator.js";

const sampleState = {
  providers: [
    {
      id: "p1",
      name: "Dr. A",
      skills: ["NEURO_CRITICAL", "NIGHT_FLOAT"],
      timeOffRequests: [],
      maxConsecutiveNights: 2,
    },
    {
      id: "p2",
      name: "Dr. B",
      skills: ["NEURO_CRITICAL"],
      timeOffRequests: [{ date: "2026-01-02", type: "PTO" }],
      maxConsecutiveNights: 2,
    },
  ],
  slots: [
    { id: "s1", date: "2026-01-01", type: "DAY", providerId: "p1", requiredSkill: "NEURO_CRITICAL", priority: "CRITICAL" },
    { id: "s2", date: "2026-01-02", type: "NIGHT", providerId: null, requiredSkill: "NIGHT_FLOAT", priority: "CRITICAL" },
    { id: "s3", date: "2026-01-02", type: "DAY", providerId: null, requiredSkill: "NEURO_CRITICAL", priority: "STANDARD" },
  ],
  scenarios: [],
  customRules: [{ id: "r1", type: "MAX_SHIFTS_PER_WEEK", providerId: "p1", maxShifts: 2 }],
  auditLog: [],
  startDate: "2026-01-01",
  numWeeks: 4,
};

test("listProviders exposes configured and enabled flags", () => {
  const providers = listProviders();
  assert.ok(Array.isArray(providers));
  assert.ok(providers.length >= 3);
  assert.ok(providers.some((provider) => provider.configured));
});

test("recommendations fallback contains summary and source", async () => {
  const result = await buildRecommendations(sampleState);
  assert.equal(result.source, "deterministic-fallback");
  assert.equal(result.summary.unassignedSlots, 2);
  assert.ok(Array.isArray(result.recommendations));
});

test("optimize assigns eligible providers and returns optimized state", async () => {
  const result = await optimizeSchedule(sampleState);
  assert.equal(result.source, "deterministic-fallback");
  assert.ok(result.changes.some((entry) => entry.action === "assign_provider"));
  assert.ok(result.optimizedState.slots.some((slot) => slot.id === "s2" && slot.providerId === "p1"));
});

test("optimize respects max consecutive nights when assigning", async () => {
  const state = {
    ...sampleState,
    providers: [
      {
        id: "p1",
        name: "Dr. A",
        skills: ["NIGHT_FLOAT"],
        timeOffRequests: [],
        maxConsecutiveNights: 1,
      },
      {
        id: "p2",
        name: "Dr. B",
        skills: ["NIGHT_FLOAT"],
        timeOffRequests: [],
        maxConsecutiveNights: 2,
      },
    ],
    customRules: [],
    slots: [
      { id: "n1", date: "2026-01-01", type: "NIGHT", providerId: "p1", requiredSkill: "NIGHT_FLOAT", priority: "CRITICAL" },
      { id: "n2", date: "2026-01-02", type: "NIGHT", providerId: null, requiredSkill: "NIGHT_FLOAT", priority: "CRITICAL" },
    ],
  };

  const result = await optimizeSchedule(state);
  assert.equal(result.source, "deterministic-fallback");
  assert.ok(result.optimizedState.slots.some((slot) => slot.id === "n2" && slot.providerId === "p2"));
});

test("simulate returns projected metrics", async () => {
  const result = await simulateScenario({
    state: sampleState,
    scenario: { absentProviderIds: ["p1"], censusSurgePct: 20 },
  });

  assert.equal(result.source, "deterministic-fallback");
  assert.ok(Number.isFinite(result.projected.coveragePct));
});

test("conflicts finds unassigned slot", async () => {
  const result = await detectConflicts(sampleState);
  assert.ok(result.conflictCount >= 1);
});

test("conflicts detect time-off and max weekly shift rule violations", async () => {
  const result = await detectConflicts({
    ...sampleState,
    slots: [
      { id: "x1", date: "2026-01-02", type: "DAY", providerId: "p2", requiredSkill: "NEURO_CRITICAL", priority: "CRITICAL" },
      { id: "x2", date: "2026-01-03", type: "DAY", providerId: "p2", requiredSkill: "NEURO_CRITICAL", priority: "CRITICAL" },
    ],
    customRules: [{ id: "r2", type: "MAX_SHIFTS_PER_WEEK", providerId: "p2", maxShifts: 1 }],
  });

  assert.ok(result.conflicts.some((entry) => entry.type === "time_off_violation"));
  assert.ok(result.conflicts.some((entry) => entry.type === "max_shifts_per_week_exceeded"));
});

test("explain returns deterministic text", async () => {
  const result = await explainDecision({ decision: { id: "d1" } });
  assert.equal(result.source, "deterministic-fallback");
  assert.ok(result.explanation.includes("critical coverage"));
});
