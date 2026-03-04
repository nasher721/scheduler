import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4111;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

function buildState() {
  return {
    providers: [
      { id: "p1", name: "Dr. A", skills: ["icu"] },
      { id: "p2", name: "Dr. B", skills: ["icu"] },
    ],
    startDate: "2026-01-01",
    numWeeks: 1,
    slots: [
      { id: "s1", date: "2026-01-02", type: "DAY", requiredSkill: "icu", providerId: null },
      { id: "s2", date: "2026-01-03", type: "NIGHT", requiredSkill: "icu", providerId: null },
    ],
    scenarios: [],
    customRules: [],
    auditLog: [],
  };
}

test("notification and solver endpoints are available", async () => {
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(BASE_URL);

    const channelsRes = await fetch(`${BASE_URL}/api/notifications/channels`);
    assert.equal(channelsRes.ok, true);
    const channelsPayload = await channelsRes.json();
    assert.equal(Array.isArray(channelsPayload.channels), true);

    const sendRes = await fetch(`${BASE_URL}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Coverage risk",
        body: "Night shift is uncovered.",
        severity: "critical",
        channels: ["log"],
      }),
    });
    assert.equal(sendRes.status, 201);
    const sendPayload = await sendRes.json();
    assert.equal(typeof sendPayload.notification.id, "string");

    const patchNotificationRes = await fetch(`${BASE_URL}/api/notifications/${sendPayload.notification.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        severity: "warning",
        statusByChannel: { log: "acknowledged" },
      }),
    });
    assert.equal(patchNotificationRes.ok, true);
    const patchNotificationPayload = await patchNotificationRes.json();
    assert.equal(patchNotificationPayload.notification.severity, "warning");

    const historyRes = await fetch(`${BASE_URL}/api/notifications/history?limit=5`);
    assert.equal(historyRes.ok, true);
    const historyPayload = await historyRes.json();
    assert.equal(historyPayload.records.length >= 1, true);

    const profilesRes = await fetch(`${BASE_URL}/api/solver/profiles`);
    assert.equal(profilesRes.ok, true);
    const profilesPayload = await profilesRes.json();
    assert.equal(profilesPayload.profiles.some((profile) => profile.id === "greedy-balanced"), true);

    const capabilitiesRes = await fetch(`${BASE_URL}/api/copilot/capabilities`);
    assert.equal(capabilitiesRes.ok, true);
    const capabilitiesPayload = await capabilitiesRes.json();
    assert.equal(Array.isArray(capabilitiesPayload.result.intents), true);
    assert.equal(Array.isArray(capabilitiesPayload.result.actions), true);

    const optimizeRes = await fetch(`${BASE_URL}/api/solver/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildState()),
    });
    assert.equal(optimizeRes.ok, true);
    const optimizePayload = await optimizeRes.json();
    assert.equal(optimizePayload.result.source, "solver-service");

    const aiOptimizeRes = await fetch(`${BASE_URL}/api/ai/optimize?useSolver=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildState()),
    });
    assert.equal(aiOptimizeRes.ok, true);
    const aiOptimizePayload = await aiOptimizeRes.json();
    assert.equal(aiOptimizePayload.result.source, "solver-service");

    const deleteNotificationRes = await fetch(`${BASE_URL}/api/notifications/${sendPayload.notification.id}`, {
      method: "DELETE",
    });
    assert.equal(deleteNotificationRes.ok, true);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});
