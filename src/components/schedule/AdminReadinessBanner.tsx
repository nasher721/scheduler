import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  PanelLeftOpen,
  RefreshCcw,
  Save,
  SearchCheck,
  Sparkles,
  Upload,
  Users,
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
  canRollbackImport: boolean;
  isOptimizeBusy: boolean;
  isAiOpen: boolean;
  isStaffPanelOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  exportAction: ReactNode;
  onImport: () => void;
  onRollbackImport: () => void;
  onAutoFill: () => void;
  onOptimize: () => void;
  onSave: () => void;
  onViewAlerts: () => void;
  onToggleAi: () => void;
  onToggleStaff: () => void;
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
  const classes = cn(
    "flex min-h-[48px] min-w-[7rem] flex-1 flex-col justify-center rounded-lg border px-3 py-2 text-left",
    severityStyles[severity],
    onClick && "transition-colors hover:bg-surface/70"
  );

  const content = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">{label}</span>
      <span className="mt-1 text-base font-semibold leading-none tabular-nums">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
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
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Admin Smoke Checklist</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {summary.passed}/{summary.total} passed
              {summary.needsAttention > 0 ? `, ${summary.needsAttention} needs attention` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="command-icon" aria-label="Close QA checklist">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-muted">
                        {item.actionArea}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {statusCopy[item.status]}
                      {item.lastCheckedAt ? ` at ${formatCheckedAt(item.lastCheckedAt)}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, { status: "passed" })}
                      className={cn("command-button", item.status === "passed" && "bg-success/10 text-success")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, { status: "needs_attention" })}
                      className={cn("command-button", item.status === "needs_attention" && "bg-error/10 text-error")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, { status: "not_checked", lastCheckedAt: undefined })}
                      className="command-button"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <label className="mt-3 block">
                  <span className="sr-only">Note for {item.label}</span>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(event) => updateItem(item.id, { note: event.target.value })}
                    placeholder="Optional note"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-foreground-muted">Session-only confirmation. This is not a durable audit record.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetChecklist} className="command-button">
              Reset checklist
            </button>
            <button type="button" onClick={onClose} className="command-button bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground">
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
  canRollbackImport,
  isOptimizeBusy,
  isAiOpen,
  isStaffPanelOpen,
  canUndo,
  canRedo,
  exportAction,
  onImport,
  onRollbackImport,
  onAutoFill,
  onOptimize,
  onSave,
  onViewAlerts,
  onToggleAi,
  onToggleStaff,
}: AdminReadinessBannerProps) {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  return (
    <>
      <section className="satin-panel flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold", severityStyles[readiness.severity])}>
                <SearchCheck className="h-3.5 w-3.5" />
                {readiness.statusLabel}
              </span>
              {!readiness.hasSetupData && (
                <span className="text-sm font-medium text-foreground-muted">Import a workbook or add staff to start smoke confirmation.</span>
              )}
            </div>
            <h2 className="mt-2 text-base font-semibold text-foreground">Schedule readiness</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setIsChecklistOpen(true)} className="command-button bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground">
              <ClipboardCheck className="h-3.5 w-3.5" />
              QA Check
            </button>
            <button type="button" onClick={onViewAlerts} className={cn("command-button", readiness.alertCount > 0 && "bg-warning/10 text-warning")}>
              <Bell className="h-3.5 w-3.5" />
              Alerts
            </button>
            <button type="button" onClick={onToggleAi} className={cn("command-button", isAiOpen && "bg-primary text-primary-foreground")}>
              <Bot className="h-3.5 w-3.5" />
              AI
            </button>
            <button type="button" onClick={onToggleStaff} className={cn("command-button", isStaffPanelOpen && "bg-primary text-primary-foreground")}>
              <Users className="h-3.5 w-3.5" />
              Staff
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 2xl:flex-row">
          <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <ReadinessMetric label="Coverage" value={`${readiness.coverage}%`} severity={readiness.coverage >= 95 ? "success" : readiness.coverage >= 50 ? "warning" : "error"} />
            <ReadinessMetric label="Filled" value={`${readiness.assigned}/${readiness.totalSlots}`} severity={readiness.hasSetupData ? "info" : "warning"} />
            <ReadinessMetric label="Critical gaps" value={readiness.criticalUnfilled} severity={readiness.criticalUnfilled > 0 ? "error" : "success"} />
            <ReadinessMetric label="Skill risk" value={readiness.skillMismatchRisk} severity={readiness.skillMismatchRisk > 0 ? "warning" : "success"} />
            <ReadinessMetric label="Fatigue" value={readiness.fatigueExposure} severity={readiness.fatigueExposure > 0 ? "warning" : "success"} />
            <ReadinessMetric label="Sync" value={readiness.syncLabel} severity={readiness.syncSeverity} />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/35 p-2">
            <button type="button" onClick={onImport} className="command-button">
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
            <button type="button" onClick={onRollbackImport} disabled={!canRollbackImport} className="command-button disabled:opacity-40">
              <RefreshCcw className="h-3.5 w-3.5" />
              Rollback
            </button>
            <button type="button" onClick={onAutoFill} className="command-button text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Auto-Fill
            </button>
            <button type="button" onClick={onOptimize} disabled={isOptimizeBusy} className="command-button text-primary disabled:opacity-50">
              <Bot className="h-3.5 w-3.5" />
              {isOptimizeBusy ? "Optimizing" : "Optimize"}
            </button>
            <button type="button" onClick={onSave} disabled={!readiness.isOnline} className="command-button disabled:opacity-40">
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <div className="shrink-0">{exportAction}</div>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-foreground-muted">
              <PanelLeftOpen className="h-3.5 w-3.5" />
              Undo {canUndo ? "ready" : "idle"} / Redo {canRedo ? "ready" : "idle"}
            </span>
            {readiness.alertCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                <AlertCircle className="h-3.5 w-3.5" />
                {readiness.alertCount} total issue{readiness.alertCount === 1 ? "" : "s"}
              </span>
            )}
            {!readiness.hasSetupData && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                <FileCheck2 className="h-3.5 w-3.5" />
                Setup needed
              </span>
            )}
          </div>
        </div>
      </section>

      <AdminSmokeChecklist isOpen={isChecklistOpen} onClose={() => setIsChecklistOpen(false)} />
    </>
  );
}

