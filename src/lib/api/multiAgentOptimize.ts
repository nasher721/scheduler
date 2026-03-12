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
  const newSlots = (result.schedule?.slots ?? []) as Array<{ id: string; providerId?: string | null }>;
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
    coverageScore: Number(metrics.coverageScore) ?? 0,
    fairnessScore: Number(metrics.fairnessScore) ?? 0,
    fatigueScore: Number(metrics.fatigueScore) ?? 0,
    changes,
    warnings: result.decisions?.length ? [] : undefined,
  };
}

export async function applyOptimizationResult(
  result: MultiAgentOptimizeResult,
  approvedBy: string | null
): Promise<ApplyOptimizationResponse> {
  const payload = {
    result: {
      optimizedState: result.schedule,
      rollout: { mode: "human_review" as const, confidenceScore: result.metrics?.objectiveScore },
      objectiveScore: result.metrics?.objectiveScore ?? null,
      guardrails: { hardViolationCount: result.metrics?.hardViolationCount ?? 0 },
    },
    approvedBy: approvedBy ?? undefined,
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
