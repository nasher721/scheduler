import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4107;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
      timeOffRequests: [],
      maxConsecutiveNights: 2,
    },
  ],
  slots: [
    { id: "s1", date: "2026-01-01", type: "DAY", providerId: "p1", requiredSkill: "NEURO_CRITICAL", priority: "CRITICAL" },
    { id: "s2", date: "2026-01-02", type: "NIGHT", providerId: null, requiredSkill: "NIGHT_FLOAT", priority: "CRITICAL" },
  ],
  scenarios: [],
  customRules: [],
  auditLog: [],
  startDate: "2026-01-01",
  numWeeks: 4,
};

async function waitForHealth(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
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

test("apply returns applyId and rollback restores previous state", async () => {
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(BASE_URL);

    const setRes = await fetch(`${BASE_URL}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleState),
    });
    assert.equal(setRes.ok, true);

    const optimizeRes = await fetch(`${BASE_URL}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleState),
    });
    assert.equal(optimizeRes.ok, true);
    const optimizePayload = await optimizeRes.json();
    const optimizeResult = optimizePayload.result;

    const applyRes = await fetch(`${BASE_URL}/api/ai/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: optimizeResult, approvedBy: "charge-nurse" }),
    });

    assert.equal(applyRes.ok, true);
    const applyPayload = await applyRes.json();
    assert.ok(applyPayload.applyId);

    const rollbackRes = await fetch(`${BASE_URL}/api/ai/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyId: applyPayload.applyId, rolledBackBy: "ops-supervisor", reason: "Manual override" }),
    });
    assert.equal(rollbackRes.ok, true);

    const stateRes = await fetch(`${BASE_URL}/api/state`);
    assert.equal(stateRes.ok, true);
    const statePayload = await stateRes.json();

    assert.equal(statePayload.state.slots.find((slot) => slot.id === "s2")?.providerId, null);
    assert.ok(statePayload.state.auditLog.some((entry) => entry.action === "ai_rollback"));
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});
