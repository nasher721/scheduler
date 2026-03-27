import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface NotificationBannerProps {
  criticalGaps: number;
  skillRisks: number;
  fatigueExposures: number;
  onViewDetails: () => void;
}

export function NotificationBanner({ criticalGaps, skillRisks, fatigueExposures, onViewDetails }: NotificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (criticalGaps === 0 && skillRisks === 0 && fatigueExposures === 0) return null;
  if (dismissed) return null;

  const total = criticalGaps + skillRisks + fatigueExposures;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3 dark:bg-amber-900/20 dark:border-amber-800">
      <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span>
          <span className="font-semibold">{total} alert{total !== 1 ? "s" : ""}</span>
          {": "}
          {criticalGaps > 0 && `${criticalGaps} critical gap${criticalGaps !== 1 ? "s" : ""}`}
          {criticalGaps > 0 && skillRisks > 0 && ", "}
          {skillRisks > 0 && `${skillRisks} skill risk${skillRisks !== 1 ? "s" : ""}`}
          {(criticalGaps > 0 || skillRisks > 0) && fatigueExposures > 0 && ", "}
          {fatigueExposures > 0 && `${fatigueExposures} fatigue exposure${fatigueExposures !== 1 ? "s" : ""}`}
          {" detected."}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onViewDetails}
          className="px-3 py-1 text-xs font-medium text-amber-800 border border-amber-300 rounded-full hover:bg-amber-100 transition-colors dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/30"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-amber-500 hover:text-amber-700 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
