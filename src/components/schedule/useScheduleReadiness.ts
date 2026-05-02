import { useMemo } from "react";
import type { Provider, ShiftSlot } from "@/store";
import { getProviderCounts } from "@/store";

export type ReadinessSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
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
  anomalyAlertCount,
  autoSaveStatus,
  isOnline,
}: UseScheduleReadinessArgs): ScheduleReadiness {
  return useMemo(() => {
    const assigned = slots.filter((slot) => slot?.providerId).length;
    const totalSlots = slots.length;
    const coverage = Math.round((assigned / Math.max(totalSlots, 1)) * 100);
    const counts = getProviderCounts(slots, providers);
    const criticalUnfilled = slots.filter((slot) => slot?.servicePriority === "CRITICAL" && !slot?.providerId).length;
    const skillMismatchRisk = slots.filter((slot) => {
      if (!slot?.providerId) return false;
      const provider = providers.find((entry) => entry.id === slot.providerId);
      return provider ? !(provider.skills ?? []).includes(slot.requiredSkill) : false;
    }).length;
    const fatigueExposure = providers.filter((provider) => {
      const providerCounts = counts[provider.id];
      return providerCounts && providerCounts.weekNights + providerCounts.weekendNights > provider.targetWeekNights;
    }).length;
    const alertCount = anomalyAlertCount + criticalUnfilled + skillMismatchRisk + fatigueExposure;
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
  }, [slots, providers, anomalyAlertCount, autoSaveStatus, isOnline]);
}

