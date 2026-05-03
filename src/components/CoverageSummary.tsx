import { useScheduleStore } from "../store";
import { buildScheduleRiskDigest } from "@/lib/scheduleRisk";

interface CoverageSummaryProps {
  className?: string;
}

export function CoverageSummary({ className }: CoverageSummaryProps) {
  const { slots, providers, customRules } = useScheduleStore();
  const safeSlots = Array.isArray(slots) ? slots : [];

  const riskDigest = buildScheduleRiskDigest(safeSlots, providers, customRules);
  const isCritical = riskDigest.criticalUnfilled.length > 0;
  const percentage = riskDigest.coveragePercent;
  const isLow = percentage < 50;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground-muted">Coverage</span>
          <span className={`font-semibold ${
            isLow ? 'text-error' : isCritical ? 'text-warning' : 'text-success'
          }`}>
            {riskDigest.filledSlots}/{riskDigest.totalSlots}
          </span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isLow ? 'bg-error' : isCritical ? 'bg-warning' : 'bg-success'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      {isCritical && (
        <div className="flex items-center gap-1 px-2 py-1 bg-error/10 text-error rounded-lg text-xs font-semibold">
          {riskDigest.criticalUnfilled.length} critical
        </div>
      )}
    </div>
  );
}
