import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { ScheduleReadiness } from "./useScheduleReadiness";

interface AdminReadinessBannerProps {
  readiness: ScheduleReadiness;
  onViewAlerts: () => void;
  onViewOpenShifts?: () => void;
}

/** A single coverage summary for the complete planning window. */
export function AdminReadinessBanner({ readiness, onViewAlerts, onViewOpenShifts }: AdminReadinessBannerProps) {
  const open = Math.max(0, readiness.totalSlots - readiness.assigned);
  return (
    <section aria-label="Schedule Readiness Summary" className="rounded-lg border border-primary/20 bg-surface px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground-secondary">Planning window coverage</p>
        <p role="status" className="text-xs text-foreground-secondary">{readiness.syncLabel === "Ready" ? "" : readiness.syncLabel}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        <div className="flex flex-col justify-center gap-1 sm:flex-row sm:items-baseline sm:gap-2">
          <span className="text-xl font-semibold tabular-nums text-primary sm:text-2xl">{readiness.assigned}<span className="text-sm font-normal text-foreground-secondary"> / {readiness.totalSlots}</span></span>
          <span className="text-xs text-foreground-secondary sm:text-sm">assigned</span>
        </div>
        <button type="button" onClick={onViewOpenShifts} disabled={!open || !onViewOpenShifts} className="group flex min-h-11 flex-col justify-center gap-1 border-l border-border pl-3 text-left disabled:cursor-default sm:flex-row sm:items-baseline sm:gap-2 sm:pl-6" aria-label={`View ${open} open shifts`}>
          <span className="text-xl font-semibold tabular-nums text-primary sm:text-2xl">{open}</span>
          <span className="text-xs text-foreground-secondary group-enabled:group-hover:text-primary sm:text-sm">open shifts</span>
        </button>
        <button type="button" onClick={onViewAlerts} className="group flex min-h-11 flex-col justify-center gap-1 border-l border-border pl-3 text-left sm:flex-row sm:items-baseline sm:gap-2 sm:pl-6" aria-label={`Review ${readiness.alertCount} scheduling alerts`}>
          <span className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{readiness.alertCount}</span>
          <span className="flex items-center gap-1 text-xs text-foreground-secondary group-hover:text-primary sm:text-sm">need review<ArrowUpRight className="hidden h-3.5 w-3.5 sm:inline" aria-hidden="true" /></span>
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div role="progressbar" aria-label="Assigned shift coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.coverage} className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.max(0, readiness.coverage))}%` }} />
        </div>
        <span className="text-xs tabular-nums text-foreground-secondary">{readiness.coverage}% coverage</span>
      </div>
      {!readiness.hasSetupData && <p className="mt-3 text-sm text-foreground-secondary">Import an Excel workbook or add your physician team to begin.</p>}
      {readiness.totalSlots > 0 && open === 0 && readiness.alertCount === 0 && <p className="mt-3 flex items-center gap-2 text-sm text-foreground-secondary"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />Every shift has an assignment.</p>}
    </section>
  );
}
