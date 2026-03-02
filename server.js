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
} from "./ai-orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "schedule-state.json");

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

app.get("/api/ai/providers", (_req, res) => {
  return res.json({ providers: listProviders() });
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
