import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  SearchCheck,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessSeverity, ScheduleReadiness } from "./useScheduleReadiness";

type SmokeStatus = "not_checked" | "passed" | "needs_attention";
type SmokeActionArea = "schedule" | "import" | "ai" | "export" | "staff" | "alerts";

interface SmokeChecklistItem {
  id: string;
  label: string;
  actionArea: SmokeActionArea;
  status: SmokeStatus;
  note: string;
  lastCheckedAt?: string;
}

interface AdminReadinessBannerProps {
  readiness: ScheduleReadiness;
  onViewAlerts: () => void;
}

const severityStyles: Record<ReadinessSeverity, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  error: "border-error/25 bg-error/10 text-error",
  info: "border-primary/20 bg-primary/10 text-primary",
};

const statusCopy: Record<SmokeStatus, string> = {
  not_checked: "Not checked",
  passed: "Passed",
  needs_attention: "Needs attention",
};

const initialChecklistItems: SmokeChecklistItem[] = [
  { id: "view-switch", label: "Schedule loads and switches between calendar/table", actionArea: "schedule", status: "not_checked", note: "" },
  { id: "import-preview", label: "Import opens preview and can be cancelled safely", actionArea: "import", status: "not_checked", note: "" },
  { id: "rollback-import", label: "Rollback import is disabled when unavailable and works after an import", actionArea: "import", status: "not_checked", note: "" },
  { id: "auto-fill", label: "Auto-Fill completes without crashing", actionArea: "schedule", status: "not_checked", note: "" },
  { id: "optimize", label: "Optimize opens a review preview or shows a clear failure", actionArea: "ai", status: "not_checked", note: "" },
  { id: "save", label: "Save reports success or clear failure", actionArea: "schedule", status: "not_checked", note: "" },
  { id: "scenarios", label: "Scenario save/load/delete still works", actionArea: "schedule", status: "not_checked", note: "" },
  { id: "export", label: "Export menu opens", actionArea: "export", status: "not_checked", note: "" },
  { id: "alerts", label: "Alerts button navigates to insights/alerts context", actionArea: "alerts", status: "not_checked", note: "" },
  { id: "ai-panel", label: "AI panel toggles", actionArea: "ai", status: "not_checked", note: "" },
  { id: "staff-panel", label: "Staff panel/sidebar toggles", actionArea: "staff", status: "not_checked", note: "" },
  { id: "undo-redo", label: "Undo/redo enablement behaves correctly", actionArea: "schedule", status: "not_checked", note: "" },
];

const valueTone: Record<ReadinessSeverity, string> = {
  success: "text-foreground",
  info: "text-foreground",
  warning: "text-warning",
  error: "text-error",
};

/**
 * One stat, stated as a phrase rather than a card. Six of these read as a
 * sentence; six colour-filled tiles read as an alarm going off.
 */
function ReadinessMetric({
  label,
  value,
  severity,
  onClick,
}: {
  label: string;
  value: string | number;
  severity: ReadinessSeverity;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={cn("text-[13px] font-semibold tabular-nums", valueTone[severity])}>{value}</span>
      <span className="text-[13px] text-foreground-tertiary">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-baseline gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-secondary/70"
      >
        {content}
      </button>
    );
  }

  return <div className="flex items-baseline gap-1.5 px-1 py-0.5">{content}</div>;
}

function formatCheckedAt(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function AdminSmokeChecklist({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<SmokeChecklistItem[]>(initialChecklistItems);
  const summary = useMemo(() => {
    const passed = items.filter((item) => item.status === "passed").length;
    const needsAttention = items.filter((item) => item.status === "needs_attention").length;
    return { passed, needsAttention, total: items.length };
  }, [items]);

  const updateItem = (id: string, updates: Partial<SmokeChecklistItem>) => {
    setItems((current) =>
      current.map((item) => (
        item.id === id
          ? {
              ...item,
              ...updates,
              lastCheckedAt: updates.status && updates.status !== "not_checked" ? new Date().toISOString() : item.lastCheckedAt,
            }
          : item
      ))
    );
  };

  const resetChecklist = () => {
    setItems(initialChecklistItems);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-3 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 bg-secondary/30">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Schedule QA Readiness Checklist</h2>
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {summary.passed}/{summary.total} verification points passed
              {summary.needsAttention > 0 ? ` • ${summary.needsAttention} require attention` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="command-icon" aria-label="Close QA checklist">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 max-h-[60vh] space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/80 bg-background/50 p-3 hover:border-border transition-colors">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{item.label}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">
                      {item.actionArea}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-foreground-muted">
                    {statusCopy[item.status]}
                    {item.lastCheckedAt ? ` at ${formatCheckedAt(item.lastCheckedAt)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { status: "passed" })}
                    className={cn("command-button text-xs py-1 px-2", item.status === "passed" && "bg-success/15 text-success border-success/30 font-semibold")}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Pass
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { status: "needs_attention" })}
                    className={cn("command-button text-xs py-1 px-2", item.status === "needs_attention" && "bg-error/15 text-error border-error/30 font-semibold")}
                  >
                    <XCircle className="h-3 w-3" />
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { status: "not_checked", lastCheckedAt: undefined })}
                    className="command-button text-xs py-1 px-2 text-foreground-muted"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={item.note}
                onChange={(event) => updateItem(item.id, { note: event.target.value })}
                placeholder="Optional notes / observations..."
                className="mt-2 w-full rounded border border-border/80 bg-surface px-2.5 py-1 text-xs text-foreground placeholder:text-foreground-muted/60 focus:border-primary focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 bg-secondary/20 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-foreground-muted">Session confirmation checklist for pre-publish safety checks.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetChecklist} className="command-button text-xs py-1">
              Reset All
            </button>
            <button type="button" onClick={onClose} className="command-button bg-primary text-primary-foreground text-xs py-1 hover:bg-primary/90">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminReadinessBanner({
  readiness,
  onViewAlerts,
}: AdminReadinessBannerProps) {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  return (
    <>
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1" aria-label="Schedule Readiness Summary">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold", severityStyles[readiness.severity])}>
            <SearchCheck className="h-3.5 w-3.5" />
            {readiness.statusLabel}
          </span>
          {!readiness.hasSetupData && (
            <span className="text-[13px] text-foreground-tertiary">Import a workbook or add staff to finish setup.</span>
          )}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-x-1 gap-y-1">
          <ReadinessMetric
            label="covered"
            value={`${readiness.coverage}%`}
            severity={readiness.coverage >= 95 ? "success" : readiness.coverage >= 50 ? "warning" : "error"}
          />
          <span className="text-foreground-muted/50">·</span>
          <ReadinessMetric
            label="filled"
            value={`${readiness.assigned}/${readiness.totalSlots}`}
            severity={readiness.hasSetupData ? "info" : "warning"}
          />
          <span className="text-foreground-muted/50">·</span>
          <ReadinessMetric
            label="critical gaps"
            value={readiness.criticalUnfilled}
            severity={readiness.criticalUnfilled > 0 ? "error" : "success"}
            onClick={readiness.criticalUnfilled > 0 ? onViewAlerts : undefined}
          />
          <span className="text-foreground-muted/50">·</span>
          <ReadinessMetric
            label="skill risks"
            value={readiness.skillMismatchRisk}
            severity={readiness.skillMismatchRisk > 0 ? "warning" : "success"}
            onClick={readiness.skillMismatchRisk > 0 ? onViewAlerts : undefined}
          />
          <span className="text-foreground-muted/50">·</span>
          <ReadinessMetric
            label="fatigue"
            value={readiness.fatigueExposure}
            severity={readiness.fatigueExposure > 0 ? "warning" : "success"}
            onClick={readiness.fatigueExposure > 0 ? onViewAlerts : undefined}
          />
          <span className="text-foreground-muted/50">·</span>
          <ReadinessMetric label="sync" value={readiness.syncLabel} severity={readiness.syncSeverity} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsChecklistOpen(true)}
            className="command-button text-xs py-1 font-semibold text-primary hover:bg-primary/10"
            title="Open Pre-Publish QA Checklist"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Pre-Publish QA
          </button>
          {readiness.alertCount > 0 && (
            <button
              type="button"
              onClick={onViewAlerts}
              className="command-button text-xs py-1 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
              title="View active alerts"
            >
              <Bell className="h-3.5 w-3.5" />
              {readiness.alertCount} alert{readiness.alertCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </section>

      <AdminSmokeChecklist isOpen={isChecklistOpen} onClose={() => setIsChecklistOpen(false)} />
    </>
  );
}
