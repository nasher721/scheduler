export interface PersistedScheduleState {
  providers: unknown[];
  startDate: string;
  numWeeks: number;
  slots: unknown[];
  scenarios: unknown[];
  customRules: unknown[];
  auditLog: unknown[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function saveScheduleState(state: PersistedScheduleState) {
  const response = await fetch(`${API_BASE}/api/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(`Failed to save state (${response.status})`);
  return response.json();
}

export async function loadScheduleState() {
  const response = await fetch(`${API_BASE}/api/state`);
  if (!response.ok) throw new Error(`Failed to load state (${response.status})`);
  return response.json() as Promise<{ state: PersistedScheduleState | null }>;
}

// ── AI helpers ────────────────────────────────────────────────────────────────

export interface AiRecommendation {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  impact: string;
  affectedSlots?: string[];
  affectedProviders?: string[];
}

export interface AiConflict {
  id: string;
  type: string;
  severity: string;
  description: string;
  affectedSlots?: string[];
  affectedProviders?: string[];
  suggestedFix?: string;
}

export interface AiOptimizeResult {
  objectiveScore: number;
  changes: { slotId: string; previousProviderId: string | null; newProviderId: string | null; reason: string }[];
  optimizedState: PersistedScheduleState;
  guardrails: { hardViolationCount: number; softViolationCount: number };
  rollout: { mode: string; confidenceScore: number };
  explanation: string;
  source: string;
}

export interface ApplyHistoryRecord {
  id: string;
  timestamp: string;
  approvedBy: string | null;
  rolloutMode: string | null;
  objectiveScore: number | null;
  confidenceScore: number | null;
  hardViolationCount: number | null;
  rolledBackAt: string | null;
  rolledBackBy: string | null;
  rollbackReason: string | null;
  changeCount: number;
}

export interface AiProvider {
  id: string;
  name: string;
  available: boolean;
  description?: string;
}

async function aiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error((err as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function aiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error((err as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function getAiProviders(): Promise<{ providers: AiProvider[] }> {
  return aiGet("/api/ai/providers");
}

export async function getAiMetrics() {
  return aiGet("/api/ai/metrics");
}

export async function getAiRecommendations(state: PersistedScheduleState): Promise<{ result: { recommendations: AiRecommendation[]; source: string } }> {
  return aiPost("/api/ai/recommendations", state);
}

export async function runAiOptimize(state: PersistedScheduleState): Promise<{ result: AiOptimizeResult }> {
  return aiPost("/api/ai/optimize", state);
}

export async function detectAiConflicts(state: PersistedScheduleState): Promise<{ result: { conflicts: AiConflict[]; source: string } }> {
  return aiPost("/api/ai/conflicts", state);
}

export async function runAiSimulate(body: { state: PersistedScheduleState; scenario?: string }): Promise<{ result: unknown }> {
  return aiPost("/api/ai/simulate", body);
}

export async function getAiExplain(body: { slotId?: string; providerId?: string; state?: PersistedScheduleState }): Promise<{ result: { explanation: string; source: string } }> {
  return aiPost("/api/ai/explain", body);
}

export async function applyAiResult(body: { result: AiOptimizeResult; approvedBy?: string }): Promise<{ ok: boolean; applyId: string; rolloutMode: string; state: PersistedScheduleState }> {
  return aiPost("/api/ai/apply", body);
}

export async function rollbackAiApply(body: { applyId: string; rolledBackBy: string; reason?: string }): Promise<{ ok: boolean; applyId: string; state: PersistedScheduleState }> {
  return aiPost("/api/ai/rollback", body);
}

export async function getAiApplyHistory(params?: { limit?: number; rolloutMode?: string; rolledBack?: boolean }): Promise<{ records: ApplyHistoryRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.rolloutMode) qs.set("rolloutMode", params.rolloutMode);
  if (params?.rolledBack !== undefined) qs.set("rolledBack", String(params.rolledBack));
  const query = qs.toString();
  return aiGet(`/api/ai/apply-history${query ? `?${query}` : ""}`);
}

export async function getAiApplyHistorySummary(days = 30) {
  return aiGet(`/api/ai/apply-history/summary?days=${days}`);
}
