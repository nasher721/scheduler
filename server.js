import express from "express";
import cors from "cors";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listProviders,
  buildRecommendations,
  optimizeSchedule,
  simulateScenario,
  detectConflicts,
  explainDecision,
  listProviderMetrics,
  recordAutomationOutcome,
} from "./ai-orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "schedule-state.json");
const AI_APPLY_HISTORY_PATH = path.join(DATA_DIR, "ai-apply-history.json");

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const isArray = (value) => Array.isArray(value);

function validateStatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Payload must be an object.";

  const requiredArrays = ["providers", "slots", "scenarios", "customRules", "auditLog"];
  for (const key of requiredArrays) {
    if (!isArray(payload[key])) return `Field \"${key}\" must be an array.`;
  }

  if (typeof payload.startDate !== "string") return "Field \"startDate\" must be a string.";
  if (typeof payload.numWeeks !== "number") return "Field \"numWeeks\" must be a number.";

  return null;
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_PATH);
  } catch {
    await fs.writeFile(STATE_PATH, JSON.stringify(null), "utf-8");
  }

  try {
    await fs.access(AI_APPLY_HISTORY_PATH);
  } catch {
    await fs.writeFile(AI_APPLY_HISTORY_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readState() {
  await ensureDataFile();
  const raw = await fs.readFile(STATE_PATH, "utf-8");
  return JSON.parse(raw || "null");
}

async function writeState(state) {
  await ensureDataFile();
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

async function readApplyHistory() {
  await ensureDataFile();
  const raw = await fs.readFile(AI_APPLY_HISTORY_PATH, "utf-8");
  const parsed = JSON.parse(raw || "[]");
  return isArray(parsed) ? parsed : [];
}

async function writeApplyHistory(history) {
  await ensureDataFile();
  await fs.writeFile(AI_APPLY_HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
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

  await writeState(req.body);
  return res.json({ ok: true, updatedAt: new Date().toISOString() });
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
  const limitRaw = Number.parseInt(String(req.query?.limit || "20"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 20;
  const includeStates = String(req.query?.includeStates || "false").toLowerCase() === "true";

  const history = await readApplyHistory();
  const records = [...history]
    .reverse()
    .slice(0, limit)
    .map((entry) => sanitizeApplyHistoryEntry(entry, { includeStates }))
    .filter(Boolean);

  return res.json({
    records,
    total: history.length,
    limit,
    includeStates,
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

app.post("/api/ai/explain", async (req, res) => {
  return res.json({ result: await explainDecision(req.body), updatedAt: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Scheduler API listening on http://localhost:${port}`);
});
