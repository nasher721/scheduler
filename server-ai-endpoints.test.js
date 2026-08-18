/**
 * Regression tests for AI endpoints that were unreachable or returned
 * degenerate results:
 *   - /api/memory/{stats,snapshot,history} were shadowed by /api/memory/:key
 *   - /api/copilot/intent rejected chat-style { message } payloads
 *   - /api/copilot/query was called by the client but never implemented
 *   - /api/copilot/suggestions computed against an empty schedule
 *   - /api/ai/parse-excel had no deterministic fallback
 *   - state round-trips dropped Provider.targetWeekNights
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4113;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const sampleState = {
  providers: [
    {
      id: "p1",
      name: "Dr. A",
      email: "a@hospital.org",
      role: "CLINICIAN",
      targetWeekDays: 9,
      targetWeekendDays: 5,
      targetWeekNights: 7,
      targetWeekendNights: 3,
      timeOffRequests: [],
      preferredDates: [],
      skills: ["NEURO_CRITICAL"],
      maxConsecutiveNights: 2,
      minDaysOffAfterNight: 1,
    },
    {
      id: "p2",
      name: "Dr. B",
      email: "b@hospital.org",
      role: "CLINICIAN",
      targetWeekDays: 10,
      targetWeekendDays: 4,
      targetWeekNights: 3,
      targetWeekendNights: 2,
      timeOffRequests: ["2026-09-01"],
      preferredDates: [],
      skills: ["NEURO_CRITICAL"],
      maxConsecutiveNights: 2,
      minDaysOffAfterNight: 1,
    },
  ],
  slots: [
    { id: "s1", date: "2026-09-01", type: "DAY", providerId: null },
    { id: "s2", date: "2026-09-02", type: "NIGHT", providerId: "p1" },
  ],
  scenarios: [],
  customRules: [],
  auditLog: [],
  startDate: "2026-09-01",
  numWeeks: 4,
};

async function waitForHealth(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // keep waiting for boot
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for server health endpoint");
}

async function withServer(run) {
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForHealth(BASE_URL);
    await run();
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
}

const postJson = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("AI and copilot endpoints behave correctly", async () => {
  await withServer(async () => {
    // --- shared-memory literal routes are not shadowed by /api/memory/:key ---
    for (const path of ["/api/memory/stats", "/api/memory/snapshot", "/api/memory/history"]) {
      const res = await fetch(`${BASE_URL}${path}`);
      assert.equal(res.status, 200, `${path} should not resolve to the :key handler`);
    }

    const restoreRes = await postJson("/api/memory/restore", { snapshot: { entries: [] } });
    assert.equal(restoreRes.status, 200, "POST /api/memory/restore should not be shadowed");

    // A malformed snapshot is a client error, not a 500.
    const badRestore = await postJson("/api/memory/restore", { snapshot: {} });
    assert.equal(badRestore.status, 400);

    // --- state round-trip preserves every provider target ---
    const putRes = await fetch(`${BASE_URL}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleState),
    });
    assert.equal(putRes.ok, true);

    const stateRes = await fetch(`${BASE_URL}/api/state`);
    const { state } = await stateRes.json();
    const p1 = state.providers.find((p) => p.id === "p1");
    assert.ok(p1, "provider p1 should survive the round trip");
    assert.equal(p1.targetWeekNights, 7, "targetWeekNights must not be dropped");
    assert.equal(p1.targetWeekendNights, 3);
    assert.equal(p1.targetWeekDays, 9);
    assert.equal(p1.targetWeekendDays, 5);

    // --- copilot intent accepts both `text` and `message` ---
    const intentFromText = await postJson("/api/copilot/intent", { text: "swap my shift on friday" });
    assert.equal(intentFromText.status, 200);
    const intentFromMessage = await postJson("/api/copilot/intent", { message: "swap my shift on friday" });
    assert.equal(intentFromMessage.status, 200);
    assert.equal(
      (await intentFromMessage.json()).data.intent,
      (await intentFromText.json()).data.intent,
      "both payload shapes should parse to the same intent",
    );

    const emptyIntent = await postJson("/api/copilot/intent", { message: "   " });
    assert.equal(emptyIntent.status, 400);

    // --- copilot query ranks available providers ---
    const queryRes = await postJson("/api/copilot/query", {
      query: "who can cover the day shift on 2026-09-01?",
    });
    assert.equal(queryRes.status, 200);
    const query = await queryRes.json();
    assert.equal(query.entities.date, "2026-09-01");
    const matchedIds = query.matches.map((m) => m.providerId);
    assert.ok(matchedIds.includes("p1"), "p1 is free on 2026-09-01");
    assert.ok(!matchedIds.includes("p2"), "p2 requested that day off and must be excluded");

    const emptyQuery = await postJson("/api/copilot/query", { query: "" });
    assert.equal(emptyQuery.status, 400);

    // --- suggestions are computed against the real schedule, not an empty one ---
    const suggestionsRes = await fetch(`${BASE_URL}/api/copilot/suggestions?viewType=week`);
    assert.equal(suggestionsRes.status, 200);
    const suggestions = await suggestionsRes.json();
    assert.equal(suggestions.data.summary.totalProviders, 2);
    assert.equal(suggestions.data.summary.totalSlots, 2);

    // --- agents explain accepts slotId as well as shiftId ---
    const explainRes = await postJson("/api/agents/explain", {
      slotId: "s1",
      scheduleState: sampleState,
    });
    assert.equal(explainRes.status, 200);

    // --- excel mapping works with no AI provider configured ---
    const excelRes = await postJson("/api/ai/parse-excel", {
      sampleData: [
        {
          "Month / Date": "2026-09-01",
          G20: "Dr A",
          H22: "Dr B",
          Nights: "Dr C",
          Vacations: "Dr D",
        },
      ],
      targetFields: ["date", "dayG20", "dayH22", "night", "vacation"],
    });
    assert.equal(excelRes.status, 200);
    const { result: excel } = await excelRes.json();
    assert.equal(excel.mapping.date, "Month / Date");
    assert.equal(excel.mapping.dayG20, "G20");
    assert.equal(excel.mapping.dayH22, "H22");
    assert.equal(excel.mapping.night, "Nights");
    assert.equal(excel.mapping.vacation, "Vacations");
    assert.ok(excel.confidence > 0.9, "exact header matches should score high confidence");

    // --- database diagnostic reports the persistence mode ---
    const dbRes = await fetch(`${BASE_URL}/api/health/db`);
    assert.equal(dbRes.status, 200);
    const db = await dbRes.json();
    assert.ok(["in-memory", "supabase"].includes(db.mode));
    assert.ok(["none", "anon", "service_role"].includes(db.keyKind));
  });
});
