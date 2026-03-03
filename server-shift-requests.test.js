import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4110;
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

test("shift request endpoints support create, list, and review", async () => {
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(BASE_URL);

    const createRes = await fetch(`${BASE_URL}/api/shift-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerName: "Dr. Adams",
        date: "2026-01-15",
        type: "time_off",
        notes: "Conference travel",
      }),
    });
    assert.equal(createRes.status, 201);
    const createPayload = await createRes.json();
    assert.equal(createPayload.request.status, "pending");

    const listRes = await fetch(`${BASE_URL}/api/shift-requests?status=pending`);
    assert.equal(listRes.ok, true);
    const listPayload = await listRes.json();
    assert.equal(listPayload.requests.length >= 1, true);

    const reviewRes = await fetch(`${BASE_URL}/api/shift-requests/${createPayload.request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", reviewedBy: "ops-lead" }),
    });
    assert.equal(reviewRes.ok, true);
    const reviewPayload = await reviewRes.json();
    assert.equal(reviewPayload.request.status, "approved");
    assert.equal(reviewPayload.request.reviewedBy, "ops-lead");

    const filteredRes = await fetch(`${BASE_URL}/api/shift-requests?status=approved`);
    assert.equal(filteredRes.ok, true);
    const filteredPayload = await filteredRes.json();
    assert.equal(filteredPayload.requests.some((entry) => entry.id === createPayload.request.id), true);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});
