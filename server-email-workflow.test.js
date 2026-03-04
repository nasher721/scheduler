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

const buildState = (providerId = "p1") => ({
  providers: [
    {
      id: providerId,
      name: "Dr. Inbox",
      email: "inbox@hospital.org",
      targetWeekDays: 1,
      targetWeekendDays: 0,
      targetWeekNights: 0,
      targetWeekendNights: 0,
      timeOffRequests: [],
      preferredDates: [],
      skills: ["NEURO_CRITICAL"],
      maxConsecutiveNights: 2,
      minDaysOffAfterNight: 1,
      credentials: [],
    },
  ],
  startDate: "2026-01-05",
  numWeeks: 1,
  slots: [
    {
      id: "2026-01-05-DAY-0",
      date: "2026-01-05",
      type: "DAY",
      providerId,
      isWeekendLayout: false,
      requiredSkill: "NEURO_CRITICAL",
      priority: "CRITICAL",
      isBackup: false,
      location: "Main",
    },
  ],
  scenarios: [],
  customRules: [],
  auditLog: [],
});

test("email workflow supports schedule update notifications and inbound request triage", async () => {
  const server = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(BASE_URL);

    const initialState = buildState("p1");
    const firstSave = await fetch(`${BASE_URL}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initialState),
    });
    assert.equal(firstSave.ok, true);

    const updatedState = buildState(null);
    const secondSave = await fetch(`${BASE_URL}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedState),
    });
    assert.equal(secondSave.ok, true);
    const secondPayload = await secondSave.json();
    assert.equal(secondPayload.queuedEmails >= 1, true);

    const eventRes = await fetch(`${BASE_URL}/api/email-events?type=schedule_update`);
    assert.equal(eventRes.ok, true);
    const eventPayload = await eventRes.json();
    assert.equal(eventPayload.events.length >= 1, true);
    const firstScheduleEvent = eventPayload.events[0];
    assert.equal(typeof firstScheduleEvent.id, "string");

    const patchEventRes = await fetch(`${BASE_URL}/api/email-events/${firstScheduleEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    assert.equal(patchEventRes.ok, true);
    const patchEventPayload = await patchEventRes.json();
    assert.equal(patchEventPayload.event.status, "sent");

    const inboundRes = await fetch(`${BASE_URL}/api/email/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "inbox@hospital.org",
        subject: "Need time off",
        body: "date: 2026-01-10\ntype: time_off\nnotes: Out of town",
      }),
    });
    assert.equal(inboundRes.status, 201);
    const inboundPayload = await inboundRes.json();
    assert.equal(inboundPayload.request.source, "email");

    const pendingRes = await fetch(`${BASE_URL}/api/shift-requests?status=pending`);
    assert.equal(pendingRes.ok, true);
    const pendingPayload = await pendingRes.json();
    assert.equal(pendingPayload.requests.some((entry) => entry.id === inboundPayload.request.id), true);

    const deleteEventRes = await fetch(`${BASE_URL}/api/email-events/${firstScheduleEvent.id}`, {
      method: "DELETE",
    });
    assert.equal(deleteEventRes.ok, true);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.on("exit", resolve));
  }
});
