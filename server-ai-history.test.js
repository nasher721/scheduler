import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4108;
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
  ],
  slots: [{ id: "s1", date: "2026-01-01", type: "DAY", providerId: null, requiredSkill: "NEURO_CRITICAL", priority: "CRITICAL" }],
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
      // wait for boot
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for server health endpoint");
}

test("apply history endpoints return redacted and detailed records", async () => {
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

    const applyRes = await fetch(`${BASE_URL}/api/ai/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: optimizePayload.result, approvedBy: "lead" }),
    });
    assert.equal(applyRes.ok, true);
    const applyPayload = await applyRes.json();

    const historyRes = await fetch(`${BASE_URL}/api/ai/apply-history?limit=1`);
    assert.equal(historyRes.ok, true);
    const historyPayload = await historyRes.json();
    assert.equal(historyPayload.records.length, 1);
    assert.equal(historyPayload.records[0].id, applyPayload.applyId);
    assert.equal(historyPayload.records[0].approvedBy, "lead");
    assert.equal(historyPayload.records[0].previousState, undefined);

    const detailRes = await fetch(`${BASE_URL}/api/ai/apply-history/${applyPayload.applyId}?includeStates=true`);
    assert.equal(detailRes.ok, true);
    const detailPayload = await detailRes.json();
    assert.ok(detailPayload.record.previousState);
    assert.ok(detailPayload.record.appliedState);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});


test("apply history summary endpoint reports range aggregates", async () => {
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

    const applyRes = await fetch(`${BASE_URL}/api/ai/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: optimizePayload.result, approvedBy: "lead" }),
    });
    assert.equal(applyRes.ok, true);
    const applyPayload = await applyRes.json();

    const rollbackRes = await fetch(`${BASE_URL}/api/ai/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyId: applyPayload.applyId, rolledBackBy: "ops" }),
    });
    assert.equal(rollbackRes.ok, true);

    const summaryRes = await fetch(`${BASE_URL}/api/ai/apply-history/summary?days=7`);
    assert.equal(summaryRes.ok, true);
    const summaryPayload = await summaryRes.json();

    assert.equal(summaryPayload.rangeDays, 7);
    assert.equal(summaryPayload.totalInRange >= 1, true);
    assert.equal(summaryPayload.summary.applyCount >= 1, true);
    assert.equal(summaryPayload.summary.rollbackCount >= 1, true);
    assert.ok(Number.isFinite(summaryPayload.summary.rollbackRate));
    assert.ok(Object.keys(summaryPayload.summary.byRolloutMode).length >= 1);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});

test("apply history endpoint supports rolloutMode and rolledBack filters", async () => {
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

    const applyRes = await fetch(`${BASE_URL}/api/ai/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: optimizePayload.result, approvedBy: "lead" }),
    });
    assert.equal(applyRes.ok, true);
    const applyPayload = await applyRes.json();

    const rolledBackBeforeRes = await fetch(`${BASE_URL}/api/ai/apply-history?limit=200&rolloutMode=${encodeURIComponent(applyPayload.rolloutMode)}&rolledBack=false`);
    assert.equal(rolledBackBeforeRes.ok, true);
    const rolledBackBeforePayload = await rolledBackBeforeRes.json();
    const beforeRecord = rolledBackBeforePayload.records.find((record) => record.id === applyPayload.applyId);
    assert.ok(beforeRecord);

    const rollbackRes = await fetch(`${BASE_URL}/api/ai/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyId: applyPayload.applyId, rolledBackBy: "ops" }),
    });
    assert.equal(rollbackRes.ok, true);

    const rolledBackAfterRes = await fetch(`${BASE_URL}/api/ai/apply-history?limit=200&rolloutMode=${encodeURIComponent(applyPayload.rolloutMode)}&rolledBack=true`);
    assert.equal(rolledBackAfterRes.ok, true);
    const rolledBackAfterPayload = await rolledBackAfterRes.json();
    const afterRecord = rolledBackAfterPayload.records.find((record) => record.id === applyPayload.applyId);
    assert.ok(afterRecord);

    const invalidFilterRes = await fetch(`${BASE_URL}/api/ai/apply-history?rolledBack=maybe`);
    assert.equal(invalidFilterRes.status, 400);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});
