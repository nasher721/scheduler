export interface PersistedScheduleState {
  providers: unknown[];
  startDate: string;
  numWeeks: number;
  slots: unknown[];
  scenarios: unknown[];
  customRules: unknown[];
  auditLog: unknown[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const DEFAULT_TIMEOUT_MS = 15_000;

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init.headers },
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : `Request failed (${response.status})`;
      throw new ApiError(response.status, message, body);
    }

    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, `Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

export async function saveScheduleState(state: PersistedScheduleState) {
  return apiFetch<{ ok: boolean; updatedAt: string }>("/api/state", {
    method: "PUT",
    body: JSON.stringify(state),
  });
}

export async function loadScheduleState() {
  return apiFetch<{ state: PersistedScheduleState | null; updatedAt: string }>("/api/state");
}

export async function checkHealth() {
  return apiFetch<{ ok: boolean; service: string }>("/api/health");
}

// ── AI: Metadata ──────────────────────────────────────────────────────────────

export async function listAiProviders() {
  return apiFetch<{ providers: unknown[] }>("/api/ai/providers");
}

export async function getAiMetrics() {
  return apiFetch<{ metrics: unknown; updatedAt: string }>("/api/ai/metrics");
}

export async function submitAiFeedback(payload: Record<string, unknown>) {
  return apiFetch<{ ok: boolean; recorded: unknown; updatedAt: string }>("/api/ai/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── AI: Schedule Operations ───────────────────────────────────────────────────

export async function getRecommendations(state: PersistedScheduleState) {
  return apiFetch<{ result: unknown; updatedAt: string }>("/api/ai/recommendations", {
    method: "POST",
    body: JSON.stringify(state),
  });
}

export async function optimizeSchedule(state: PersistedScheduleState, options?: Record<string, unknown>) {
  return apiFetch<{ result: unknown; updatedAt: string }>("/api/ai/optimize", {
    method: "POST",
    body: JSON.stringify(options ? { state, ...options } : state),
  });
}

export async function simulateScenario(state: PersistedScheduleState, scenario?: Record<string, unknown>) {
  return apiFetch<{ result: unknown; updatedAt: string }>("/api/ai/simulate", {
    method: "POST",
    body: JSON.stringify(scenario ? { state, ...scenario } : state),
  });
}

export async function detectConflicts(state: PersistedScheduleState) {
  return apiFetch<{ result: unknown; updatedAt: string }>("/api/ai/conflicts", {
    method: "POST",
    body: JSON.stringify(state),
  });
}

export async function explainDecision(payload: Record<string, unknown>) {
  return apiFetch<{ result: unknown; updatedAt: string }>("/api/ai/explain", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── AI: Apply / Rollback ──────────────────────────────────────────────────────

export async function applyOptimizedSchedule(
  result: Record<string, unknown>,
  approvedBy?: string,
) {
  return apiFetch<{
    ok: boolean;
    applyId: string;
    rolloutMode: string;
    approvedBy: string | null;
    state: PersistedScheduleState;
    updatedAt: string;
  }>("/api/ai/apply", {
    method: "POST",
    body: JSON.stringify({ result, approvedBy: approvedBy ?? "" }),
  });
}

export async function rollbackApply(
  applyId: string,
  rolledBackBy: string,
  reason?: string,
) {
  return apiFetch<{
    ok: boolean;
    applyId: string;
    rolledBackBy: string;
    state: PersistedScheduleState;
    updatedAt: string;
  }>("/api/ai/rollback", {
    method: "POST",
    body: JSON.stringify({ applyId, rolledBackBy, reason: reason ?? "" }),
  });
}

// ── AI: Apply History ─────────────────────────────────────────────────────────

export async function getApplyHistory(limit = 20, includeStates = false) {
  const params = new URLSearchParams({ limit: String(limit), includeStates: String(includeStates) });
  return apiFetch<{ records: unknown[]; total: number; limit: number; updatedAt: string }>(
    `/api/ai/apply-history?${params}`,
  );
}

export async function getApplyHistorySummary(days = 30) {
  const params = new URLSearchParams({ days: String(days) });
  return apiFetch<{ rangeDays: number; summary: unknown; updatedAt: string }>(
    `/api/ai/apply-history/summary?${params}`,
  );
}

export async function getApplyHistoryEntry(applyId: string, includeStates = false) {
  const params = new URLSearchParams({ includeStates: String(includeStates) });
  return apiFetch<{ record: unknown; updatedAt: string }>(
    `/api/ai/apply-history/${encodeURIComponent(applyId)}?${params}`,
  );
}
