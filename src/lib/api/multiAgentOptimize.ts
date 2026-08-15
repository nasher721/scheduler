/**
 * Multi-agent optimization and apply API – wire optimizer result into main schedule workflow
 */

import { requestJson } from "./client";

export interface MultiAgentOptimizeResult {
  success: boolean;
  schedule: {
    providers: unknown[];
    slots: unknown[];
    startDate?: string;
    numWeeks?: number;
    scenarios?: unknown[];
    customRules?: unknown[];
    auditLog?: unknown[];
  };
  decisions?: unknown[];
  metrics?: Record<string, number>;
  agentResults?: Record<string, unknown>;
  iterations?: number;
  duration?: number;
  timestamp?: number;
}

export interface ApplyOptimizationResponse {
  ok: boolean;
  applyId: string;
  rolloutMode: string;
  approvedBy: string | null;
  state: {
    providers: unknown[];
    slots: unknown[];
    startDate?: string;
    numWeeks?: number;
    scenarios?: unknown[];
    customRules?: unknown[];
    auditLog?: unknown[];
  };
  updatedAt: string;
}

export async function multiAgentOptimize(scheduleState: unknown): Promise<MultiAgentOptimizeResult> {
  return requestJson<MultiAgentOptimizeResult>(
    "/api/ai/agents/optimize",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleState }),
    },
    "Multi-agent optimize"
  );
}

/** Build OptimizationPreview for ScheduleChangePreview from multi-agent result and current state */
export function buildOptimizationPreview(
  result: MultiAgentOptimizeResult,
  currentSlots: Array<{ id: string; providerId?: string | null }>,
  _providers: Array<{ id: string; name: string }>
): {
  objectiveScore: number;
  objectiveScoreBefore: number;
  coverageScore: number;
  fairnessScore: number;
  fatigueScore: number;
  changes: Array<{
    id: string;
    type: "assign" | "remove" | "swap" | "modify";
    slotId: string;
    fromProviderId?: string | null;
    toProviderId?: string | null;
    reason: string;
  }>;
  warnings?: string[];
} {
  const scheduleObj = result.schedule || (result as unknown as { optimizedState?: { slots?: unknown[] } }).optimizedState;
  const newSlots = (scheduleObj?.slots ?? []) as Array<{ id: string; providerId?: string | null }>;
  const byId = new Map(currentSlots.map((s) => [s.id, s]));
  const changes: Array<{
    id: string;
    type: "assign" | "remove" | "swap" | "modify";
    slotId: string;
    fromProviderId?: string | null;
    toProviderId?: string | null;
    reason: string;
  }> = [];
  newSlots.forEach((newSlot, idx) => {
    const cur = byId.get(newSlot.id);
    const from = cur?.providerId ?? null;
    const to = newSlot?.providerId ?? null;
    if (from !== to) {
      changes.push({
        id: `change-${newSlot.id}-${idx}`,
        type: to ? "assign" : "remove",
        slotId: newSlot.id,
        fromProviderId: from,
        toProviderId: to,
        reason: "Multi-agent optimization",
      });
    }
  });
  const metrics = result.metrics ?? {};
  return {
    objectiveScore: Number(metrics.objectiveScore) || 0,
    objectiveScoreBefore: 0,
    coverageScore: Number(metrics.coverageScore) || 0,
    fairnessScore: Number(metrics.fairnessScore) || 0,
    fatigueScore: Number(metrics.fatigueScore) || 0,
    changes,
    warnings: result.decisions?.length ? [] : undefined,
  };
}

export async function applyOptimizationResult(
  result: MultiAgentOptimizeResult,
  approvedBy: string | null
): Promise<ApplyOptimizationResponse> {
  const schedule = (result.schedule || (result as unknown as { optimizedState?: MultiAgentOptimizeResult["schedule"] }).optimizedState || {}) as Record<string, unknown>;
  const safeApprovedBy = (approvedBy && approvedBy.trim()) ? approvedBy.trim() : "Scheduler Admin";
  const payload = {
    result: {
      optimizedState: {
        ...schedule,
        providers: Array.isArray(schedule.providers) ? schedule.providers : [],
        slots: Array.isArray(schedule.slots) ? schedule.slots : [],
        scenarios: Array.isArray(schedule.scenarios) ? schedule.scenarios : [],
        customRules: Array.isArray(schedule.customRules) ? schedule.customRules : [],
        auditLog: Array.isArray(schedule.auditLog) ? schedule.auditLog : [],
        startDate: typeof schedule.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(schedule.startDate)
          ? schedule.startDate
          : new Date().toISOString().split("T")[0],
        numWeeks: Number.isInteger(schedule.numWeeks) && (Number(schedule.numWeeks) >= 1)
          ? Number(schedule.numWeeks)
          : 4,
      },
      rollout: { mode: "human_review" as const, confidenceScore: result.metrics?.objectiveScore },
      objectiveScore: result.metrics?.objectiveScore ?? null,
      guardrails: { hardViolationCount: result.metrics?.hardViolationCount ?? 0 },
    },
    approvedBy: safeApprovedBy,
  };
  return requestJson<ApplyOptimizationResponse>(
    "/api/ai/apply",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Apply optimization"
  );
}
