import { CalendarDays, Inbox, ChevronDown } from "lucide-react";

export type ViewMode =
  | "schedule"
  | "shift-requests"
  | "analytics"
  | "rules"
  | "strategy"
  | "swaps"
  | "holidays"
  | "conflicts"
  | "notifications"
  | "predictive"
  | "templates"
  | "ai-test";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

const operationsViews: Array<{ value: ViewMode; label: string }> = [
  { value: "rules", label: "Governance" },
  { value: "strategy", label: "Strategy" },
  { value: "swaps", label: "Swaps" },
  { value: "holidays", label: "Holidays" },
  { value: "conflicts", label: "Command" },
  { value: "templates", label: "Templates" },
];

const insightsViews: Array<{ value: ViewMode; label: string }> = [
  { value: "analytics", label: "Insights" },
  { value: "notifications", label: "Alerts" },
  { value: "predictive", label: "ML Insights" },
  { value: "ai-test", label: "AI Test" },
];

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const operationsValue = operationsViews.some((item) => item.value === view) ? view : "";
  const insightsValue = insightsViews.some((item) => item.value === view) ? view : "";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="flex w-full min-w-0 items-center gap-1 rounded-lg border border-border bg-secondary/50 p-0.5 sm:w-auto">
        <button
          onClick={() => onChange("schedule")}
          className={`nav-chip rounded-lg ${view === "schedule" ? "nav-chip-active" : ""}`}
          aria-current={view === "schedule" ? "page" : undefined}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Schedule
        </button>
        <button
          onClick={() => onChange("shift-requests")}
          className={`nav-chip rounded-lg ${view === "shift-requests" ? "nav-chip-active" : ""}`}
          aria-current={view === "shift-requests" ? "page" : undefined}
        >
          <Inbox className="w-3.5 h-3.5" />
          Shift requests
        </button>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative flex min-h-[44px] w-full min-w-0 items-center sm:min-w-[140px] sm:max-w-[min(100%,220px)]">
          <span className="sr-only">Operations</span>
          <select
            value={operationsValue}
            onChange={(e) => e.target.value && onChange(e.target.value as ViewMode)}
            className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            aria-label="Operations"
          >
            <option value="">Operations</option>
            {operationsViews.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 w-4 h-4 text-foreground-muted" />
        </label>
        <label className="relative flex min-h-[44px] w-full min-w-0 items-center sm:min-w-[140px] sm:max-w-[min(100%,220px)]">
          <span className="sr-only">Insights</span>
          <select
            value={insightsValue}
            onChange={(e) => e.target.value && onChange(e.target.value as ViewMode)}
            className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
            aria-label="Insights"
          >
            <option value="">Insights</option>
            {insightsViews.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 w-4 h-4 text-foreground-muted" />
        </label>
      </div>
    </div>
  );
}
