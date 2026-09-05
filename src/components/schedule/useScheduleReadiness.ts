import { useMemo } from "react";
import type { Provider, ShiftSlot, CustomRule } from "@/types";
import { buildAuthoritativeMetrics } from "@/lib/scheduleRisk";

export type ReadinessSaveStatus = "idle" | "pending" | "saving" | "saved" | "local" | "error";
export type ReadinessSeverity = "success" | "warning" | "error" | "info";

export interface ScheduleReadiness {
  assigned: number;
  totalSlots: number;
  coverage: number;
  criticalUnfilled: number;
  skillMismatchRisk: number;
  fatigueExposure: number;
  alertCount: number;
  hasSetupData: boolean;
  severity: ReadinessSeverity;
  statusLabel: string;
  syncLabel: string;
  syncSeverity: ReadinessSeverity;
  isOnline: boolean;
}

interface UseScheduleReadinessArgs {
  slots: ShiftSlot[];
  providers: Provider[];
  customRules?: CustomRule[];
  anomalyAlertCount: number;
  autoSaveStatus: ReadinessSaveStatus;
  isOnline: boolean;
}

function getSyncState(autoSaveStatus: ReadinessSaveStatus, isOnline: boolean): Pick<ScheduleReadiness, "syncLabel" | "syncSeverity"> {
  if (!isOnline) return { syncLabel: "Offline", syncSeverity: "error" };

  switch (autoSaveStatus) {
    case "pending":
      return { syncLabel: "Pending", syncSeverity: "warning" };
    case "saving":
      return { syncLabel: "Saving", syncSeverity: "info" };
    case "saved":
      return { syncLabel: "Saved", syncSeverity: "success" };
    case "local":
      return { syncLabel: "Saved on this device · cloud unavailable", syncSeverity: "warning" };
    case "error":
      return { syncLabel: "Save failed", syncSeverity: "error" };
    case "idle":
    default:
      return { syncLabel: "Ready", syncSeverity: "success" };
  }
}

export function useScheduleReadiness({
  slots,
  providers,
  customRules = [],
  anomalyAlertCount,
  autoSaveStatus,
  isOnline,
}: UseScheduleReadinessArgs): ScheduleReadiness {
  return useMemo(() => {
    const metrics = buildAuthoritativeMetrics(slots, providers, customRules, anomalyAlertCount);
    const assigned = metrics.filledSlots;
    const totalSlots = metrics.totalSlots;
    const coverage = metrics.coveragePercent;
    const criticalUnfilled = metrics.criticalUnfilledCount;
    const skillMismatchRisk = metrics.skillMismatchCount;
    const fatigueExposure = metrics.fatigueExposureCount;
    const alertCount = metrics.totalAlertCount;
    const hasSetupData = providers.length > 0 && totalSlots > 0;
    const sync = getSyncState(autoSaveStatus, isOnline);

    let severity: ReadinessSeverity = "success";
    let statusLabel = "Ready";

    if (!hasSetupData) {
      severity = "info";
      statusLabel = "Import or add staff to begin";
    } else if (!isOnline || sync.syncSeverity === "error" || criticalUnfilled > 0) {
      severity = "error";
      statusLabel = "Needs attention";
    } else if (coverage < 95 || skillMismatchRisk > 0 || fatigueExposure > 0 || anomalyAlertCount > 0) {
      severity = "warning";
      statusLabel = "Review recommended";
    }

    return {
      assigned,
      totalSlots,
      coverage,
      criticalUnfilled,
      skillMismatchRisk,
      fatigueExposure,
      alertCount,
      hasSetupData,
      severity,
      statusLabel,
      syncLabel: sync.syncLabel,
      syncSeverity: sync.syncSeverity,
      isOnline,
    };
  }, [slots, providers, customRules, anomalyAlertCount, autoSaveStatus, isOnline]);
}

