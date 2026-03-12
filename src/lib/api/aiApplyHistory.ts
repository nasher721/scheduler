/**
 * AI apply history API – list and summary for agent-native UI integration
 */

import { requestJson } from "./client";

export interface AiApplyRecord {
  id: string;
  timestamp: string;
  rolloutMode: string;
  approvedBy: string | null;
  rolledBackAt: string | null;
  objectiveScore?: number | null;
  confidenceScore?: number | null;
  hardViolationCount?: number | null;
}

export interface AiApplySummary {
  applyCount: number;
  rollbackCount: number;
  rollbackRate: number;
  avgObjectiveScore: number | null;
  avgConfidenceScore: number | null;
  avgHardViolationCount?: number | null;
  byRolloutMode?: Record<string, { applyCount: number; rollbackCount: number }>;
}

export interface ApplyHistoryResponse {
  records: AiApplyRecord[];
  total: number;
  totalAllTime: number;
  limit: number;
  updatedAt: string;
}

export interface ApplyHistorySummaryResponse {
  rangeDays: number;
  since: string;
  totalInRange: number;
  totalAllTime: number;
  summary: AiApplySummary;
  updatedAt: string;
}

export async function fetchApplyHistory(limit = 50): Promise<ApplyHistoryResponse> {
  return requestJson<ApplyHistoryResponse>(
    `/api/ai/apply-history?limit=${limit}`,
    { method: "GET" },
    "Fetch AI apply history"
  );
}

export async function fetchApplyHistorySummary(days = 30): Promise<ApplyHistorySummaryResponse> {
  return requestJson<ApplyHistorySummaryResponse>(
    `/api/ai/apply-history/summary?days=${days}`,
    { method: "GET" },
    "Fetch AI apply history summary"
  );
}
