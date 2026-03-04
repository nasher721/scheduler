import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  listProviders,
  buildRecommendations,
  optimizeSchedule,
  simulateScenario,
  detectConflicts,
  explainDecision,
  parseExcelStructure,
  listProviderMetrics,
  recordAutomationOutcome,
  parseIntent,
  getCopilotSuggestions,
  processCopilotMessage,
} from "./ai-orchestrator.js";
import {
  dispatchNotification,
  listNotificationChannels,
  buildPendingApprovalAlerts,
} from "./notification-service.js";
import { listSolverProfiles, optimizeWithSolver } from "./solver-service.js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);



const baseProviders = [
  { id: "1", name: "Dr. Adams", email: "adams@hospital.org", role: "ADMIN", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "AIRWAY", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 1, credentials: [{ credentialType: "ACLS", expiresAt: "2027-01-01", status: "active" }] },
  { id: "2", name: "Dr. Baker", email: "baker@hospital.org", role: "CLINICIAN", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "EEG", "NIGHT_FLOAT"], maxConsecutiveNights: 3, minDaysOffAfterNight: 1, credentials: [{ credentialType: "Stroke Certification", expiresAt: "2027-02-01", status: "active" }] },
  { id: "3", name: "Dr. Clark", email: "clark@hospital.org", role: "SCHEDULER", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "ECMO", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 2, credentials: [{ credentialType: "NIHSS", expiresAt: "2027-03-01", status: "active" }] },
];

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const isArray = (value) => Array.isArray(value);

const VALID_CREDENTIAL_STATUSES = new Set(["active", "expiring_soon", "expired", "pending_verification"]);

function validateCredentials(payload) {
  const providers = isArray(payload?.providers) ? payload.providers : [];

  for (const provider of providers) {
    if (!provider || typeof provider !== "object") return "Each provider must be an object.";
    if (provider.credentials === undefined) continue;
    if (!isArray(provider.credentials)) return `Provider ${provider.id || "unknown"} field \"credentials\" must be an array.`;

    for (const credential of provider.credentials) {
      if (!credential || typeof credential !== "object") return `Provider ${provider.id || "unknown"} has an invalid credential entry.`;
      if (typeof credential.credentialType !== "string" || credential.credentialType.trim() === "") {
        return `Provider ${provider.id || "unknown"} credentials require \"credentialType\".`;
      }
      if (credential.issuedAt !== undefined && typeof credential.issuedAt !== "string") {
        return `Provider ${provider.id || "unknown"} credential \"issuedAt\" must be a string.`;
      }
      if (credential.expiresAt !== undefined && typeof credential.expiresAt !== "string") {
        return `Provider ${provider.id || "unknown"} credential \"expiresAt\" must be a string.`;
      }
      if (!VALID_CREDENTIAL_STATUSES.has(credential.status)) {
        return `Provider ${provider.id || "unknown"} credential has invalid \"status\".`;
      }
    }
  }

  return null;
}

function validateStatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Payload must be an object.";

  const requiredArrays = ["providers", "slots", "scenarios", "customRules", "auditLog"];
  if (isArray(payload.providers)) {
    for (const provider of payload.providers) {
      if (!provider || typeof provider !== "object") continue;
      if (provider.email !== undefined && (typeof provider.email !== "string" || !provider.email.includes("@"))) {
        return "Provider email must be a valid email string when provided.";
      }
    }
  }
  for (const key of requiredArrays) {
    if (!isArray(payload[key])) return `Field \"${key}\" must be an array.`;
  }

  if (typeof payload.startDate !== "string") return "Field \"startDate\" must be a string.";
  if (typeof payload.numWeeks !== "number") return "Field \"numWeeks\" must be a number.";

  const credentialError = validateCredentials(payload);
  if (credentialError) return credentialError;

  return null;
}

async function getSupabaseSetting(key, defaultValue) {
  const { data, error } = await supabase.from('global_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return defaultValue;
  return data.value;
}

async function setSupabaseSetting(key, value) {
  await supabase.from('global_settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString()
  });
}

async function readState() {
  return await getSupabaseSetting('schedule_state', null);
}

async function writeState(state) {
  await setSupabaseSetting('schedule_state', state);
}

async function readApplyHistory() {
  const history = await getSupabaseSetting('ai_apply_history', []);
  return isArray(history) ? history : [];
}

async function writeApplyHistory(history) {
  await setSupabaseSetting('ai_apply_history', history);
}

async function readShiftRequests() {
  const requests = await getSupabaseSetting('shift_requests_data', []);
  return isArray(requests) ? requests : [];
}

async function writeShiftRequests(requests) {
  await setSupabaseSetting('shift_requests_data', requests);
}

async function readEmailEvents() {
  const events = await getSupabaseSetting('email_events_data', []);
  return isArray(events) ? events : [];
}

async function writeEmailEvents(events) {
  await setSupabaseSetting('email_events_data', events);
}

async function readNotifications() {
  const records = await getSupabaseSetting('notification_history', []);
  return isArray(records) ? records : [];
}

async function writeNotifications(records) {
  await setSupabaseSetting('notification_history', records);
}

async function persistNotification(notification) {
  const records = await readNotifications();
  records.push(notification);
  await writeNotifications(records);
  return notification;
}

const VALID_SHIFT_REQUEST_TYPES = new Set(["time_off", "swap", "availability"]);
const VALID_SHIFT_REQUEST_STATUSES = new Set(["pending", "approved", "denied"]);

function validateShiftRequestPayload(payload) {
  if (!payload || typeof payload !== "object") return "Payload must be an object.";
  if (typeof payload.providerName !== "string" || !payload.providerName.trim()) {
    return 'Field "providerName" is required.';
  }
  if (typeof payload.date !== "string" || !payload.date.trim()) {
    return 'Field "date" is required.';
  }

  const type = String(payload.type || "").toLowerCase();
  if (!VALID_SHIFT_REQUEST_TYPES.has(type)) {
    return 'Field "type" must be one of: time_off, swap, availability.';
  }

  if (payload.notes !== undefined && typeof payload.notes !== "string") {
    return 'Field "notes" must be a string when provided.';
  }

  if (payload.deadlineAt !== undefined && typeof payload.deadlineAt !== "string") {
    return 'Field "deadlineAt" must be a string when provided.';
  }

  return null;
}

function findProviderByIdentity(providers, payload = {}) {
  if (!isArray(providers)) return null;
  const providerEmail = typeof payload.providerEmail === "string" ? payload.providerEmail.trim().toLowerCase() : "";
  const providerName = typeof payload.providerName === "string" ? payload.providerName.trim().toLowerCase() : "";

  if (providerEmail) {
    const byEmail = providers.find((provider) =>
      typeof provider?.email === "string" && provider.email.trim().toLowerCase() === providerEmail,
    );
    if (byEmail) return byEmail;
  }

  if (providerName) {
    return providers.find((provider) => typeof provider?.name === "string" && provider.name.trim().toLowerCase() === providerName) || null;
  }

  return null;
}

function buildScheduleChangeSummary(previousState, nextState) {
  const previousSlots = isArray(previousState?.slots) ? previousState.slots : [];
  const nextSlots = isArray(nextState?.slots) ? nextState.slots : [];
  const previousById = new Map(previousSlots.map((slot) => [slot?.id, slot]));
  const changes = [];

  for (const slot of nextSlots) {
    if (!slot || typeof slot !== "object") continue;
    const prior = previousById.get(slot.id);
    const priorProviderId = prior?.providerId ?? null;
    const nextProviderId = slot.providerId ?? null;
    if (priorProviderId === nextProviderId) continue;
    changes.push({
      slotId: slot.id,
      date: slot.date,
      shiftType: slot.type,
      previousProviderId: priorProviderId,
      nextProviderId,
    });
  }

  return changes;
}

async function queueScheduleChangeEmails(previousState, nextState) {
  const changes = buildScheduleChangeSummary(previousState, nextState);
  if (changes.length === 0) return [];

  const providers = [
    ...(isArray(previousState?.providers) ? previousState.providers : []),
    ...(isArray(nextState?.providers) ? nextState.providers : []),
  ];
  const providerById = new Map(providers.map((provider) => [provider?.id, provider]));
  const notificationsByProvider = new Map();

  for (const change of changes) {
    for (const providerId of [change.previousProviderId, change.nextProviderId]) {
      if (!providerId) continue;
      const provider = providerById.get(providerId);
      if (!provider || typeof provider.email !== "string" || !provider.email.trim()) continue;
      if (!notificationsByProvider.has(providerId)) {
        notificationsByProvider.set(providerId, { provider, changes: [] });
      }
      notificationsByProvider.get(providerId).changes.push(change);
    }
  }

  if (notificationsByProvider.size === 0) return [];

  const existingEvents = await readEmailEvents();
  const now = new Date().toISOString();
  const queued = [];

  for (const [providerId, item] of notificationsByProvider.entries()) {
    queued.push({
      id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "schedule_update",
      status: "queued",
      providerId,
      providerName: item.provider.name,
      to: item.provider.email,
      subject: `Schedule updated for ${item.provider.name}`,
      body: `Your schedule changed in ${item.changes.length} shift(s).`,
      changes: item.changes,
      createdAt: now,
    });
  }

  await writeEmailEvents([...existingEvents, ...queued]);
  return queued;
}

function parseInboundEmailBody(body) {
  if (typeof body !== "string") return {};
  const parsed = {};
  for (const line of body.split("\n")) {
    const [rawKey, ...rawValue] = line.split(":");
    if (!rawKey || rawValue.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (value) parsed[key] = value;
  }

  return {
    date: typeof parsed.date === "string" ? parsed.date : undefined,
    type: typeof parsed.type === "string" ? parsed.type.toLowerCase() : undefined,
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

function sanitizeApplyHistoryEntry(entry, options = {}) {
  const includeStates = options.includeStates === true;
  if (!entry || typeof entry !== "object") return null;

  const base = {
    id: entry.id,
    timestamp: entry.timestamp,
    approvedBy: entry.approvedBy || null,
    rolloutMode: entry.rolloutMode || null,
    objectiveScore: Number.isFinite(entry?.result?.objectiveScore) ? entry.result.objectiveScore : null,
    confidenceScore: Number.isFinite(entry?.result?.rollout?.confidenceScore) ? entry.result.rollout.confidenceScore : null,
    hardViolationCount: Number.isFinite(entry?.result?.guardrails?.hardViolationCount)
      ? Number(entry.result.guardrails.hardViolationCount)
      : null,
    rolledBackAt: entry.rolledBackAt || null,
    rolledBackBy: entry.rolledBackBy || null,
    rollbackReason: entry.rollbackReason || null,
    changeCount: isArray(entry?.result?.changes) ? entry.result.changes.length : 0,
  };

  if (!includeStates) return base;

  return {
    ...base,
    result: entry.result || null,
    previousState: entry.previousState || null,
    appliedState: entry.appliedState || null,
  };
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function buildApplyHistorySummary(history) {
  const totals = {
    applyCount: history.length,
    rollbackCount: 0,
    objectiveScoreSum: 0,
    objectiveScoreCount: 0,
    confidenceScoreSum: 0,
    confidenceScoreCount: 0,
    hardViolationSum: 0,
    hardViolationCount: 0,
  };
  const byRolloutMode = {};

  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue;

    const mode = entry.rolloutMode || "unknown";
    if (!byRolloutMode[mode]) {
      byRolloutMode[mode] = { applyCount: 0, rollbackCount: 0 };
    }
    byRolloutMode[mode].applyCount += 1;

    if (entry.rolledBackAt) {
      totals.rollbackCount += 1;
      byRolloutMode[mode].rollbackCount += 1;
    }

    if (Number.isFinite(entry?.result?.objectiveScore)) {
      totals.objectiveScoreSum += entry.result.objectiveScore;
      totals.objectiveScoreCount += 1;
    }

    if (Number.isFinite(entry?.result?.rollout?.confidenceScore)) {
      totals.confidenceScoreSum += entry.result.rollout.confidenceScore;
      totals.confidenceScoreCount += 1;
    }

    if (Number.isFinite(entry?.result?.guardrails?.hardViolationCount)) {
      totals.hardViolationSum += Number(entry.result.guardrails.hardViolationCount);
      totals.hardViolationCount += 1;
    }
  }

  return {
    applyCount: totals.applyCount,
    rollbackCount: totals.rollbackCount,
    rollbackRate: totals.applyCount > 0 ? Number((totals.rollbackCount / totals.applyCount).toFixed(3)) : 0,
    avgObjectiveScore:
      totals.objectiveScoreCount > 0 ? Number((totals.objectiveScoreSum / totals.objectiveScoreCount).toFixed(3)) : null,
    avgConfidenceScore:
      totals.confidenceScoreCount > 0 ? Number((totals.confidenceScoreSum / totals.confidenceScoreCount).toFixed(3)) : null,
    avgHardViolationCount:
      totals.hardViolationCount > 0 ? Number((totals.hardViolationSum / totals.hardViolationCount).toFixed(3)) : null,
    byRolloutMode,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nicu-scheduler-api" });
});

app.get("/api/state", async (_req, res) => {
  const state = await readState();
  res.json({ state, updatedAt: new Date().toISOString() });
});

app.put("/api/state", async (req, res) => {
  const validationError = validateStatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const previousState = await readState();
  await writeState(req.body);
  const queuedEmails = await queueScheduleChangeEmails(previousState, req.body);
  return res.json({ ok: true, queuedEmails: queuedEmails.length, updatedAt: new Date().toISOString() });
});

app.get("/api/shift-requests", async (req, res) => {
  const statusFilter = typeof req.query?.status === "string" ? req.query.status.trim().toLowerCase() : "";
  if (statusFilter && !VALID_SHIFT_REQUEST_STATUSES.has(statusFilter)) {
    return res.status(400).json({ error: 'Query parameter "status" must be one of: pending, approved, denied.' });
  }

  const requests = await readShiftRequests();
  const filtered = statusFilter ? requests.filter((entry) => entry.status === statusFilter) : requests;
  return res.json({ requests: filtered, total: filtered.length, updatedAt: new Date().toISOString() });
});

app.post("/api/shift-requests", async (req, res) => {
  const validationError = validateShiftRequestPayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const requests = await readShiftRequests();
  const requestRecord = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    providerName: req.body.providerName.trim(),
    date: req.body.date,
    type: req.body.type.toLowerCase(),
    notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
    deadlineAt: typeof req.body.deadlineAt === "string" ? req.body.deadlineAt : null,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    source: req.body.source === "email" ? "email" : "app",
  };
  requests.push(requestRecord);
  await writeShiftRequests(requests);

  const notification = await dispatchNotification({
    eventType: "shift_request_submitted",
    title: "New shift request submitted",
    body: `${requestRecord.providerName} submitted a ${requestRecord.type} request for ${requestRecord.date}.`,
    severity: "info",
    channels: ["log"],
    metadata: {
      requestId: requestRecord.id,
      requestType: requestRecord.type,
      status: requestRecord.status,
    },
  });
  await persistNotification(notification);

  return res.status(201).json({ request: requestRecord, notification, updatedAt: new Date().toISOString() });
});

app.patch("/api/shift-requests/:id", async (req, res) => {
  const requestId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  const status = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
  const reviewedBy = typeof req.body?.reviewedBy === "string" ? req.body.reviewedBy.trim() : "";

  if (!requestId) return res.status(400).json({ error: "Request id is required." });
  if (!VALID_SHIFT_REQUEST_STATUSES.has(status) || status === "pending") {
    return res.status(400).json({ error: 'Field "status" must be either approved or denied.' });
  }
  if (!reviewedBy) {
    return res.status(400).json({ error: 'Field "reviewedBy" is required when changing status.' });
  }

  const requests = await readShiftRequests();
  const requestIndex = requests.findIndex((entry) => entry.id === requestId);
  if (requestIndex < 0) {
    return res.status(404).json({ error: `Request not found for id ${requestId}.` });
  }

  requests[requestIndex] = {
    ...requests[requestIndex],
    status,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
  };
  await writeShiftRequests(requests);

  const notification = await dispatchNotification({
    eventType: "shift_request_reviewed",
    title: "Shift request reviewed",
    body: `${requests[requestIndex].providerName} request for ${requests[requestIndex].date} was ${status}.`,
    severity: status === "denied" ? "warning" : "info",
    channels: ["log"],
    metadata: {
      requestId,
      reviewedBy,
      status,
    },
  });
  await persistNotification(notification);

  return res.json({ request: requests[requestIndex], notification, updatedAt: new Date().toISOString() });
});

app.get("/api/notifications/channels", (_req, res) => {
  return res.json({ channels: listNotificationChannels(), updatedAt: new Date().toISOString() });
});

app.post("/api/notifications/send", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Notification payload must be an object." });
  }

  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
  const severity = typeof req.body.severity === "string" ? req.body.severity.trim().toLowerCase() : "info";
  if (!title || !body) {
    return res.status(400).json({ error: "Notification payload requires title and body." });
  }
  if (!["info", "warning", "critical"].includes(severity)) {
    return res.status(400).json({ error: 'Field "severity" must be info, warning, or critical.' });
  }

  const notification = await dispatchNotification({
    eventType: typeof req.body.eventType === "string" ? req.body.eventType : "manual",
    title,
    body,
    severity,
    channels: isArray(req.body.channels) ? req.body.channels : ["log"],
    metadata: req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {},
  });

  await persistNotification(notification);
  return res.status(201).json({ notification, updatedAt: new Date().toISOString() });
});

app.get("/api/notifications/history", async (req, res) => {
  const limit = Math.min(250, toPositiveInt(req.query?.limit, 50));
  const records = await readNotifications();
  return res.json({
    records: [...records].reverse().slice(0, limit),
    total: records.length,
    limit,
    updatedAt: new Date().toISOString(),
  });
});

app.post("/api/notifications/dispatch-pending-approvals", async (req, res) => {
  const alertWindowHours = Math.min(168, toPositiveInt(req.body?.alertWindowHours, 24));
  const requests = await readShiftRequests();
  const alerts = buildPendingApprovalAlerts(requests, Date.now(), alertWindowHours);
  const results = [];

  for (const alert of alerts) {
    const notification = await dispatchNotification(alert);
    await persistNotification(notification);
    results.push(notification);
  }

  return res.json({
    dispatched: results.length,
    alertWindowHours,
    notifications: results,
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/solver/profiles", (_req, res) => {
  return res.json({ profiles: listSolverProfiles(), updatedAt: new Date().toISOString() });
});

app.post("/api/solver/optimize", async (req, res) => {
  const state = getPayloadState(req.body);
  const validationError = validateStatePayload(state);
  if (validationError) {
    return res.status(400).json({ error: `Invalid state payload. ${validationError}` });
  }

  return res.json({ result: await optimizeWithSolver(req.body), updatedAt: new Date().toISOString() });
});

app.get("/api/email-events", async (req, res) => {
  const typeFilter = typeof req.query?.type === "string" ? req.query.type.trim().toLowerCase() : "";
  const events = await readEmailEvents();
  const records = typeFilter ? events.filter((entry) => entry?.type === typeFilter) : events;
  return res.json({ events: records, total: records.length, updatedAt: new Date().toISOString() });
});

app.post("/api/email/inbound", async (req, res) => {
  const from = typeof req.body?.from === "string" ? req.body.from.trim().toLowerCase() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body : "";
  if (!from || !subject) {
    return res.status(400).json({ error: 'Fields "from" and "subject" are required.' });
  }

  const state = await readState();
  const provider = findProviderByIdentity(state?.providers, {
    providerEmail: from,
    providerName: req.body?.providerName,
  });

  if (!provider) {
    return res.status(404).json({ error: "No provider profile matches the inbound email sender." });
  }

  const parsed = parseInboundEmailBody(body);
  const requestPayload = {
    providerName: provider.name,
    date: parsed.date || req.body?.date,
    type: parsed.type || req.body?.type,
    notes: parsed.notes || body,
  };
  const validationError = validateShiftRequestPayload(requestPayload);
  if (validationError) {
    return res.status(400).json({ error: `Could not triage inbound email. ${validationError}` });
  }

  const requests = await readShiftRequests();
  const requestRecord = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    providerName: provider.name,
    providerEmail: provider.email || from,
    date: requestPayload.date,
    type: requestPayload.type.toLowerCase(),
    notes: requestPayload.notes,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    source: "email",
  };

  requests.push(requestRecord);
  await writeShiftRequests(requests);

  const emailEvents = await readEmailEvents();
  emailEvents.push({
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "inbound_request",
    status: "processed",
    from,
    subject,
    requestId: requestRecord.id,
    createdAt: new Date().toISOString(),
  });
  await writeEmailEvents(emailEvents);

  return res.status(201).json({ request: requestRecord, updatedAt: new Date().toISOString() });
});

function getPayloadState(body) {
  if (body && typeof body === "object" && body.state && typeof body.state === "object") {
    return body.state;
  }

  return body;
}

function buildAiAuditEntry({ action, mode, accepted, details = {} }) {
  return {
    id: `ai-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action,
    mode,
    accepted,
    details,
  };
}

app.get("/api/ai/providers", (_req, res) => {
  return res.json({ providers: listProviders() });
});

app.get("/api/ai/metrics", (_req, res) => {
  return res.json({ metrics: listProviderMetrics(), updatedAt: new Date().toISOString() });
});

app.post("/api/ai/parse-excel", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Parse payload must be an object." });
  }

  try {
    const result = await parseExcelStructure(req.body);
    return res.json({ result, updatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/feedback", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Feedback payload must be an object." });
  }

  const recorded = recordAutomationOutcome(req.body);
  return res.json({ ok: true, recorded, updatedAt: new Date().toISOString() });
});

app.post("/api/ai/apply", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Apply payload must be an object." });
  }

  const result = req.body?.result;
  if (!result || typeof result !== "object") {
    return res.status(400).json({ error: "Apply payload requires a result object." });
  }

  const optimizedState = result?.optimizedState;
  const validationError = validateStatePayload(optimizedState);
  if (validationError) {
    return res.status(400).json({ error: `Invalid optimized state payload. ${validationError}` });
  }

  const rolloutMode = String(result?.rollout?.mode || "shadow").toLowerCase();
  const approvedBy = typeof req.body?.approvedBy === "string" ? req.body.approvedBy.trim() : "";

  if (rolloutMode === "shadow") {
    return res.status(409).json({
      error: "Rollout mode is shadow. Use optimize/recommend endpoints without applying state.",
      rolloutMode,
    });
  }

  if (rolloutMode === "human_review" && !approvedBy) {
    return res.status(400).json({
      error: "Human-review rollout requires approvedBy before applying.",
      rolloutMode,
    });
  }

  const nextState = {
    ...optimizedState,
    auditLog: isArray(optimizedState.auditLog) ? [...optimizedState.auditLog] : [],
  };

  const violationCount = Number.isFinite(result?.guardrails?.hardViolationCount)
    ? Math.max(0, Number(result.guardrails.hardViolationCount))
    : 0;

  nextState.auditLog.push(
    buildAiAuditEntry({
      action: "ai_apply",
      mode: rolloutMode,
      accepted: true,
      details: {
        approvedBy: approvedBy || null,
        objectiveScore: Number.isFinite(result?.objectiveScore) ? result.objectiveScore : null,
        confidenceScore: Number.isFinite(result?.rollout?.confidenceScore) ? result.rollout.confidenceScore : null,
        hardViolationCount: violationCount,
      },
    }),
  );

  const previousState = await readState();
  const applyId = `ai-apply-${Date.now()}`;
  const applyHistory = await readApplyHistory();
  applyHistory.push({
    id: applyId,
    timestamp: new Date().toISOString(),
    approvedBy: approvedBy || null,
    rolloutMode,
    result,
    previousState,
    appliedState: nextState,
    rolledBackAt: null,
    rolledBackBy: null,
    rollbackReason: null,
  });

  await writeState(nextState);
  await writeApplyHistory(applyHistory);
  const recorded = recordAutomationOutcome({ result, accepted: true, rolledBack: false, violationCount });
  return res.json({
    ok: true,
    applyId,
    rolloutMode,
    approvedBy: approvedBy || null,
    recorded,
    state: nextState,
    updatedAt: new Date().toISOString(),
  });
});

app.post("/api/ai/rollback", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Rollback payload must be an object." });
  }

  const applyId = typeof req.body?.applyId === "string" ? req.body.applyId.trim() : "";
  const rolledBackBy = typeof req.body?.rolledBackBy === "string" ? req.body.rolledBackBy.trim() : "";
  const rollbackReason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!applyId) {
    return res.status(400).json({ error: "Rollback payload requires applyId." });
  }

  if (!rolledBackBy) {
    return res.status(400).json({ error: "Rollback payload requires rolledBackBy reviewer." });
  }

  const history = await readApplyHistory();
  const entryIndex = history.findIndex((entry) => entry?.id === applyId);
  if (entryIndex < 0) {
    return res.status(404).json({ error: `Apply record not found for applyId ${applyId}.` });
  }

  if (history[entryIndex].rolledBackAt) {
    return res.status(409).json({ error: "Apply record has already been rolled back.", applyId });
  }

  const priorState = history[entryIndex].previousState;
  const validationError = validateStatePayload(priorState);
  if (validationError) {
    return res.status(409).json({ error: `Cannot rollback: stored state is invalid. ${validationError}` });
  }

  const restoredState = {
    ...priorState,
    auditLog: isArray(priorState.auditLog) ? [...priorState.auditLog] : [],
  };
  restoredState.auditLog.push(
    buildAiAuditEntry({
      action: "ai_rollback",
      mode: history[entryIndex].rolloutMode || "unknown",
      accepted: false,
      details: {
        applyId,
        rolledBackBy,
        rollbackReason: rollbackReason || null,
      },
    }),
  );

  history[entryIndex] = {
    ...history[entryIndex],
    rolledBackAt: new Date().toISOString(),
    rolledBackBy,
    rollbackReason: rollbackReason || null,
  };

  await writeState(restoredState);
  await writeApplyHistory(history);

  const resultSnapshot = history[entryIndex].result;
  const violationCount = Number.isFinite(resultSnapshot?.guardrails?.hardViolationCount)
    ? Math.max(0, Number(resultSnapshot.guardrails.hardViolationCount))
    : 0;
  const recorded = recordAutomationOutcome({
    result: resultSnapshot,
    accepted: false,
    rolledBack: true,
    violationCount,
  });

  return res.json({
    ok: true,
    applyId,
    rolledBackBy,
    recorded,
    state: restoredState,
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/ai/apply-history", async (req, res) => {
  const limit = Math.min(200, toPositiveInt(req.query?.limit, 20));
  const includeStates = String(req.query?.includeStates || "false").toLowerCase() === "true";
  const rolloutModeFilter = typeof req.query?.rolloutMode === "string" ? req.query.rolloutMode.trim().toLowerCase() : "";
  const rolledBackFilter = parseOptionalBoolean(req.query?.rolledBack);

  if (req.query?.rolledBack !== undefined && rolledBackFilter === null) {
    return res.status(400).json({ error: 'Query parameter "rolledBack" must be either true or false when provided.' });
  }

  const history = await readApplyHistory();
  const filteredHistory = history.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;

    if (rolloutModeFilter) {
      const entryMode = String(entry.rolloutMode || "").toLowerCase();
      if (entryMode !== rolloutModeFilter) return false;
    }

    if (rolledBackFilter !== null) {
      const isRolledBack = Boolean(entry.rolledBackAt);
      if (isRolledBack !== rolledBackFilter) return false;
    }

    return true;
  });

  const records = [...filteredHistory]
    .reverse()
    .slice(0, limit)
    .map((entry) => sanitizeApplyHistoryEntry(entry, { includeStates }))
    .filter(Boolean);

  return res.json({
    records,
    total: filteredHistory.length,
    totalAllTime: history.length,
    limit,
    includeStates,
    filters: {
      rolloutMode: rolloutModeFilter || null,
      rolledBack: rolledBackFilter,
    },
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/ai/apply-history/summary", async (req, res) => {
  const days = Math.min(365, toPositiveInt(req.query?.days, 30));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const history = await readApplyHistory();
  const filtered = history.filter((entry) => {
    const ts = Date.parse(entry?.timestamp || "");
    return Number.isFinite(ts) && ts >= since;
  });

  return res.json({
    rangeDays: days,
    since: new Date(since).toISOString(),
    totalInRange: filtered.length,
    totalAllTime: history.length,
    summary: buildApplyHistorySummary(filtered),
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/ai/apply-history/:applyId", async (req, res) => {
  const applyId = typeof req.params?.applyId === "string" ? req.params.applyId.trim() : "";
  const includeStates = String(req.query?.includeStates || "false").toLowerCase() === "true";
  if (!applyId) {
    return res.status(400).json({ error: "applyId path parameter is required." });
  }

  const history = await readApplyHistory();
  const entry = history.find((record) => record?.id === applyId);
  if (!entry) {
    return res.status(404).json({ error: `Apply record not found for applyId ${applyId}.` });
  }

  return res.json({
    record: sanitizeApplyHistoryEntry(entry, { includeStates }),
    includeStates,
    updatedAt: new Date().toISOString(),
  });
});

app.post("/api/ai/recommendations", async (req, res) => {
  const state = getPayloadState(req.body);
  const validationError = validateStatePayload(state);
  if (validationError) {
    return res.status(400).json({ error: `Invalid state payload. ${validationError}` });
  }

  return res.json({ result: await buildRecommendations(req.body), updatedAt: new Date().toISOString() });
});

app.post("/api/ai/optimize", async (req, res) => {
  const state = getPayloadState(req.body);
  const validationError = validateStatePayload(state);
  if (validationError) {
    return res.status(400).json({ error: `Invalid state payload. ${validationError}` });
  }

  const useSolver = String(req.query?.useSolver || "false").toLowerCase() === "true";
  if (useSolver) {
    return res.json({ result: await optimizeWithSolver(req.body), updatedAt: new Date().toISOString() });
  }

  return res.json({ result: await optimizeSchedule(req.body), updatedAt: new Date().toISOString() });
});

app.post("/api/ai/simulate", async (req, res) => {
  const state = getPayloadState(req.body);
  const validationError = validateStatePayload(state);
  if (validationError) {
    return res.status(400).json({ error: `Invalid state payload. ${validationError}` });
  }

  return res.json({ result: await simulateScenario(req.body), updatedAt: new Date().toISOString() });
});

app.post("/api/ai/conflicts", async (req, res) => {
  const state = getPayloadState(req.body);
  const validationError = validateStatePayload(state);
  if (validationError) {
    return res.status(400).json({ error: `Invalid state payload. ${validationError}` });
  }

  return res.json({ result: await detectConflicts(req.body), updatedAt: new Date().toISOString() });
});

app.post("/api/register", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Registration payload must be an object." });
  }

  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: "Name, email, and role are required for registration." });
  }

  let state = await readState();
  if (!state) {
    state = {
      providers: baseProviders,
      slots: [],
      scenarios: [],
      customRules: [],
      auditLog: [],
      startDate: new Date().toISOString().split('T')[0],
      numWeeks: 4
    };
  }

  const providers = isArray(state.providers) ? state.providers : [];
  const existing = providers.find(p => p.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "Email already in use." });
  }

  const newProvider = {
    ...req.body,
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timeOffRequests: isArray(req.body.timeOffRequests) ? req.body.timeOffRequests : [],
    preferredDates: isArray(req.body.preferredDates) ? req.body.preferredDates : [],
    skills: isArray(req.body.skills) ? req.body.skills : ["NEURO_CRITICAL"],
    credentials: isArray(req.body.credentials) ? req.body.credentials : [],
  };

  state.providers = [...providers, newProvider];
  await writeState(state);

  return res.status(201).json({
    ok: true,
    provider: newProvider,
    updatedAt: new Date().toISOString(),
  });
});

app.post("/api/ai/explain", async (req, res) => {
  return res.json({ result: await explainDecision(req.body), updatedAt: new Date().toISOString() });
});

// ==================== COPILOT ENDPOINTS ====================

// POST /api/copilot/chat - Main chat endpoint
app.post("/api/copilot/chat", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Chat payload must be an object." });
  }

  const { message, context, conversationHistory } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required and must be a string." });
  }

  try {
    const result = await processCopilotMessage({ message, context, conversationHistory });
    return res.json({
      result,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Copilot chat error:", error);
    return res.status(500).json({
      error: "Failed to process message",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// POST /api/copilot/intent - Parse intent only (no execution)
app.post("/api/copilot/intent", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Intent payload must be an object." });
  }

  const { text, context } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required and must be a string." });
  }

  try {
    const result = await parseIntent({ text, context });
    return res.json({
      result,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Intent parsing error:", error);
    return res.status(500).json({
      error: "Failed to parse intent",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// GET /api/copilot/suggestions - Get contextual inline suggestions
app.get("/api/copilot/suggestions", async (req, res) => {
  try {
    // Parse context from query params
    const context = {
      viewType: req.query.viewType || 'week',
      selectedDate: req.query.selectedDate || null,
      selectedProviderId: req.query.selectedProviderId || null,
      userRole: req.query.userRole || 'CLINICIAN',
      visibleProviderCount: parseInt(req.query.visibleProviderCount || '0', 10)
    };

    const result = await getCopilotSuggestions({ context });
    return res.json({
      result,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({
      error: "Failed to get suggestions",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// GET /api/copilot/stream - SSE for streaming responses (placeholder for future)
app.get("/api/copilot/stream", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Stream connected' })}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

export default app;

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Scheduler API listening on http://localhost:${port}`);
  });
}
