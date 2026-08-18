import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import {
  requestContextMiddleware,
  httpLogMiddleware,
  apiNotFoundHandler,
  globalErrorHandler,
} from "./server/error-system.js";

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
  listCopilotCapabilities,
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

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
// Every table in this project has RLS enabled with policies granted to the
// `authenticated` role only — the `anon` role is denied everything. This API
// server acts on behalf of the whole department and holds no end-user session,
// so it MUST authenticate with the service role key. Running it with the anon
// key makes every SELECT return zero rows and every write fail, which used to
// be invisible because the failures were swallowed by empty catch blocks.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseKey = serviceRoleKey || anonKey;
const supabaseKeyKind = serviceRoleKey ? 'service_role' : (anonKey ? 'anon' : 'none');
const hasValidSupabase = Boolean(supabaseUrl.startsWith('https://') && supabaseKey.length > 10 && !supabaseUrl.includes('placeholder'));
const supabase = hasValidSupabase
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key');

/** Last error seen from Supabase, surfaced by GET /api/health/db. */
let lastSupabaseError = null;

/**
 * Log (and remember) a Supabase failure instead of swallowing it. Returns true
 * when an error was present so callers can branch on it.
 */
function reportSupabaseError(operation, error) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : (error?.message || String(error));
  lastSupabaseError = { operation, message, at: new Date().toISOString() };
  console.error(`[Supabase] ${operation} failed: ${message}`);
  return true;
}

const baseProviders = [
  { id: "1", name: "Dr. Adams", email: "adams@hospital.org", role: "ADMIN", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "AIRWAY", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 1, credentials: [{ credentialType: "ACLS", expiresAt: "2027-01-01", status: "active" }] },
  { id: "2", name: "Dr. Baker", email: "baker@hospital.org", role: "CLINICIAN", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "EEG", "NIGHT_FLOAT"], maxConsecutiveNights: 3, minDaysOffAfterNight: 1, credentials: [{ credentialType: "Stroke Certification", expiresAt: "2027-02-01", status: "active" }] },
  { id: "3", name: "Dr. Clark", email: "clark@hospital.org", role: "SCHEDULER", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "ECMO", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 2, credentials: [{ credentialType: "NIHSS", expiresAt: "2027-03-01", status: "active" }] },
];

const inMemoryStore = {
  settings: new Map(),
  providers: [...baseProviders],
  slots: [],
  scenarios: [],
  customRules: [],
  auditLog: [],
  shiftRequests: [],
  notifications: [],
  emailEvents: [],
};

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(requestContextMiddleware);
app.use(httpLogMiddleware);

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Neuro ICU Scheduler API",
    version: "1.0.0",
    description: "API for clinical staffing, scheduling optimization, shift swaps, and marketplace operations.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/health": {
      get: {
        summary: "API Health Check",
        responses: { 200: { description: "Service is healthy" } },
      },
    },
    "/api/state": {
      get: {
        summary: "Get current schedule state",
        responses: { 200: { description: "Current schedule state" } },
      },
      put: {
        summary: "Update schedule state",
        responses: { 200: { description: "Updated schedule state" } },
      },
    },
    "/api/shift-requests": {
      get: {
        summary: "List shift requests",
        responses: { 200: { description: "List of shift requests" } },
      },
      post: {
        summary: "Create shift request",
        responses: { 201: { description: "Shift request created" } },
      },
    },
  },
};

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

const stateCache = {
  data: null,
  timestamp: 0,
  ttl: 5000,
};

function getCachedState() {
  const now = Date.now();
  if (stateCache.data && now - stateCache.timestamp < stateCache.ttl) {
    return stateCache.data;
  }
  return null;
}

function setCachedState(data) {
  stateCache.data = data;
  stateCache.timestamp = Date.now();
}

function invalidateCache() {
  stateCache.data = null;
  stateCache.timestamp = 0;
}

const isArray = (value) => Array.isArray(value);

const VALID_PROVIDER_ROLES = new Set(["ADMIN", "SCHEDULER", "CLINICIAN"]);

const VALID_CREDENTIAL_STATUSES = new Set(["active", "expiring_soon", "expired", "pending_verification"]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(dateStr) {
  if (typeof dateStr !== "string" || !DATE_REGEX.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

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
      
      // Validate issuedAt date format if provided
      if (credential.issuedAt !== undefined) {
        if (typeof credential.issuedAt !== "string") {
          return `Provider ${provider.id || "unknown"} credential \"issuedAt\" must be a string.`;
        }
        if (credential.issuedAt && !isValidDateString(credential.issuedAt)) {
          return `Provider ${provider.id || "unknown"} credential \"issuedAt\" must be in YYYY-MM-DD format.`;
        }
      }
      
      // Validate expiresAt date format if provided
      if (credential.expiresAt !== undefined) {
        if (typeof credential.expiresAt !== "string") {
          return `Provider ${provider.id || "unknown"} credential \"expiresAt\" must be a string.`;
        }
        if (credential.expiresAt && !isValidDateString(credential.expiresAt)) {
          return `Provider ${provider.id || "unknown"} credential \"expiresAt\" must be in YYYY-MM-DD format.`;
        }
      }
      
      // Validate status - case-insensitive check with normalization
      if (typeof credential.status !== "string") {
        return `Provider ${provider.id || "unknown"} credential \"status\" must be a string.`;
      }
      const normalizedStatus = credential.status.toLowerCase().trim();
      if (!VALID_CREDENTIAL_STATUSES.has(normalizedStatus)) {
        return `Provider ${provider.id || "unknown"} credential has invalid \"status\". Must be one of: ${Array.from(VALID_CREDENTIAL_STATUSES).join(", ")}`;
      }
    }
  }

  return null;
}

const VALID_SHIFT_TYPES = new Set(["DAY", "NIGHT", "NMET", "JEOPARDY", "RECOVERY", "CONSULTS", "VACATION"]);
const VALID_SLOT_PRIORITIES = new Set(["CRITICAL", "STANDARD"]);
const VALID_LOCATION_GROUPS = new Set(["MAIN_CAMPUS_UNIT", "MAIN_CAMPUS_SERVICE", "AKRON_UNIT", "SUPPORT_SERVICE"]);
const VALID_SERVICE_PRIORITIES = new Set(["CRITICAL", "STANDARD", "FLEXIBLE"]);

function validateSlots(payload) {
  if (!isArray(payload?.slots)) return null;

  for (const slot of payload.slots) {
    if (!slot || typeof slot !== "object") return "Each slot must be an object.";
    if (typeof slot.id !== "string" || !slot.id.trim()) {
      return "Each slot must have a non-empty \"id\" string.";
    }
    if (typeof slot.date !== "string" || !isValidDateString(slot.date)) {
      return `Slot ${slot.id || "unknown"} must have a valid \"date\" in YYYY-MM-DD format.`;
    }
    if (slot.type && !VALID_SHIFT_TYPES.has(slot.type)) {
      return `Slot ${slot.id || "unknown"} has invalid \"type\". Must be one of: ${Array.from(VALID_SHIFT_TYPES).join(", ")}`;
    }
    if (slot.requiredSkill !== undefined && (typeof slot.requiredSkill !== "string" || !slot.requiredSkill.trim())) {
      return `Slot ${slot.id || "unknown"} must have a non-empty \"requiredSkill\".`;
    }
    if (slot.priority !== undefined && !VALID_SLOT_PRIORITIES.has(slot.priority)) {
      return `Slot ${slot.id || "unknown"} has invalid \"priority\". Must be one of: ${Array.from(VALID_SLOT_PRIORITIES).join(", ")}`;
    }
    if (slot.location !== undefined && (typeof slot.location !== "string" || !slot.location.trim())) {
      return `Slot ${slot.id || "unknown"} must have a valid non-empty \"location\".`;
    }
    if (slot.locationGroup !== undefined && !VALID_LOCATION_GROUPS.has(slot.locationGroup)) {
      return `Slot ${slot.id || "unknown"} has invalid \"locationGroup\".`;
    }
    if (slot.servicePriority !== undefined && !VALID_SERVICE_PRIORITIES.has(slot.servicePriority)) {
      return `Slot ${slot.id || "unknown"} has invalid \"servicePriority\".`;
    }
    // providerId can be null or a string
    if (slot.providerId !== undefined && slot.providerId !== null && typeof slot.providerId !== "string") {
      return `Slot ${slot.id || "unknown"} must have \"providerId\" as a string or null.`;
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
  if (!isValidDateString(payload.startDate)) {
    return "Field \"startDate\" must be in YYYY-MM-DD format.";
  }
  if (typeof payload.numWeeks !== "number" || payload.numWeeks < 1 || payload.numWeeks > 52 || !Number.isInteger(payload.numWeeks)) {
    return "Field \"numWeeks\" must be an integer between 1 and 52.";
  }

  const credentialError = validateCredentials(payload);
  if (credentialError) return credentialError;

  const slotError = validateSlots(payload);
  if (slotError) return slotError;

  return null;
}

async function getSupabaseSetting(key, defaultValue) {
  if (!hasValidSupabase) {
    return inMemoryStore.settings.has(key) ? inMemoryStore.settings.get(key) : defaultValue;
  }
  try {
    const { data, error } = await supabase.from('global_settings')
      .select('value')
      .eq('key', key)
      // maybeSingle(): a missing key is a normal empty result, not an error.
      .maybeSingle();

    reportSupabaseError(`read setting ${key}`, error);
    if (error || !data) return inMemoryStore.settings.has(key) ? inMemoryStore.settings.get(key) : defaultValue;
    return data.value;
  } catch (error) {
    reportSupabaseError(`read setting ${key}`, error);
    return inMemoryStore.settings.has(key) ? inMemoryStore.settings.get(key) : defaultValue;
  }
}

async function setSupabaseSetting(key, value) {
  inMemoryStore.settings.set(key, value);
  if (!hasValidSupabase) return;
  try {
    const { error } = await supabase.from('global_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    });
    reportSupabaseError(`write setting ${key}`, error);
  } catch (error) {
    reportSupabaseError(`write setting ${key}`, error);
  }
}

// ---------------------------------------------------------------------------
// Schedule state persistence
// ---------------------------------------------------------------------------
// Scenarios, custom rules and audit entries each have a dedicated, indexed
// table. They used to be nested inside the single `schedule_config` JSON blob,
// which meant every state write rewrote the entire history as one row and the
// blob grew without bound. `schedule_config` now holds only the two scalar
// settings; the arrays come from their own tables. Blob values are still read
// as a fallback so a database written by the previous layout still loads.
const AUDIT_LOG_LIMIT = 500;
const APPLY_HISTORY_LIMIT = 100;
const UPSERT_CHUNK_SIZE = 500;

function chunk(items, size = UPSERT_CHUNK_SIZE) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function defaultScheduleConfig() {
  return {
    startDate: new Date().toISOString().split("T")[0],
    numWeeks: 4,
  };
}

function mapProviderRow(p) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    targetWeekDays: p.target_week_days,
    targetWeekendDays: p.target_weekend_days,
    targetWeekNights: p.target_week_nights,
    targetWeekendNights: p.target_weekend_nights,
    timeOffRequests: p.time_off_requests || [],
    preferredDates: p.preferred_dates || [],
    skills: p.skills || [],
    maxConsecutiveNights: p.max_consecutive_nights,
    minDaysOffAfterNight: p.min_days_off_after_night,
    credentials: p.credentials || [],
    schedulingRestrictions: p.scheduling_restrictions || {},
    notes: p.notes,
  };
}

function mapProviderToRow(p) {
  return {
    id: p.id,
    name: p.name,
    email: p.email || `${p.id}@placeholder.org`,
    role: p.role || "CLINICIAN",
    target_week_days: p.targetWeekDays,
    target_weekend_days: p.targetWeekendDays,
    target_week_nights: p.targetWeekNights,
    target_weekend_nights: p.targetWeekendNights,
    time_off_requests: p.timeOffRequests || [],
    preferred_dates: p.preferredDates || [],
    skills: p.skills || [],
    max_consecutive_nights: p.maxConsecutiveNights,
    min_days_off_after_night: p.minDaysOffAfterNight,
    credentials: p.credentials || [],
    scheduling_restrictions: p.schedulingRestrictions || {},
    notes: p.notes || null,
  };
}

function mapSlotRow(s) {
  return {
    id: s.id,
    date: s.date,
    type: s.type,
    providerId: s.provider_id,
    isWeekendLayout: s.is_weekend_layout,
    requiredSkill: s.required_skill,
    priority: s.priority,
    location: s.location,
    secondaryProviderIds: s.secondary_provider_ids || [],
    isSharedAssignment: s.is_shared_assignment || false,
    locationGroup: s.location_group,
    servicePriority: s.service_priority,
    serviceLocation: s.service_location,
  };
}

function mapSlotToRow(s) {
  return {
    id: s.id,
    date: s.date,
    type: s.type,
    provider_id: s.providerId || null,
    is_weekend_layout: Boolean(s.isWeekendLayout),
    required_skill: s.requiredSkill || null,
    priority: s.priority || "STANDARD",
    location: s.location || null,
    secondary_provider_ids: s.secondaryProviderIds || [],
    is_shared_assignment: Boolean(s.isSharedAssignment),
    location_group: s.locationGroup || null,
    service_priority: s.servicePriority || "STANDARD",
    service_location: s.serviceLocation || null,
  };
}

function mapScenarioRow(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    startDate: row.start_date,
    numWeeks: row.num_weeks,
    providers: row.providers || [],
    slots: row.slots || [],
  };
}

function mapScenarioToRow(scenario) {
  return {
    id: scenario.id,
    name: scenario.name,
    created_at: scenario.createdAt || new Date().toISOString(),
    start_date: scenario.startDate,
    num_weeks: scenario.numWeeks,
    providers: scenario.providers || [],
    slots: scenario.slots || [],
  };
}

function mapCustomRuleRow(row) {
  return {
    id: row.id,
    type: row.type,
    providerA: row.provider_a ?? undefined,
    providerB: row.provider_b ?? undefined,
    providerId: row.provider_id ?? undefined,
    maxShifts: row.max_shifts ?? undefined,
  };
}

function mapCustomRuleToRow(rule) {
  return {
    id: rule.id,
    type: rule.type,
    provider_a: rule.providerA ?? null,
    provider_b: rule.providerB ?? null,
    provider_id: rule.providerId ?? null,
    max_shifts: Number.isFinite(rule.maxShifts) ? rule.maxShifts : null,
  };
}

function mapAuditRow(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    action: row.action,
    details: row.details,
    slotId: row.slot_id ?? undefined,
    providerId: row.provider_id ?? undefined,
    user: row.actor ?? undefined,
  };
}

function mapAuditToRow(entry) {
  return {
    id: entry.id,
    timestamp: entry.timestamp || new Date().toISOString(),
    action: entry.action,
    // AI audit entries carry a structured `details` object; the column is TEXT.
    details: typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details ?? null),
    slot_id: entry.slotId ?? null,
    provider_id: entry.providerId ?? null,
    actor: entry.user ?? null,
  };
}

function buildInMemoryState() {
  const baseConfig = inMemoryStore.settings.get('schedule_config') || defaultScheduleConfig();
  return {
    startDate: baseConfig.startDate || defaultScheduleConfig().startDate,
    numWeeks: baseConfig.numWeeks || 4,
    scenarios: inMemoryStore.scenarios,
    customRules: inMemoryStore.customRules,
    auditLog: inMemoryStore.auditLog,
    providers: inMemoryStore.providers.length > 0 ? inMemoryStore.providers : baseProviders,
    slots: inMemoryStore.slots,
  };
}

async function readState() {
  const cached = getCachedState();
  if (cached) {
    return cached;
  }

  if (!hasValidSupabase) {
    const state = buildInMemoryState();
    setCachedState(state);
    return state;
  }

  try {
    // One round trip per table, all in flight together rather than serially.
    const [configRes, providersRes, slotsRes, scenariosRes, rulesRes, auditRes] = await Promise.all([
      supabase.from('global_settings').select('value').eq('key', 'schedule_config').maybeSingle(),
      supabase.from('providers').select('*'),
      supabase.from('slots').select('*'),
      supabase.from('scenarios').select('*').order('created_at', { ascending: false }),
      supabase.from('custom_rules').select('*'),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(AUDIT_LOG_LIMIT),
    ]);

    reportSupabaseError('read schedule_config', configRes.error);
    reportSupabaseError('read providers', providersRes.error);
    reportSupabaseError('read slots', slotsRes.error);
    reportSupabaseError('read scenarios', scenariosRes.error);
    reportSupabaseError('read custom_rules', rulesRes.error);
    reportSupabaseError('read audit_logs', auditRes.error);

    const baseState = configRes.data?.value || defaultScheduleConfig();
    const providers = (providersRes.data || []).map(mapProviderRow);
    const slots = (slotsRes.data || []).map(mapSlotRow);

    // Legacy fallback: a database still using the old nested-blob layout.
    const scenarios = scenariosRes.data?.length
      ? scenariosRes.data.map(mapScenarioRow)
      : (isArray(baseState.scenarios) ? baseState.scenarios : []);
    const customRules = rulesRes.data?.length
      ? rulesRes.data.map(mapCustomRuleRow)
      : (isArray(baseState.customRules) ? baseState.customRules : []);
    const auditLog = auditRes.data?.length
      ? auditRes.data.map(mapAuditRow)
      : (isArray(baseState.auditLog) ? baseState.auditLog : []);

    const result = {
      providers: providers.length > 0 ? providers : baseProviders,
      slots,
      startDate: baseState.startDate || defaultScheduleConfig().startDate,
      numWeeks: baseState.numWeeks || 4,
      scenarios,
      customRules,
      auditLog,
    };

    setCachedState(result);
    return result;
  } catch (error) {
    reportSupabaseError('read state', error);
    const fallback = buildInMemoryState();
    setCachedState(fallback);
    return fallback;
  }
}

/**
 * Replace the rows of `table` so they match `rows` exactly: upsert everything
 * incoming, then delete whatever is no longer present.
 */
async function syncTable(table, rows) {
  const incomingIds = new Set(rows.map((row) => row.id));

  for (const batch of chunk(rows)) {
    const { error } = await supabase.from(table).upsert(batch);
    if (reportSupabaseError(`upsert ${table}`, error)) return false;
  }

  const { data: existing, error: listError } = await supabase.from(table).select('id');
  if (reportSupabaseError(`list ${table} ids`, listError)) return false;

  const stale = (existing || []).map((row) => row.id).filter((id) => !incomingIds.has(id));
  for (const batch of chunk(stale)) {
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (reportSupabaseError(`delete ${table}`, error)) return false;
  }
  return true;
}

/** Primitive: persist schedule state to DB only. No email or audit. Use queueScheduleChangeEmails for notify. */
async function writeState(state) {
  const providers = isArray(state.providers) ? state.providers : [];
  const slots = isArray(state.slots) ? state.slots : [];
  const scenarios = isArray(state.scenarios) ? state.scenarios : [];
  const customRules = isArray(state.customRules) ? state.customRules : [];
  // The audit log is append-only and unbounded on the client; keep the most
  // recent window so a single write never grows without limit.
  const auditLog = (isArray(state.auditLog) ? state.auditLog : []).slice(0, AUDIT_LOG_LIMIT);

  inMemoryStore.providers = [...providers];
  inMemoryStore.slots = [...slots];
  inMemoryStore.scenarios = [...scenarios];
  inMemoryStore.customRules = [...customRules];
  inMemoryStore.auditLog = [...auditLog];
  inMemoryStore.settings.set('schedule_config', {
    startDate: state.startDate,
    numWeeks: state.numWeeks,
  });

  if (hasValidSupabase) {
    try {
      // slots.provider_id references providers, so providers must land first.
      // Everything after that is independent, so it goes out concurrently
      // instead of as five sequential round trips.
      if (providers.length > 0) {
        await syncTable('providers', providers.map(mapProviderToRow));
      }

      await Promise.all([
        syncTable('slots', slots.map(mapSlotToRow)),
        syncTable('scenarios', scenarios.map(mapScenarioToRow)),
        syncTable('custom_rules', customRules.map(mapCustomRuleToRow)),
        // Audit entries are append-only: upsert by id, never delete.
        (async () => {
          for (const batch of chunk(auditLog.map(mapAuditToRow))) {
            const { error } = await supabase.from('audit_logs').upsert(batch);
            reportSupabaseError('upsert audit_logs', error);
          }
        })(),
        (async () => {
          const { error } = await supabase.from("global_settings").upsert({
            key: "schedule_config",
            value: { startDate: state.startDate, numWeeks: state.numWeeks },
          });
          reportSupabaseError('upsert schedule_config', error);
        })(),
      ]);
    } catch (error) {
      reportSupabaseError('write state', error);
    }
  }

  invalidateCache();
}

// ---------------------------------------------------------------------------
// AI apply history
// ---------------------------------------------------------------------------
// Each entry embeds a full before/after schedule snapshot. These live in their
// own table so reads can be paginated and old entries pruned; previously the
// whole history was one JSON value in global_settings, rewritten on every
// apply. `global_settings.ai_apply_history` is still read once as a fallback so
// history written by the old layout is not lost.
function mapApplyHistoryRow(row) {
  return {
    id: row.id,
    timestamp: row.applied_at,
    approvedBy: row.approved_by,
    rolloutMode: row.rollout_mode,
    result: row.result || {},
    previousState: row.previous_state || {},
    appliedState: row.applied_state || {},
    rolledBackAt: row.rolled_back_at,
    rolledBackBy: row.rolled_back_by,
    rollbackReason: row.rollback_reason,
  };
}

function mapApplyHistoryToRow(entry) {
  return {
    id: entry.id,
    applied_at: entry.timestamp || new Date().toISOString(),
    approved_by: entry.approvedBy ?? null,
    rollout_mode: entry.rolloutMode || 'shadow',
    result: entry.result || {},
    previous_state: entry.previousState || {},
    applied_state: entry.appliedState || {},
    rolled_back_at: entry.rolledBackAt ?? null,
    rolled_back_by: entry.rolledBackBy ?? null,
    rollback_reason: entry.rollbackReason ?? null,
  };
}

async function readApplyHistory() {
  if (!hasValidSupabase) {
    const history = inMemoryStore.settings.get('ai_apply_history');
    return isArray(history) ? history : [];
  }

  const { data, error } = await supabase
    .from('ai_apply_history')
    .select('*')
    .order('applied_at', { ascending: true })
    .limit(APPLY_HISTORY_LIMIT);

  if (reportSupabaseError('read ai_apply_history', error)) {
    const history = await getSupabaseSetting('ai_apply_history', []);
    return isArray(history) ? history : [];
  }

  if (!data || data.length === 0) {
    // Legacy fallback for databases written before the table existed.
    const history = await getSupabaseSetting('ai_apply_history', []);
    return isArray(history) ? history : [];
  }

  return data.map(mapApplyHistoryRow);
}

async function writeApplyHistory(history) {
  const entries = (isArray(history) ? history : []).slice(-APPLY_HISTORY_LIMIT);
  inMemoryStore.settings.set('ai_apply_history', entries);
  if (!hasValidSupabase) return;

  for (const batch of chunk(entries.map(mapApplyHistoryToRow))) {
    const { error } = await supabase.from('ai_apply_history').upsert(batch);
    if (reportSupabaseError('upsert ai_apply_history', error)) {
      // Table unavailable — keep the previous blob behaviour so history survives.
      await setSupabaseSetting('ai_apply_history', entries);
      return;
    }
  }
}
async function readShiftRequests() {
  if (!hasValidSupabase) {
    return [...inMemoryStore.shiftRequests];
  }
  try {
    const { data, error } = await supabase
      .from("shift_requests")
      .select("*")
      .order("requested_at", { ascending: false });
    if (reportSupabaseError("read shift_requests", error)) return [...inMemoryStore.shiftRequests];
    return (data || []).map((entry) => ({
      id: entry.id,
      providerName: entry.provider_name || "",
      providerEmail: entry.provider_email || null,
      date: entry.date,
      type: entry.type,
      notes: entry.notes || "",
      deadlineAt: entry.deadline_at || null,
      status: entry.status,
      createdAt: entry.requested_at,
      reviewedAt: entry.resolved_at,
      reviewedBy: entry.resolved_by,
      source: entry.source || "app",
    }));
  } catch (error) {
    reportSupabaseError("read shift_requests", error);
    return [...inMemoryStore.shiftRequests];
  }
}

async function readEmailEvents() {
  if (!hasValidSupabase) {
    return [...inMemoryStore.emailEvents];
  }
  try {
    const { data, error } = await supabase
      .from("email_events")
      .select("*")
      .order("created_at", { ascending: false });
    if (reportSupabaseError("read email_events", error)) return [...inMemoryStore.emailEvents];
    return (data || []).map((entry) => ({
      id: entry.id,
      type: entry.type,
      status: entry.status,
      ...(entry.raw_payload && typeof entry.raw_payload === "object" ? entry.raw_payload : {}),
      createdAt: entry.created_at,
    }));
  } catch (error) {
    reportSupabaseError("read email_events", error);
    return [...inMemoryStore.emailEvents];
  }
}

async function readNotifications() {
  if (!hasValidSupabase) {
    return [...inMemoryStore.notifications];
  }
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (reportSupabaseError("read notifications", error)) return [...inMemoryStore.notifications];
    return (data || []).map((entry) => ({
      id: entry.id,
      eventType: entry.event_type || null,
      title: entry.title,
      body: entry.body,
      severity: entry.severity || "info",
      channels: isArray(entry.channels) ? entry.channels : [],
      statusByChannel: entry.status_by_channel && typeof entry.status_by_channel === "object" ? entry.status_by_channel : {},
      metadata: entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
      createdAt: entry.created_at,
    }));
  } catch (error) {
    reportSupabaseError("read notifications", error);
    return [...inMemoryStore.notifications];
  }
}

async function persistNotification(notification) {
  const notifObj = {
    id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    eventType: notification.eventType || null,
    title: notification.title,
    body: notification.body,
    severity: notification.severity || "info",
    channels: isArray(notification.channels) ? notification.channels : [],
    statusByChannel: notification.statusByChannel && typeof notification.statusByChannel === "object" ? notification.statusByChannel : {},
    metadata: notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {},
    createdAt: notification.createdAt || new Date().toISOString(),
  };

  inMemoryStore.notifications.unshift(notifObj);

  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          id: notifObj.id,
          event_type: notifObj.eventType,
          title: notifObj.title,
          body: notifObj.body,
          severity: notifObj.severity,
          channels: notifObj.channels,
          status_by_channel: notifObj.statusByChannel,
          metadata: notifObj.metadata,
        })
        .select()
        .single();
      if (!error && data) {
        return {
          id: data.id,
          eventType: data.event_type || null,
          title: data.title,
          body: data.body,
          severity: data.severity || "info",
          channels: isArray(data.channels) ? data.channels : [],
          statusByChannel: data.status_by_channel && typeof data.status_by_channel === "object" ? data.status_by_channel : {},
          metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
          createdAt: data.created_at,
        };
      }
    } catch {}
  }

  return notifObj;
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

  if (queued.length > 0) {
    for (const event of queued) {
      inMemoryStore.emailEvents.unshift({
        id: event.id,
        type: event.type,
        status: event.status,
        providerId: event.providerId,
        providerName: event.providerName,
        to: event.to,
        subject: event.subject,
        body: event.body,
        changes: event.changes,
        createdAt: event.createdAt,
      });
    }

    if (hasValidSupabase) {
      try {
        await supabase.from("email_events").insert(
          queued.map((event) => ({
            id: event.id,
            type: event.type,
            status: event.status,
            raw_payload: {
              providerId: event.providerId,
              providerName: event.providerName,
              to: event.to,
              subject: event.subject,
              body: event.body,
              changes: event.changes,
            },
          })),
        );
      } catch {}
    }
  }
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

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    ok: true,
    status: "ok",
    service: "nicu-scheduler-api",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: process.uptime(),
  });
});

/**
 * Database diagnostic. Reports whether Supabase is configured, which key kind
 * the server is authenticating with, and whether a representative read
 * actually returns rows. An anon key here is a misconfiguration: RLS grants
 * nothing to `anon`, so reads come back empty rather than erroring.
 */
app.get("/api/health/db", async (_req, res) => {
  const base = {
    configured: hasValidSupabase,
    keyKind: supabaseKeyKind,
    usingServiceRole: supabaseKeyKind === "service_role",
    lastError: lastSupabaseError,
  };

  if (!hasValidSupabase) {
    return res.json({
      ...base,
      ok: true,
      mode: "in-memory",
      warning: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Running with in-memory state only.",
    });
  }

  const { count, error } = await supabase
    .from("providers")
    .select("id", { count: "exact", head: true });

  if (error) {
    reportSupabaseError("health probe", error);
    return res.status(503).json({ ...base, ok: false, mode: "supabase", error: error.message });
  }

  return res.json({
    ...base,
    ok: true,
    mode: "supabase",
    providerCount: count ?? 0,
    warning:
      supabaseKeyKind === "anon"
        ? "Server is using an anon key. Row Level Security grants the anon role no access, so reads return empty and writes fail. Set SUPABASE_SERVICE_ROLE_KEY."
        : null,
  });
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
  await writeState(req.body); // primitive: write only
  const queuedEmails = await queueScheduleChangeEmails(previousState, req.body); // workflow: notify
  return res.json({ ok: true, queuedEmails: queuedEmails.length, updatedAt: new Date().toISOString() });
});

app.get("/api/schedule/scenarios", async (_req, res) => {
  const state = await readState();
  const scenarios = isArray(state.scenarios) ? state.scenarios : [];
  return res.json({ scenarios, total: scenarios.length, updatedAt: new Date().toISOString() });
});

app.get("/api/schedule/summary", async (_req, res) => {
  const state = await readState();
  const slots = isArray(state.slots) ? state.slots : [];
  const scenarios = isArray(state.scenarios) ? state.scenarios : [];
  return res.json({
    startDate: state.startDate,
    numWeeks: state.numWeeks,
    slotCount: slots.length,
    scenarioCount: scenarios.length,
    providerCount: isArray(state.providers) ? state.providers.length : 0,
    updatedAt: new Date().toISOString(),
  });
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

  let requestRecord;

  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("shift_requests")
        .insert({
          provider_name: req.body.providerName.trim(),
          provider_email: typeof req.body.providerEmail === "string" ? req.body.providerEmail.trim().toLowerCase() : null,
          date: req.body.date,
          type: req.body.type.toLowerCase(),
          notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
          deadline_at: typeof req.body.deadlineAt === "string" ? req.body.deadlineAt : null,
          source: req.body.source === "email" ? "email" : "app",
          status: "pending",
        })
        .select()
        .single();
      if (!error && data) {
        requestRecord = {
          id: data.id,
          providerName: data.provider_name,
          providerEmail: data.provider_email,
          date: data.date,
          type: data.type,
          notes: data.notes || "",
          deadlineAt: data.deadline_at,
          status: data.status,
          createdAt: data.requested_at,
          reviewedAt: data.resolved_at,
          reviewedBy: data.resolved_by,
          source: data.source || "app",
        };
      }
    } catch {}
  }

  if (!requestRecord) {
    requestRecord = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      providerName: req.body.providerName.trim(),
      providerEmail: typeof req.body.providerEmail === "string" ? req.body.providerEmail.trim().toLowerCase() : null,
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
    inMemoryStore.shiftRequests.unshift(requestRecord);
  }

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
  const persistedNotification = await persistNotification(notification);

  return res.status(201).json({ request: requestRecord, notification: persistedNotification, updatedAt: new Date().toISOString() });
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

  let requestRecord;

  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("shift_requests")
        .update({
          status,
          resolved_by: reviewedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();
      if (!error && data) {
        requestRecord = {
          id: data.id,
          providerName: data.provider_name,
          providerEmail: data.provider_email,
          date: data.date,
          type: data.type,
          notes: data.notes || "",
          deadlineAt: data.deadline_at,
          status: data.status,
          createdAt: data.requested_at,
          reviewedAt: data.resolved_at,
          reviewedBy: data.resolved_by,
          source: data.source || "app",
        };
      }
    } catch {}
  }

  if (!requestRecord) {
    const item = inMemoryStore.shiftRequests.find((r) => r.id === requestId);
    if (!item) {
      return res.status(404).json({ error: `Request not found for id ${requestId}.` });
    }
    item.status = status;
    item.reviewedBy = reviewedBy;
    item.reviewedAt = new Date().toISOString();
    requestRecord = item;
  }

  const notification = await dispatchNotification({
    eventType: "shift_request_reviewed",
    title: "Shift request reviewed",
    body: `${requestRecord.providerName} request for ${requestRecord.date} was ${status}.`,
    severity: status === "denied" ? "warning" : "info",
    channels: ["log"],
    metadata: {
      requestId,
      reviewedBy,
      status,
    },
  });
  const persistedNotification = await persistNotification(notification);

  return res.json({ request: requestRecord, notification: persistedNotification, updatedAt: new Date().toISOString() });
});

app.delete("/api/shift-requests/:id", async (req, res) => {
  const requestId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  if (!requestId) return res.status(400).json({ error: "Request id is required." });

  let deleted = false;
  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("shift_requests")
        .delete()
        .eq("id", requestId)
        .select()
        .single();
      if (!error && data) deleted = true;
    } catch {}
  }

  const idx = inMemoryStore.shiftRequests.findIndex((r) => r.id === requestId);
  if (idx !== -1) {
    inMemoryStore.shiftRequests.splice(idx, 1);
    deleted = true;
  }

  if (!deleted) {
    return res.status(404).json({ error: `Request not found for id ${requestId}.` });
  }

  return res.json({
    ok: true,
    deletedId: requestId,
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/notifications/channels", (_req, res) => {
  return res.json({
    capabilitySchemaVersion: "2026-03-04",
    channels: listNotificationChannels(),
    updatedAt: new Date().toISOString(),
  });
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

  const persistedNotification = await persistNotification(notification);
  return res.status(201).json({ notification: persistedNotification, updatedAt: new Date().toISOString() });
});

app.get("/api/notifications/history", async (req, res) => {
  const limit = Math.min(250, toPositiveInt(req.query?.limit, 50));
  const records = await readNotifications();
  return res.json({
    records: records.slice(0, limit),
    total: records.length,
    limit,
    updatedAt: new Date().toISOString(),
  });
});

app.patch("/api/notifications/:id", async (req, res) => {
  const notificationId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  if (!notificationId) return res.status(400).json({ error: "Notification id is required." });
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Notification patch payload must be an object." });
  }

  const updates = {};
  if (typeof req.body.title === "string") updates.title = req.body.title.trim();
  if (typeof req.body.body === "string") updates.body = req.body.body.trim();
  if (typeof req.body.severity === "string") {
    const severity = req.body.severity.trim().toLowerCase();
    if (!["info", "warning", "critical"].includes(severity)) {
      return res.status(400).json({ error: 'Field "severity" must be info, warning, or critical.' });
    }
    updates.severity = severity;
  }
  if (isArray(req.body.channels)) updates.channels = req.body.channels;
  if (req.body.statusByChannel && typeof req.body.statusByChannel === "object") {
    updates.status_by_channel = req.body.statusByChannel;
  }
  if (req.body.metadata && typeof req.body.metadata === "object") {
    updates.metadata = req.body.metadata;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid notification fields provided for update." });
  }

  let notification;
  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .update(updates)
        .eq("id", notificationId)
        .select()
        .single();
      if (!error && data) {
        notification = {
          id: data.id,
          eventType: data.event_type,
          title: data.title,
          body: data.body,
          severity: data.severity,
          channels: data.channels,
          statusByChannel: data.status_by_channel,
          metadata: data.metadata,
          createdAt: data.created_at,
        };
      }
    } catch {}
  }

  if (!notification) {
    const item = inMemoryStore.notifications.find((n) => n.id === notificationId);
    if (!item) {
      return res.status(404).json({ error: `Notification not found for id ${notificationId}.` });
    }
    if (updates.title) item.title = updates.title;
    if (updates.body) item.body = updates.body;
    if (updates.severity) item.severity = updates.severity;
    if (updates.channels) item.channels = updates.channels;
    if (updates.status_by_channel) item.statusByChannel = updates.status_by_channel;
    if (updates.metadata) item.metadata = updates.metadata;
    notification = item;
  }

  return res.json({ notification, updatedAt: new Date().toISOString() });
});

app.delete("/api/notifications/:id", async (req, res) => {
  const notificationId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  if (!notificationId) return res.status(400).json({ error: "Notification id is required." });

  let deleted = false;
  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .select()
        .single();
      if (!error && data) deleted = true;
    } catch {}
  }

  const idx = inMemoryStore.notifications.findIndex((n) => n.id === notificationId);
  if (idx !== -1) {
    inMemoryStore.notifications.splice(idx, 1);
    deleted = true;
  }

  if (!deleted) {
    return res.status(404).json({ error: `Notification not found for id ${notificationId}.` });
  }

  return res.json({
    ok: true,
    deletedId: notificationId,
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
    const persistedNotification = await persistNotification(notification);
    results.push(persistedNotification);
  }

  return res.json({
    dispatched: results.length,
    alertWindowHours,
    notifications: results,
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/solver/profiles", (_req, res) => {
  return res.json({
    capabilitySchemaVersion: "2026-03-04",
    profiles: listSolverProfiles(),
    updatedAt: new Date().toISOString(),
  });
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

app.patch("/api/email-events/:id", async (req, res) => {
  const eventId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  const status = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
  if (!eventId) return res.status(400).json({ error: "Email event id is required." });
  if (!status) return res.status(400).json({ error: 'Field "status" is required.' });

  let event;
  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("email_events")
        .update({ status })
        .eq("id", eventId)
        .select()
        .single();
      if (!error && data) {
        event = {
          id: data.id,
          type: data.type,
          status: data.status,
          ...(data.raw_payload && typeof data.raw_payload === "object" ? data.raw_payload : {}),
          createdAt: data.created_at,
        };
      }
    } catch {}
  }

  if (!event) {
    const item = inMemoryStore.emailEvents.find((e) => e.id === eventId);
    if (!item) {
      return res.status(404).json({ error: `Email event not found for id ${eventId}.` });
    }
    item.status = status;
    event = item;
  }

  return res.json({ event, updatedAt: new Date().toISOString() });
});

app.delete("/api/email-events/:id", async (req, res) => {
  const eventId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  if (!eventId) return res.status(400).json({ error: "Email event id is required." });

  let deleted = false;
  if (hasValidSupabase) {
    try {
      const { data, error } = await supabase
        .from("email_events")
        .delete()
        .eq("id", eventId)
        .select()
        .single();
      if (!error && data) deleted = true;
    } catch {}
  }

  const idx = inMemoryStore.emailEvents.findIndex((e) => e.id === eventId);
  if (idx !== -1) {
    inMemoryStore.emailEvents.splice(idx, 1);
    deleted = true;
  }

  if (!deleted) {
    return res.status(404).json({ error: `Email event not found for id ${eventId}.` });
  }

  return res.json({
    ok: true,
    deletedId: eventId,
    updatedAt: new Date().toISOString(),
  });
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

  let requestRecord;
  if (hasValidSupabase) {
    try {
      const { data: createdRequest, error: requestError } = await supabase
        .from("shift_requests")
        .insert({
          provider_id: provider.id,
          provider_name: provider.name,
          provider_email: provider.email || from,
          date: requestPayload.date,
          type: requestPayload.type.toLowerCase(),
          notes: requestPayload.notes,
          status: "pending",
          source: "email",
        })
        .select()
        .single();
      if (!requestError && createdRequest) {
        requestRecord = {
          id: createdRequest.id,
          providerName: createdRequest.provider_name,
          providerEmail: createdRequest.provider_email,
          date: createdRequest.date,
          type: createdRequest.type,
          notes: createdRequest.notes || "",
          deadlineAt: createdRequest.deadline_at,
          status: createdRequest.status,
          createdAt: createdRequest.requested_at,
          reviewedAt: createdRequest.resolved_at,
          reviewedBy: createdRequest.resolved_by,
          source: createdRequest.source || "email",
        };
      }
    } catch {}
  }

  if (!requestRecord) {
    requestRecord = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      providerName: provider.name,
      providerEmail: provider.email || from,
      date: requestPayload.date,
      type: requestPayload.type.toLowerCase(),
      notes: requestPayload.notes || "",
      deadlineAt: null,
      status: "pending",
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      source: "email",
    };
    inMemoryStore.shiftRequests.unshift(requestRecord);
  }

  const emailEventObj = {
    id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "inbound_request",
    status: "processed",
    raw_payload: {
      from,
      subject,
      requestId: requestRecord.id,
    },
    from,
    subject,
    requestId: requestRecord.id,
    createdAt: new Date().toISOString(),
  };
  inMemoryStore.emailEvents.unshift(emailEventObj);

  if (hasValidSupabase) {
    try {
      await supabase.from("email_events").insert({
        id: emailEventObj.id,
        type: "inbound_request",
        status: "processed",
        raw_payload: {
          from,
          subject,
          requestId: requestRecord.id,
        },
      });
    } catch {}
  }

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
  return res.json({
    capabilitySchemaVersion: "2026-03-04",
    providers: listProviders(),
    updatedAt: new Date().toISOString(),
  });
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

// ---------- Agent tools (typed primitives for AI/automation) ----------
// Primitives: capability-only (read/write/list). Workflows: orchestration (optimize, apply, notify).
app.get("/api/agent-tools", (_req, res) => {
  const tools = [
    { id: "schedule/assign-shift", method: "POST", path: "/api/agent-tools/schedule/assign-shift", description: "Assign a provider to a shift slot or clear the assignment.", params: { slotId: "string", providerId: "string | null" }, category: "primitive" },
    { id: "schedule/scenarios", method: "GET", path: "/api/schedule/scenarios", description: "List saved schedule scenarios.", params: {}, category: "primitive" },
    { id: "schedule/summary", method: "GET", path: "/api/schedule/summary", description: "Get schedule metadata (startDate, numWeeks, slotCount, scenarioCount).", params: {}, category: "primitive" },
    { id: "ai/agents/optimize/result", method: "GET", path: "/api/ai/agents/optimize/result", description: "Get last multi-agent optimization result (after POST optimize).", params: {}, category: "primitive" },
    { id: "ai/apply", method: "POST", path: "/api/ai/apply", description: "Apply an optimized schedule state (human_review rollout with approvedBy).", params: { result: "object", approvedBy: "string" }, category: "workflow" },
    { id: "state/read", method: "GET", path: "/api/state", description: "Read full schedule state (providers, slots, scenarios, customRules, auditLog, startDate, numWeeks).", params: {}, category: "primitive" },
    { id: "state/write", method: "PUT", path: "/api/state", description: "Write full schedule state. Triggers schedule-change notifications.", params: { state: "object" }, category: "workflow" },
    { id: "ai/agents/optimize", method: "POST", path: "/api/ai/agents/optimize", description: "Run multi-agent schedule optimization. Returns result; use ai/apply to apply.", params: { body: "object (scheduleState)" }, category: "workflow" },
    { id: "shift-requests/create", method: "POST", path: "/api/shift-requests", description: "Create a shift request.", params: { body: "object (request payload)" }, category: "primitive" },
    { id: "shift-requests/update", method: "PATCH", path: "/api/shift-requests/:id", description: "Update a shift request (e.g. approve/deny).", params: { id: "path", body: "object" }, category: "primitive" },
    { id: "notifications/send", method: "POST", path: "/api/notifications/send", description: "Send a notification.", params: { body: "object" }, category: "primitive" },
    { id: "notifications/update", method: "PATCH", path: "/api/notifications/:id", description: "Update a notification (e.g. mark read).", params: { id: "path", body: "object" }, category: "primitive" },
    { id: "notifications/delete", method: "DELETE", path: "/api/notifications/:id", description: "Delete a notification.", params: { id: "path" }, category: "primitive" },
    { id: "ai/forecast/read", method: "GET", path: "/api/ai/forecast", description: "Read demand forecast for a date range (query: startDate, days).", params: { startDate: "query", days: "query" }, category: "primitive" },
    { id: "ai/preferences/read", method: "GET", path: "/api/ai/preferences", description: "List all learned preference models.", params: {}, category: "primitive" },
    { id: "ai/preferences/read-one", method: "GET", path: "/api/ai/preferences/:providerId", description: "Read one provider's preference model.", params: { providerId: "path" }, category: "primitive" },
  ];
  res.json({
    tools,
    primitives: tools.filter((t) => t.category === "primitive").map((t) => t.id),
    workflows: tools.filter((t) => t.category === "workflow").map((t) => t.id),
    updatedAt: new Date().toISOString(),
  });
});

app.post("/api/agent-tools/schedule/assign-shift", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Body must be an object with slotId and providerId." });
  }
  const slotId = typeof req.body.slotId === "string" ? req.body.slotId.trim() : "";
  const providerId = req.body.providerId === null || req.body.providerId === undefined
    ? null
    : typeof req.body.providerId === "string" ? req.body.providerId.trim() : null;
  if (!slotId) {
    return res.status(400).json({ error: "slotId is required." });
  }
  const state = await readState();
  const slots = isArray(state.slots) ? state.slots : [];
  const slotIndex = slots.findIndex((s) => s && s.id === slotId);
  if (slotIndex < 0) {
    return res.status(404).json({ error: `Slot not found: ${slotId}.` });
  }
  const updated = slots.map((s, i) =>
    i === slotIndex ? { ...s, providerId: providerId || null } : s
  );
  await writeState({ ...state, slots: updated });
  return res.json({
    ok: true,
    slotId,
    providerId,
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
  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email address is required for registration." });
  }
  if (!VALID_PROVIDER_ROLES.has(role)) {
    return res.status(400).json({
      error: `Invalid role. Must be one of: ${[...VALID_PROVIDER_ROLES].join(", ")}`,
    });
  }

  // providers.email carries a unique index on lower(email); normalize so the
  // duplicate check here matches what the database will enforce.
  const normalizedEmail = email.trim().toLowerCase();

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
  const existing = providers.find(p => p.email?.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "Email already in use." });
  }

  const newProvider = {
    ...req.body,
    email: normalizedEmail,
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
    return res.status(400).json({ ok: false, error: "Chat payload must be an object.", code: "INVALID_PARAMETERS" });
  }

  const { message, context, conversationHistory } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ ok: false, error: "Message is required and must be a string.", code: "INVALID_PARAMETERS" });
  }

  try {
    const result = await processCopilotMessage({ message, context, conversationHistory });
    return res.json({
      ok: true,
      data: result,
      result,
      updatedAt: new Date().toISOString(),
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Copilot chat error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to process message",
      message: error instanceof Error ? error.message : "Unknown error",
      code: "COPILOT_ERROR",
    });
  }
});

// POST /api/copilot/intent - Parse intent only (no execution)
app.post("/api/copilot/intent", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ ok: false, error: "Intent payload must be an object.", code: "INVALID_PARAMETERS" });
  }

  // Accept either `text` (copilot client) or `message` (chat-style callers).
  const { context } = req.body;
  const text = typeof req.body.text === "string" ? req.body.text : req.body.message;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'A non-empty "text" (or "message") string is required.',
      code: "INVALID_PARAMETERS",
    });
  }

  try {
    const result = await parseIntent({ text, context });
    return res.json({
      ok: true,
      data: result,
      result,
      updatedAt: new Date().toISOString(),
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Intent parsing error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to parse intent",
      message: error instanceof Error ? error.message : "Unknown error",
      code: "INTENT_ERROR",
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

    // Suggestions are derived from the live schedule. Without this the
    // recommendation builder saw an undefined state and every suggestion was
    // computed against an empty schedule (0 providers, 0 slots, 0% coverage).
    const state = await readState();
    const result = await getCopilotSuggestions({ state, context });
    return res.json({
      ok: true,
      data: result,
      result,
      updatedAt: new Date().toISOString(),
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to get suggestions",
      message: error instanceof Error ? error.message : "Unknown error",
      code: "SUGGESTIONS_ERROR",
    });
  }
});

// GET /api/copilot/capabilities - Discover supported intents/actions
app.get("/api/copilot/capabilities", (_req, res) => {
  const capabilities = listCopilotCapabilities();
  return res.json({
    ok: true,
    data: capabilities,
    result: capabilities,
    updatedAt: new Date().toISOString(),
    meta: { timestamp: new Date().toISOString() },
  });
});

// Maps the orchestrator's fine-grained intents onto the coarse vocabulary the
// marketplace copilot client expects.
const COPILOT_QUERY_INTENT_MAP = {
  request_swap: "coverage_request",
  request_time_off: "availability_check",
  check_coverage: "schedule_query",
  assign_shift: "coverage_request",
  unassign_shift: "coverage_request",
  optimize_schedule: "schedule_query",
};

/**
 * POST /api/copilot/query — marketplace copilot.
 *
 * Answers "who can cover X" style questions: classifies the query, then ranks
 * providers who are actually available on the requested date, least-loaded
 * first. Ranking is deterministic and works with no AI provider configured.
 */
app.post("/api/copilot/query", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) {
    return res.status(400).json({ ok: false, error: 'A non-empty "query" string is required.', code: "INVALID_PARAMETERS" });
  }

  try {
    const parsed = await parseIntent({ text: query, context: req.body?.context || {} });
    const entities = parsed?.entities || {};
    const intent = COPILOT_QUERY_INTENT_MAP[parsed?.intent] || "unknown";

    const state = await readState();
    const providers = isArray(state.providers) ? state.providers : [];
    const slots = isArray(state.slots) ? state.slots : [];

    const dateRange = isArray(req.body?.context?.dateRange) ? req.body.context.dateRange : [];
    // Slots are keyed by ISO date, so only an ISO-shaped entity can be matched
    // against them. Relative phrases ("friday") fall through to the caller's
    // supplied dateRange rather than being treated as a real date.
    const isoDate = typeof entities.date === "string" && DATE_REGEX.test(entities.date) ? entities.date : null;
    const targetDate = isoDate || dateRange[0] || null;
    const shiftType = entities.shiftType || null;

    // Assignment load per provider, used to prefer the least-loaded candidates.
    const assignmentCount = new Map();
    const busyOnTargetDate = new Set();
    for (const slot of slots) {
      if (!slot?.providerId) continue;
      assignmentCount.set(slot.providerId, (assignmentCount.get(slot.providerId) || 0) + 1);
      if (targetDate && slot.date === targetDate) busyOnTargetDate.add(slot.providerId);
    }

    const maxLoad = Math.max(1, ...assignmentCount.values());

    const matches = providers
      .filter((provider) => {
        if (!provider?.id) return false;
        if (targetDate && busyOnTargetDate.has(provider.id)) return false;
        if (targetDate && isArray(provider.timeOffRequests) && provider.timeOffRequests.includes(targetDate)) return false;
        return true;
      })
      .map((provider) => {
        const load = assignmentCount.get(provider.id) || 0;
        // Availability weighs most; a light current load breaks ties.
        const loadScore = 1 - load / maxLoad;
        const skillScore = shiftType && isArray(provider.skills) && provider.skills.includes(shiftType) ? 0.2 : 0;
        return {
          providerId: provider.id,
          providerName: provider.name,
          score: Number(Math.min(1, 0.6 * loadScore + 0.2 + skillScore).toFixed(3)),
          availability: targetDate ? [targetDate] : [],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return res.json({
      query,
      intent,
      entities: {
        providerName: entities.providerName ?? undefined,
        date: targetDate ?? undefined,
        shiftType: shiftType ?? undefined,
      },
      matches,
      explanation: targetDate
        ? `${matches.length} provider(s) are unassigned and not on requested time off for ${targetDate}, ranked by lightest current schedule load.`
        : `No specific date was detected in the query, so all ${matches.length} provider(s) are ranked by current schedule load.`,
      source: parsed?.source || "deterministic-fallback",
    });
  } catch (error) {
    console.error("Copilot query failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to process copilot query",
      message: error instanceof Error ? error.message : "Unknown error",
      code: "COPILOT_QUERY_ERROR",
    });
  }
});

// GET /api/copilot/stream - SSE for streaming responses
app.get("/api/copilot/stream", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('retry: 3000\n\n');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Stream connected' })}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 25000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// ============ AI SERVICES ROUTES ============
// Import and register AI services routes
import { registerAIServicesRoutes } from './server/ai-services-routes.js';
import { registerSharedMemoryRoutes } from './server/shared-memory-routes.js';
import { registerAgentsRoutes } from './server/agents-routes.js';
import { registerMarketplaceRoutes } from './server/marketplace-routes.js';

// Register routes
registerAIServicesRoutes(app);
registerSharedMemoryRoutes(app);
registerAgentsRoutes(app);
registerMarketplaceRoutes(app, supabase);

console.log('[Server] AI services routes registered');

app.use(apiNotFoundHandler);
app.use(globalErrorHandler);

export default app;

/** Make the persistence mode obvious at boot instead of failing silently later. */
function logSupabaseStartupStatus() {
  if (!hasValidSupabase) {
    console.warn(
      "[Supabase] Not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). " +
        "Running with in-memory state — nothing is persisted across restarts.",
    );
    return;
  }
  if (supabaseKeyKind === "service_role") {
    console.log(`[Supabase] Connected to ${supabaseUrl} using the service role key.`);
    return;
  }
  console.warn(
    `[Supabase] Connected to ${supabaseUrl} using an ANON key. Row Level Security grants the ` +
      "anon role no access, so reads return empty result sets and writes are rejected. " +
      "Set SUPABASE_SERVICE_ROLE_KEY for the API server.",
  );
}

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    logSupabaseStartupStatus();
    console.log(`Scheduler API listening on http://localhost:${port}`);
  });
}
