import type { CustomRule, Provider, ShiftSlot } from "@/types";
import { getProviderCounts } from "@/store";

export type RiskSeverity = "critical" | "warning" | "healthy";

export interface ProviderLoadSignal {
  providerId: string;
  providerName: string;
  totalAssigned: number;
  totalTarget: number;
  variance: number;
  nightAssigned: number;
  nightTarget: number;
  nightVariance: number;
}

export interface AuthoritativeScheduleMetrics {
  totalSlots: number;
  filledSlots: number;
  unfilledSlots: number;
  coveragePercent: number;
  criticalUnfilledCount: number;
  criticalUnfilledSlots: ShiftSlot[];
  skillMismatchCount: number;
  skillMismatches: Array<{ slot: ShiftSlot; provider: Provider }>;
  fatigueExposureCount: number;
  fatiguedProviders: ProviderLoadSignal[];
  overloadedProviders: ProviderLoadSignal[];
  providersWithoutNightFloat: Provider[];
  totalAlertCount: number;
  hasMaxShiftProtection: boolean;
  severity: RiskSeverity;
  recommendedActions: string[];
}

export interface ScheduleRiskDigest extends AuthoritativeScheduleMetrics {
  criticalUnfilled: ShiftSlot[];
  mostLoadedProvider: ProviderLoadSignal | null;
}

export function isCriticalCoverageSlot(
  slot: Pick<ShiftSlot, "priority" | "servicePriority"> & Partial<Pick<ShiftSlot, "locationGroup" | "serviceLocation">>
): boolean {
  if (slot.servicePriority === "CRITICAL" || slot.priority === "CRITICAL") return true;
  if (slot.locationGroup === "MAIN_CAMPUS_UNIT") return true;
  const loc = slot.serviceLocation;
  if (loc === "G20" || loc === "H22" || loc === "Akron") return true;
  return false;
}

export function getProviderLoadSignals(slots: ShiftSlot[], providers: Provider[]): ProviderLoadSignal[] {
  return providers
    .map((provider) => {
      const assignedSlots = slots.filter((slot) => slot.providerId === provider.id);
      const totalAssigned = assignedSlots.length;
      const totalTarget =
        provider.targetWeekDays +
        provider.targetWeekendDays +
        provider.targetWeekNights +
        provider.targetWeekendNights;
      const nightAssigned = assignedSlots.filter((slot) => slot.type === "NIGHT").length;
      const nightTarget = provider.targetWeekNights + provider.targetWeekendNights;

      return {
        providerId: provider.id,
        providerName: provider.name,
        totalAssigned,
        totalTarget,
        variance: totalAssigned - totalTarget,
        nightAssigned,
        nightTarget,
        nightVariance: nightAssigned - nightTarget,
      };
    })
    .sort((a, b) => b.variance - a.variance || b.totalAssigned - a.totalAssigned);
}

export function buildAuthoritativeMetrics(
  slots: ShiftSlot[],
  providers: Provider[],
  customRules: CustomRule[] = [],
  anomalyAlertCount: number = 0,
): AuthoritativeScheduleMetrics {
  const safeSlots = Array.isArray(slots) ? slots : [];
  const safeProviders = Array.isArray(providers) ? providers : [];
  const safeRules = Array.isArray(customRules) ? customRules : [];

  const totalSlots = safeSlots.length;
  const filledSlots = safeSlots.filter((slot) => !!slot.providerId).length;
  const unfilledSlots = totalSlots - filledSlots;
  const coveragePercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const criticalUnfilledSlots = safeSlots
    .filter((slot) => isCriticalCoverageSlot(slot) && !slot.providerId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const criticalUnfilledCount = criticalUnfilledSlots.length;

  const skillMismatches = safeSlots.flatMap((slot) => {
    if (!slot.providerId || !slot.requiredSkill) return [];
    const provider = safeProviders.find((candidate) => candidate.id === slot.providerId);
    if (!provider || (provider.skills ?? []).includes(slot.requiredSkill)) return [];
    return [{ slot, provider }];
  });
  const skillMismatchCount = skillMismatches.length;

  const counts = getProviderCounts(safeSlots, safeProviders);
  const loadSignals = getProviderLoadSignals(safeSlots, safeProviders);

  const fatiguedProviders = safeProviders
    .filter((provider) => {
      const pCounts = counts[provider.id];
      if (!pCounts) return false;
      const totalNights = pCounts.weekNights + pCounts.weekendNights;
      return totalNights > (provider.targetWeekNights + provider.targetWeekendNights);
    })
    .map((provider) => {
      const signal = loadSignals.find((s) => s.providerId === provider.id);
      return signal ?? {
        providerId: provider.id,
        providerName: provider.name,
        totalAssigned: 0,
        totalTarget: 0,
        variance: 0,
        nightAssigned: 0,
        nightTarget: 0,
        nightVariance: 0,
      };
    });
  const fatigueExposureCount = fatiguedProviders.length;

  const overloadedProviders = loadSignals.filter(
    (signal) => signal.variance > 0 || signal.nightVariance > 0,
  );

  const providersWithoutNightFloat = safeProviders.filter(
    (provider) => !(provider.skills ?? []).includes("NIGHT_FLOAT"),
  );

  const hasMaxShiftProtection = safeRules.some((rule) => rule.type === "MAX_SHIFTS_PER_WEEK");

  const totalAlertCount = criticalUnfilledCount + skillMismatchCount + fatigueExposureCount + (anomalyAlertCount || 0);

  let severity: RiskSeverity = "healthy";
  if (criticalUnfilledCount > 0 || coveragePercent < 80) {
    severity = "critical";
  } else if (skillMismatchCount > 0 || overloadedProviders.length > 0 || !hasMaxShiftProtection || totalAlertCount > 0) {
    severity = "warning";
  }

  const recommendedActions: string[] = [];
  if (criticalUnfilledCount > 0) {
    recommendedActions.push(`Fill ${criticalUnfilledCount} critical coverage gap${criticalUnfilledCount === 1 ? "" : "s"} first.`);
  }
  if (skillMismatchCount > 0) {
    recommendedActions.push(`Review ${skillMismatchCount} skill mismatch${skillMismatchCount === 1 ? "" : "es"} before publishing.`);
  }
  if (fatiguedProviders.length > 0) {
    recommendedActions.push(`Address fatigue exposure for ${fatiguedProviders.slice(0, 3).map((p) => p.providerName).join(", ")}.`);
  }
  if (overloadedProviders.length > 0 && fatiguedProviders.length === 0) {
    recommendedActions.push(`Add max-shift guardrails for ${overloadedProviders.slice(0, 3).map((p) => p.providerName).join(", ")}.`);
  }
  if (!hasMaxShiftProtection && safeProviders.length > 0) {
    recommendedActions.push("Add at least one weekly max-shift rule before optimizing.");
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Schedule is ready for export or scenario comparison.");
  }

  return {
    totalSlots,
    filledSlots,
    unfilledSlots,
    coveragePercent,
    criticalUnfilledCount,
    criticalUnfilledSlots,
    skillMismatchCount,
    skillMismatches,
    fatigueExposureCount,
    fatiguedProviders,
    overloadedProviders,
    providersWithoutNightFloat,
    totalAlertCount,
    hasMaxShiftProtection,
    severity,
    recommendedActions,
  };
}

export function buildScheduleRiskDigest(
  slots: ShiftSlot[],
  providers: Provider[],
  customRules: CustomRule[] = [],
  anomalyAlertCount: number = 0,
): ScheduleRiskDigest {
  const metrics = buildAuthoritativeMetrics(slots, providers, customRules, anomalyAlertCount);
  const loadSignals = getProviderLoadSignals(slots, providers);

  return {
    ...metrics,
    criticalUnfilled: metrics.criticalUnfilledSlots,
    mostLoadedProvider: loadSignals[0] ?? null,
  };
}

export function validateScheduleConsistency(
  slots: ShiftSlot[],
  providers: Provider[],
  customRules: CustomRule[] = []
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const metrics = buildAuthoritativeMetrics(slots, providers, customRules);

  if (metrics.criticalUnfilledCount > 0) {
    issues.push(`${metrics.criticalUnfilledCount} critical shift${metrics.criticalUnfilledCount > 1 ? "s" : ""} remain unassigned.`);
  }

  if (metrics.skillMismatchCount > 0) {
    issues.push(`${metrics.skillMismatchCount} assigned provider${metrics.skillMismatchCount > 1 ? "s do" : " does"} not meet required shift skills.`);
  }

  const invalidProviderIds = slots
    .filter((s) => s.providerId && !providers.some((p) => p.id === s.providerId))
    .map((s) => s.providerId as string);

  if (invalidProviderIds.length > 0) {
    issues.push(`${invalidProviderIds.length} slot(s) reference non-existent provider IDs.`);
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
