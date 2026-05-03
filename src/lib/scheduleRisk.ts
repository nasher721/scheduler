import type { CustomRule, Provider, ShiftSlot } from "@/types";

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

export interface ScheduleRiskDigest {
  totalSlots: number;
  filledSlots: number;
  coveragePercent: number;
  criticalUnfilled: ShiftSlot[];
  skillMismatches: Array<{ slot: ShiftSlot; provider: Provider }>;
  providersWithoutNightFloat: Provider[];
  overloadedProviders: ProviderLoadSignal[];
  mostLoadedProvider: ProviderLoadSignal | null;
  hasMaxShiftProtection: boolean;
  severity: RiskSeverity;
  recommendedActions: string[];
}

export function isCriticalCoverageSlot(slot: Pick<ShiftSlot, "priority" | "servicePriority">): boolean {
  return slot.servicePriority === "CRITICAL" || slot.priority === "CRITICAL";
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

export function buildScheduleRiskDigest(
  slots: ShiftSlot[],
  providers: Provider[],
  customRules: CustomRule[],
): ScheduleRiskDigest {
  const filledSlots = slots.filter((slot) => !!slot.providerId).length;
  const criticalUnfilled = slots
    .filter((slot) => isCriticalCoverageSlot(slot) && !slot.providerId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const skillMismatches = slots.flatMap((slot) => {
    if (!slot.providerId || !slot.requiredSkill) return [];
    const provider = providers.find((candidate) => candidate.id === slot.providerId);
    if (!provider || provider.skills.includes(slot.requiredSkill)) return [];
    return [{ slot, provider }];
  });
  const providerLoadSignals = getProviderLoadSignals(slots, providers);
  const overloadedProviders = providerLoadSignals.filter(
    (signal) => signal.variance > 0 || signal.nightVariance > 0,
  );
  const providersWithoutNightFloat = providers.filter(
    (provider) => !provider.skills.includes("NIGHT_FLOAT"),
  );
  const hasMaxShiftProtection = customRules.some((rule) => rule.type === "MAX_SHIFTS_PER_WEEK");
  const coveragePercent = slots.length > 0 ? Math.round((filledSlots / slots.length) * 100) : 0;
  const severity: RiskSeverity =
    criticalUnfilled.length > 0 || coveragePercent < 80
      ? "critical"
      : skillMismatches.length > 0 || overloadedProviders.length > 0 || !hasMaxShiftProtection
        ? "warning"
        : "healthy";

  const recommendedActions: string[] = [];
  if (criticalUnfilled.length > 0) {
    recommendedActions.push(`Fill ${criticalUnfilled.length} critical coverage gap${criticalUnfilled.length === 1 ? "" : "s"} first.`);
  }
  if (skillMismatches.length > 0) {
    recommendedActions.push(`Review ${skillMismatches.length} skill mismatch${skillMismatches.length === 1 ? "" : "es"} before publishing.`);
  }
  if (overloadedProviders.length > 0) {
    recommendedActions.push(`Add max-shift guardrails for ${overloadedProviders.slice(0, 3).map((p) => p.providerName).join(", ")}.`);
  }
  if (!hasMaxShiftProtection && providers.length > 0) {
    recommendedActions.push("Add at least one weekly max-shift rule before optimizing.");
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Schedule is ready for export or scenario comparison.");
  }

  return {
    totalSlots: slots.length,
    filledSlots,
    coveragePercent,
    criticalUnfilled,
    skillMismatches,
    providersWithoutNightFloat,
    overloadedProviders,
    mostLoadedProvider: providerLoadSignals[0] ?? null,
    hasMaxShiftProtection,
    severity,
    recommendedActions,
  };
}
