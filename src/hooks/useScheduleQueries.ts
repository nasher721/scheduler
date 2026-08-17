import { useQuery } from "@tanstack/react-query";
import { fetchScheduleSummary } from "../lib/api/scheduleApi";
import { fetchScheduleScenarios } from "../lib/api/scheduleApi";
import { fetchLastOptimizationResult } from "../lib/api/scheduleApi";
import { fetchAgentTools } from "../lib/api/scheduleApi";
import { listShiftRequests } from "../lib/api/shiftRequests";
import { listNotificationHistory } from "../lib/api/notifications";
import { listEmailEvents } from "../lib/api/shiftRequests";
import { fetchApplyHistory } from "../lib/api/aiApplyHistory";
import { fetchApplyHistorySummary } from "../lib/api/aiApplyHistory";
import { getCopilotCapabilities } from "../lib/api/copilot";
import { getMarketplaceShifts } from "../lib/api/marketplace";
import { getBroadcastHistory } from "../lib/api/broadcast";
import type { ShiftRequestStatus, ShiftLifecycleStatus } from "../types";

// ───────────────────────────────────────────────
// Core schedule queries
// ───────────────────────────────────────────────

export function useScheduleSummaryQuery() {
  return useQuery({
    queryKey: ["schedule", "summary"],
    queryFn: fetchScheduleSummary,
  });
}

export function useScheduleScenariosQuery() {
  return useQuery({
    queryKey: ["schedule", "scenarios"],
    queryFn: fetchScheduleScenarios,
  });
}

export function useLastOptimizationResultQuery() {
  return useQuery({
    queryKey: ["schedule", "lastOptimization"],
    queryFn: fetchLastOptimizationResult,
  });
}

export function useAgentToolsQuery() {
  return useQuery({
    queryKey: ["agent", "tools"],
    queryFn: fetchAgentTools,
  });
}

// ───────────────────────────────────────────────
// Shift requests
// ───────────────────────────────────────────────

export function useShiftRequestsQuery(status?: ShiftRequestStatus) {
  return useQuery({
    queryKey: ["shiftRequests", status ?? "all"],
    queryFn: () => listShiftRequests(status),
  });
}

export function useEmailEventsQuery(requestId: string) {
  return useQuery({
    queryKey: ["emailEvents", requestId],
    queryFn: () => listEmailEvents(requestId),
    enabled: !!requestId,
  });
}

// ───────────────────────────────────────────────
// Notifications
// ───────────────────────────────────────────────

export function useNotificationHistoryQuery(limit: number = 50) {
  return useQuery({
    queryKey: ["notifications", "history", limit],
    queryFn: () => listNotificationHistory(limit),
  });
}

// ───────────────────────────────────────────────
// AI apply history
// ───────────────────────────────────────────────

export function useApplyHistoryQuery(limit: number = 50) {
  return useQuery({
    queryKey: ["ai", "applyHistory", limit],
    queryFn: () => fetchApplyHistory(limit),
  });
}

export function useApplyHistorySummaryQuery(days: number = 30) {
  return useQuery({
    queryKey: ["ai", "applyHistorySummary", days],
    queryFn: () => fetchApplyHistorySummary(days),
  });
}

// ───────────────────────────────────────────────
// Copilot capabilities
// ───────────────────────────────────────────────

export function useCopilotCapabilitiesQuery() {
  return useQuery({
    queryKey: ["copilot", "capabilities"],
    queryFn: getCopilotCapabilities,
  });
}

// ───────────────────────────────────────────────
// Marketplace
// ───────────────────────────────────────────────

export function useMarketplaceShiftsQuery(filters?: {
  status?: ShiftLifecycleStatus;
  postedByProviderId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["marketplace", "shifts", filters],
    queryFn: () => getMarketplaceShifts(filters),
  });
}

// ───────────────────────────────────────────────
// Broadcast history
// ───────────────────────────────────────────────

export function useBroadcastHistoryQuery(shiftId: string) {
  return useQuery({
    queryKey: ["broadcast", "history", shiftId],
    queryFn: () => getBroadcastHistory(shiftId),
    enabled: !!shiftId,
  });
}
