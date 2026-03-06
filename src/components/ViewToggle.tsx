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
    <div className="satin-panel p-3 border-slate-200/50 rounded-2xl flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => onChange("schedule")}
          className={`nav-chip ${view === "schedule" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Schedule</span>
        </button>

        <button
          onClick={() => onChange("shift-requests")}
          className={`nav-chip ${view === "shift-requests" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Shift Requests</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
        <label className="relative flex items-center min-w-[180px]">
          <span className="sr-only">Open operations module</span>
          <select
            value={operationsValue}
            onChange={(e) => e.target.value && onChange(e.target.value as ViewMode)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-xs font-semibold text-slate-700"
            aria-label="Operations modules"
          >
            <option value="">Operations</option>
            {operationsViews.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 w-3.5 h-3.5 text-slate-400" />
        </label>

        <label className="relative flex items-center min-w-[180px]">
          <span className="sr-only">Open insights module</span>
          <select
            value={insightsValue}
            onChange={(e) => e.target.value && onChange(e.target.value as ViewMode)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-xs font-semibold text-slate-700"
            aria-label="Insights modules"
          >
            <option value="">Insights</option>
            {insightsViews.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 w-3.5 h-3.5 text-slate-400" />
        </label>
      </div>
    </div>
  );
}
