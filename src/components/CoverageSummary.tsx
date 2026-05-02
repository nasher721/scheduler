import { useScheduleStore } from "../store";

interface CoverageSummaryProps {
  className?: string;
}

export function CoverageSummary({ className }: CoverageSummaryProps) {
  const slots = useScheduleStore((s) => s.slots);
  const safeSlots = Array.isArray(slots) ? slots : [];

  const totalSlots = safeSlots.length;
  const filledSlots = safeSlots.filter(s => s?.providerId).length;
  const criticalUnfilled = safeSlots.filter(s => 
    s?.priority === "CRITICAL" && !s?.providerId
  ).length;

  const percentage = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const isCritical = criticalUnfilled > 0;
  const isLow = percentage < 50;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground-muted">Coverage</span>
          <span className={`font-semibold ${
            isLow ? 'text-error' : isCritical ? 'text-warning' : 'text-success'
          }`}>
            {filledSlots}/{totalSlots}
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
          {criticalUnfilled} critical
        </div>
      )}
    </div>
  );
}
