import { ArrowUpRight, CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
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
    <section aria-label="Schedule Readiness Summary" className="workspace-summary rounded-xl border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-foreground-secondary"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />Planning window coverage</p>
        <p role="status" className="text-[11px] text-foreground-secondary">{readiness.syncLabel === "Ready" ? "" : readiness.syncLabel}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        <div className="flex flex-col justify-center gap-1">
          <span className="text-3xl font-medium tracking-tight tabular-nums text-primary sm:text-[34px]">{readiness.assigned}<span className="text-sm font-normal tracking-normal text-foreground-muted"> / {readiness.totalSlots}</span></span>
          <span className="text-xs text-foreground-secondary">Shifts assigned</span>
        </div>
        <button type="button" onClick={onViewOpenShifts} disabled={!open || !onViewOpenShifts} className="group flex min-h-11 flex-col justify-center gap-1 border-l border-border pl-3 text-left disabled:cursor-default sm:pl-6" aria-label={`View ${open} open shifts`}>
          <span className="flex w-full items-center justify-between text-3xl font-medium tracking-tight tabular-nums text-foreground sm:text-[34px]">{open}<CircleDashed className="mr-3 hidden h-5 w-5 text-foreground-muted sm:block" aria-hidden="true" /></span>
          <span className="text-xs text-foreground-secondary group-enabled:group-hover:text-primary">Open shifts</span>
        </button>
        <button type="button" onClick={onViewAlerts} className="group flex min-h-11 flex-col justify-center gap-1 border-l border-border pl-3 text-left sm:pl-6" aria-label={`Review ${readiness.alertCount} scheduling alerts`}>
          <span className="flex w-full items-center justify-between text-3xl font-medium tracking-tight tabular-nums text-foreground sm:text-[34px]">{readiness.alertCount}<ArrowUpRight className="hidden h-5 w-5 text-foreground-muted group-hover:text-primary sm:block" aria-hidden="true" /></span>
          <span className="text-xs text-foreground-secondary group-hover:text-primary">Need review</span>
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div role="progressbar" aria-label="Assigned shift coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.coverage} className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.max(0, readiness.coverage))}%` }} />
        </div>
        <span className="text-xs tabular-nums text-foreground-secondary">{readiness.coverage}% coverage</span>
      </div>
      {!readiness.hasSetupData && <p className="mt-3 text-sm text-foreground-secondary">Import an Excel workbook or add your physician team to begin.</p>}
      {readiness.totalSlots > 0 && open === 0 && readiness.alertCount === 0 && <p className="mt-3 flex items-center gap-2 text-sm text-foreground-secondary"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />Every shift has an assignment.</p>}
    </section>
  );
}
